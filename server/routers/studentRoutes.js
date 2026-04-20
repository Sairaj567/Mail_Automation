const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fileType = require('file-type');
const fs = require('fs').promises;
const crypto = require('crypto');
const studentController = require('../controllers/studentController');
const logger = require('../config/logger');

// Allowed MIME types for file uploads
const ALLOWED_MIMES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

// Configure multer for file uploads - store in memory for validation
const storage = multer.memoryStorage();

const upload = multer({ 
    storage: storage,
    fileFilter: async function (req, file, cb) {
        try {
            // Check MIME type (basic check, will be verified by magic bytes)
            if (!ALLOWED_MIMES.includes(file.mimetype)) {
                logger.warn(`Invalid MIME type for file upload: ${file.mimetype}`, { userId: req.session.user?.id });
                return cb(new Error('Invalid file type. Only PDF and Word documents are allowed'), false);
            }
            
            // Verify actual file content using magic bytes
            const type = await fileType.fromBuffer(file.buffer);
            
            if (!type || !ALLOWED_MIMES.includes(type.mime)) {
                logger.warn(`File content does not match allowed types. Detected: ${type?.mime}`, { userId: req.session.user?.id });
                return cb(new Error('File content does not match allowed types (PDF or Word)'), false);
            }
            
            cb(null, true);
        } catch (err) {
            logger.error('Error validating file type', { error: err.message, userId: req.session.user?.id });
            cb(new Error('Failed to verify file type'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

/**
 * Middleware to safely move uploaded files to disk with race condition protection
 * Uses atomic rename to prevent concurrent write conflicts
 */
const moveUploadedFiles = (uploadDir) => {
    return async (req, res, next) => {
        if (!req.files) return next();
        
        const baseUploadDir = path.join(__dirname, '../../public/uploads');
        const uploadPath = path.join(baseUploadDir, uploadDir);
        
        try {
            // Create upload directory if it doesn't exist
            await fs.mkdir(uploadPath, { recursive: true });
            
            // Process each uploaded field
            for (const field in req.files) {
                const files = req.files[field];
                
                for (const file of files) {
                    try {
                        // Generate unique filename using UUID + timestamp to prevent collisions
                        const uniqueId = crypto.randomBytes(8).toString('hex');
                        const ext = path.extname(file.originalname);
                        const filename = `${field}-${uniqueId}-${Date.now()}${ext}`;
                        const finalPath = path.join(uploadPath, filename);
                        
                        // Write to temporary file first, then atomically rename
                        // This prevents race conditions from concurrent uploads
                        const tempFilename = `${filename}.tmp`;
                        const tempPath = path.join(uploadPath, tempFilename);
                        
                        // Write to temp file
                        await fs.writeFile(tempPath, file.buffer);
                        
                        // Atomically rename temp file to final filename
                        await fs.rename(tempPath, finalPath);
                        
                        logger.info(`File uploaded successfully: ${filename}`, {
                            userId: req.session.user?.id,
                            field: field,
                            size: file.size
                        });
                        
                        // Replace buffer with filename for downstream processing
                        file.filename = filename;
                        delete file.buffer;
                    } catch (fileErr) {
                        logger.error(`Error processing file upload for field ${field}`, {
                            error: fileErr.message,
                            userId: req.session.user?.id
                        });
                        throw fileErr;
                    }
                }
            }
            
            next();
        } catch (err) {
            logger.error('Error in file upload middleware', {
                error: err.message,
                userId: req.session.user?.id
            });
            next(err);
        }
    };
};

// Middleware to check if user is student
const requireStudent = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'student') {
        next();
    } else {
        res.redirect('/auth/login?role=student');
    }
};

// Apply for Job - with file upload and validation
router.post('/apply-job', 
    requireStudent, 
    upload.fields([
        { name: 'resume', maxCount: 1 },
        { name: 'coverLetterFile', maxCount: 1 }
    ]),
    moveUploadedFiles('resumes'),
    studentController.applyForJob
);

// Dashboard
router.get('/dashboard', requireStudent, studentController.getDashboard);

// Jobs route
router.get('/jobs', requireStudent, studentController.getJobs);

// Job details
router.get('/jobs/:id', requireStudent, studentController.getJobDetails);

// Applications
router.get('/applications', requireStudent, studentController.getApplications);

// Profile
router.get('/profile', requireStudent, studentController.getProfile);

// Resume
router.get('/resume', requireStudent, studentController.getResume);

// API Routes for dynamic actions
router.post('/save-job', requireStudent, studentController.toggleSaveJob);
router.post('/update-profile', requireStudent, studentController.updateProfile);

router.post('/upload-resume', 
    requireStudent, 
    upload.single('resume'),
    moveUploadedFiles('resumes'),
    studentController.uploadResume
);

router.delete('/delete-resume', requireStudent, studentController.deleteResume);
router.delete('/delete-application', requireStudent, studentController.deleteApplication);

module.exports = router;