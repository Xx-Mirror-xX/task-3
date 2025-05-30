const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const axios = require('axios');
const app = express();
require('dotenv').config();

// Configuración de reCAPTCHA v2
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || '6LcojE4rAAAAAEcJGKd1KJh2-Uepd0HPQLL1Rkvh';
const GEOLOCATION_TIMEOUT = 3000; 
const GEOLOCATION_CACHE = new Map();

const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite');

        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                firstName TEXT,
                lastName TEXT,
                email TEXT UNIQUE,
                password TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                firstName TEXT NOT NULL,
                lastName TEXT NOT NULL,
                email TEXT NOT NULL,
                message TEXT NOT NULL,
                ipAddress TEXT NOT NULL,
                country TEXT,
                city TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT,
                cardName TEXT,
                cardNumber TEXT,
                expiryMonth INTEGER,
                expiryYear INTEGER,
                cvv TEXT,
                amount REAL,
                currency TEXT,
                service TEXT,
                paymentDate DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
        });
    }
});

// Configuración de middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/stylesheet', express.static(path.join(__dirname, 'public', 'stylesheet')));
app.use('/img', express.static(path.join(__dirname, 'public', 'img')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'secreto',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false, 
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

// Middleware de autenticación
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(403).send('Acceso denegado');
    }
    next();
};

// Función optimizada para verificar reCAPTCHA Enterprise
const verifyRecaptcha = async (token, ipAddress) => {
    if (!token) {
        return { 
            success: false, 
            error: "Token de reCAPTCHA faltante",
            'error-codes': ['missing-input-response']
        };
    }

    try {
        const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET_KEY}&response=${token}&remoteip=${ipAddress}`;
        
        const response = await axios.post(verificationUrl);
        const result = response.data;

        return {
            success: result.success,
            score: result.score || 0.5, // Default score for v2
            'error-codes': result['error-codes'] || []
        };
    } catch (error) {
        console.error('Error al verificar reCAPTCHA:', error);
        return {
            success: false,
            error: "Error al verificar reCAPTCHA",
            'error-codes': ['connection-error']
        };
    }
};


const getGeolocation = async (ipAddress) => {
    // Verificar si es localhost
    if (ipAddress === '::1' || ipAddress === '127.0.0.1') {
        try {
            const publicIpResponse = await axios.get('https://api.ipify.org?format=json', { timeout: GEOLOCATION_TIMEOUT });
            ipAddress = publicIpResponse.data.ip;
        } catch (error) {
            console.error('Error al obtener IP pública:', error.message);
            return {
                country: 'Desconocido',
                city: 'Desconocido'
            };
        }
    }

    // Verificar caché primero
    if (GEOLOCATION_CACHE.has(ipAddress)) {
        return GEOLOCATION_CACHE.get(ipAddress);
    }

    try {
        // Intentar con ip-api.com primero (gratuito y menos restrictivo)
        const response = await axios.get(`http://ip-api.com/json/${ipAddress}?fields=country,city,status`, {
            timeout: GEOLOCATION_TIMEOUT
        });
        
        if (response.data && response.data.status === 'success') {
            const result = {
                country: response.data.country || 'Desconocido',
                city: response.data.city || 'Desconocido'
            };
            
            // Almacenar en caché por 1 hora
            GEOLOCATION_CACHE.set(ipAddress, result);
            setTimeout(() => GEOLOCATION_CACHE.delete(ipAddress), 60 * 60 * 1000);
            
            return result;
        }
    } catch (error) {
        console.error('Error con ip-api.com:', error.message);
    }

    // Fallback a ipapi.co si ip-api.com falla
    try {
        const response = await axios.get(`https://ipapi.co/${ipAddress}/json/`, {
            timeout: GEOLOCATION_TIMEOUT
        });
        
        if (response.data) {
            const result = {
                country: response.data.country_name || 'Desconocido',
                city: response.data.city || 'Desconocido'
            };
            
            // Almacenar en caché por 1 hora
            GEOLOCATION_CACHE.set(ipAddress, result);
            setTimeout(() => GEOLOCATION_CACHE.delete(ipAddress), 60 * 60 * 1000);
            
            return result;
        }
    } catch (error) {
        console.error('Error con ipapi.co:', error.message);
    }

    // Retornar valores por defecto si todo falla
    return {
        country: 'Desconocido',
        city: 'Desconocido'
    };
};

// Ruta de verificación de reCAPTCHA optimizada
app.post('/api/verify-recaptcha', async (req, res) => {
    const { token, action } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    const result = await verifyRecaptcha(token, ipAddress, action);
    
    if (!result.success) {
        return res.status(400).json(result);
    }
    
    res.json({
        success: true,
        timestamp: result.timestamp,
        action: result.action,
        score: result.score
    });
});

// Rutas de autenticación optimizadas con acciones específicas
app.post('/register', async (req, res) => {
    try {
        const { fName, lName, email, password, 'g-recaptcha-response': recaptchaToken } = req.body;
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        
        if (!fName || !lName || !email || !password || !recaptchaToken) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }

        const recaptchaResult = await verifyRecaptcha(recaptchaToken, ipAddress, 'register');
        if (!recaptchaResult.success || recaptchaResult.score < 0.5) {
            return res.status(400).json({ 
                error: 'Verificación de reCAPTCHA fallida',
                score: recaptchaResult.score 
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run(
            'INSERT INTO users (firstName, lastName, email, password) VALUES (?, ?, ?, ?)',
            [fName, lName, email, hashedPassword],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: 'Email ya registrado' });
                    }
                    return res.status(500).json({ error: 'Error al registrar usuario' });
                }
                res.json({ 
                    success: true, 
                    message: 'Usuario registrado con éxito',
                    email: email
                });
            }
        );
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body; // Eliminamos el recaptchaToken
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                message: 'Todos los campos son requeridos' 
            });
        }

        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
            if (err) {
                return res.status(500).json({ 
                    success: false,
                    message: 'Error en el servidor' 
                });
            }
            
            if (!user) {
                return res.status(401).json({ 
                    success: false,
                    message: 'Credenciales incorrectas' 
                });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ 
                    success: false,
                    message: 'Credenciales incorrectas' 
                });
            }

            req.session.userId = user.id;
            res.json({ 
                success: true,
                redirect: '/indice'
            });
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error en el servidor' 
        });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Error al cerrar sesión' });
        }
        res.redirect('/');
    });
});

// Formulario de contacto
const contactForm = document.getElementById('contactFormData');
if (contactForm) {
    contactForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const recaptchaResponse = grecaptcha.getResponse();
        if (!recaptchaResponse) {
            showError('Por favor completa el reCAPTCHA');
            return;
        }

        const requiredFields = ['firstName', 'lastName', 'email', 'message'];
        let isValid = true;
        
        requiredFields.forEach(field => {
            const input = this.elements[field];
            if (!input.value.trim()) {
                isValid = false;
                input.style.borderBottom = '2px solid red';
            } else {
                input.style.borderBottom = '';
            }
        });

        if (!isValid) {
            showError('Por favor complete todos los campos requeridos');
            return;
        }

        try {
            // Primero enviamos a FormSubmit
            const formSubmitResponse = await fetch(this.action, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName: this.firstName.value.trim(),
                    lastName: this.lastName.value.trim(),
                    email: this.email.value.trim(),
                    message: this.message.value.trim(),
                    'g-recaptcha-response': recaptchaResponse
                })
            });

            // Luego guardamos en nuestra base de datos
            const dbResponse = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName: this.firstName.value.trim(),
                    lastName: this.lastName.value.trim(),
                    email: this.email.value.trim(),
                    message: this.message.value.trim(),
                    'g-recaptcha-response': recaptchaResponse
                })
            });

            const result = await dbResponse.json();

            if (dbResponse.ok) {
                showError(result.message || 'Mensaje enviado con éxito', 'success');
                this.reset();
                grecaptcha.reset();
                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 1000);
            } else {
                showError(result.error || 'Error al enviar el mensaje');
                grecaptcha.reset();
            }
        } catch (error) {
            console.error('Error:', error);
            showError('Error de conexión con el servidor');
            grecaptcha.reset();
        }
    });
}

// Rutas de contactos optimizadas con acciones específicas
app.post('/api/contact', async (req, res) => {
    try {
        const { firstName, lastName, email, message, 'g-recaptcha-response': recaptchaToken } = req.body;
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        if (!firstName || !lastName || !email || !message || !recaptchaToken) {
            return res.status(400).json({ error: "Todos los campos son requeridos" });
        }

        const recaptchaResult = await verifyRecaptcha(recaptchaToken, ipAddress, 'contact');
        if (!recaptchaResult.success || recaptchaResult.score < 0.5) {
            return res.status(400).json({ 
                error: "Verificación de reCAPTCHA fallida",
                score: recaptchaResult.score
            });
        }


        const { country, city } = await getGeolocation(ipAddress);

        db.run(
            `INSERT INTO contacts (firstName, lastName, email, message, ipAddress, country, city) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [firstName, lastName, email, message, ipAddress, country, city],
            function(err) {
                if (err) {
                    console.error('Error al guardar contacto:', err);
                    return res.status(500).json({ error: "Error al guardar contacto" });
                }
                res.json({ 
                    success: true, 
                    message: "Contacto guardado exitosamente",
                    id: this.lastID
                });
            }
        );
    } catch (error) {
        console.error('Error en /api/contact:', error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

app.get('/api/contacts', requireAuth, (req, res) => {
    db.all(
        "SELECT * FROM contacts ORDER BY createdAt DESC",
        (err, rows) => {
            if (err) {
                console.error('Error al obtener contactos:', err);
                return res.status(500).json({ error: 'Error al obtener contactos' });
            }
            res.json(rows);
        }
    );
});

// Rutas de pagos optimizadas con acciones específicas
app.post('/api/payment', requireAuth, async (req, res) => {
    try {
        const { email, cardName, cardNumber, expiryMonth, expiryYear, cvv, amount, currency, 'g-recaptcha-response': recaptchaToken } = req.body;
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        if (!email || !cardName || !cardNumber || !expiryMonth || !expiryYear || !cvv || !amount || !currency || !recaptchaToken) {
            return res.status(400).json({ error: "Todos los campos son requeridos" });
        }

        const recaptchaResult = await verifyRecaptcha(recaptchaToken, ipAddress, 'payment');
        if (!recaptchaResult.success || recaptchaResult.score < 0.5) {
            return res.status(400).json({ 
                error: "Verificación de reCAPTCHA fallida",
                score: recaptchaResult.score
            });
        }

        db.run(
            `INSERT INTO payments (email, cardName, cardNumber, expiryMonth, expiryYear, cvv, amount, currency)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [email, cardName, cardNumber, expiryMonth, expiryYear, cvv, amount, currency],
            function(err) {
                if (err) {
                    console.error('Error al procesar pago:', err);
                    return res.status(500).json({ error: "Error al procesar pago" });
                }
                res.json({ 
                    success: true, 
                    message: "Pago procesado exitosamente",
                    id: this.lastID
                });
            }
        );
    } catch (error) {
        console.error('Error en /api/payment:', error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

app.get('/api/payments', requireAuth, (req, res) => {
    db.all(
        "SELECT * FROM payments ORDER BY paymentDate DESC",
        (err, rows) => {
            if (err) {
                console.error('Error al obtener pagos:', err);
                return res.status(500).json({ error: 'Error al obtener pagos' });
            }
            res.json(rows);
        }
    );
});

// Rutas de vistas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/contactos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'contactos.html'));
});

app.get('/pagos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pagos.html'));
});

app.get('/indice', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'vistas', 'indice.html'));
});

app.get('/admin/contacts.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'contacts.html'));
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`Servidor ejecutándose en http://${HOST}:${PORT}`);
});
