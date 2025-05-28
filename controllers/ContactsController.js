const ContactsModel = require('../models/ContactsModel');
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

            await this.model.addContact({
                firstName,
                lastName,
                email,
                message,
                ipAddress
            });

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
        if (!req.session.userId) {
            return res.status(403).send('Acceso denegado');
        }
        res.sendFile(path.join(__dirname, '../public/admin/contacts.html'));
    }
}

module.exports = ContactsController;