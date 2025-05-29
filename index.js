// index.js (código completo actualizado)
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const axios = require('axios');
const app = express();
require('dotenv').config();

const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY || '6Le1SE4rAAAAANvBxclNSX_kOKHsH2KZ8sayC3R7';
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || '6Le1SE4rAAAAAB07BDfVTCNguDfhgyhJQucCvVYq';

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

            db.run(`CREATE TABLE IF NOT EXISTS captchas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                token TEXT NOT NULL,
                hostname TEXT,
                success BOOLEAN NOT NULL,
                score REAL,
                challenge_ts DATETIME,
                error_codes TEXT,
                ip_address TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

// Función para registrar captchas (optimizada para no bloquear)
const logCaptcha = (data) => {
    db.run(
        `INSERT INTO captchas (action, token, hostname, success, score, challenge_ts, error_codes, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            data.action || 'unknown',
            data.token,
            data.hostname,
            data.success ? 1 : 0,
            data.score || null,
            data.challenge_ts || null,
            data.error_codes ? JSON.stringify(data.error_codes) : null,
            data.ip_address || null
        ],
        (err) => {
            if (err) console.error('Error al registrar captcha:', err);
        }
    );
};

// Función optimizada para verificar reCAPTCHA con acciones específicas
const verifyRecaptcha = async (token, ipAddress, action = 'unknown') => {
    if (!token) {
        return { 
            success: false, 
            error: "Token de reCAPTCHA faltante",
            'error-codes': ['missing-input-response'],
            action,
            timestamp: new Date().toISOString()
        };
    }

    // Validar formato de acción según recomendaciones de reCAPTCHA
    const validAction = action.replace(/[^a-zA-Z0-9/_]/g, '_').toLowerCase();
    
    try {
        const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET_KEY}&response=${token}`;
        const response = await axios.post(verificationUrl, {}, {
            timeout: 3000
        });

        const result = {
            ...response.data,
            action: validAction,
            ip_address: ipAddress,
            timestamp: new Date().toISOString()
        };

        // Registrar el captcha de forma asíncrona sin esperar
        process.nextTick(() => logCaptcha(result));

        return result;
    } catch (error) {
        console.error('Error al verificar reCAPTCHA:', error);
        return {
            success: false,
            error: "Error al verificar reCAPTCHA",
            'error-codes': ['connection-error'],
            action: validAction,
            timestamp: new Date().toISOString()
        };
    }
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
        timestamp: result.challenge_ts,
        hostname: result.hostname,
        action: result.action
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

        const recaptchaResult = await verifyRecaptcha(recaptchaToken, ipAddress, 'user_registration');
        if (!recaptchaResult.success) {
            return res.status(400).json({ error: 'Verificación de reCAPTCHA fallida' });
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
                res.json({ success: true, message: 'Usuario registrado con éxito' });
            }
        );
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password, 'g-recaptcha-response': recaptchaToken } = req.body;
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        
        if (!recaptchaToken) {
            return res.status(400).json({ 
                success: false,
                message: 'Por favor completa el reCAPTCHA' 
            });
        }

        const recaptchaResult = await verifyRecaptcha(recaptchaToken, ipAddress, 'user_login');
        if (!recaptchaResult.success) {
            return res.status(400).json({ 
                success: false,
                message: 'Verificación de reCAPTCHA fallida' 
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
            res.json({ success: true });
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

// Rutas de contactos optimizadas con acciones específicas
app.post('/api/contact', async (req, res) => {
    try {
        const { firstName, lastName, email, message, 'g-recaptcha-response': recaptchaToken } = req.body;
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        if (!firstName || !lastName || !email || !message || !recaptchaToken) {
            return res.status(400).json({ error: "Todos los campos son requeridos" });
        }

        const recaptchaResult = await verifyRecaptcha(recaptchaToken, ipAddress, 'contact_form_submit');
        if (!recaptchaResult.success) {
            return res.status(400).json({ error: "Verificación de reCAPTCHA fallida" });
        }

        // Obtener ubicación por IP (no bloqueante)
        let country = 'Desconocido';
        let city = 'Desconocido';
        
        const locationPromise = axios.get(`https://ipapi.co/${ipAddress}/json/`)
            .then(response => {
                country = response.data.country_name || 'Desconocido';
                city = response.data.city || 'Desconocido';
            })
            .catch(error => {
                console.error('Error al obtener geolocalización:', error.message);
            });

        await locationPromise;

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

        const recaptchaResult = await verifyRecaptcha(recaptchaToken, ipAddress, 'payment_processing');
        if (!recaptchaResult.success) {
            return res.status(400).json({ error: "Verificación de reCAPTCHA fallida" });
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

app.get('/api/captchas', requireAuth, (req, res) => {
    db.all(
        "SELECT * FROM captchas ORDER BY created_at DESC",
        (err, rows) => {
            if (err) {
                console.error('Error al obtener captchas:', err);
                return res.status(500).json({ error: 'Error al obtener captchas' });
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
    res.sendFile(path.join(__dirname, 'public', 'contacts.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
