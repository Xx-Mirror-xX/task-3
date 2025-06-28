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

                if (response.data.status === 'APPROVED') {
                    await this.model.updatePayment(localPaymentId, {
                        transactionId: response.data.transaction_id,
                        status: 'completed'
                    });
                    
                    return res.status(201).json({ 
                        success: true,
                        paymentId: localPaymentId,
                        transactionId: response.data.transaction_id,
                        message: req.__('Pago procesado exitosamente')
                    });
                } else {
                    return this.handlePaymentError(response.data, res, localPaymentId, req);
                }
            } catch (apiError) {
                if (apiError.code === 'ECONNABORTED') {
                    console.error(req.__('Timeout procesando pago [ID: %s]', localPaymentId));
                    await this.model.updatePayment(localPaymentId, {
                        status: 'timeout_error',
                        errorDetails: req.__("La API excedió el tiempo de espera")
                    });
                    
                    return res.status(504).json({
                        success: false,
                        paymentId: localPaymentId,
                        error: req.__('El procesador de pagos no respondió a tiempo'),
                        solution: req.__('Por favor intente nuevamente más tarde')
                    });
                }
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

    handlePaymentError(apiResponse, res, localPaymentId, req) {
        const errorMessages = {
            'REJECTED': req.__('Pago rechazado por el procesador'),
            'ERROR': req.__('Error en el procesamiento del pago'),
            'INSUFFICIENT': req.__('Fondos insuficientes'),
            'INVALID_CARD': req.__('Tarjeta inválida'),
            'EXPIRED_CARD': req.__('Tarjeta expirada'),
            '001': req.__('Número de tarjeta inválido'),
            '002': req.__('Pago rechazado'),
            '003': req.__('Error en el procesamiento'),
            '004': req.__('Fondos insuficientes'),
            'TIMEOUT': req.__('Tiempo de espera agotado')
        };

        let status = 'error';
        if (apiResponse.status) {
            status = apiResponse.status;
        } else if (apiResponse.error_code) {
            status = apiResponse.error_code;
        } else if (apiResponse.full_name) {
            const specialNames = ['APPROVED', 'REJECTED', 'ERROR', 'INSUFFICIENT'];
            if (specialNames.includes(apiResponse.full_name.toUpperCase())) {
                status = apiResponse.full_name.toUpperCase();
            }
        }

        const errorMessage = errorMessages[status] || req.__('Error al procesar el pago');

        this.model.updatePayment(localPaymentId, {
            status: status.toLowerCase(),
            errorDetails: JSON.stringify(apiResponse)
        });

        return res.status(400).json({
            success: false,
            paymentId: localPaymentId,
            error: errorMessage,
            details: apiResponse
        });
    }

    handleApiError(error, res, localPaymentId, req) {
        console.error(req.__('Error con la API de pagos: %s'), error.message);
        
        let status = 'api_error';
        let userMessage = req.__('Error al contactar el procesador de pagos');
        let statusCode = 500;

        if (error.response) {
            statusCode = error.response.status;
            userMessage = req.__('Error en el procesador (%s)', statusCode);
        } else if (error.request) {
            userMessage = req.__('El procesador de pagos no respondió');
            statusCode = 503;
        }

        this.model.updatePayment(localPaymentId, {
            status: status,
            errorDetails: error.message
        });

        return res.status(statusCode).json({
            success: false,
            paymentId: localPaymentId,
            error: userMessage,
            details: error.message
        });
    }

    async index(req, res) {
        if (!req.isAuthenticated() || !req.user.isAdmin) {
            return res.status(403).send('Acceso denegado');
        }
        res.render('admin/payments');
    }

    async getPayments(req, res) {
        try {
            if (!req.isAuthenticated() || !req.user.isAdmin) {
                return res.status(403).json({ error: 'No autorizado' });
            }
            
            const payments = await this.model.getAllPayments();
            res.json(payments);
        } catch (error) {
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
}

module.exports = PaymentsController;
