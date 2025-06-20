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

    // Botón de Google Login (para login normal)
    const googleLoginBtns = document.querySelectorAll('#googleLoginBtn');
    googleLoginBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '/auth/google';
        });
    });

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

    async function getGeolocation(ip) {
        try {
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

    const contactForm = document.getElementById('contactFormData');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            if (window.grecaptcha) {
                const recaptchaResponse = grecaptcha.getResponse();
                if (!recaptchaResponse) {
                    showError('Por favor completa el reCAPTCHA');
                    return;
                }
            }

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
                const ipResponse = await fetch('https://api.ipify.org?format=json');
                const ipData = await ipResponse.json();
                const ipAddress = ipData.ip;
                
                const { country, city } = await getGeolocation(ipAddress);

                const contactData = {
                    firstName: this.firstName.value.trim(),
                    lastName: this.lastName.value.trim(),
                    email: this.email.value.trim(),
                    message: this.message.value.trim(),
                    ipAddress: ipAddress,
                    country: country,
                    city: city,
                    date: new Date().toLocaleString(),
                    'g-recaptcha-response': window.grecaptcha ? grecaptcha.getResponse() : ''
                };

                const serverResponse = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify(contactData)
                });
                
                const serverResult = await serverResponse.json();

                if (serverResponse.ok) {
                    try {
                        const emailjsResponse = await emailjs.send(
                            'service_52jvu4t',
                            'template_1mmq126',
                            {
                                name: `${contactData.firstName} ${contactData.lastName}`,
                                firstName: contactData.firstName,
                                lastName: contactData.lastName,
                                email: contactData.email,
                                message: contactData.message,
                                ip: contactData.ipAddress,
                                city: contactData.city,
                                country: contactData.country,
                                location: `${contactData.city}, ${contactData.country}`,
                                date: contactData.date
                            }
                        );
                        
                        console.log('EmailJS success:', emailjsResponse.status, emailjsResponse.text);
                    } catch (emailError) {
                        console.error('EmailJS failed:', emailError);
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

    const paymentForm = document.getElementById('paymentFormData');
    if (paymentForm) {
        paymentForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const recaptchaResponse = window.grecaptcha ? grecaptcha.getResponse() : '';
            if (!recaptchaResponse) {
                showError('Por favor completa el reCAPTCHA');
                return;
            }

            const requiredFields = ['email', 'cardName', 'cardNumber', 'expiryMonth', 
                                  'expiryYear', 'cvv', 'amount', 'currency'];
            let isValid = true;
            
            requiredFields.forEach(field => {
                const input = this.elements[field];
                if (!input || !input.value.trim()) {
                    isValid = false;
                    if (input) input.style.borderBottom = '2px solid red';
                } else if (input) {
                    input.style.borderBottom = '';
                }
            });
            
            if (!isValid) {
                showError('Por favor complete todos los campos requeridos');
                return;
            }

            const amount = parseFloat(this.amount.value.trim());
            if (amount <= 0) {
                showError('El monto debe ser mayor que 0');
                this.amount.style.borderBottom = '2px solid red';
                return;
            }

            const submitBtn = this.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
            submitBtn.disabled = true;

            try {
                const response = await fetch('/api/payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: this.email.value.trim(),
                        cardName: this.cardName.value.trim(),
                        cardNumber: this.cardNumber.value.trim().replace(/\s/g, ''),
                        expiryMonth: this.expiryMonth.value,
                        expiryYear: this.expiryYear.value,
                        cvv: this.cvv.value.trim(),
                        amount: amount,
                        currency: this.currency.value,
                        service: "Servicio de Donación",
                        'g-recaptcha-response': recaptchaResponse
                    })
                });
                
                const result = await response.json();

                if (response.ok) {
                    let successMsg = result.message || 'Pago procesado con éxito';
                    if (result.paymentId) {
                        successMsg += `<br><small>ID de transacción: ${result.paymentId}</small>`;
                    }
                    showError(successMsg, 'success');
                    
                    this.reset();
                    if (window.grecaptcha) grecaptcha.reset();
                    
                    setTimeout(() => {
                        window.location.href = `/payment-receipt.html?paymentId=${result.paymentId}`;
                    }, 2000);
                } else {
                    showError(result.error || 'Error al procesar el pago');
                    if (result.paymentId) {
                        console.log('Pago registrado localmente con ID:', result.paymentId);
                    }
                    if (window.grecaptcha) grecaptcha.reset();
                }
            } catch (error) {
                console.error('Error:', error);
                showError('Error de conexión con el servidor. Por favor intente nuevamente.');
                if (window.grecaptcha) grecaptcha.reset();
            } finally {
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
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

    // ADMIN SECTION
    const adminBtn = document.querySelector('.admin-btn');
    const adminModal = document.getElementById('adminLoginModal');
    const closeBtn = document.querySelector('.admin-close-btn');
    const adminLoginForm = document.getElementById('adminLoginForm');
    const adminGoogleBtn = document.getElementById('adminGoogleLoginBtn');

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

    if (adminGoogleBtn) {
        adminGoogleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '/auth/google/admin';
        });
    }

    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('adminEmail')?.value;
            const password = document.getElementById('adminPassword')?.value;

            const submitBtn = this.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
            submitBtn.disabled = true;

            try {
                // Primero hacemos login
                const loginResponse = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                if (!loginResponse.ok) {
                    const errorData = await loginResponse.json();
                    throw new Error(errorData.message || 'Credenciales incorrectas');
                }

                // Luego verificamos si es admin
                const userResponse = await fetch('/api/current-user');
                if (!userResponse.ok) {
                    throw new Error('No se pudo verificar el usuario');
                }

                const userData = await userResponse.json();
                
                if (!userData.isAdmin) {
                    throw new Error('Acceso denegado - Solo para administradores');
                }

                showError('Autenticación exitosa', 'success');
                
                // Opciones de redirección
                setTimeout(() => {
                    const wantsContacts = confirm('¿Deseas ir al Panel de Contactos? (Aceptar) \nO prefieres Registrar nuevo Admin? (Cancelar)');
                    if (wantsContacts) {
                        window.location.href = '/admin/contacts.html';
                    } else {
                        window.location.href = '/admin/register.html';
                    }
                }, 1000);

            } catch (error) {
                console.error('Error en login admin:', error);
                showError(error.message || 'Error de conexión con el servidor');
            } finally {
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }

    // Cargar contactos si estamos en la página de contactos
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

    // Cargar datos del usuario actual
    async function loadCurrentUser() {
        try {
            const response = await fetch('/api/current-user');
            if (response.ok) {
                const user = await response.json();
                // Puedes usar esta información para personalizar la UI
                console.log('Usuario actual:', user);
            }
        } catch (error) {
            console.error('Error al cargar usuario:', error);
        }
    }
    
    loadCurrentUser();
});
