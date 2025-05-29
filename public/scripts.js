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

    function showError(message) {
        alert(message);
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
                    alert(result.message || 'Mensaje enviado con éxito');
                    this.reset();
                    grecaptcha.reset();
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

            if (!window.grecaptcha || !window.grecaptcha.getResponse) {
                alert('reCAPTCHA no está cargado correctamente');
                return;
            }

            const recaptchaToken = grecaptcha.getResponse();
            if (!recaptchaToken) {
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
                        'g-recaptcha-response': recaptchaToken
                    })
                });
                
                const result = await response.json();

                if (response.ok) {
                    let successMsg = result.message || 'Pago procesado con éxito';
                    if (result.id) {
                        successMsg += '. ID de transacción: ' + result.id;
                    }
                    alert(successMsg);
                    this.reset();
                    grecaptcha.reset();
                } else {
                    alert(result.error || 'Error al procesar el pago');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error al procesar el pago');
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
