// Dashboard JavaScript - UPDATED LOGOUT
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard loaded with dynamic data');
    
    // Mobile menu toggle (existing code)
    const mobileMenuBtn = document.createElement('button');
    mobileMenuBtn.className = 'mobile-menu-btn';
    mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
    mobileMenuBtn.style.display = 'none';
    
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        document.body.appendChild(mobileMenuBtn);
        
        mobileMenuBtn.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
        
        function checkScreenSize() {
            if (window.innerWidth <= 1024) {
                mobileMenuBtn.style.display = 'block';
                sidebar.classList.remove('active');
            } else {
                mobileMenuBtn.style.display = 'none';
                sidebar.classList.add('active');
            }
        }
        
        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
    }
    
    // FIXED LOGOUT FUNCTIONALITY
    const logoutLinks = document.querySelectorAll('.nav-item.logout');
    logoutLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (confirm('Are you sure you want to logout?')) {
                // Show loading state
                const originalText = link.innerHTML;
                link.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging out...';
                link.style.pointerEvents = 'none';
                
                fetch('/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Logout failed');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        showAlert('Logout successful!', 'success');
                        // Redirect to home page after short delay
                        setTimeout(() => {
                            window.location.href = '/';
                        }, 1000);
                    } else {
                        throw new Error(data.message || 'Logout failed');
                    }
                })
                .catch(error => {
                    console.error('Logout error:', error);
                    showAlert('Logout failed. Please try again.', 'error');
                    // Reset button state
                    link.innerHTML = originalText;
                    link.style.pointerEvents = 'auto';
                });
            }
        });
    });

    // Status colors for applications
    const statusElements = document.querySelectorAll('.status');
    statusElements.forEach(status => {
        updateStatusColor(status);
    });

    // Profile completion animation
    const completionFill = document.querySelector('.completion-fill');
    if (completionFill) {
        // Animate the completion bar
        setTimeout(() => {
            const width = completionFill.style.width;
            completionFill.style.width = '0%';
            setTimeout(() => {
                completionFill.style.width = width;
            }, 100);
        }, 500);
    }

    // Quick action cards animation
    const actionCards = document.querySelectorAll('.action-card');
    actionCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            card.style.transition = 'all 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100 + 300);
    });

    // Stats counter animation
    const statNumbers = document.querySelectorAll('.stat-info h3');
    statNumbers.forEach(stat => {
        const value = parseInt(stat.textContent) || 0;
        animateValue(stat, 0, value, 1000);
    });
});

// Update status colors
function updateStatusColor(statusElement) {
    const status = statusElement.textContent.toLowerCase().replace(' ', '-');
    
    // Remove existing status classes
    const classes = statusElement.className.split(' ').filter(cls => !cls.startsWith('status-'));
    statusElement.className = classes.join(' ') + ' status';
    
    // Add appropriate class based on status
    switch(status) {
        case 'applied':
            statusElement.classList.add('status-applied');
            break;
        case 'under-review':
            statusElement.classList.add('status-under-review');
            break;
        case 'shortlisted':
            statusElement.classList.add('status-shortlisted');
            break;
        case 'interview':
            statusElement.classList.add('status-interview');
            break;
        case 'rejected':
            statusElement.classList.add('status-rejected');
            break;
        case 'accepted':
            statusElement.classList.add('status-accepted');
            break;
        default:
            statusElement.classList.add('status-applied');
    }
}

// Animate numbers counting up
function animateValue(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        element.textContent = value.toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Alert function
function showAlert(message, type) {
    // Remove any existing alerts
    const existingAlert = document.querySelector('.custom-alert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    const alert = document.createElement('div');
    alert.className = `custom-alert alert-${type}`;
    alert.textContent = message;
    alert.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
    `;
    
    if (type === 'error') {
        alert.style.background = '#EF4444';
    } else if (type === 'success') {
        alert.style.background = '#10B981';
    } else {
        alert.style.background = '#3B82F6';
    }
    
    document.body.appendChild(alert);
    
    setTimeout(() => {
        alert.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 300);
    }, 3000);
}

// Add CSS animations
if (!document.querySelector('#dashboard-animations')) {
    const animations = document.createElement('style');
    animations.id = 'dashboard-animations';
    animations.textContent = `
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
    document.head.appendChild(animations);
}