// Jobs JavaScript - FIXED
document.addEventListener('DOMContentLoaded', function() {
    console.log('Jobs page loaded');
    
    // Save job functionality
    const saveButtons = document.querySelectorAll('.save-job');
    saveButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const jobId = this.dataset.jobId;
            const button = this;
            
            // Check if user is in demo mode
            const isDemoUser = document.querySelector('.demo-banner') !== null;
            if (isDemoUser) {
                showAlert('Please create a real account to save jobs.', 'info');
                return;
            }
            
            fetch('/student/save-job', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ jobId })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    if (data.isSaved) {
                        button.innerHTML = '<i class="fas fa-bookmark"></i> Saved';
                        button.classList.add('saved');
                    } else {
                        button.innerHTML = '<i class="far fa-bookmark"></i> Save';
                        button.classList.remove('saved');
                    }
                    showAlert(data.message, 'success');
                } else {
                    showAlert(data.message, 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showAlert('Failed to save job. Please try again.', 'error');
            });
        });
    });

    // Apply filters with real-time search
    const searchInput = document.getElementById('jobSearch');
    const jobTypeFilter = document.getElementById('jobTypeFilter');
    const experienceFilter = document.getElementById('experienceFilter');
    const applyFiltersBtn = document.getElementById('applyFilters');
    const clearFiltersBtn = document.getElementById('clearFilters');

    function applyFilters() {
        const search = searchInput.value;
        const jobType = jobTypeFilter.value;
        const experience = experienceFilter.value;

        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (jobType) params.append('jobType', jobType);
        if (experience) params.append('experience', experience);

        window.location.href = `/student/jobs?${params.toString()}`;
    }

    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFilters);
    }

    // Enter key in search
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                applyFilters();
            }
        });
    }

    // Clear filters button
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', function() {
            window.location.href = '/student/jobs';
        });
    }

    // Real-time search debounce
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(applyFilters, 800);
        });
    }

    // Load more jobs functionality
    const loadMoreBtn = document.getElementById('loadMoreJobs');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', function() {
            // Simulate loading more jobs
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            this.disabled = true;
            
            setTimeout(() => {
                showAlert('No more jobs to load at the moment.', 'info');
                this.innerHTML = '<i class="fas fa-plus"></i> Load More Jobs';
                this.disabled = false;
            }, 1500);
        });
    }

    // Initialize job card animations
    const jobCards = document.querySelectorAll('.job-card');
    jobCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            card.style.transition = 'all 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
});

// Alert function for jobs page
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
    } else if (type === 'info') {
        alert.style.background = '#3B82F6';
    } else {
        alert.style.background = '#F59E0B';
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

// Add CSS animations for jobs page
if (!document.querySelector('#jobs-animations')) {
    const animations = document.createElement('style');
    animations.id = 'jobs-animations';
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
        
        .save-job.saved {
            background: var(--primary-purple);
            color: white;
        }
        
        .save-job.saved i {
            color: white;
        }
    `;
    document.head.appendChild(animations);
}