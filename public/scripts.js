document.addEventListener('DOMContentLoaded', function() {
    const signUpButton = document.getElementById('SignUpButton');
    const signInButton = document.getElementById('SignInButton');
    const signInForm = document.getElementById('SignIn');
    const signUpForm = document.getElementById('SignUp');
    
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
            
            if (message.toLowerCase().includes('captcha')) {
                if (window.grecaptcha && typeof grecaptcha.reset === 'function') {
                    grecaptcha.reset();
                }
            }
            
            setTimeout(() => {
                if (errorContainer) {
                    errorContainer.style.display = 'none';
                }
            }, 5000);
        } else {
            alert(message);
        }
    }

    // Función para obtener geolocalización
    async function getGeolocation(ip) {
        try {
            // Primero intentamos con ip-api.com (gratis)
            const response = await fetch(`https://ip-api.com/json/${ip}?fields=country,city`);
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

    // Formulario de contacto
    const contactForm = document.getElementById('contactFormData');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Validación de reCAPTCHA
            if (window.grecaptcha) {
                const recaptchaResponse = grecaptcha.getResponse();
                if (!recaptchaResponse) {
                    showError('Por favor completa el reCAPTCHA');
                    return;
                }
            }

            // Validación de campos requeridos
            const requiredFields = ['firstName', 'lastName', 'email', 'message'];
            let isValid = true;
            
            requiredFields.forEach(field => {
                const input = this.elements[field];
                if (input && !input.value.trim()) {
                    isValid = false;
                    input.style.borderBottom = '2px solid red';
                } else if (input) {
                    input.style.borderBottom = '';
                }
            });

            if (!isValid) {
                showError('Por favor complete todos los campos requeridos');
                return;
            }

            try {
                // Get IP address
                const ipResponse = await fetch('https://api.ipify.org?format=json');
                const ipData = await ipResponse.json();
                const ipAddress = ipData.ip;
                
                // Get geolocation
                const { country, city } = await getGeolocation(ipAddress);

                // Prepare data for both server and EmailJS
                const contactData = {
                    firstName: this.firstName.value.trim(),
                    lastName: this.lastName.value.trim(),
                    email: this.email.value.trim(),
                    message: this.message.value.trim(),
                    ipAddress: ipAddress,
                    country: country,
                    city: city,
                    'g-recaptcha-response': window.grecaptcha ? grecaptcha.getResponse() : ''
                };

                // Send to server
                const serverResponse = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify(contactData)
                });
                
                const serverResult = await serverResponse.json();

                if (serverResponse.ok) {
                    // Send email using EmailJS
                    try {
                        const emailjsResponse = await emailjs.send(
                            'service_52jvu4t',
                            'template_1mmq126',
                            {
                                name: `${contactData.firstName} ${contactData.lastName}`,
                                email: contactData.email,
                                message: contactData.message,
                                ip: contactData.ipAddress,
                                location: `${contactData.city}, ${contactData.country}`,
                                date: new Date().toLocaleString()
                            }
                        );
                        
                        console.log('EmailJS success:', emailjsResponse.status, emailjsResponse.text);
                    } catch (emailError) {
                        console.error('EmailJS failed:', emailError);
                        // Continue even if email fails since the server submission was successful
                    }

                    showError('Mensaje enviado con éxito', 'success');
                    this.reset();
                    if (window.grecaptcha && typeof grecaptcha.reset === 'function') {
                        grecaptcha.reset();
                    }
                    setTimeout(() => {
                        window.location.href = '/index.html';
                    }, 1000);
                } else {
                    showError(serverResult.error || 'Error al enviar el mensaje');
                    if (window.grecaptcha && typeof grecaptcha.reset === 'function') {
                        grecaptcha.reset();
                    }
                }
            } catch (error) {
                console.error('Error:', error);
                showError('Error al enviar el mensaje. Por favor intente nuevamente.');
                if (window.grecaptcha && typeof grecaptcha.reset === 'function') {
                    grecaptcha.reset();
                }
            }
        });
    }

    // Formulario de pago
    const paymentForm = document.getElementById('paymentFormData');
    if (paymentForm) {
        paymentForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            if (window.grecaptcha) {
                const recaptchaResponse = grecaptcha.getResponse();
                if (!recaptchaResponse) {
                    showError('Por favor completa el reCAPTCHA');
                    return;
                }
            }

            const requiredFields = ['email', 'cardName', 'cardNumber', 
                                'expiryMonth', 'expiryYear', 'cvv', 
                                'amount', 'currency'];
            let isValid = true;
            
            requiredFields.forEach(field => {
                const input = this.elements[field];
                if (input && !input.value.trim()) {
                    isValid = false;
                    if (input.style) input.style.borderBottom = '2px solid red';
                } else if (input && input.style) {
                    input.style.borderBottom = '';
                }
            });
            
            if (!isValid) {
                showError('Por favor complete todos los campos requeridos');
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
                        'g-recaptcha-response': window.grecaptcha ? grecaptcha.getResponse() : ''
                    })
                });
                
                const result = await response.json();

                if (response.ok) {
                    let successMsg = result.message || 'Pago procesado con éxito';
                    if (result.id) {
                        successMsg += '. ID de transacción: ' + result.id;
                    }
                    showError(successMsg, 'success');
                    this.reset();
                    if (window.grecaptcha && typeof grecaptcha.reset === 'function') {
                        grecaptcha.reset();
                    }
                    setTimeout(() => {
                        window.location.href = '/index.html';
                    }, 1000);
                } else {
                    showError(result.error || 'Error al procesar el pago');
                    if (window.grecaptcha && typeof grecaptcha.reset === 'function') {
                        grecaptcha.reset();
                    }
                }
            } catch (error) {
                console.error('Error:', error);
                showError('El pago se registró localmente pero hubo un problema al conectarse con el procesador de pagos. Por favor, verifique más tarde.');
                if (window.grecaptcha && typeof grecaptcha.reset === 'function') {
                    grecaptcha.reset();
                }
            }
        });
    }

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
                    setTimeout(() => {
                        window.location.href = result.redirect || '/indice';
                    }, 1000);
                } else {
                    showError(result.message || 'Credenciales incorrectas');
                }
            } catch (error) {
                console.error('Error:', error);
                showError('Error de conexión con el servidor');
            }
        });
    }

   const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Validar campos requeridos
            const requiredFields = ['fName', 'lName', 'email', 'password'];
            let isValid = true;
            
            requiredFields.forEach(field => {
                const input = this.elements[field];
                if (input && !input.value.trim()) {
                    isValid = false;
                    input.style.borderBottom = '2px solid red';
                } else if (input) {
                    input.style.borderBottom = '';
                }
            });

            if (!isValid) {
                showError('Por favor complete todos los campos requeridos');
                return;
            }

            // Validar reCAPTCHA
            const recaptchaResponse = window.grecaptcha ? grecaptcha.getResponse() : '';
            if (!recaptchaResponse) {
                showError('Por favor complete el reCAPTCHA');
                return;
            }
                
            try {
                const response = await fetch('/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fName: this.fName.value.trim(),
                        lName: this.lName.value.trim(),
                        email: this.email.value.trim(),
                        password: this.password.value.trim(),
                        'g-recaptcha-response': recaptchaResponse
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    showError('Registro exitoso. Redirigiendo al login...', 'success');
                    setTimeout(() => {
                        signUpForm.style.display = "none";
                        signInForm.style.display = "block";
                        grecaptcha.reset();
                        if (result.email) {
                            const loginEmail = document.querySelector('#loginEmail');
                            if (loginEmail) loginEmail.value = result.email;
                        }
                        registerForm.reset();
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

    if (adminBtn && adminModal) {
        adminBtn.addEventListener('click', function(e) {
            e.preventDefault();
            adminModal.style.display = 'block';
        });
    }

    if (closeBtn && adminModal) {
        closeBtn.addEventListener('click', function() {
            adminModal.style.display = 'none';
        });
    }

    if (adminModal) {
        window.addEventListener('click', function(e) {
            if (e.target === adminModal) {
                adminModal.style.display = 'none';
            }
        });
    }

    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('adminEmail')?.value;
            const password = document.getElementById('adminPassword')?.value;

            const validEmail = 'xxsandovalluisxx@gmail.com';
            const validPassword = '12345';

            if (email === validEmail && password === validPassword) {
                window.location.href = '/admin/contacts.html';
                if (adminModal) adminModal.style.display = 'none';
            } else {
                showError('Credenciales incorrectas. Inténtalo de nuevo.');
            }
        });
    }

    // Cargar contactos si estamos en la página de administración
    if (document.getElementById('contactsTable')) {
        async function loadContacts() {
            try {
                const response = await fetch('/api/contacts');
                if (!response.ok) {
                    throw new Error('Error al cargar contactos');
                }
                const contacts = await response.json();
                
                const tbody = document.querySelector('#contactsTable tbody');
                if (tbody) {
                    tbody.innerHTML = '';
                    
                    contacts.forEach(contact => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${contact.id}</td>
                            <td>${contact.firstName} ${contact.lastName}</td>
                            <td>${contact.email}</td>
                            <td>${contact.message}</td>
                            <td>${contact.ipAddress}</td>
                            <td>${contact.city || 'N/A'}, ${contact.country || 'N/A'}</td>
                            <td>${new Date(contact.createdAt).toLocaleString()}</td>
                        `;
                        tbody.appendChild(row);
                    });
                }
            } catch (error) {
                console.error('Error:', error);
                showError(error.message);
            }
        }
        
        loadContacts();
    }
});
