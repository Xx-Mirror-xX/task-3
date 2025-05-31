// PaymentsController.js
const PaymentsModel = require('../models/PaymentsModel');
const path = require('path');
const axios = require('axios');

class PaymentsController {
    constructor() {
        this.model = new PaymentsModel();
    }

    async addPayment(req, res) {
        try {
            const {
                email,
                cardName,
                cardNumber,
                expiryMonth,
                expiryYear,
                cvv,
                amount,
                currency,
                service
            } = req.body;

            if (!email || !cardName || !cardNumber || !expiryMonth || 
                !expiryYear || !cvv || !amount || !currency || !service) {
                return res.status(400).json({ error: "Todos los campos son requeridos" });
            }

            // First save payment to local database
            const localPaymentId = await this.model.addPayment({
                email,
                cardName,
                cardNumber,
                expiryMonth,
                expiryYear,
                cvv,
                amount,
                currency,
                service
            });

            // Prepare data for Fake Payment API
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

            const config = {
                headers: {
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiZmFrZSBwYXltZW50IiwiZGF0ZSI6IjIwMjUtMDUtMzFUMDY6NTA6MDguODk0WiIsImlhdCI6MTc0ODY3NDIwOH0.qXRCwAZ7_6JawqcSVz3Wh9bBqXtyZYRZv5bI1MmjCag',
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10 seconds timeout
            };

            try {
                // Make request to Fake Payment API
                const paymentResponse = await axios.post('https://fakepayment.onrender.com/payments', paymentData, config);

                // Check response status
                if (paymentResponse.data && paymentResponse.data.status === 'APPROVED') {
                    return res.status(201).json({ 
                        success: true,
                        paymentId: paymentResponse.data.transaction_id || `local-${localPaymentId}`,
                        message: 'Pago procesado exitosamente',
                        details: paymentResponse.data
                    });
                } else {
                    // Payment was rejected or had an error
                    const errorMessage = paymentResponse.data.message || 
                                        (paymentResponse.data.status === 'REJECTED' ? 'Pago rechazado' : 
                                         paymentResponse.data.status === 'ERROR' ? 'Error en el procesamiento del pago' : 
                                         paymentResponse.data.status === 'INSUFFICIENT' ? 'Fondos insuficientes' : 
                                         'Error al procesar el pago');
                    
                    return res.status(400).json({ 
                        success: false,
                        error: errorMessage,
                        details: paymentResponse.data
                    });
                }
            } catch (apiError) {
                console.error('Error al conectar con la API de pagos:', apiError.message);
                
                if (apiError.response) {
                    // API returned an error response
                    const errorData = apiError.response.data;
                    let errorMessage = 'Error al procesar el pago';
                    
                    if (errorData.error_code === '001') errorMessage = 'Número de tarjeta inválido';
                    else if (errorData.error_code === '002') errorMessage = 'Pago rechazado';
                    else if (errorData.error_code === '003') errorMessage = 'Error en el procesamiento del pago';
                    else if (errorData.error_code === '004') errorMessage = 'Fondos insuficientes';
                    
                    return res.status(400).json({ 
                        success: false,
                        error: errorMessage,
                        details: errorData
                    });
                } else {
                    // Network or other error - payment was saved locally but API call failed
                    return res.status(201).json({ 
                        success: true,
                        paymentId: `local-${localPaymentId}`,
                        message: 'Pago registrado localmente (error en conexión con procesador de pagos)'
                    });
                }
            }
        } catch (error) {
            console.error('Error al procesar pago:', error);
            if (error.response) {
                res.status(error.response.status).json({ 
                    error: error.response.data.message || 'Error en el procesamiento del pago' 
                });
            } else {
                res.status(500).json({ 
                    error: 'Error interno del servidor al procesar el pago',
                    details: error.message 
                });
            }
        }
    }

    async index(req, res) {
        if (!req.session.userId) {
            return res.status(403).send('Acceso denegado');
        }
        res.sendFile(path.join(__dirname, '../public/payments.html'));
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
