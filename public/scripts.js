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
            errorMessage.innerHTML = message;
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
                        window.location.href = '/'; // Redirigir a la página principal
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

            const cardNumber = this.cardNumber.value.trim().replace(/\s/g, '');
            if (cardNumber.length < 13 || cardNumber.length > 19 || !/^\d+$/.test(cardNumber)) {
                showError('Número de tarjeta inválido (debe tener 13-19 dígitos)');
                this.cardNumber.style.borderBottom = '2px solid red';
                return;
            }

            const amount = parseFloat(this.amount.value.trim());
            if (isNaN(amount) || amount <= 0) {
                showError('El monto debe ser un número mayor que 0');
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
                        cardNumber: cardNumber,
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
                    window.location.href = '/admin/payments'; // Redirigir a la página de pagos
                } else {
                    let errorMsg = result.error || 'Error al procesar el pago';
                    if (result.paymentId) {
                        errorMsg += `<br><small>ID local: ${result.paymentId}</small>`;
                    }
                    
                    if (result.details) {
                        const errorCodes = {
                            '001': 'Número de tarjeta inválido',
                            '002': 'Pago rechazado por el procesador',
                            '003': 'Error en el procesamiento del pago',
                            '004': 'Fondos insuficientes'
                        };
                        
                        if (result.details.error_code && errorCodes[result.details.error_code]) {
                            errorMsg = errorCodes[result.details.error_code];
                        }
                        
                        if (result.details.message) {
                            errorMsg += `<br><small>${result.details.message}</small>`;
                        }
                    }
                    
                    showError(errorMsg);
                    
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
                        window.location.href = result.redirect || '/indice'; // Redirigir a la vista de índice
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

    if (document.getElementById('contactsTable')) {
        async function loadContacts() {
            try {
                const response = await fetch('/api/contacts', {
                    credentials: 'include'  // Incluir credenciales para enviar la cookie de sesión
                });
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

    if (document.getElementById('paymentsTable')) {
        let allPayments = [];
        
        async function loadPayments() {
            try {
                const response = await fetch('/api/payments', {
                    credentials: 'include'  // Incluir credenciales para enviar la cookie de sesión
                });
                if (!response.ok) {
                    throw new Error('Error al cargar pagos');
                }
                allPayments = await response.json();
                renderPayments(allPayments);
            } catch (error) {
                console.error('Error:', error);
                alert(error.message);
            }
        }
        
        function renderPayments(payments) {
            const tbody = document.querySelector('#paymentsTable tbody');
            tbody.innerHTML = '';
            
            payments.forEach(payment => {
                const row = document.createElement('tr');
                const statusClass = `status-${payment.status || 'pending'}`;
                
                row.innerHTML = `
                    <td>${payment.id}</td>
                    <td>${payment.email}</td>
                    <td>${payment.service}</td>
                    <td>${payment.amount}</td>
                    <td>${payment.currency}</td>
                    <td class="${statusClass}">${getStatusText(payment.status)}</td>
                    <td>${new Date(payment.paymentDate).toLocaleString()}</td>
                    <td>${payment.transactionId || 'N/A'}</td>
                `;
                tbody.appendChild(row);
            });
        }
        
        function getStatusText(status) {
            switch(status) {
                case 'completed': return 'Completado';
                case 'pending': return 'Pendiente';
                case 'failed': return 'Fallido';
                case 'rejected': return 'Rechazado';
                case 'api_error': return 'Error API';
                default: return status;
            }
        }
        
        function filterPayments() {
            const service = document.getElementById('serviceFilter').value;
            const status = document.getElementById('statusFilter').value;
            const dateFrom = document.getElementById('dateFromFilter').value;
            const dateTo = document.getElementById('dateToFilter').value;
            
            let filtered = [...allPayments];
            
            if (service) {
                filtered = filtered.filter(p => p.service === service);
            }
            
            if (status) {
                filtered = filtered.filter(p => p.status === status);
            }
            
            if (dateFrom) {
                const fromDate = new Date(dateFrom);
                filtered = filtered.filter(p => new Date(p.paymentDate) >= fromDate);
            }
            
            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setDate(toDate.getDate() + 1); // Incluir todo el día seleccionado
                filtered = filtered.filter(p => new Date(p.paymentDate) <= toDate);
            }
            
            renderPayments(filtered);
        }
        
        function resetFilters() {
            document.getElementById('serviceFilter').value = '';
            document.getElementById('statusFilter').value = '';
            document.getElementById('dateFromFilter').value = '';
            document.getElementById('dateToFilter').value = '';
            renderPayments(allPayments);
        }
        
        document.getElementById('applyFiltersBtn').addEventListener('click', (e) => {
            e.preventDefault();
            filterPayments();
        });
        
        document.getElementById('resetFiltersBtn').addEventListener('click', (e) => {
            e.preventDefault();
            resetFilters();
        });
        
        loadPayments();
    }
});
