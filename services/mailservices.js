// mailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

class MailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail', // Puedes cambiarlo por tu proveedor de correo
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }

    async sendContactNotification(contactData) {
        try {
            const mailOptions = {
                from: `"Formulario de Contacto" <${process.env.EMAIL_USER}>`,
                to: 'xxsandovalluisxx@hotmail.com', // Destinatario principal
                bcc: process.env.ADDITIONAL_RECIPIENTS?.split(',') || [], // Destinatarios adicionales
                subject: 'Nuevo contacto recibido',
                html: `
                    <h1>Nuevo contacto recibido</h1>
                    <p><strong>Nombre:</strong> ${contactData.firstName} ${contactData.lastName}</p>
                    <p><strong>Email:</strong> ${contactData.email}</p>
                    <p><strong>Mensaje:</strong> ${contactData.message}</p>
                    <p><strong>Dirección IP:</strong> ${contactData.ipAddress}</p>
                    <p><strong>Ubicación:</strong> ${contactData.city}, ${contactData.country}</p>
                    <p><strong>Fecha/Hora:</strong> ${new Date(contactData.createdAt || new Date()).toLocaleString()}</p>
                `
            };

            await this.transporter.sendMail(mailOptions);
            console.log('Correo de notificación enviado');
        } catch (error) {
            console.error('Error al enviar correo de notificación:', error);
            throw error;
        }
    }
}

module.exports = new MailService();
