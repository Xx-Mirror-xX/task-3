const ContactsModel = require('../models/ContactsModel');
const path = require('path');
const axios = require('axios');
const mailService = require('../services/mailService'); 

mailService.sendContactNotification(contactData)
    .then(() => console.log('Correo enviado exitosamente'))
    .catch(err => {
        console.error('Error al enviar correo:', err);
    });

class ContactsController {
    constructor() {
        this.model = new ContactsModel();
    }

  async addContact(req, res) {
        try {
            const { firstName, lastName, email, message } = req.body;
            
            if (!firstName || !lastName || !email || !message) {
                return res.status(400).json({ 
                    error: "Todos los campos son requeridos" 
                });
            }

            const ipAddress = req.ip || 
                             req.headers['x-forwarded-for'] || 
                             req.connection.remoteAddress;

            let country = 'Desconocido';
            let city = 'Desconocido';
            
            try {
                const response = await axios.get(`https://ipapi.co/${ipAddress}/json/`, {
                    timeout: 3000
                });
                
                if (response.data) {
                    country = response.data.country_name || 'Desconocido';
                    city = response.data.city || 'Desconocido';
                }
            } catch (error) {
                console.error('Error al obtener geolocalización:', error.message);
                
                if (ipAddress === '::1' || ipAddress === '127.0.0.1') {
                    try {
                        const publicIpResponse = await axios.get('https://api.ipify.org?format=json');
                        const publicIp = publicIpResponse.data.ip;
                        const locResponse = await axios.get(`https://ipapi.co/${publicIp}/json/`);
                        if (locResponse.data) {
                            country = locResponse.data.country_name || 'Desconocido';
                            city = locResponse.data.city || 'Desconocido';
                        }
                    } catch (fallbackError) {
                        console.error('Error al obtener IP pública:', fallbackError.message);
                    }
                }
            }

            const contactData = {
                firstName,
                lastName,
                email,
                message,
                ipAddress,
                country,
                city
            };

            await this.model.addContact(contactData);

            mailService.sendContactNotification(contactData)
                .catch(err => console.error('Error al enviar correo:', err));

            res.status(201).json({ 
                success: true,
                message: "Contacto guardado exitosamente"
            });
        } catch (error) {
            console.error('Error al agregar contacto:', error);
            res.status(500).json({ 
                error: 'Error interno del servidor',
                details: error.message 
            });
        }
    }

    async getContacts(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(403).json({ 
                    error: 'Acceso no autorizado' 
                });
            }
            
            const contacts = await this.model.getAllContacts();
            res.json(contacts);
        } catch (error) {
            console.error('Error al obtener contactos:', error);
            res.status(500).json({ 
                error: 'Error al obtener contactos',
                details: error.message
            });
        }
    }

    async index(req, res) {
        if (!req.isAuthenticated() || !req.user.isAdmin) {
            return res.status(403).send('Acceso denegado');
        }
        res.render('admin/contacts');
    }
}

module.exports = ContactsController;
