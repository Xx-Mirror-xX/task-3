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

            // Primero guardamos el pago en la base de datos local
            await this.model.addPayment({
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

            // Configuración para la solicitud a la API de pagos
            const paymentData = {
                cardNumber,
                cardName,
                expiryDate: `${expiryMonth}/${expiryYear}`,
                cvv,
                amount,
                currency
            };

            const config = {
                headers: {
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiZmFrZSBwYXltZW50IiwiZGF0ZSI6IjIwMjUtMDUtMjdUMDg6NTM6MDguMDY4WiIsImlhdCI6MTc0ODMzNTk4OH0.S6yNoBe0VKc_nAB34NN1in9lOkx58apjS3eixaVQggA',
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10 segundos de timeout
            };

            // Intentamos conectar con la API de pagos
            try {
                const fakePaymentResponse = await axios.post('https://fakepayment.onrender.com/payment', paymentData, config);

                if (!fakePaymentResponse.data.success) {
                    console.error('Error en el pago:', fakePaymentResponse.data.message);
                    return res.status(400).json({ 
                        error: fakePaymentResponse.data.message || 'Error al procesar el pago' 
                    });
                }

                res.status(201).json({ 
                    success: true,
                    paymentId: fakePaymentResponse.data.paymentId,
                    message: 'Pago procesado exitosamente'
                });
            } catch (apiError) {
                console.error('Error al conectar con la API de pagos:', apiError.message);
                // Aunque falló la API externa, el pago se guardó localmente
                res.status(201).json({ 
                    success: true,
                    paymentId: 'local-' + Date.now(),
                    message: 'Pago registrado localmente (error en conexión con procesador de pagos)'
                });
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