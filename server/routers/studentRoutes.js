const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { fileTypeFromBuffer } = require('file-type');
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
    fileFilter: function (req, file, cb) {
        try {
            // Basic MIME gate; magic-byte verification happens in moveUploadedFiles.
            if (!ALLOWED_MIMES.includes(file.mimetype)) {
                logger.warn(`Invalid MIME type for file upload: ${file.mimetype}`, { userId: req.session.user?.id });
                return cb(new Error('Invalid file type. Only PDF and Word documents are allowed'), false);
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

const imageUpload = multer({
    storage: storage,
    limits: {
        fileSize: 2 * 1024 * 1024,
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype && file.mimetype.startsWith('image/')) {
            return cb(null, true);
        }
        return cb(new Error('Only image files are allowed'), false);
    }
});

/**
 * Middleware to safely move uploaded files to disk with race condition protection
 * Uses atomic rename to prevent concurrent write conflicts
 */
const moveUploadedFiles = (uploadDir) => {
    return async (req, res, next) => {
        if (!req.files && !req.file) return next();
        
        const baseUploadDir = path.join(__dirname, '../../public/uploads');
        const uploadPath = path.join(baseUploadDir, uploadDir);
        
        try {
            // Create upload directory if it doesn't exist
            await fs.mkdir(uploadPath, { recursive: true });
            
            const normalizedFiles = req.files
                ? req.files
                : (req.file ? { [req.file.fieldname || 'file']: [req.file] } : {});

            // Process each uploaded field
            for (const field in normalizedFiles) {
                const files = normalizedFiles[field];
                
                for (const file of files) {
                    try {
                        if (uploadDir === 'resumes') {
                            const detectedType = await fileTypeFromBuffer(file.buffer);
                            if (!detectedType || !ALLOWED_MIMES.includes(detectedType.mime)) {
                                logger.warn('File content does not match allowed types', {
                                    userId: req.session.user?.id,
                                    declaredMime: file.mimetype,
                                    detectedMime: detectedType?.mime || 'unknown'
                                });
                                throw new Error('File content does not match allowed types (PDF or Word)');
                            }
                        }

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

            if (req.file && normalizedFiles[req.file.fieldname]?.[0]) {
                req.file = normalizedFiles[req.file.fieldname][0];
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

router.post('/upload-profile-image',
    requireStudent,
    imageUpload.single('profileImage'),
    moveUploadedFiles('profile-images'),
    studentController.uploadProfileImage
);

router.post('/rename-resume', requireStudent, studentController.renameResume);
router.post('/set-primary-resume', requireStudent, studentController.setPrimaryResume);
router.get('/resume/recommendation/:jobId', requireStudent, studentController.getRecommendedResumeForJob);
router.post('/ai/resume-review', requireStudent, studentController.aiResumeReview);
router.post('/ai/resume-build', requireStudent, studentController.aiResumeBuild);

router.delete('/delete-resume', requireStudent, studentController.deleteResume);
router.delete('/delete-application', requireStudent, studentController.deleteApplication);

module.exports = router;