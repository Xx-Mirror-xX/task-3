// helpers/geolocation.js
const axios = require('axios');

class GeolocationHelper {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async getLocationByIp(ipAddress) {
        // Si es localhost, obtener IP pública primero
        if (ipAddress === '::1' || ipAddress === '127.0.0.1') {
            try {
                const publicIp = await this.getPublicIp();
                if (publicIp) {
                    return this._fetchLocation(publicIp);
                }
            } catch (error) {
                console.error('Error al obtener IP pública:', error.message);
            }
            return {
                country: 'Localhost',
                city: 'Servidor Local',
                isp: 'Desarrollo'
            };
        }
        
        return this._fetchLocation(ipAddress);
    }

    async _fetchLocation(ipAddress) {
        try {
            const response = await axios.get(`https://api.apiip.net/api/check?ip=${ipAddress}&accessKey=${this.apiKey}`, {
                timeout: 3000
            });
            
            return {
                country: response.data?.country || 'Desconocido',
                city: response.data?.city || 'Desconocido',
                isp: response.data?.asn?.name || 'Desconocido',
                latitude: response.data?.latitude,
                longitude: response.data?.longitude
            };
        } catch (error) {
            console.error('Error al obtener geolocalización para IP:', ipAddress, error.message);
            return {
                country: 'Desconocido',
                city: 'Desconocido',
                isp: 'Desconocido'
            };
        }
    }

    async getPublicIp() {
        try {
            const response = await axios.get('https://api.ipify.org?format=json', {
                timeout: 3000
            });
            return response.data.ip;
        } catch (error) {
            console.error('Error al obtener IP pública:', error.message);
            return null;
        }
    }
}

module.exports = GeolocationHelper;
