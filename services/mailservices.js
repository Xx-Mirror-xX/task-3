// mailservices.js
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;
require('dotenv').config();

const createTransporter = async () => {
    const oauth2Client = new OAuth2(
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET,
        "https://developers.google.com/oauthplayground"
    );

    oauth2Client.setCredentials({
        refresh_token: process.env.REFRESH_TOKEN
    });

    const accessToken = await new Promise((resolve, reject) => {
        oauth2Client.getAccessToken((err, token) => {
            if (err) {
                reject("Failed to create access token");
            }
            resolve(token);
        });
    });

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: 'xxsandovalluisxx@gmail.com',
            accessToken,
            clientId: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            refreshToken: process.env.REFRESH_TOKEN
        }
    });

    return transporter;
};

class MailService {
    constructor() {
        this.transporter = null;
        this.initializeTransporter();
    }

    async initializeTransporter() {
        this.transporter = await createTransporter();
    }

    async sendContactNotification(contactData) {
        if (!this.transporter) {
            await this.initializeTransporter();
        }

        try {
            const mailOptions = {
                from: `"Formulario de Contacto" <xxsandovalluisxx@gmail.com>`,
                to: 'xxsandovalluisxx@gmail.com', // Correo principal
                cc: 'xxsandovalluisxx@hotmail.com', // Correo secundario
                subject: 'Nuevo contacto recibido - Creating Social Network',
                html: `
                    <h2>Nuevo contacto recibido</h2>
                    <p><strong>Nombre:</strong> ${contactData.firstName} ${contactData.lastName}</p>
                    <p><strong>Email:</strong> ${contactData.email}</p>
                    <p><strong>Mensaje:</strong> ${contactData.message}</p>
                    <p><strong>Dirección IP:</strong> ${contactData.ipAddress}</p>
                    <p><strong>Ubicación:</strong> ${contactData.city || 'N/A'}, ${contactData.country || 'N/A'}</p>
                    <p><strong>Fecha/Hora:</strong> ${new Date(contactData.createdAt || new Date()).toLocaleString()}</p>
                    <hr>
                    <p>Este mensaje fue enviado desde el formulario de contacto de Creating Social Network</p>
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