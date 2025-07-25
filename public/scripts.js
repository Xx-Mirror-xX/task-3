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
            const response = await fetch(`https://ip-api.com/json/${ip}?fields=country,city,isp`);
            if (response.ok) {
                const data = await response.json();
                if (data && data.country) {
                    return {
                        country: data.country,
                        city: data.city || 'Desconocida',
                        isp: data.isp || 'Desconocido'
                    };
                }
            }
            
            const backupResponse = await fetch(`https://ipapi.co/${ip}/json/`);
            if (backupResponse.ok) {
                const backupData = await backupResponse.json();
                return {
                    country: backupData.country_name || 'Desconocido',
                    city: backupData.city || 'Desconocida',
                    isp: backupData.org || 'Desconocido'
                };
            }
        } catch (error) {
            console.error('Error obteniendo geolocalización:', error);
        }
        return {
            country: 'Desconocido',
            city: 'Desconocida',
            isp: 'Desconocido'
        };
    }

    const contactForm = document.getElementById('contactFormData');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            if (window.grecaptcha) {
                const recaptchaResponse = grecaptcha.getResponse();
                if (!recaptchaResponse) {
                    showError('<%= __("Por favor completa el reCAPTCHA") %>');
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
                showError('<%= __("Por favor complete todos los campos requeridos") %>');
                return;
            }

            try {
                const ipResponse = await fetch('https://api.ipify.org?format=json');
                const ipData = await ipResponse.json();
                const ipAddress = ipData.ip;
                
                const locationData = await getGeolocation(ipAddress);
                
                let locationDisplay = locationData.city + ', ' + locationData.country;
                if (locationData.isp.includes('VPN') || locationData.isp.includes('Proxy')) {
                    locationDisplay = 'Servidor Privado (' + locationData.isp + ')';
                }

                const contactData = {
                    firstName: this.firstName.value.trim(),
                    lastName: this.lastName.value.trim(),
                    email: this.email.value.trim(),
                    message: this.message.value.trim(),
                    ipAddress: ipAddress,
                    country: locationData.country,
                    city: locationData.city,
                    isp: locationData.isp,
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

                    showError('<%= __("Mensaje enviado con éxito") %>', 'success');
                    this.reset();
                    if (window.grecaptcha && typeof grecaptcha.reset === 'function') {
                        grecaptcha.reset();
                    }
                    setTimeout(() => {
                        window.location.href = '/'; 
                    }, 1000);
                } else {
                    showError(serverResult.error || '<%= __("Error al enviar el mensaje") %>');
                    if (window.grecaptcha && typeof grecaptcha.reset === 'function') {
                        grecaptcha.reset();
                    }
                }
            } catch (error) {
                console.error('Error:', error);
                showError('<%= __("Error al enviar el mensaje. Por favor intente nuevamente.") %>');
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
                showError('<%= __("Por favor completa el reCAPTCHA") %>');
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
                showError('<%= __("Por favor complete todos los campos requeridos") %>');
                return;
            }

            const cardNumber = this.cardNumber.value.trim().replace(/\s/g, '');
            if (cardNumber.length < 13 || cardNumber.length > 19 || !/^\d+$/.test(cardNumber)) {
                showError('<%= __("Número de tarjeta inválido (debe tener 13-19 dígitos)") %>');
                this.cardNumber.style.borderBottom = '2px solid red';
                return;
            }

            const amount = parseFloat(this.amount.value.trim());
            if (isNaN(amount) || amount <= 0) {
                showError('<%= __("El monto debe ser un número mayor que 0") %>');
                this.amount.style.borderBottom = '2px solid red';
                return;
            }

            const submitBtn = this.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <%= __("Procesando...") %>';
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
                    if (result.success) {

                        showError(`${result.message}<br><small>${result.details}</small>`, 'success');
                        

                        setTimeout(() => {
                            window.location.href = '/admin/payments';
                        }, 3000);
                    } else {

                        let errorMsg = result.message;
                        

                        if (result.details) {
                            if (typeof result.details === 'object') {
                                try {
                                    errorMsg += `<br><small>${JSON.stringify(result.details)}</small>`;
                                } catch {
                                    errorMsg += `<br><small>${result.details.toString()}</small>`;
                                }
                            } else {
                                errorMsg += `<br><small>${result.details}</small>`;
                            }
                        }
                        

                        if (result.paymentId) {
                            errorMsg += `<br><small><%= __("ID local") %>: ${result.paymentId}</small>`;
                        }
                        
                        showError(errorMsg);
                    }
                } else {
                    let errorMsg = result.error || '<%= __("Error al procesar el pago") %>';
                    
                    if (result.details) {
                        if (typeof result.details === 'object') {
                            try {
                                errorMsg += `<br><small>${JSON.stringify(result.details)}</small>`;
                            } catch {
                                errorMsg += `<br><small>${result.details.toString()}</small>`;
                            }
                        } else {
                            errorMsg += `<br><small>${result.details}</small>`;
                        }
                    }
                    
                    if (result.paymentId) {
                        errorMsg += `<br><small><%= __("ID local") %>: ${result.paymentId}</small>`;
                    }
                    
                    showError(errorMsg);
                }
            } catch (error) {
                console.error('Error:', error);
                showError('<%= __("Error de conexión con el servidor. Por favor intente nuevamente.") %>');
            } finally {
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
                if (window.grecaptcha) grecaptcha.reset();
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
                showError('<%= __("Por favor complete todos los campos requeridos") %>');
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
                    showError('<%= __("Inicio de sesión exitoso. Redirigiendo...") %>', 'success');
                    setTimeout(() => {
                        window.location.href = result.redirect || '/indice'; 
                    }, 1000);
                } else {
                    showError(result.message || '<%= __("Credenciales incorrectas") %>');
                }
            } catch (error) {
                console.error('Error:', error);
                showError('<%= __("Error de conexión con el servidor") %>');
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
                showError('<%= __("Por favor complete todos los campos requeridos") %>');
                return;
            }

            const recaptchaResponse = window.grecaptcha ? grecaptcha.getResponse() : '';
            if (!recaptchaResponse) {
                showError('<%= __("Por favor complete el reCAPTCHA") %>');
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
                    showError('<%= __("Registro exitoso. Redirigiendo al login...") %>', 'success');
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
                    showError(result.error || '<%= __("Error en el registro") %>');
                    grecaptcha.reset();
                }
            } catch (error) {
                console.error('Error:', error);
                showError('<%= __("Error de conexión con el servidor") %>');
                grecaptcha.reset();
            }
        });
    }

    const adminBtn = document.querySelector('.admin-btn');
    const adminModal = document.getElementById('adminLoginModal');
    const closeBtn = document.querySelector('.admin-close-btn');
    const adminLoginForm = document.getElementById('adminLoginForm');
    const adminGoogleBtn = document.getElementById('adminGoogleBtn');

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
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <%= __("Verificando...") %>';
            submitBtn.disabled = true;

            try {
                const response = await fetch('/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const result = await response.json();

                if (response.ok) {
                    window.location.href = result.redirect || '/admin/contacts';
                } else {
                    if (result.message.includes('no tiene contraseña configurada')) {
                        showError('<%= __("Este usuario fue registrado con Google. Por favor use el botón de Google.") %>');
                    } else {
                        showError(result.message || '<%= __("Credenciales incorrectas o no tiene permisos de admin") %>');
                    }
                }
            } catch (error) {
                console.error('Error en login admin:', error);
                showError('<%= __("Error de conexión con el servidor") %>');
            } finally {
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }

    if (document.getElementById('contactsTable')) {
        async function loadContacts() {
            try {
                const response = await fetch('/api/contacts', {
                    credentials: 'include'  
                });
                if (!response.ok) {
                    throw new Error('<%= __("Error al cargar contactos") %>');
                }
                const contacts = await response.json();
                
                const tbody = document.querySelector('#contactsTable tbody');
                if (tbody) {
                    tbody.innerHTML = '';
                    
                    contacts.forEach(contact => {
                        const row = document.createElement('tr');
                      
                        let locationInfo = contact.city && contact.country ? 
                            `${contact.city}, ${contact.country}` : 
                            '<%= __("Ubicación no disponible") %>';
                            
                        if (contact.isp && contact.isp.includes('VPN')) {
                            locationInfo = `Servidor Privado (${contact.isp})`;
                        }
                        
                        row.innerHTML = `
                            <td>${contact.id}</td>
                            <td>${contact.firstName} ${contact.lastName}</td>
                            <td>${contact.email}</td>
                            <td>${contact.message}</td>
                            <td>${contact.ipAddress}</td>
                            <td>${locationInfo}</td>
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
                    credentials: 'include' 
                });
                if (!response.ok) {
                    throw new Error('<%= __("Error al cargar pagos") %>');
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
                    <td>${payment.formattedAmount}</td>
                    <td>${payment.currency}</td>
                    <td class="${statusClass}">${getStatusText(payment.status)}</td>
                    <td>${payment.formattedDate}</td>
                    <td>${payment.transactionId || 'N/A'}</td>
                `;
                tbody.appendChild(row);
            });
        }
        
        function getStatusText(status) {
            switch(status) {
                case 'completed': return '<%= __("Completado") %>';
                case 'pending': return '<%= __("Pendiente") %>';
                case 'failed': return '<%= __("Fallido") %>';
                case 'rejected': return '<%= __("Rechazado") %>';
                case 'api_error': return '<%= __("Error API") %>';
                case 'timeout_error': return '<%= __("Tiempo de espera agotado") %>';
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
                toDate.setDate(toDate.getDate() + 1); 
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
    

    const langSelectors = document.querySelectorAll('.lang-selector');
    langSelectors.forEach(selector => {
        const langCookie = document.cookie.replace(/(?:(?:^|.*;\s*)lang\s*=\s*([^;]*).*$)|^.*$/, "$1");
        if (langCookie) {
            selector.value = langCookie;
        }
        
        selector.addEventListener('change', function() {
            const lang = this.value;
            const returnUrl = window.location.pathname + window.location.search;
            window.location.href = '/change-lang/' + lang + '?returnUrl=' + encodeURIComponent(returnUrl);
        });
    });

});
