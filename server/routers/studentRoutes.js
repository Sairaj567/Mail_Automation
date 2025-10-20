const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const studentController = require('../controllers/studentController');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Create separate folders for resumes and cover letters
        let folder = 'resumes';
        if (file.fieldname === 'coverLetterFile') {
            folder = 'cover-letters';
        }
        cb(null, path.join(__dirname, '../../public/uploads/' + folder));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype === 'application/pdf' || 
            file.mimetype === 'application/msword' ||
            file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and Word documents are allowed'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});



// Middleware to check if user is student
const requireStudent = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'student') {
        next();
    } else {
        res.redirect('/auth/login?role=student');
    }
};

// Update apply route to handle multiple files
router.post('/apply-job', requireStudent, upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'coverLetterFile', maxCount: 1 }
]), studentController.applyForJob);

// Dashboard
router.get('/dashboard', requireStudent, studentController.getDashboard);

// Jobs route - FIXED
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
router.post('/upload-resume', requireStudent, upload.single('resume'), studentController.uploadResume);
router.delete('/delete-resume', requireStudent, studentController.deleteResume);
router.delete('/delete-application', requireStudent, studentController.deleteApplication);

module.exports = router;