// Auth Page JavaScript - Works for both login and signup pages
document.addEventListener('DOMContentLoaded', function() {
    // Password toggle functionality
    const passwordToggle = document.getElementById('passwordToggle');
    if (passwordToggle) {
        passwordToggle.addEventListener('click', function() {
            const passwordInput = document.getElementById('password');
            const icon = this.querySelector('i');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    }

    // Login Form handling
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        // Login form submit is handled by the unified FormData handler below.
    }
    
    // Signup Form handling
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        // Signup form submit is handled by the unified FormData handler below.
    }
    
    // Social login buttons
    const googleBtns = document.querySelectorAll('.btn-google');
    const linkedinBtns = document.querySelectorAll('.btn-linkedin');
    
    googleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            showAlert('Google authentication would be implemented here', 'info');
        });
    });
    
    linkedinBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            showAlert('LinkedIn authentication would be implemented here', 'info');
        });
    });
    
    // Forgot password link
    const forgotPassword = document.querySelector('.forgot-password');
    if (forgotPassword) {
        forgotPassword.addEventListener('click', function(e) {
            e.preventDefault();
            showAlert('Password reset functionality would be implemented here', 'info');
        });
    }
});

// Helper functions
function validateEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

function evaluatePasswordRequirements(password) {
    const value = password || '';
    return {
        length: value.length >= 12,
        uppercase: /[A-Z]/.test(value),
        lowercase: /[a-z]/.test(value),
        number: /[0-9]/.test(value),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(value),
    };
}

function setupPasswordGuidance(form) {
    const passwordInput = form.querySelector('input[name="password"]');
    const guidance = form.querySelector('#passwordGuidance');

    if (!passwordInput || !guidance) {
        return;
    }

    const updateRules = () => {
        const requirements = evaluatePasswordRequirements(passwordInput.value);
        guidance.querySelectorAll('[data-rule]').forEach((item) => {
            const isValid = Boolean(requirements[item.dataset.rule]);
            item.classList.toggle('is-valid', isValid);
        });
    };

    passwordInput.addEventListener('input', updateRules);
    updateRules();
}

function showAlert(message, type) {
    // Remove any existing alerts
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    // Style the alert
    alert.style.position = 'fixed';
    alert.style.top = '20px';
    alert.style.right = '20px';
    alert.style.padding = '1rem 1.5rem';
    alert.style.borderRadius = '10px';
    alert.style.color = 'white';
    alert.style.fontWeight = '500';
    alert.style.zIndex = '1000';
    alert.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    alert.style.maxWidth = '400px';
    alert.style.animation = 'slideIn 0.3s ease-out';
    
    // Set background color based on type
    if (type === 'error') {
        alert.style.background = '#EF4444';
    } else if (type === 'success') {
        alert.style.background = '#10B981';
    } else {
        alert.style.background = '#3B82F6';
    }
    
    document.body.appendChild(alert);
    
    // Remove alert after 5 seconds
    setTimeout(() => {
        alert.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 300);
    }, 5000);
}

/// Update form submission to include role
function submitLogin(formData) {
    showAlert('Logging in...', 'info');
    
    fetch('/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('Login successful! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = data.redirectTo;
            }, 1500);
        } else {
            showAlert(data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Login failed. Please try again.', 'error');
    });
}

function submitSignup(formData) {
    showAlert('Creating your account...', 'info');
    
    fetch('/auth/signup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('Account created successfully! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = data.redirectTo;
            }, 1500);
        } else {
            showAlert(data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Signup failed. Please try again.', 'error');
    });
}

// Update event listeners to collect all form data
document.addEventListener('DOMContentLoaded', function() {
    // Password toggle
    const passwordToggles = document.querySelectorAll('.password-toggle');
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const passwordInput = this.closest('.input-group').querySelector('input[type="password"]');
            const icon = this.querySelector('i');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });

    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const data = Object.fromEntries(formData);
            
            if (!validateEmail(data.email)) {
                showAlert('Please enter a valid email address', 'error');
                return;
            }
            
            if (data.password.length < 6) {
                showAlert('Password must be at least 6 characters long', 'error');
                return;
            }
            
            submitLogin(data);
        });
    }
    
    // Signup form
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        setupPasswordGuidance(signupForm);

        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const data = Object.fromEntries(formData);
            
            // Basic validation
            if (data.name.trim().length < 2) {
                showAlert('Please enter your full name', 'error');
                return;
            }
            
            if (!validateEmail(data.email)) {
                showAlert('Please enter a valid email address', 'error');
                return;
            }
            
            const requirements = evaluatePasswordRequirements(data.password);
            const unmetRules = [];
            if (!requirements.length) unmetRules.push('at least 12 characters');
            if (!requirements.uppercase) unmetRules.push('an uppercase letter');
            if (!requirements.lowercase) unmetRules.push('a lowercase letter');
            if (!requirements.number) unmetRules.push('a number');
            if (!requirements.special) unmetRules.push('a special character');

            if (unmetRules.length > 0) {
                showAlert(`Password must include ${unmetRules.join(', ')}`, 'error');
                return;
            }
            
            if (data.password !== data.confirmPassword) {
                showAlert('Passwords do not match', 'error');
                return;
            }
            
            if (!data.agreeTerms) {
                showAlert('Please agree to the Terms & Conditions', 'error');
                return;
            }
            
            submitSignup(data);
        });
    }
});
// Animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);