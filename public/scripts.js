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

    // Función para verificar reCAPTCHA
    async function verifyRecaptcha(token, action = 'unknown') {
        try {
            const response = await fetch('/api/verify-recaptcha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, action })
            });
            
            if (!response.ok) {
                throw new Error('Error en la verificación');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error verifying reCAPTCHA:', error);
            return { success: false };
        }
    }

    // Formulario de contacto
    const contactForm = document.getElementById('contactFormData');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            if (!window.grecaptcha || !window.grecaptcha.getResponse) {
                showError('reCAPTCHA no está cargado correctamente');
                return;
            }

            const recaptchaToken = grecaptcha.getResponse();
            if (!recaptchaToken) {
                showError('Por favor completa el reCAPTCHA');
                return;
            }

            try {
                const recaptchaVerification = await verifyRecaptcha(recaptchaToken, 'contact_form_submit');
                if (!recaptchaVerification.success) {
                    showError('Verificación de reCAPTCHA fallida');
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
                        'g-recaptcha-response': recaptchaToken
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    showError(result.message || 'Mensaje enviado con éxito', 'success');
                    this.reset();
                    grecaptcha.reset();
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

    // Formulario de pago
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
                if (!window.grecaptcha || !window.grecaptcha.getResponse) {
                    alert('reCAPTCHA no está cargado correctamente');
                    return;
                }

                const recaptchaToken = grecaptcha.getResponse();
                if (!recaptchaToken) {
                    alert('Por favor completa el reCAPTCHA');
                    return;
                }

                const recaptchaVerification = await verifyRecaptcha(recaptchaToken, 'payment_processing');
                if (!recaptchaVerification.success) {
                    alert('Verificación de reCAPTCHA fallida');
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
                        'g-recaptcha-response': recaptchaToken
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
                }
            } catch (error) {
                console.error('Error:', error);
                alert('El pago se registró localmente pero hubo un problema al conectarse con el procesador de pagos. Por favor, verifique más tarde.');
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
            
            if (!window.grecaptcha || !window.grecaptcha.getResponse) {
                showError('reCAPTCHA no está cargado correctamente');
                return;
            }

            const recaptchaToken = grecaptcha.getResponse();

            if (!recaptchaToken) {
                showError('Por favor completa el reCAPTCHA');
                return;
            }

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        email, 
                        password,
                        'g-recaptcha-response': recaptchaToken 
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    window.location.href = '/indice';
                } else {
                    showError(result.message || 'Credenciales incorrectas');
                    grecaptcha.reset();
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
            
            if (!window.grecaptcha || !window.grecaptcha.getResponse) {
                showError('reCAPTCHA no está cargado correctamente');
                return;
            }

            const recaptchaToken = grecaptcha.getResponse();
            if (!recaptchaToken) {
                showError('Por favor completa el reCAPTCHA');
                return;
            }

            try {
                const recaptchaVerification = await verifyRecaptcha(recaptchaToken, 'user_registration');
                if (!recaptchaVerification.success) {
                    showError('Verificación de reCAPTCHA fallida');
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
                        'g-recaptcha-response': recaptchaToken
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    window.location.href = result.redirect || '/index.html#SignIn';
                    if (result.email) {
                        setTimeout(() => {
                            const loginEmail = document.querySelector('#SignIn input[name="email"]');
                            if (loginEmail) loginEmail.value = result.email;
                        }, 100);
                    }
                } else {
                    showError(result.error || 'Error en el registro');
                    grecaptcha.reset();
                }
            } catch (error) {
                console.error('Error:', error);
                showError('Error de conexión con el servidor');
            }
        });
    }
});
