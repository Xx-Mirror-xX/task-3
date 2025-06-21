const PaymentsModel = require('../models/PaymentsModel');
const axios = require('axios');

class PaymentsController {
    constructor() {
        this.model = new PaymentsModel();
        this.apiConfig = {
            baseURL: 'https://fakepayment.onrender.com',
            timeout: 10000,
            headers: {
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiZmFrZSBwYXltZW50IiwiZGF0ZSI6IjIwMjUtMDYtMjFUMDM6NTM6NTYuMzU5WiIsImlhdCI6MTc1MDQ3ODAzNn0.ZfPxNnfGQHcXANsG1r48yDYx2ElrWzpxTijillHQW9E',
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

            // Validaciones mejoradas
            const cleanedCardNumber = cardNumber.replace(/\s/g, '');
            if (!/^\d{13,19}$/.test(cleanedCardNumber)) {
                return res.status(400).json({ error: "Número de tarjeta inválido" });
            }

            if (!/^\d{3,4}$/.test(cvv)) {
                return res.status(400).json({ error: "CVV inválido" });
            }

            const amountValue = parseFloat(amount);
            if (isNaN(amountValue) || amountValue <= 0) {
                return res.status(400).json({ error: "Monto inválido" });
            }

            // Guardar en base de datos local primero
            const localPaymentId = await this.model.addPayment({
                email, cardName, cardNumber, expiryMonth, expiryYear, cvv, 
                amount: amountValue, currency, service
            });

            // Preparar datos según la nueva especificación
            const paymentData = {
                amount: amountValue,
                "card-number": cleanedCardNumber,
                cvv: cvv,
                "expiration-month": expiryMonth.toString().padStart(2, '0'),
                "expiration-year": expiryYear.toString(),
                "full-name": cardName, // Usaremos el nombre ingresado
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

                // Manejar diferentes respuestas de la API
                if (response.data.status === 'APPROVED') {
                    // Actualizar el pago en la base de datos local
                    await this.model.updatePayment(localPaymentId, {
                        transactionId: response.data.transaction_id,
                        status: 'completed'
                    });
                    
                    return res.status(201).json({ 
                        success: true,
                        paymentId: localPaymentId,
                        transactionId: response.data.transaction_id,
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
            'REJECTED': 'Pago rechazado por el procesador',
            'ERROR': 'Error en el procesamiento del pago',
            'INSUFFICIENT': 'Fondos insuficientes',
            'INVALID_CARD': 'Tarjeta inválida',
            'EXPIRED_CARD': 'Tarjeta expirada',
            '001': 'Número de tarjeta inválido',
            '002': 'Pago rechazado',
            '003': 'Error en el procesamiento',
            '004': 'Fondos insuficientes'
        };

        // Determinar el estado basado en el nombre o código de error
        let status = 'error';
        if (apiResponse.status) {
            status = apiResponse.status;
        } else if (apiResponse.error_code) {
            status = apiResponse.error_code;
        } else if (apiResponse.full_name) {
            // Si el nombre es una palabra clave especial
            const specialNames = ['APPROVED', 'REJECTED', 'ERROR', 'INSUFFICIENT'];
            if (specialNames.includes(apiResponse.full_name.toUpperCase())) {
                status = apiResponse.full_name.toUpperCase();
            }
        }

        const errorMessage = errorMessages[status] || 'Error al procesar el pago';

        // Actualizar estado en la base de datos
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

    handleApiError(error, res, localPaymentId) {
        console.error('Error con la API de pagos:', error.message);
        
        // Actualizar estado en la base de datos
        this.model.updatePayment(localPaymentId, {
            status: 'api_error',
            errorDetails: error.message
        });

        if (error.response) {
            // Error específico de la API
            const status = error.response.status;
            const errorData = error.response.data || {};
            
            return res.status(status).json({
                success: false,
                paymentId: localPaymentId,
                error: `Error en el procesador de pagos (${status})`,
                details: errorData
            });
        } else if (error.request) {
            // La solicitud fue hecha pero no hubo respuesta
            return res.status(503).json({
                success: false,
                paymentId: localPaymentId,
                error: 'El procesador de pagos no respondió',
                details: error.message
            });
        } else {
            // Error al configurar la solicitud
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
