// Applications JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('Applications page loaded');
    
    // Status update functionality
    const statusElements = document.querySelectorAll('.status');
    statusElements.forEach(status => {
        // Add appropriate colors based on status
        updateStatusColor(status);
    });

    // Interview details modal functionality
    const scheduleButtons = document.querySelectorAll('.schedule-btn');
    scheduleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const applicationCard = this.closest('.application-card');
            const jobTitle = applicationCard.querySelector('h3').textContent;
            const companyName = applicationCard.querySelector('.company-name').textContent;
            
            showInterviewDetails(jobTitle, companyName);
        });
    });

    // Filter applications functionality
    const filterButtons = document.createElement('div');
    filterButtons.className = 'application-filters';
    filterButtons.innerHTML = `
        <div class="filter-buttons">
            <button class="filter-btn active" data-filter="all">All</button>
            <button class="filter-btn" data-filter="pending">Pending</button>
            <button class="filter-btn" data-filter="interview">Interviews</button>
            <button class="filter-btn" data-filter="accepted">Accepted</button>
            <button class="filter-btn" data-filter="rejected">Rejected</button>
        </div>
    `;

    // Insert filters at the top of applications list
    const applicationsList = document.querySelector('.applications-list-container');
    if (applicationsList) {
        applicationsList.insertBefore(filterButtons, applicationsList.firstChild);
        
        // Add filter functionality
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                // Remove active class from all buttons
                filterBtns.forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                this.classList.add('active');
                
                const filter = this.dataset.filter;
                filterApplications(filter);
            });
        });
    }

    // Application search functionality
    const searchBox = document.createElement('div');
    searchBox.className = 'application-search';
    searchBox.innerHTML = `
        <div class="search-container">
            <i class="fas fa-search"></i>
            <input type="text" id="applicationSearch" placeholder="Search applications by company or job title...">
        </div>
    `;

    if (applicationsList) {
        applicationsList.insertBefore(searchBox, applicationsList.firstChild);
        
        const searchInput = document.getElementById('applicationSearch');
        searchInput.addEventListener('input', function() {
            searchApplications(this.value);
        });
    }

    // Export applications functionality
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn-secondary export-btn';
    exportBtn.innerHTML = '<i class="fas fa-download"></i> Export Applications';
    exportBtn.style.marginBottom = '1rem';
    
    const sectionHeader = document.querySelector('.section-header');
    if (sectionHeader) {
        sectionHeader.appendChild(exportBtn);
        
        exportBtn.addEventListener('click', exportApplications);
    }

    // Initialize tooltips for status icons
    initializeTooltips();
});

// Update status colors
function updateStatusColor(statusElement) {
    const status = statusElement.textContent.toLowerCase().replace(' ', '-');
    
    // Remove existing status classes
    statusElement.className = 'status';
    
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

// Filter applications
function filterApplications(filter) {
    const applicationCards = document.querySelectorAll('.application-card');
    
    applicationCards.forEach(card => {
        const statusElement = card.querySelector('.status');
        const status = statusElement.textContent.toLowerCase().replace(' ', '-');
        
        switch(filter) {
            case 'all':
                card.style.display = 'block';
                break;
            case 'pending':
                if (['applied', 'under-review', 'shortlisted'].includes(status)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
                break;
            case 'interview':
                card.style.display = status === 'interview' ? 'block' : 'none';
                break;
            case 'accepted':
                card.style.display = status === 'accepted' ? 'block' : 'none';
                break;
            case 'rejected':
                card.style.display = status === 'rejected' ? 'block' : 'none';
                break;
        }
    });
    
    // Show message if no applications match filter
    showNoResultsMessage();
}

// Search applications
function searchApplications(query) {
    const applicationCards = document.querySelectorAll('.application-card');
    let visibleCount = 0;
    
    applicationCards.forEach(card => {
        const jobTitle = card.querySelector('h3').textContent.toLowerCase();
        const companyName = card.querySelector('.company-name').textContent.toLowerCase();
        const searchQuery = query.toLowerCase();
        
        if (jobTitle.includes(searchQuery) || companyName.includes(searchQuery)) {
            card.style.display = 'block';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });
    
    showNoResultsMessage(visibleCount === 0);
}

// Show no results message
function showNoResultsMessage(show = false) {
    let noResultsMsg = document.querySelector('.no-results-message');
    
    if (show && !noResultsMsg) {
        noResultsMsg = document.createElement('div');
        noResultsMsg.className = 'no-results-message';
        noResultsMsg.innerHTML = `
            <i class="fas fa-search fa-2x"></i>
            <h3>No applications found</h3>
            <p>Try adjusting your search criteria or filter</p>
        `;
        noResultsMsg.style.textAlign = 'center';
        noResultsMsg.style.padding = '3rem';
        noResultsMsg.style.color = 'var(--dark-gray)';
        
        const applicationsContainer = document.querySelector('.applications-list-container');
        applicationsContainer.appendChild(noResultsMsg);
    } else if (!show && noResultsMsg) {
        noResultsMsg.remove();
    }
}

// Show interview details modal
function showInterviewDetails(jobTitle, companyName) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Interview Details</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="interview-info">
                    <div class="info-item">
                        <strong>Position:</strong>
                        <span>${jobTitle}</span>
                    </div>
                    <div class="info-item">
                        <strong>Company:</strong>
                        <span>${companyName}</span>
                    </div>
                    <div class="info-item">
                        <strong>Interview Date:</strong>
                        <span>To be scheduled</span>
                    </div>
                    <div class="info-item">
                        <strong>Interview Type:</strong>
                        <span>Virtual (Video Call)</span>
                    </div>
                    <div class="info-item">
                        <strong>Duration:</strong>
                        <span>45 minutes</span>
                    </div>
                    <div class="info-item">
                        <strong>Interviewers:</strong>
                        <span>Hiring Manager & Team Lead</span>
                    </div>
                </div>
                <div class="interview-preparation">
                    <h4>Preparation Tips</h4>
                    <ul>
                        <li>Review the job description and company values</li>
                        <li>Prepare examples of your relevant experience</li>
                        <li>Test your video and audio equipment beforehand</li>
                        <li>Have questions ready for the interviewers</li>
                        <li>Find a quiet, well-lit space for the interview</li>
                    </ul>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary close-modal">Close</button>
                <button class="btn-primary" id="addToCalendar">
                    <i class="fas fa-calendar-plus"></i> Add to Calendar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add modal styles
    addModalStyles();
    
    // Close modal functionality
    const closeButtons = modal.querySelectorAll('.close-modal');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            modal.remove();
        });
    });
    
    // Add to calendar functionality
    const addToCalendarBtn = modal.querySelector('#addToCalendar');
    addToCalendarBtn.addEventListener('click', () => {
        alert('Calendar integration would be implemented here!');
    });
    
    // Close modal on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Export applications to CSV
function exportApplications() {
    const applicationCards = document.querySelectorAll('.application-card');
    let csvContent = "Job Title,Company,Status,Applied Date,Location,Salary\n";
    
    applicationCards.forEach(card => {
        if (card.style.display !== 'none') {
            const jobTitle = card.querySelector('h3').textContent;
            const companyName = card.querySelector('.company-name').textContent;
            const status = card.querySelector('.status').textContent;
            const appliedDate = card.querySelector('.application-date').textContent.replace('Applied: ', '');
            const location = card.querySelector('.job-meta span:nth-child(1)').textContent;
            const salary = card.querySelector('.job-meta span:nth-child(2)')?.textContent || 'N/A';
            
            csvContent += `"${jobTitle}","${companyName}","${status}","${appliedDate}","${location}","${salary}"\n`;
        }
    });
    
    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'my-applications.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showAlert('Applications exported successfully!', 'success');
}

// Initialize tooltips
function initializeTooltips() {
    const statusElements = document.querySelectorAll('.status');
    
    statusElements.forEach(status => {
        status.title = getStatusDescription(status.textContent);
    });
}

// Get status descriptions for tooltips
function getStatusDescription(status) {
    const descriptions = {
        'APPLIED': 'Your application has been submitted and is under review',
        'UNDER REVIEW': 'The company is currently reviewing your application',
        'SHORTLISTED': 'Your application has been shortlisted for further consideration',
        'INTERVIEW': 'You have been invited for an interview',
        'REJECTED': 'Unfortunately, your application was not successful',
        'ACCEPTED': 'Congratulations! Your application has been accepted'
    };
    
    return descriptions[status] || 'Application status';
}

// Add modal styles
function addModalStyles() {
    if (!document.querySelector('#modal-styles')) {
        const styles = document.createElement('style');
        styles.id = 'modal-styles';
        styles.textContent = `
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            }
            
            .modal-content {
                background: white;
                border-radius: 15px;
                width: 90%;
                max-width: 500px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            }
            
            .modal-header {
                padding: 1.5rem;
                border-bottom: 1px solid var(--medium-gray);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .modal-header h3 {
                margin: 0;
                color: var(--text-dark);
            }
            
            .close-modal {
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                color: var(--dark-gray);
            }
            
            .modal-body {
                padding: 1.5rem;
            }
            
            .interview-info {
                margin-bottom: 1.5rem;
            }
            
            .info-item {
                display: flex;
                justify-content: space-between;
                padding: 0.5rem 0;
                border-bottom: 1px solid var(--light-gray);
            }
            
            .interview-preparation h4 {
                margin-bottom: 1rem;
                color: var(--text-dark);
            }
            
            .interview-preparation ul {
                list-style: none;
                padding: 0;
            }
            
            .interview-preparation li {
                padding: 0.5rem 0;
                display: flex;
                align-items: flex-start;
                gap: 0.5rem;
            }
            
            .interview-preparation li:before {
                content: "•";
                color: var(--primary-purple);
                font-weight: bold;
            }
            
            .modal-footer {
                padding: 1.5rem;
                border-top: 1px solid var(--medium-gray);
                display: flex;
                gap: 1rem;
                justify-content: flex-end;
            }
        `;
        document.head.appendChild(styles);
    }
}

// Alert function
function showAlert(message, type) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
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
    }, 5000);
}

// Add CSS animations if not already present
if (!document.querySelector('#app-animations')) {
    const animations = document.createElement('style');
    animations.id = 'app-animations';
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
        
        /* Additional styles for applications page */
        .application-filters {
            margin-bottom: 1.5rem;
        }
        
        .filter-buttons {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }
        
        .filter-btn {
            padding: 0.5rem 1rem;
            border: 1px solid var(--medium-gray);
            background: var(--white);
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.3s;
            font-size: 0.9rem;
        }
        
        .filter-btn.active {
            background: var(--primary-purple);
            color: white;
            border-color: var(--primary-purple);
        }
        
        .filter-btn:hover {
            border-color: var(--primary-purple);
        }
        
        .application-search {
            margin-bottom: 1.5rem;
        }
        
        .search-container {
            position: relative;
            max-width: 400px;
        }
        
        .search-container i {
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
            color: var(--dark-gray);
        }
        
        .search-container input {
            width: 100%;
            padding: 0.75rem 1rem 0.75rem 3rem;
            border: 1px solid var(--medium-gray);
            border-radius: 8px;
            font-size: 1rem;
        }
        
        .export-btn {
            margin-left: auto;
        }
    `;
    document.head.appendChild(animations);
}

// Delete application function
async function deleteApplication(applicationId) {
    if (!applicationId) {
        console.error('No application ID provided');
        return;
    }

    if (!confirm('Are you sure you want to delete this application? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch('/student/delete-application', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                applicationId: applicationId
            })
        });

        const data = await response.json();
        
        if (data.success) {
            showNotification('Application deleted successfully', 'success');
            // Remove the application card from the DOM
            const applicationCard = document.querySelector(`[data-application-id="${applicationId}"]`)?.closest('.application-card');
            if (applicationCard) {
                applicationCard.style.opacity = '0';
                applicationCard.style.transform = 'translateX(-100%)';
                setTimeout(() => {
                    applicationCard.remove();
                    // Reload the page if no applications left
                    if (document.querySelectorAll('.application-card').length === 0) {
                        window.location.reload();
                    }
                }, 300);
            } else {
                // Fallback: reload the page
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        } else {
            showNotification(data.message || 'Failed to delete application', 'error');
        }
    } catch (error) {
        console.error('Error deleting application:', error);
        showNotification('Failed to delete application', 'error');
    }
}

// Notification function
function showNotification(message, type) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;

    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#48BB78' : '#F56565'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 0.75rem;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 5000);
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .application-card {
        transition: all 0.3s ease;
    }
`;
document.head.appendChild(style);

// Add event listeners for delete buttons
document.addEventListener('DOMContentLoaded', function() {
    const deleteButtons = document.querySelectorAll('.delete-application-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const applicationId = this.getAttribute('data-application-id');
            deleteApplication(applicationId);
        });
    });
});