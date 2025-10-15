// Resume JavaScript with Dynamic Functionality
document.addEventListener('DOMContentLoaded', function() {
    const uploadArea = document.getElementById('uploadArea');
    const resumeFile = document.getElementById('resumeFile');
    const browseBtn = document.getElementById('browseBtn');
    const uploadProgress = uploadArea.querySelector('.upload-progress');
    const progressFill = uploadProgress.querySelector('.progress-fill');
    const progressText = uploadProgress.querySelector('.progress-text');
    
    // File upload functionality
    browseBtn.addEventListener('click', () => resumeFile.click());
    
    resumeFile.addEventListener('change', handleFileSelect);
    
    // Drag and drop functionality
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        uploadArea.classList.add('drag-over');
    }
    
    function unhighlight() {
        uploadArea.classList.remove('drag-over');
    }
    
    uploadArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }
    
    function handleFileSelect(e) {
        const files = e.target.files;
        handleFiles(files);
    }
    
    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            
            // Validate file type and size
            if (file.type !== 'application/pdf') {
                showAlert('Please select a PDF file', 'error');
                return;
            }
            
            if (file.size > 5 * 1024 * 1024) {
                showAlert('File size must be less than 5MB', 'error');
                return;
            }
            
            uploadFile(file);
        }
    }
    
    function uploadFile(file) {
        const formData = new FormData();
        formData.append('resume', file);
        
        // Show progress
        uploadArea.querySelector('.upload-placeholder').style.display = 'none';
        uploadProgress.style.display = 'block';
        
        // Simulate upload progress (in real app, use actual progress events)
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 10;
            if (progress >= 100) {
                progress = 100;
                clearInterval(progressInterval);
            }
            
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `${Math.round(progress)}%`;
        }, 200);
        
        // Actual upload
        fetch('/student/upload-resume', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            clearInterval(progressInterval);
            progressFill.style.width = '100%';
            progressText.textContent = '100%';
            
            if (data.success) {
                showAlert(data.message, 'success');
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                showAlert(data.message, 'error');
                resetUploadArea();
            }
        })
        .catch(error => {
            console.error('Upload error:', error);
            showAlert('Upload failed. Please try again.', 'error');
            resetUploadArea();
        });
    }
    
    function resetUploadArea() {
        uploadProgress.style.display = 'none';
        uploadArea.querySelector('.upload-placeholder').style.display = 'block';
        progressFill.style.width = '0%';
        resumeFile.value = '';
    }
    
    // PDF Preview Functionality
    const viewPreviewBtn = document.getElementById('viewPreviewBtn');
    const pdfPreview = document.getElementById('pdfPreview');
    const pdfCanvas = document.getElementById('pdfCanvas');
    const currentPageEl = document.getElementById('currentPage');
    const totalPagesEl = document.getElementById('totalPages');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const closePreviewBtn = document.getElementById('closePreview');
    
    let pdfDoc = null;
    let pageNum = 1;
    let pageRendering = false;
    let pageNumPending = null;
    const scale = 1.5;
    
    if (viewPreviewBtn) {
        viewPreviewBtn.addEventListener('click', loadPdfPreview);
    }
    
    function loadPdfPreview() {
        const resumePath = '/uploads/resumes/<%= profile.resume %>';
        
        // Configure PDF.js worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        
        // Load the PDF
        const loadingTask = pdfjsLib.getDocument(resumePath);
        loadingTask.promise.then(function(pdf) {
            pdfDoc = pdf;
            totalPagesEl.textContent = pdf.numPages;
            
            // Show preview container
            document.querySelector('.preview-placeholder').style.display = 'none';
            pdfPreview.style.display = 'block';
            
            // Render first page
            renderPage(pageNum);
        }).catch(function(error) {
            console.error('Error loading PDF:', error);
            showAlert('Could not load PDF preview', 'error');
        });
    }
    
    function renderPage(num) {
        pageRendering = true;
        
        pdfDoc.getPage(num).then(function(page) {
            const viewport = page.getViewport({ scale: scale });
            pdfCanvas.height = viewport.height;
            pdfCanvas.width = viewport.width;
            
            const renderContext = {
                canvasContext: pdfCanvas.getContext('2d'),
                viewport: viewport
            };
            
            const renderTask = page.render(renderContext);
            
            renderTask.promise.then(function() {
                pageRendering = false;
                
                if (pageNumPending !== null) {
                    renderPage(pageNumPending);
                    pageNumPending = null;
                }
            });
        });
        
        currentPageEl.textContent = num;
    }
    
    function queueRenderPage(num) {
        if (pageRendering) {
            pageNumPending = num;
        } else {
            renderPage(num);
        }
    }
    
    function onPrevPage() {
        if (pageNum <= 1) {
            return;
        }
        pageNum--;
        queueRenderPage(pageNum);
    }
    
    function onNextPage() {
        if (pageNum >= pdfDoc.numPages) {
            return;
        }
        pageNum++;
        queueRenderPage(pageNum);
    }
    
    if (prevPageBtn) prevPageBtn.addEventListener('click', onPrevPage);
    if (nextPageBtn) nextPageBtn.addEventListener('click', onNextPage);
    
    if (closePreviewBtn) {
        closePreviewBtn.addEventListener('click', function() {
            pdfPreview.style.display = 'none';
            document.querySelector('.preview-placeholder').style.display = 'block';
        });
    }
    
    // Resume Actions
    const downloadBtn = document.getElementById('downloadBtn');
    const replaceBtn = document.getElementById('replaceBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            const resumePath = '/uploads/resumes/<%= profile.resume %>';
            const link = document.createElement('a');
            link.href = resumePath;
            link.download = '<%= profile.resume %>';
            link.click();
        });
    }
    
    if (replaceBtn) {
        replaceBtn.addEventListener('click', function() {
            resumeFile.click();
        });
    }
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to delete your resume? This will affect your job applications.')) {
                fetch('/student/delete-resume', {
                    method: 'DELETE'
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showAlert(data.message, 'success');
                        setTimeout(() => {
                            window.location.reload();
                        }, 1500);
                    } else {
                        showAlert(data.message, 'error');
                    }
                })
                .catch(error => {
                    console.error('Delete error:', error);
                    showAlert('Failed to delete resume', 'error');
                });
            }
        });
    }
    
    // Resume Builder Actions
    const aiBuilderBtn = document.getElementById('aiBuilderBtn');
    const templateBuilderBtn = document.getElementById('templateBuilderBtn');
    const uploadExistingBtn = document.getElementById('uploadExistingBtn');
    
    if (aiBuilderBtn) {
        aiBuilderBtn.addEventListener('click', function() {
            showAlert('AI Resume Builder coming soon!', 'info');
        });
    }
    
    if (templateBuilderBtn) {
        templateBuilderBtn.addEventListener('click', function() {
            showAlert('Template Builder coming soon!', 'info');
        });
    }
    
    if (uploadExistingBtn) {
        uploadExistingBtn.addEventListener('click', function() {
            resumeFile.click();
        });
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
        }, 5000);
    }
    
    // Add CSS animations
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
});