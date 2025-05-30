const ContactsModel = require('../models/ContactsModel');
const GeolocationHelper = require('../helpers/geolocation');
const geolocationHelper = new GeolocationHelper('78fa71af-348c-412f-9a27-15af099c312c');
const path = require('path');
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

            // Obtener información de geolocalización
            const location = await geolocationHelper.getLocationByIp(ipAddress);

            await this.model.addContact({
                firstName,
                lastName,
                email,
                message,
                ipAddress,
                country: location.country,
                city: location.city
            });

            res.status(201).json({ 
                success: true,
                message: "Contacto guardado exitosamente",
                location: {
                    ip: ipAddress,
                    country: location.country,
                    city: location.city
                }
            });
        } catch (error) {
            console.error('Error al agregar contacto:', error);
            res.status(500).json({ 
                error: 'Error interno del servidor',
                details: error.message 
            });
        }
    }


    async index(req, res) {
        if (!req.session.userId) {
            return res.status(403).send('Acceso denegado');
        }
        res.sendFile(path.join(__dirname, '../public/admin/contacts.html'));
    }
}

module.exports = ContactsController;
