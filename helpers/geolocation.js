// helpers/geolocation.js
const axios = require('axios');

class GeolocationHelper {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async getLocationByIp(ipAddress) {
        try {
            const response = await axios.get(`https://api.apiip.net/api/check?ip=${ipAddress}&accessKey=${this.apiKey}`, {
                timeout: 5000
            });
            
            return {
                country: response.data?.country || 'Desconocido',
                city: response.data?.city || 'Desconocido',
                isp: response.data?.asn?.name || 'Desconocido'
            };
        } catch (error) {
            console.error('Error al obtener geolocalización:', error.message);
            return {
                country: 'Desconocido',
                city: 'Desconocido',
                isp: 'Desconocido'
            };
        }
    }

    async getPublicIp() {
        try {
            const response = await axios.get('https://api.ipify.org?format=json');
            return response.data.ip;
        } catch (error) {
            console.error('Error al obtener IP pública:', error.message);
            return null;
        }
    }
}

module.exports = GeolocationHelper;
