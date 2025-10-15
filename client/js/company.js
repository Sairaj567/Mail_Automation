// Company Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize company dashboard functionality
    initCompanyDashboard();
});

function initCompanyDashboard() {
    // Handle quick action buttons
    const quickActionBtns = document.querySelectorAll('.quick-action-btn');
    quickActionBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            if (this.getAttribute('href') === '#') {
                e.preventDefault();
                showNotification('This feature is available in the full version', 'info');
            }
        });
    });

    // Handle application status updates
    const statusButtons = document.querySelectorAll('.action-btn');
    statusButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const applicationId = this.dataset.applicationId;
            if (applicationId) {
                updateApplicationStatus(applicationId, this);
            }
        });
    });

    // Initialize charts if available
    initCompanyCharts();
}

function updateApplicationStatus(applicationId, button) {
    const newStatus = prompt('Enter new status (new, review, interview, rejected, hired):');
    
    if (newStatus && ['new', 'review', 'interview', 'rejected', 'hired'].includes(newStatus)) {
        // Show loading state
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        button.disabled = true;

        fetch('/company/applicants/update-status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                applicationId: applicationId,
                status: newStatus
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('Application status updated successfully!', 'success');
                // Update the status badge
                const statusBadge = button.closest('tr').querySelector('.status-badge');
                statusBadge.className = `status-badge status-${newStatus}`;
                statusBadge.textContent = newStatus.toUpperCase();
            } else {
                showNotification(data.message || 'Failed to update status', 'error');
            }
        })
        .catch(error => {
            console.error('Error updating status:', error);
            showNotification('Failed to update application status', 'error');
        })
        .finally(() => {
            // Reset button
            button.innerHTML = 'View';
            button.disabled = false;
        });
    }
}

function initCompanyCharts() {
    // Initialize analytics charts if Chart.js is available
    if (typeof Chart !== 'undefined') {
        // Company analytics charts would go here
        console.log('Charts initialized for company dashboard');
    }
}

// Utility function to show notifications
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    // Add styles if not already added
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 1rem 1.5rem;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                border-left: 4px solid #8B5FBF;
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 1rem;
                max-width: 400px;
                animation: slideInRight 0.3s ease;
            }
            .notification-success { border-left-color: #10B981; }
            .notification-error { border-left-color: #EF4444; }
            .notification-warning { border-left-color: #F59E0B; }
            .notification-info { border-left-color: #5F7BF4; }
            .notification-content {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                flex: 1;
            }
            .notification-close {
                background: none;
                border: none;
                cursor: pointer;
                color: #64748B;
                padding: 0.25rem;
            }
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function getNotificationIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

// Handle job posting form
function handleJobPosting(formData) {
    // Validate form data
    const requiredFields = ['title', 'description', 'location', 'type'];
    for (let field of requiredFields) {
        if (!formData[field]) {
            showNotification(`Please fill in the ${field} field`, 'error');
            return false;
        }
    }

    return true;
}

// Export functions for global access
window.companyDashboard = {
    init: initCompanyDashboard,
    showNotification: showNotification,
    handleJobPosting: handleJobPosting
};