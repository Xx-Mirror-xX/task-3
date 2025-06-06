const PaymentsModel = require('../models/PaymentsModel');
const axios = require('axios');

class PaymentsController {
    constructor() {
        this.model = new PaymentsModel();
        this.apiConfig = {
            baseURL: 'https://fakepayment.onrender.com',
            timeout: 10000,
            headers: {
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiZmFrZSBwYXltZW50IiwiZGF0ZSI6IjIwMjUtMDUtMzFUMDY6NTA6MDguODk0WiIsImlhdCI6MTc0ODY3NDIwOH0.qXRCwAZ7_6JawqcSVz3Wh9bBqXtyZYRZv5bI1MmjCag',
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


        if (cardNumber.length < 13 || cardNumber.length > 19) {
            return res.status(400).json({ error: "Número de tarjeta inválido" });
        }

        if (cvv.length < 3 || cvv.length > 4) {
            return res.status(400).json({ error: "CVV inválido" });
        }


        const amountValue = parseFloat(amount);
        if (amountValue <= 0) {
            return res.status(400).json({ error: "Monto Insuficiente" });
        }


            const localPaymentId = await this.model.addPayment({
                email, cardName, cardNumber, expiryMonth, expiryYear, cvv, 
                amount, currency, service
            });


            const paymentData = {
                "amount": parseFloat(amount),
                "card-number": cardNumber,
                "cvv": cvv,
                "expiration-month": expiryMonth,
                "expiration-year": expiryYear,
                "full-name": cardName,
                "currency": currency,
                "description": service,
                "reference": `local-${localPaymentId}`
            };

            try {

                const response = await axios.post(
                    `${this.apiConfig.baseURL}/payments`,
                    paymentData,
                    this.apiConfig
                );


                if (response.data.status === 'APPROVED') {
                    return res.status(201).json({ 
                        success: true,
                        paymentId: response.data.transaction_id || `local-${localPaymentId}`,
                        message: 'Pago procesado exitosamente',
                        details: response.data
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
            'REJECTED': 'Pago rechazado por el procesador',
            'ERROR': 'Error en el procesamiento del pago',
            'INSUFFICIENT': 'Fondos insuficientes',
            'INVALID_CARD': 'Tarjeta inválida',
            'EXPIRED_CARD': 'Tarjeta expirada'
        };

        const errorMessage = apiResponse.message || 
                           errorMessages[apiResponse.status] || 
                           'Error al procesar el pago';

        return res.status(400).json({
            success: false,
            paymentId: `local-${localPaymentId}`,
            error: errorMessage,
            details: apiResponse
        });
    }

    handleApiError(error, res, localPaymentId) {
        console.error('Error con la API de pagos:', error.message);

        if (error.response) {

            const errorData = error.response.data;
            const errorCodes = {
                '001': 'Número de tarjeta inválido',
                '002': 'Pago rechazado',
                '003': 'Error en el procesamiento',
                '004': 'Fondos insuficientes'
            };

            return res.status(400).json({
                success: false,
                paymentId: `local-${localPaymentId}`,
                error: errorCodes[errorData.error_code] || 'Error al procesar el pago',
                details: errorData
            });
        } else {

            return res.status(201).json({
                success: true,
                paymentId: `local-${localPaymentId}`,
                message: 'Pago registrado localmente (error en conexión con procesador de pagos)',
                warning: 'Por favor verifique el estado del pago más tarde'
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
