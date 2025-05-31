document.addEventListener('DOMContentLoaded', function() {
    // Inicialización de EmailJS (reemplaza con tu User ID)
    emailjs.init('TU_USER_ID_DE_EMAILJS');

    // Elementos del formulario de login/registro
    const signUpButton = document.getElementById('SignUpButton');
    const signInButton = document.getElementById('SignInButton');
    const signInForm = document.getElementById('SignIn');
    const signUpForm = document.getElementById('SignUp');
    
    // Toggle entre login y registro
    if (signUpButton && signInButton) {
        signUpButton.addEventListener('click', function(e) {
            e.preventDefault();
            signInForm.style.display = "none";
            signUpForm.style.display = "block";
            if (window.grecaptcha && window.grecaptcha.reset) {
                grecaptcha.reset();
            }
        });

        signInButton.addEventListener('click', function(e) {
            e.preventDefault();
            signUpForm.style.display = "none";
            signInForm.style.display = "block";
            if (window.grecaptcha && window.grecaptcha.reset) {
                grecaptcha.reset();
            }
        });
    }

    // Función para mostrar errores
    function showError(message, type = 'error') {
        const errorContainer = document.getElementById('errorContainer');
        const errorMessage = document.getElementById('errorMessage');
        
        if (errorContainer && errorMessage) {
            errorMessage.textContent = message;
            errorContainer.style.display = 'block';
            errorContainer.className = type === 'error' ? 'error-container' : 'error-container success';
            
            errorContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            if (message.toLowerCase().includes('captcha') {
                if (window.grecaptcha && window.grecaptcha.reset) {
                    grecaptcha.reset();
                }
            }
            
            setTimeout(() => {
                errorContainer.style.display = 'none';
            }, 5000);
        } else {
            alert(message);
        }
    }

    // Función para obtener geolocalización
    async function getGeolocation(ip) {
        try {
            // Primero intentamos con ip-api.com (gratis)
            const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,city`);
            if (response.ok) {
                const data = await response.json();
                if (data && data.country) {
                    return {
                        country: data.country,
                        city: data.city || 'Desconocida'
                    };
                }
            }
            
            // Fallback a ipapi.co si el primero falla
            const backupResponse = await fetch(`https://ipapi.co/${ip}/json/`);
            if (backupResponse.ok) {
                const backupData = await backupResponse.json();
                return {
                    country: backupData.country_name || 'Desconocido',
                    city: backupData.city || 'Desconocida'
                };
            }
        } catch (error) {
            console.error('Error obteniendo geolocalización:', error);
        }
        return {
            country: 'Desconocido',
            city: 'Desconocida'
        };
    }

    // Función para obtener la IP pública (si estamos en localhost)
    async function getPublicIp() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            if (response.ok) {
                const data = await response.json();
                return data.ip;
            }
        } catch (error) {
            console.error('Error obteniendo IP pública:', error);
        }
        return null;
    }

    // Formulario de contacto con EmailJS
    const contactForm = document.getElementById('contactFormData');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Obtener IP del usuario
            let ipAddress = '';
            try {
                // Primero intentamos obtener la IP real si no es localhost
                const response = await fetch('https://api.ipify.org?format=json');
                if (response.ok) {
                    const data = await response.json();
                    ipAddress = data.ip;
                }
            } catch (error) {
                console.error('Error obteniendo IP:', error);
            }

            // Si no obtuvimos IP o es localhost, usamos la IP de la conexión
            if (!ipAddress || ipAddress === '::1' || ipAddress === '127.0.0.1') {
                ipAddress = 'IP no disponible';
            }

            // Guardar la IP en el formulario
            document.getElementById('ipAddressField').value = ipAddress;

            // Obtener geolocalización (solo si no es localhost)
            if (ipAddress && ipAddress !== '::1' && ipAddress !== '127.0.0.1' && ipAddress !== 'IP no disponible') {
                const location = await getGeolocation(ipAddress);
                document.getElementById('countryField').value = location.country;
                document.getElementById('cityField').value = location.city;
            } else {
                document.getElementById('countryField').value = 'Local';
                document.getElementById('cityField').value = 'Localhost';
            }

            // Establecer fecha actual
            document.getElementById('currentDate').value = new Date().toLocaleString();

            // Validación de reCAPTCHA
            const recaptchaResponse = grecaptcha.getResponse();
            if (!recaptchaResponse) {
                showError('Por favor completa el reCAPTCHA');
                return;
            }

            // Validación de campos requeridos
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
                // Envía el formulario usando EmailJS
                const response = await emailjs.sendForm(
                    'service_52jvu4t', // Tu Service ID
                    'TU_TEMPLATE_ID',  // ID del template que creaste
                    this
                );

                if (response.status === 200) {
                    showError('Mensaje enviado con éxito', 'success');
                    this.reset();
                    grecaptcha.reset();
                    setTimeout(() => {
                        window.location.href = '/index.html';
                    }, 1000);
                } else {
                    showError('Error al enviar el mensaje');
                    grecaptcha.reset();
                }
            } catch (error) {
                console.error('Error al enviar el formulario:', error);
                showError('Error al enviar el mensaje. Por favor intente nuevamente.');
                grecaptcha.reset();
            }
        });
    }

    // Formulario de pago
    const paymentForm = document.getElementById('paymentFormData');
    if (paymentForm) {
        paymentForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const recaptchaResponse = grecaptcha.getResponse();
            if (!recaptchaResponse) {
                alert('Por favor completa el reCAPTCHA');
                return;
            }

            const requiredFields = ['email', 'cardName', 'cardNumber', 
                                'expiryMonth', 'expiryYear', 'cvv', 
                                'amount', 'currency'];
            let isValid = true;
            
            requiredFields.forEach(field => {
                const input = this.elements[field];
                if (!input.value.trim()) {
                    isValid = false;
                    if (input.style) input.style.borderBottom = '2px solid red';
                } else {
                    if (input.style) input.style.borderBottom = '';
                }
            });
            
            if (!isValid) {
                alert('Por favor complete todos los campos requeridos');
                return;
            }

            try {
                const response = await fetch('/api/payment', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({
                        email: this.email.value.trim(),
                        cardName: this.cardName.value.trim(),
                        cardNumber: this.cardNumber.value.trim(),
                        expiryMonth: this.expiryMonth.value,
                        expiryYear: this.expiryYear.value,
                        cvv: this.cvv.value.trim(),
                        amount: this.amount.value.trim(),
                        currency: this.currency.value,
                        service: "Donante de Cafes",
                        'g-recaptcha-response': recaptchaResponse
                    })
                });
                
                const result = await response.json();

                if (response.ok) {
                    let successMsg = result.message || 'Pago procesado con éxito';
                    if (result.paymentId) {
                        successMsg += '. ID de transacción: ' + result.paymentId;
                    }
                    alert(successMsg);
                    this.reset();
                    grecaptcha.reset();
                    setTimeout(() => {
                        window.location.href = '/index.html';
                    }, 1000);
                } else {
                    alert(result.error || 'Error al procesar el pago');
                    grecaptcha.reset();
                }
            } catch (error) {
                console.error('Error:', error);
                alert('El pago se registró localmente pero hubo un problema al conectarse con el procesador de pagos. Por favor, verifique más tarde.');
                grecaptcha.reset();
            }
        });
    }

    // Formulario de login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = this.email.value;
            const password = this.password.value;
            
            if (!email || !password) {
                showError('Por favor complete todos los campos requeridos');
                return;
            }

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        email, 
                        password
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    showError('Inicio de sesión exitoso. Redirigiendo...', 'success');
                    if (result.redirect) {
                        setTimeout(() => {
                            window.location.href = result.redirect;
                        }, 1000);
                    } else {
                        setTimeout(() => {
                            window.location.href = '/indice';
                        }, 1000);
                    }
                } else {
                    showError(result.message || 'Credenciales incorrectas');
                }
            } catch (error) {
                console.error('Error:', error);
                showError('Error de conexión con el servidor');
            }
        });
    }

    // Formulario de registro
    const registerForm = document.getElementById('SignUp')?.querySelector('form');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const recaptchaResponse = grecaptcha.getResponse();
            if (!recaptchaResponse) {
                showError('Por favor completa el reCAPTCHA');
                return;
            }
                
            try {
                const response = await fetch('/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fName: this.fName.value,
                        lName: this.lName.value,
                        email: this.email.value,
                        password: this.password.value,
                        'g-recaptcha-response': recaptchaResponse
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    showError('Registro exitoso. Redirigiendo...', 'success');
                    setTimeout(() => {
                        signUpForm.style.display = "none";
                        signInForm.style.display = "block";
                        grecaptcha.reset();
                        if (result.email) {
                            const loginEmail = document.querySelector('#SignIn input[name="email"]');
                            if (loginEmail) loginEmail.value = result.email;
                        }
                    }, 1500);
                } else {
                    showError(result.error || 'Error en el registro');
                    grecaptcha.reset();
                }
            } catch (error) {
                console.error('Error:', error);
                showError('Error de conexión con el servidor');
                grecaptcha.reset();
            }
        });
    }

    // Panel de administración
    const adminBtn = document.querySelector('.admin-btn');
    const adminModal = document.getElementById('adminLoginModal');
    const closeBtn = document.querySelector('.admin-close-btn');
    const adminLoginForm = document.getElementById('adminLoginForm');

    if (adminBtn) {
        adminBtn.addEventListener('click', function(e) {
            e.preventDefault();
            adminModal.style.display = 'block';
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            adminModal.style.display = 'none';
        });
    }

    window.addEventListener('click', function(e) {
        if (e.target === adminModal) {
            adminModal.style.display = 'none';
        }
    });

    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('adminEmail').value;
            const password = document.getElementById('adminPassword').value;

            const validEmail = 'xxsandovalluisxx@gmail.com';
            const validPassword = '12345';

            if (email === validEmail && password === validPassword) {
                window.location.href = '/admin/contacts.html';
                adminModal.style.display = 'none';
            } else {
                alert('Credenciales incorrectas. Inténtalo de nuevo.');
            }
        });
    }
});
