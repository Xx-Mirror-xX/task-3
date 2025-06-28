require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const axios = require('axios');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const i18n = require('i18n');
const cookieParser = require('cookie-parser');
const app = express();

// Configuración de i18n
i18n.configure({
  locales: ['en', 'es'],
  directory: path.join(__dirname, 'locales'),
  defaultLocale: 'es',
  cookie: 'lang',
  register: global,
  updateFiles: false
});

const PaymentsController = require('./controllers/PaymentsController');
const paymentsController = new PaymentsController();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL;
const GEOLOCATION_TIMEOUT = 3000;
const GEOLOCATION_CACHE = new Map();

app.set('trust proxy', 1);

// Middleware
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/stylesheet', express.static(path.join(__dirname, 'public', 'stylesheet')));
app.use('/img', express.static(path.join(__dirname, 'public', 'img')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vistas', express.static(path.join(__dirname, 'vistas')));
app.use(i18n.init);

// Middleware para establecer el idioma
app.use((req, res, next) => {
  const validLangs = ['es', 'en'];
  let lang = req.cookies.lang;
  
  // Si no hay cookie o el idioma no es válido, usar 'es'
  if (!validLangs.includes(lang)) {
    lang = 'es';
    res.cookie('lang', lang, {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 año
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });
  }
  
  req.setLocale(lang);
  res.locals.lang = lang;
  res.locals.__ = res.__ = function() {
    return i18n.__.apply(req, arguments);
  };
  next();
});

const isProduction = process.env.NODE_ENV === 'production';
app.use(session({
    secret: 'secreto',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { 
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
        maxAge: 15 * 60 * 1000,
        proxy: true 
    },
    proxy: true 
}));
app.use(passport.initialize());
app.use(passport.session());

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
        
        const isAdminLogin = req.query.state === 'admin';

        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
            if (err) return done(err);
            
            if (user) {
                if (isAdminLogin && !user.isAdmin) {
                    const currentUser = req.user;
                    if (currentUser && currentUser.isAdmin) {
                        db.run('UPDATE users SET isAdmin = TRUE WHERE id = ?', [user.id], (err) => {
                            if (err) return done(err);
                            return done(null, {...user, isAdmin: true});
                        });
                    } else {
                        return done(null, false, { message: 'No tienes permisos para crear administradores' });
                    }
                } else {
                    return done(null, user);
                }
            } else {
                const isAdmin = isAdminLogin && req.user && req.user.isAdmin;
                
                db.run(
                    'INSERT INTO users (firstName, lastName, email, googleId, isAdmin) VALUES (?, ?, ?, ?, ?)',
                    [firstName, lastName, email, profile.id, isAdmin],
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
                googleId TEXT,
                isAdmin BOOLEAN DEFAULT FALSE,
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
                isp TEXT,
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
                status TEXT,
                errorDetails TEXT
            )`);

            const adminEmail = ADMIN_EMAIL;
            const adminPassword = ADMIN_PASSWORD;
            db.get('SELECT * FROM users WHERE email = ?', [adminEmail], (err, row) => {
                if (err) {
                    console.error('Error al verificar usuario admin:', err);
                    return;
                }
                if (!row) {
                    bcrypt.hash(adminPassword, 10, (err, hash) => {
                        if (err) {
                            console.error('Error al hashear contraseña admin:', err);
                            return;
                        }
                        db.run(
                            'INSERT INTO users (firstName, lastName, email, password, isAdmin) VALUES (?, ?, ?, ?, ?)',
                            ['Admin', 'User', adminEmail, hash, true],
                            function(err) {
                                if (err) {
                                    console.error('Error al crear usuario admin:', err);
                                } else {
                                    console.log('Usuario admin creado por defecto');
                                }
                            }
                        );
                    });
                }
            });
        });
    }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Ruta para cambiar idioma
app.get('/change-lang/:lang', (req, res) => {
    const lang = req.params.lang;
    const validLangs = ['es', 'en'];
    const returnUrl = req.query.returnUrl || '/';
    
    if (!validLangs.includes(lang)) {
        return res.redirect(returnUrl);
    }

    res.cookie('lang', lang, {
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 año
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
        path: '/'
    });
    
    res.redirect(returnUrl);
});

const requireAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(403).send('Acceso denegado');
};

const requireAdmin = (req, res, next) => {
    if (!req.isAuthenticated()) return res.status(403).send('Acceso denegado');
    if (!req.user.isAdmin) return res.status(403).send('Acceso denegado - Solo para administradores');
    next();
};

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
        return response.data;
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
    const privateIPRanges = [
        '10.', '192.168.', '172.16.', '172.17.', '172.18.', '172.19.',
        '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.',
        '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.'
    ];
    const isPrivateIP = privateIPRanges.some(range => ipAddress.startsWith(range)) || 
                       ipAddress === '::1' || 
                       ipAddress === '127.0.0.1';

    if (isPrivateIP) {
        try {
            const publicIpResponse = await axios.get('https://api.ipify.org?format=json', { timeout: GEOLOCATION_TIMEOUT });
            ipAddress = publicIpResponse.data.ip;
        } catch (error) {
            console.error('Error al obtener IP pública:', error.message);
            return {
                country: 'Servidor Privado',
                city: 'Ubicación Oculta',
                isp: 'Red Privada'
            };
        }
    }

    if (GEOLOCATION_CACHE.has(ipAddress)) {
        return GEOLOCATION_CACHE.get(ipAddress);
    }

    try {
        const response = await axios.get(`http://ip-api.com/json/${ipAddress}?fields=country,city,status,isp`, {
            timeout: GEOLOCATION_TIMEOUT
        });
        if (response.data && response.data.status === 'success') {
            const result = {
                country: response.data.country || 'Desconocido',
                city: response.data.city || 'Desconocido',
                isp: response.data.isp || 'Desconocido'
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
                city: response.data.city || 'Desconocido',
                isp: response.data.org || 'Desconocido'
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
        city: 'Desconocido',
        isp: 'Desconocido'
    };
};

app.get('/auth/google', 
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        prompt: 'select_account' 
    })
);

app.get('/auth/google/admin', 
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        prompt: 'select_account',
        state: 'admin'
    })
);

app.get('/auth/google/callback', 
    passport.authenticate('google', { 
        failureRedirect: '/',
        failureMessage: true 
    }),
    (req, res) => {
        req.session.save(() => {
            if (req.user.isAdmin) {
                res.redirect('/admin/contacts');
            } else {
                res.redirect('/indice');
            }
        });
    }
);

app.post('/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                message: req.__('Todos los campos son requeridos') 
            });
        }

        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
            if (err) {
                console.error('Error en la consulta SQL:', err);
                return res.status(500).json({ 
                    success: false,
                    message: req.__('Error en el servidor') 
                });
            }
            
            if (!user) {
                return res.status(401).json({ 
                    success: false,
                    message: req.__('Credenciales incorrectas') 
                });
            }

            if (!user.password) {
                return res.status(401).json({ 
                    success: false,
                    message: req.__('Este usuario no tiene contraseña configurada') 
                });
            }

            try {
                const isMatch = await bcrypt.compare(password.toString(), user.password.toString());
                if (!isMatch) {
                    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
                        req.login(user, (err) => {
                            if (err) {
                                console.error('Error en req.login:', err);
                                return res.status(500).json({ 
                                    success: false,
                                    message: req.__('Error en el servidor') 
                                });
                            }
                            req.session.save(() => {
                                res.json({ 
                                    success: true,
                                    redirect: '/admin/contacts'
                                });
                            });
                        });
                        return;
                    }
                    return res.status(401).json({ 
                        success: false,
                        message: req.__('Credenciales incorrectas') 
                    });
                }

                if (!user.isAdmin) {
                    return res.status(403).json({ 
                        success: false,
                        message: req.__('Acceso denegado - Solo para administradores') 
                    });
                }

                req.login(user, (err) => {
                    if (err) {
                        console.error('Error en req.login:', err);
                        return res.status(500).json({ 
                            success: false,
                            message: req.__('Error en el servidor') 
                        });
                    }
                    req.session.save(() => {
                        res.json({ 
                            success: true,
                            redirect: '/admin/contacts'
                        });
                    });
                });
            } catch (bcryptError) {
                console.error('Error en bcrypt.compare:', bcryptError);
                return res.status(500).json({ 
                    success: false,
                    message: req.__('Error al verificar contraseña') 
                });
            }
        });
    } catch (error) {
        console.error('Error en login admin:', error);
        res.status(500).json({ 
            success: false,
            message: req.__('Error en el servidor') 
        });
    }
});

app.post('/register', async (req, res) => {
    try {
        const { fName, lName, email, password, 'g-recaptcha-response': recaptchaToken } = req.body;
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        
        if (!fName || !lName || !email || !password || !recaptchaToken) {
            return res.status(400).json({ error: req.__('Todos los campos son requeridos') });
        }

        const recaptchaResult = await verifyRecaptcha(recaptchaToken, ipAddress, 'register');
        if (!recaptchaResult.success || recaptchaResult.score < 0.5) {
            return res.status(400).json({ 
                error: req.__('Verificación de reCAPTCHA fallida'),
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
                        return res.status(400).json({ error: req.__('Email ya registrado') });
                    }
                    return res.status(500).json({ error: req.__('Error al registrar usuario') });
                }
                res.json({ 
                    success: true, 
                    message: req.__('Usuario registrado con éxito'),
                    email: email
                });
            }
        );
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ error: req.__('Error en el servidor') });
    }
});

function formatDate(dateString, lang) {
    const date = new Date(dateString);
    if (lang === 'es') {
        return date.toLocaleString('es-VE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } else {
        return date.toLocaleString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }
}

function formatCurrency(amount, currency, lang) {
    if (lang === 'es') {
        return new Intl.NumberFormat('es-VE', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    } else {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }
}

app.post('/admin/register', requireAdmin, async (req, res) => {
    try {
        const { fName, lName, email, password } = req.body;
        
        if (!fName || !lName || !email || !password) {
            return res.status(400).json({ error: req.__('Todos los campos son requeridos') });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run(
            'INSERT INTO users (firstName, lastName, email, password, isAdmin) VALUES (?, ?, ?, ?, ?)',
            [fName, lName, email, hashedPassword, true],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: req.__('Email ya registrado') });
                    }
                    return res.status(500).json({ error: req.__('Error al registrar administrador') });
                }
                res.json({ 
                    success: true, 
                    message: req.__('Administrador registrado con éxito'),
                    email: email
                });
            }
        );
    } catch (error) {
        console.error('Error en registro de administrador:', error);
        res.status(500).json({ error: req.__('Error en el servidor') });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                message: req.__('Todos los campos son requeridos') 
            });
        }

        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
            if (err) {
                console.error('Error en la consulta SQL:', err);
                return res.status(500).json({ 
                    success: false,
                    message: req.__('Error en el servidor') 
                });
            }
            
            if (!user) {
                return res.status(401).json({ 
                    success: false,
                    message: req.__('Credenciales incorrectas') 
                });
            }

            if (user.googleId && !user.password) {
                return res.status(401).json({ 
                    success: false,
                    message: req.__('Este email está registrado con Google. Por favor inicie sesión con Google.') 
                });
            }

            if (!user.password) {
                return res.status(401).json({ 
                    success: false,
                    message: req.__('Este usuario no tiene contraseña configurada') 
                });
            }

            try {
                const isMatch = await bcrypt.compare(password.toString(), user.password.toString());
                if (!isMatch) {
                if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
                        req.login(user, (err) => {
                            if (err) {
                                console.error('Error en req.login:', err);
                                return res.status(500).json({ 
                                    success: false,
                                    message: req.__('Error en el servidor') 
                                });
                            }
                            req.session.save(() => {
                                res.json({ 
                                    success: true,
                                    redirect: user.isAdmin ? '/admin/contacts' : '/indice'
                                });
                            });
                        });
                        return;
                    }
                    return res.status(401).json({ 
                        success: false,
                        message: req.__('Credenciales incorrectas') 
                    });
                }

                req.login(user, (err) => {
                    if (err) {
                        console.error('Error en req.login:', err);
                        return res.status(500).json({ 
                            success: false,
                            message: req.__('Error en el servidor') 
                        });
                    }
                    req.session.save(() => {
                        res.json({ 
                            success: true,
                            redirect: user.isAdmin ? '/admin/contacts' : '/indice'
                        });
                    });
                });
            } catch (bcryptError) {
                console.error('Error en bcrypt.compare:', bcryptError);
                return res.status(500).json({ 
                    success: false,
                    message: req.__('Error al verificar contraseña') 
                });
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ 
            success: false,
            message: req.__('Error en el servidor') 
        });
    }
});

app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: req.__('Error al cerrar sesión') });
        }
        req.session.destroy(err => {
            if (err) {
                return res.status(500).json({ error: req.__('Error al cerrar sesión') });
            }
            res.redirect('/');
        });
    });
});

app.post('/api/contact', async (req, res) => {
    try {
        const { firstName, lastName, email, message, 'g-recaptcha-response': recaptchaToken } = req.body;
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        if (!firstName || !lastName || !email || !message || !recaptchaToken) {
            return res.status(400).json({ error: req.__("Todos los campos son requeridos") });
        }

        const recaptchaResult = await verifyRecaptcha(recaptchaToken, ipAddress, 'contact');
        if (!recaptchaResult.success || recaptchaResult.score < 0.5) {
            return res.status(400).json({ 
                error: req.__("Verificación de reCAPTCHA fallida"),
                score: recaptchaResult.score
            });
        }

        const locationData = await getGeolocation(ipAddress);
        
        db.run(
            `INSERT INTO contacts (firstName, lastName, email, message, ipAddress, country, city, isp) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [firstName, lastName, email, message, ipAddress, locationData.country, locationData.city, locationData.isp],
            function(err) {
                if (err) {
                    console.error('Error al guardar contacto:', err);
                    return res.status(500).json({ error: req.__("Error al guardar contacto") });
                }
                res.json({ 
                    success: true, 
                    message: req.__("Contacto guardado exitosamente"),
                    id: this.lastID
                });
            }
        );
    } catch (error) {
        console.error('Error en /api/contact:', error);
        res.status(500).json({ error: req.__("Error en el servidor") });
    }
});

app.get('/api/contacts', requireAuth, (req, res) => {
    db.all(
        "SELECT * FROM contacts ORDER BY createdAt DESC",
        (err, rows) => {
            if (err) {
                console.error('Error al obtener contactos:', err);
                return res.status(500).json({ error: req.__('Error al obtener contactos') });
            }
            res.json(rows);
        }
    );
});

app.post('/api/payment', async (req, res) => {
    try {
        const { 'g-recaptcha-response': recaptchaToken } = req.body;
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        if (!recaptchaToken) {
            return res.status(400).json({ error: req.__("Verificación de reCAPTCHA requerida") });
        }

        const recaptchaResult = await verifyRecaptcha(recaptchaToken, ipAddress, 'payment');
        if (!recaptchaResult.success || recaptchaResult.score < 0.5) {
            return res.status(400).json({ 
                error: req.__("Verificación de reCAPTCHA fallida"),
                score: recaptchaResult.score
            });
        }

        return paymentsController.addPayment(req, res);
    } catch (error) {
        console.error('Error en /api/payment:', error);
        res.status(500).json({ error: req.__("Error en el servidor") });
    }
});

app.get('/api/payments', requireAuth, (req, res) => {
    db.all(
        "SELECT * FROM payments ORDER BY paymentDate DESC",
        (err, rows) => {
            if (err) {
                console.error('Error al obtener pagos:', err);
                return res.status(500).json({ error: req.__('Error al obtener pagos') });
            }
            res.json(rows);
        }
    );
});

app.get('/api/payments', requireAuth, (req, res) => {
    db.all(
        "SELECT * FROM payments ORDER BY paymentDate DESC",
        (err, rows) => {
            if (err) {
                console.error('Error al obtener pagos:', err);
                return res.status(500).json({ error: req.__('Error al obtener pagos') });
            }
            const formattedRows = rows.map(payment => ({
                ...payment,
                formattedAmount: formatCurrency(payment.amount, payment.currency, req.getLocale()),
                formattedDate: formatDate(payment.paymentDate, req.getLocale())
            }));
            
            res.json(formattedRows);
        }
    );
});


app.get('/', (req, res) => {
    res.render('index', { lang: res.locals.lang });
});

app.get('/contactos', (req, res) => {
    res.render('contactos', { lang: res.locals.lang });
});

app.get('/pagos', (req, res) => {
    res.render('pagos', { lang: res.locals.lang });
});

app.get('/admin/contacts', requireAdmin, (req, res) => {
    res.render('admin/contacts', { lang: res.locals.lang });
});

app.get('/admin/register', requireAdmin, (req, res) => {
    res.render('admin/register', { lang: res.locals.lang });
});

app.get('/admin/payments', requireAdmin, (req, res) => {
    res.render('admin/payments', { lang: res.locals.lang });
});

app.get('/indice', requireAuth, (req, res) => {
    res.render('vistas/indice', { lang: res.locals.lang });
});

app.use((req, res) => {
    res.status(404).send(req.__('Página no encontrada'));
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`Servidor ejecutándose en http://${HOST}:${PORT}`);
});
