const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const axios = require('axios');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const app = express();

const PaymentsController = require('./controllers/PaymentsController');
const paymentsController = new PaymentsController();

// Configuración sin .env
const RECAPTCHA_SECRET_KEY = '6LcojE4rAAAAAEcJGKd1KJh2-Uepd0HPQLL1Rkvh';
const GOOGLE_CLIENT_ID = '237117412868-qu524rceddvoeko90ev60b626gl540qt.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = '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';
const GOOGLE_CALLBACK_URL = 'https://creating-social-network-2.onrender.com/auth/google/callback';
const GEOLOCATION_TIMEOUT = 3000;
const GEOLOCATION_CACHE = new Map();

// Configuración de la base de datos
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite');

        db.serialize(() => {
            // Verificar y crear tablas con estructura correcta
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                firstName TEXT,
                lastName TEXT,
                email TEXT UNIQUE,
                password TEXT,
                googleId TEXT UNIQUE,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) {
                    console.error('Error al crear tabla users:', err);
                } else {
                    // Verificar si la columna googleId existe
                    db.get("PRAGMA table_info(users)", [], (err, result) => {
                        if (err) {
                            console.error('Error al verificar estructura de tabla:', err);
                            return;
                        }

                        db.all("PRAGMA table_info(users)", [], (err, columns) => {
                            if (err) {
                                console.error('Error al obtener columnas:', err);
                                return;
                            }

                            const hasGoogleId = columns.some(col => col.name === 'googleId');
                            if (!hasGoogleId) {
                                db.run("ALTER TABLE users ADD COLUMN googleId TEXT UNIQUE", (alterErr) => {
                                    if (alterErr) {
                                        console.error('Error al añadir columna googleId:', alterErr);
                                    } else {
                                        console.log('Columna googleId añadida exitosamente');
                                    }
                                });
                            }
                        });
                    });
                }
            });

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
                paymentDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                transactionId TEXT,
                status TEXT
            )`);
        });
    }
});

// Configuración de Passport para Google OAuth
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: GOOGLE_CALLBACK_URL,
    passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;
        const nameParts = profile.displayName.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

        // Primero buscar por email
        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
            if (err) return done(err);

            if (user) {
                // Si el usuario existe pero no tiene googleId, actualizarlo
                if (!user.googleId) {
                    db.run('UPDATE users SET googleId = ? WHERE id = ?', [profile.id, user.id], (err) => {
                        if (err) return done(err);
                        return done(null, user);
                    });
                } else {
                    // Si ya tiene googleId, verificar que coincida
                    if (user.googleId === profile.id) {
                        return done(null, user);
                    } else {
                        return done(null, false, { message: 'Este email ya está registrado con otra cuenta de Google' });
                    }
                }
            } else {
                // Si no existe por email, buscar por googleId
                db.get('SELECT * FROM users WHERE googleId = ?', [profile.id], (err, googleUser) => {
                    if (err) return done(err);
                    
                    if (googleUser) {
                        return done(null, googleUser);
                    } else {
                        // Crear nuevo usuario
                        db.run(
                            'INSERT INTO users (firstName, lastName, email, googleId) VALUES (?, ?, ?, ?)',
                            [firstName, lastName, email, profile.id],
                            function(err) {
                                if (err) return done(err);
                                
                                db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, newUser) => {
                                    if (err) return done(err);
                                    return done(null, newUser);
                                });
                            }
                        );
                    }
                });
            }
        });
    } catch (error) {
        return done(error);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
        done(err, user);
    });
});

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/stylesheet', express.static(path.join(__dirname, 'public', 'stylesheet')));
app.use('/img', express.static(path.join(__dirname, 'public', 'img')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'secreto',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, 
        maxAge: 24 * 60 * 60 * 1000 
    }
}));
app.use(passport.initialize());
app.use(passport.session());

// Middleware de autenticación
const requireAuth = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(403).send('Acceso denegado');
    }
    next();
};

// Middleware de administrador
const requireAdmin = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(403).send('Acceso denegado');
    }
    
    const adminEmail = 'xxsandovalluisxx@gmail.com';
    if (req.user.email !== adminEmail) {
        return res.status(403).send('Acceso denegado - Solo para administradores');
    }
    
    next();
};

// Función para verificar reCAPTCHA
const verifyRecaptcha = async (token, ipAddress, action = '') => {
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
            score: result.score || 0.5,
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

// Función para obtener geolocalización
const getGeolocation = async (ipAddress) => {
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

    if (GEOLOCATION_CACHE.has(ipAddress)) {
        return GEOLOCATION_CACHE.get(ipAddress);
    }

    try {
        const response = await axios.get(`http://ip-api.com/json/${ipAddress}?fields=country,city,status`, {
            timeout: GEOLOCATION_TIMEOUT
        });
        
        if (response.data && response.data.status === 'success') {
            const result = {
                country: response.data.country || 'Desconocido',
                city: response.data.city || 'Desconocido'
            };
            
            GEOLOCATION_CACHE.set(ipAddress, result);
            setTimeout(() => GEOLOCATION_CACHE.delete(ipAddress), 60 * 60 * 1000);
            
            return result;
        }
    } catch (error) {
        console.error('Error con ip-api.com:', error.message);
    }

    try {
        const response = await axios.get(`https://ipapi.co/${ipAddress}/json/`, {
            timeout: GEOLOCATION_TIMEOUT
        });
        
        if (response.data) {
            const result = {
                country: response.data.country_name || 'Desconocido',
                city: response.data.city || 'Desconocido'
            };
            
            GEOLOCATION_CACHE.set(ipAddress, result);
            setTimeout(() => GEOLOCATION_CACHE.delete(ipAddress), 60 * 60 * 1000);
            
            return result;
        }
    } catch (error) {
        console.error('Error con ipapi.co:', error.message);
    }

    return {
        country: 'Desconocido',
        city: 'Desconocido'
    };
};

// Rutas de autenticación con Google
app.get('/auth/google', 
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        prompt: 'select_account' 
    })
);

app.get('/auth/google/callback', 
    passport.authenticate('google', { 
        failureRedirect: '/index.html',
        failureMessage: true 
    }),
    (req, res) => {
        res.redirect('/indice');
    }
);

// Ruta para verificar reCAPTCHA
app.post('/api/verify-recaptcha', async (req, res) => {
    const { token, action } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    const result = await verifyRecaptcha(token, ipAddress, action);
    
    if (!result.success) {
        return res.status(400).json(result);
    }
    
    res.json({
        success: true,
        score: result.score
    });
});

// Ruta de registro
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

// Ruta de login
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
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

            if (user.googleId && !user.password) {
                return res.status(401).json({ 
                    success: false,
                    message: 'Este email está registrado con Google. Por favor inicie sesión con Google.' 
                });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ 
                    success: false,
                    message: 'Credenciales incorrectas' 
                });
            }

            req.login(user, (err) => {
                if (err) {
                    return res.status(500).json({ 
                        success: false,
                        message: 'Error en el servidor' 
                    });
                }
                
                res.json({ 
                    success: true,
                    redirect: '/indice'
                });
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

// Ruta de logout
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: 'Error al cerrar sesión' });
        }
        req.session.destroy(err => {
            if (err) {
                return res.status(500).json({ error: 'Error al cerrar sesión' });
            }
            res.redirect('/');
        });
    });
});

// Ruta de contacto
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

// Ruta para obtener contactos
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

// Ruta de pagos
app.post('/api/payment', async (req, res) => {
    try {
        const { 'g-recaptcha-response': recaptchaToken } = req.body;
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        if (!recaptchaToken) {
            return res.status(400).json({ error: "Verificación de reCAPTCHA requerida" });
        }

        const recaptchaResult = await verifyRecaptcha(recaptchaToken, ipAddress, 'payment');
        if (!recaptchaResult.success || recaptchaResult.score < 0.5) {
            return res.status(400).json({ 
                error: "Verificación de reCAPTCHA fallida",
                score: recaptchaResult.score
            });
        }

        return paymentsController.addPayment(req, res);
    } catch (error) {
        console.error('Error en /api/payment:', error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// Ruta para obtener pagos
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

// Ruta para detalles de transacción
app.get('/api/payments/:transaction_id', requireAuth, paymentsController.getTransactionDetails.bind(paymentsController));

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

app.get('/payment-receipt.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'payment-receipt.html'));
});

app.get('/indice', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'vistas', 'indice.html'));
});

app.get('/admin/contacts.html', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'contacts.html'));
});

// Ruta de registro solo para administradores
app.get('/register.html', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`Servidor ejecutándose en http://${HOST}:${PORT}`);
});
