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

        // Obtener información de geolocalización
        let country = 'Desconocido';
        let city = 'Desconocido';
        
        try {
            const response = await axios.get(`https://api.apiip.net/api/check?ip=${ipAddress}&accessKey=78fa71af-348c-412f-9a27-15af099c312c`, {
                timeout: 5000 // 5 segundos de timeout
            });
            
            if (response.data) {
                country = response.data.country || 'Desconocido';
                city = response.data.city || 'Desconocido';
            }
        } catch (error) {
            console.error('Error al obtener geolocalización:', error.message);
            
            // Si es localhost, intentar con la IP pública
            if (ipAddress === '::1' || ipAddress === '127.0.0.1') {
                try {
                    const publicIpResponse = await axios.get('https://api.ipify.org?format=json');
                    const publicIp = publicIpResponse.data.ip;
                    const locResponse = await axios.get(`https://api.apiip.net/api/check?ip=${publicIp}&accessKey=78fa71af-348c-412f-9a27-15af099c312c`);
                    if (locResponse.data) {
                        country = locResponse.data.country || 'Desconocido';
                        city = locResponse.data.city || 'Desconocido';
                    }
                } catch (fallbackError) {
                    console.error('Error al obtener IP pública:', fallbackError.message);
                }
            }
        }

        await this.model.addContact({
            firstName,
            lastName,
            email,
            message,
            ipAddress,
            country,
            city
        });

        res.status(201).json({ 
            success: true,
            message: "Contacto guardado exitosamente",
            location: { country, city }
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
