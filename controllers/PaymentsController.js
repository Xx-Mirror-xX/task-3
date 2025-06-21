const PaymentsModel = require('../models/PaymentsModel');
const axios = require('axios');

class PaymentsController {
    constructor() {
        this.model = new PaymentsModel();
        this.apiConfig = {
            baseURL: 'https://fakepayment.onrender.com',
            timeout: 10000,
            headers: {
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiZmFrZSBwYXltZW50IiwiZGF0ZSI6IjIwMjUtMDYtMjFUMDA6NTk6MzEuNTIxWiIsImlhdCI6MTc1MDQ2NzU3MX0.7dmBc4cOLBIzGn46tof09GvBgaFPTXCXeUM6sP0slz4',
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
                    error: "Todos los campos son requeridos",
                    missingFields
                });
            }

            const { email, cardName, cardNumber, expiryMonth, expiryYear, cvv, 
                   amount, currency, service } = req.body;

            if (!/^\d{13,19}$/.test(cardNumber.replace(/\s/g, ''))) {
                return res.status(400).json({ error: "Número de tarjeta inválido" });
            }

            if (!/^\d{3,4}$/.test(cvv)) {
                return res.status(400).json({ error: "CVV inválido" });
            }

            const amountValue = parseFloat(amount);
            if (isNaN(amountValue) || amountValue <= 0) {
                return res.status(400).json({ error: "Monto inválido" });
            }

            const localPaymentId = await this.model.addPayment({
                email, cardName, cardNumber, expiryMonth, expiryYear, cvv, 
                amount: amountValue, currency, service
            });

            const paymentData = {
                amount: amountValue,
                "card-number": cardNumber.replace(/\s/g, ''),
                cvv: cvv,
                "expiration-month": expiryMonth,
                "expiration-year": expiryYear.toString().slice(-2),
                "full-name": cardName,
                currency: currency,
                description: service,
                reference: `local-${localPaymentId}`
            };

            try {
                const response = await axios.post(
                    `${this.apiConfig.baseURL}/payment`,
                    paymentData,
                    this.apiConfig
                );

                if (response.data.status === 'success') {
                    return res.status(201).json({ 
                        success: true,
                        paymentId: localPaymentId,
                        transactionId: response.data.transactionId,
                        message: 'Pago procesado exitosamente'
                    });
                } else {
                    return this.handlePaymentError(response.data, res, localPaymentId);
                }
            } catch (apiError) {
                return this.handleApiError(apiError, res, localPaymentId);
            }
        } catch (error) {
            console.error('Error al procesar pago:', error);
            return res.status(500).json({ 
                error: 'Error interno del servidor',
                details: error.message 
            });
        }
    }

    handlePaymentError(apiResponse, res, localPaymentId) {
        const errorMessages = {
            'failed': 'Pago rechazado por el procesador',
            'declined': 'Transacción declinada',
            'invalid_card': 'Tarjeta inválida',
            'expired_card': 'Tarjeta expirada',
            'insufficient_funds': 'Fondos insuficientes'
        };

        const status = apiResponse.status || 'error';
        const errorCode = apiResponse.errorCode || 'unknown';
        
        return res.status(400).json({
            success: false,
            paymentId: localPaymentId,
            error: errorMessages[errorCode] || `Error en el pago (${status})`,
            details: apiResponse
        });
    }

    handleApiError(error, res, localPaymentId) {
        console.error('Error con la API de pagos:', error.message);

        if (error.response) {
            const status = error.response.status;
            const errorData = error.response.data || {};
            
            return res.status(status).json({
                success: false,
                paymentId: localPaymentId,
                error: `Error en el procesador de pagos (${status})`,
                details: errorData
            });
        } else if (error.request) {
            return res.status(503).json({
                success: false,
                paymentId: localPaymentId,
                error: 'El procesador de pagos no respondió',
                details: error.message
            });
        } else {
            return res.status(500).json({
                success: false,
                paymentId: localPaymentId,
                error: 'Error al contactar el procesador de pagos',
                details: error.message
            });
        }
    }

    async getTransactionDetails(req, res) {
        try {
            const { transaction_id } = req.params;
            
            if (!transaction_id) {
                return res.status(400).json({ error: "Se requiere el ID de transacción" });
            }

            const response = await axios.get(
                `${this.apiConfig.baseURL}/payments/${transaction_id}`,
                this.apiConfig
            );
            
            res.json({
                success: true,
                transaction: response.data
            });
            
        } catch (error) {
            console.error('Error al obtener detalles:', error.message);
            
            if (error.response) {
                res.status(error.response.status).json({
                    success: false,
                    error: error.response.data.message || 'Error al obtener detalles',
                    details: error.response.data
                });
            } else {
                res.status(503).json({
                    success: false,
                    error: 'No se pudo conectar con el servicio de pagos',
                    details: error.message
                });
            }
        }
    }

    async index(req, res) {
        if (!req.session.userId) {
            return res.status(403).send('Acceso denegado');
        }
        res.sendFile(path.join(__dirname, '../public/admin/payments.html'));
    }

    async getPayments(req, res) {
        try {
            if (!req.session.userId) {
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
