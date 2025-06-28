const PaymentsModel = require('../models/PaymentsModel');
const axios = require('axios');

class PaymentsController {
    constructor() {
        this.model = new PaymentsModel();
        this.apiConfig = {
            baseURL: 'https://fakepayment.onrender.com',
            timeout: 60000,
            headers: {
                'Authorization': `Bearer ${process.env.FAKE_PAYMENT_API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };
    }

    async addPayment(req, res) {
        try {
            const requiredFields = ['email', 'cardName', 'cardNumber', 'expiryMonth', 
                                  'expiryYear', 'cvv', 'amount', 'currency', 'service'];
            
            const missingFields = requiredFields.filter(field => !req.body[field]);
            if (missingFields.length > 0) {
                return res.status(400).json({ 
                    error: req.__("Todos los campos son requeridos"),
                    missingFields
                });
            }

            const { email, cardName, cardNumber, expiryMonth, expiryYear, cvv, 
                   amount, currency, service } = req.body;

            const cleanedCardNumber = cardNumber.replace(/\s/g, '');
            if (!/^\d{13,19}$/.test(cleanedCardNumber)) {
                return res.status(400).json({ error: req.__("Número de tarjeta inválido") });
            }

            if (!/^\d{3,4}$/.test(cvv)) {
                return res.status(400).json({ error: req.__("CVV inválido") });
            }

            const amountValue = parseFloat(amount);
            if (isNaN(amountValue) || amountValue <= 0) {
                return res.status(400).json({ error: req.__("Monto inválido") });
            }

            const localPaymentId = await this.model.addPayment({
                email, cardName, cardNumber, expiryMonth, expiryYear, cvv, 
                amount: amountValue, currency, service
            });

            const paymentData = {
                amount: amountValue,
                "card-number": cleanedCardNumber,
                cvv: cvv,
                "expiration-month": expiryMonth.toString().padStart(2, '0'),
                "expiration-year": expiryYear.toString(),
                "full-name": cardName,
                currency: currency,
                description: service,
                reference: `local-${localPaymentId}`
            };

            try {
                const response = await axios.post(
                    `${this.apiConfig.baseURL}/payments`,
                    paymentData,
                    this.apiConfig
                );

                const responseStatus = response.data.status || response.data.full_name;
                
                if (responseStatus === 'APPROVED') {
                    await this.model.updatePayment(localPaymentId, {
                        transactionId: response.data.transaction_id,
                        status: 'completed'
                    });
                    
                    return res.status(201).json({ 
                        success: true,
                        paymentId: localPaymentId,
                        transactionId: response.data.transaction_id,
                        message: req.__('Pago procesado exitosamente'),
                        details: req.__('Payment successful')
                    });
                } else {
                    return this.handlePaymentResponse(response.data, res, localPaymentId, req);
                }
            } catch (apiError) {
                return this.handleApiError(apiError, res, localPaymentId, req);
            }
        } catch (error) {
            console.error(req.__('Error al procesar pago: %s'), error.message);
            return res.status(500).json({ 
                error: req.__('Error interno del servidor'),
                details: error.message 
            });
        }
    }

    handlePaymentResponse(apiResponse, res, localPaymentId, req) {
        const responseMap = {
            'APPROVED': {
                status: 'completed',
                message: req.__('Pago aprobado'),
                details: req.__('Payment successful')
            },
            'REJECTED': {
                status: 'rejected',
                message: req.__('Pago rechazado'),
                details: req.__('Código: 002')
            },
            'ERROR': {
                status: 'failed',
                message: req.__('Error en el pago'),
                details: req.__('Código: 003')
            },
            'INSUFFICIENT': {
                status: 'failed',
                message: req.__('Fondos insuficientes'),
                details: req.__('Código: 004')
            }
        };

        const responseStatus = apiResponse.status || apiResponse.full_name || 'ERROR';
        const result = responseMap[responseStatus] || responseMap['ERROR'];

        this.model.updatePayment(localPaymentId, {
            status: result.status,
            transactionId: apiResponse.transaction_id || 'N/A',
            errorDetails: JSON.stringify(apiResponse)
        });

        return res.status(200).json({
            success: false,
            paymentId: localPaymentId,
            status: result.status,
            message: result.message,
            details: result.details,
            apiResponse: apiResponse
        });
    }

    handleApiError(error, res, localPaymentId, req) {
        let status = 'api_error';
        let userMessage = req.__('Error con la API de pagos');
        let statusCode = 500;
        let errorDetails = '';

        if (error.response) {
            statusCode = error.response.status;
            
            if (statusCode === 400) {
                userMessage = req.__('Solicitud incorrecta a la API de pagos');
                
                if (error.response.data) {
                    if (typeof error.response.data === 'string') {
                        errorDetails = error.response.data;
                    } else if (error.response.data.error) {
                        errorDetails = error.response.data.error;
                    } else if (error.response.data.message) {
                        errorDetails = error.response.data.message;
                    } else {
                        try {
                            errorDetails = JSON.stringify(error.response.data);
                        } catch (e) {
                            errorDetails = error.response.data.toString();
                        }
                    }
                }
            } else {
                userMessage = req.__('Error en el procesador (%s)', statusCode);
                errorDetails = error.response.data || error.message;
            }
        } else if (error.request) {
            userMessage = req.__('El procesador de pagos no respondió');
            statusCode = 503;
            errorDetails = error.message;
        } else if (error.code === 'ECONNABORTED') {
            userMessage = req.__('Tiempo de espera agotado');
            statusCode = 504;
            status = 'timeout_error';
            errorDetails = error.message;
        } else {
            errorDetails = error.message;
        }

        console.error(`${userMessage}: ${errorDetails}`);
        
        this.model.updatePayment(localPaymentId, {
            status: status,
            errorDetails: errorDetails
        });

        return res.status(statusCode).json({
            success: false,
            paymentId: localPaymentId,
            error: userMessage,
            details: errorDetails
        });
    }

    async index(req, res) {
        if (!req.isAuthenticated() || !req.user.isAdmin) {
            return res.status(403).send(req.__('Acceso denegado'));
        }
        res.render('admin/payments', { lang: req.getLocale() });
    }

    async getPayments(req, res) {
        try {
            if (!req.isAuthenticated() || !req.user.isAdmin) {
                return res.status(403).json({ error: req.__('No autorizado') });
            }
            
            const payments = await this.model.getAllPayments();
            res.json(payments);
        } catch (error) {
            res.status(500).json({ error: req.__('Error del servidor') });
        }
    }
}

module.exports = PaymentsController;
