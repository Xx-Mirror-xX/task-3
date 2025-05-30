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
                const signupWidgetId = document.getElementById('signup-recaptcha').getAttribute('data-widget-id');
                if (signupWidgetId) {
                    grecaptcha.reset(signupWidgetId);
                }
            }
        });

        signInButton.addEventListener('click', function(e) {
            e.preventDefault();
            signUpForm.style.display = "none";
            signInForm.style.display = "block";
            if (window.grecaptcha && window.grecaptcha.reset) {
                const signinWidgetId = document.getElementById('signin-recaptcha').getAttribute('data-widget-id');
                if (signinWidgetId) {
                    grecaptcha.reset(signinWidgetId);
                }
            }
        });
    }

    function showError(message, formId = null) {
        const errorContainer = document.getElementById('errorContainer');
        const errorMessage = document.getElementById('errorMessage');
        
        if (errorContainer && errorMessage) {
            errorMessage.textContent = message;
            errorContainer.style.display = 'block';
            
            errorContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            if (message.toLowerCase().includes('captcha')) {
                if (window.grecaptcha && window.grecaptcha.reset) {
                    const widgets = document.querySelectorAll('.g-recaptcha');
                    widgets.forEach(widget => {
                        const widgetId = widget.getAttribute('data-widget-id');
                        if (widgetId) grecaptcha.reset(widgetId);
                    });
                }
            }
            
            setTimeout(() => {
                errorContainer.style.display = 'none';
            }, 5000);
        } else {
            alert(message);
        }
    }

    // Función para verificar reCAPTCHA con acciones específicas
    async function verifyRecaptcha(token, action = 'unknown') {
        try {
            const response = await fetch('/api/verify-recaptcha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, action })
            });
            
            const result = await response.json();
            
            if (!result.success) {
                console.error('Errores de reCAPTCHA:', result);
            }
            
            return result;
        } catch (error) {
            console.error('Error verifying reCAPTCHA:', error);
            return { success: false };
        }
    }

    // Formulario de contacto con acción específica
    const contactForm = document.getElementById('contactFormData');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            if (!window.grecaptcha || !window.grecaptcha.enterprise || !window.grecaptcha.enterprise.execute) {
                showError('reCAPTCHA Enterprise no está cargado correctamente');
                return;
            }

            try {
                const token = await grecaptcha.enterprise.execute('6LcojE4rAAAAAF5Z6Ai57vMQ-cymByYnOSvOocsJ', {action: 'contact'});
                
                if (!token) {
                    showError('Por favor completa el reCAPTCHA');
                    return;
                }

                const recaptchaVerification = await verifyRecaptcha(token, 'contact');
                if (!recaptchaVerification.success || recaptchaVerification.score < 0.5) {
                    showError('Verificación de reCAPTCHA fallida. Por favor inténtalo de nuevo.');
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

                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        firstName: this.firstName.value.trim(),
                        lastName: this.lastName.value.trim(),
                        email: this.email.value.trim(),
                        message: this.message.value.trim(),
                        'g-recaptcha-response': token
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    showError(result.message || 'Mensaje enviado con éxito', 'success');
                    this.reset();
                    setTimeout(() => {
                        window.location.href = '/index.html';
                    }, 1000);
                } else {
                    showError(result.error || 'Error al enviar el mensaje');
                }
            } catch (error) {
                console.error('Error:', error);
                showError('Error de conexión con el servidor');
            }
        });
    }

    // Formulario de pago con acción específica
    const paymentForm = document.getElementById('paymentFormData');
    if (paymentForm) {
        paymentForm.addEventListener('submit', async function(e) {
            e.preventDefault();

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
                if (!window.grecaptcha || !window.grecaptcha.enterprise || !window.grecaptcha.enterprise.execute) {
                    alert('reCAPTCHA Enterprise no está cargado correctamente');
                    return;
                }

                const token = await grecaptcha.enterprise.execute('6LcojE4rAAAAAF5Z6Ai57vMQ-cymByYnOSvOocsJ', {action: 'payment'});
                
                if (!token) {
                    alert('Por favor completa el reCAPTCHA');
                    return;
                }

                const recaptchaVerification = await verifyRecaptcha(token, 'payment');
                if (!recaptchaVerification.success || recaptchaVerification.score < 0.5) {
                    alert('Verificación de reCAPTCHA fallida. Por favor inténtalo de nuevo.');
                    return;
                }

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
                        'g-recaptcha-response': token
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
                    setTimeout(() => {
                        window.location.href = '/index.html';
                    }, 1000);
                } else {
                    alert(result.error || 'Error al procesar el pago');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('El pago se registró localmente pero hubo un problema al conectarse con el procesador de pagos. Por favor, verifique más tarde.');
            }
        });
    }

    // Formulario de login con acción específica
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = this.email.value;
            const password = this.password.value;
            
            if (!window.grecaptcha || !window.grecaptcha.enterprise || !window.grecaptcha.enterprise.execute) {
                showError('reCAPTCHA Enterprise no está cargado correctamente');
                return;
            }

            try {
                const token = await grecaptcha.enterprise.execute('6LcojE4rAAAAAF5Z6Ai57vMQ-cymByYnOSvOocsJ', {action: 'login'});
                
                if (!token) {
                    showError('Por favor completa el reCAPTCHA');
                    return;
                }

                const recaptchaVerification = await verifyRecaptcha(token, 'login');
                if (!recaptchaVerification.success || recaptchaVerification.score < 0.5) {
                    showError('Verificación de reCAPTCHA fallida. Por favor inténtalo de nuevo.');
                    return;
                }

                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        email, 
                        password,
                        'g-recaptcha-response': token 
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    if (result.redirect) {
                        window.location.href = result.redirect;
                    } else {
                        window.location.href = '/indice';
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

    // Formulario de registro con acción específica
    const registerForm = document.getElementById('SignUp')?.querySelector('form');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!window.grecaptcha || !window.grecaptcha.enterprise || !window.grecaptcha.enterprise.execute) {
                showError('reCAPTCHA Enterprise no está cargado correctamente');
                return;
            }

            try {
                const token = await grecaptcha.enterprise.execute('6LcojE4rAAAAAF5Z6Ai57vMQ-cymByYnOSvOocsJ', {action: 'register'});
                
                if (!token) {
                    showError('Por favor completa el reCAPTCHA');
                    return;
                }

                const recaptchaVerification = await verifyRecaptcha(token, 'register');
                if (!recaptchaVerification.success || recaptchaVerification.score < 0.5) {
                    showError('Verificación de reCAPTCHA fallida. Por favor inténtalo de nuevo.');
                    return;
                }
                
                const response = await fetch('/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fName: this.fName.value,
                        lName: this.lName.value,
                        email: this.email.value,
                        password: this.password.value,
                        'g-recaptcha-response': token
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    showError('Registro exitoso. Redirigiendo...', 'success');
                    setTimeout(() => {
                        signUpForm.style.display = "none";
                        signInForm.style.display = "block";
                        if (result.email) {
                            const loginEmail = document.querySelector('#SignIn input[name="email"]');
                            if (loginEmail) loginEmail.value = result.email;
                        }
                    }, 1500);
                } else {
                    showError(result.error || 'Error en el registro');
                }
            } catch (error) {
                console.error('Error:', error);
                showError('Error de conexión con el servidor');
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
        adminLoginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('adminEmail').value;
            const password = document.getElementById('adminPassword').value;

            const validEmail = 'xxsandovalluisxx@gmail.com';
            const validPassword = '12345';

            if (email === validEmail && password === validPassword) {
                try {
                    if (!window.grecaptcha || !window.grecaptcha.enterprise || !window.grecaptcha.enterprise.execute) {
                        alert('reCAPTCHA Enterprise no está cargado correctamente');
                        return;
                    }

                    const token = await grecaptcha.enterprise.execute('6LcojE4rAAAAAF5Z6Ai57vMQ-cymByYnOSvOocsJ', {action: 'admin_login'});
                    
                    if (!token) {
                        alert('Por favor completa el reCAPTCHA');
                        return;
                    }

                    const recaptchaVerification = await verifyRecaptcha(token, 'admin_login');
                    if (!recaptchaVerification.success || recaptchaVerification.score < 0.5) {
                        alert('Verificación de reCAPTCHA fallida. Por favor inténtalo de nuevo.');
                        return;
                    }

                    const response = await fetch('/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            email: validEmail, 
                            password: validPassword,
                            'g-recaptcha-response': token
                        })
                    });

                    const result = await response.json();

                    if (response.ok) {
                        window.location.href = '/admin/contacts.html';
                        adminModal.style.display = 'none';
                    } else {
                        alert(result.error || 'Error en la autenticación');
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('Error de conexión con el servidor');
                }
            } else {
                alert('Credenciales incorrectas. Inténtalo de nuevo.');
            }
        });
    }
});
