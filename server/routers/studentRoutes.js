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
router.post('/apply-job', requireStudent, async (req, res) => {
    try {
        const { jobId, coverLetter } = req.body;
        const studentId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(studentId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Please create a real account to apply for jobs. Demo users cannot submit applications.'
            });
        }

        // Check if already applied
        const existingApplication = await Application.findOne({
            student: studentId,
            job: jobId
        });

        if (existingApplication) {
            return res.json({
                success: false,
                message: 'You have already applied for this job'
            });
        }

        // Get student's resume
        const studentProfile = await StudentProfile.findOne({ user: studentId });
        if (!studentProfile?.resume) {
            return res.json({
                success: false,
                message: 'Please upload your resume before applying'
            });
        }

        // Create application
        const application = new Application({
            student: studentId,
            job: jobId,
            resume: studentProfile.resume,
            coverLetter,
            status: 'applied'
        });

        await application.save();

        res.json({
            success: true,
            message: 'Application submitted successfully!',
            applicationId: application._id
        });
    } catch (error) {
        console.error('Apply job error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit application'
        });
    }
});

router.post('/save-job', requireStudent, async (req, res) => {
    try {
        const { jobId } = req.body;
        const studentId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(studentId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Please create a real account to save jobs.'
            });
        }

        let studentProfile = await StudentProfile.findOne({ user: studentId });
        
        if (!studentProfile) {
            studentProfile = new StudentProfile({ user: studentId, savedJobs: [] });
        }

        const isSaved = studentProfile.savedJobs.includes(jobId);
        
        if (isSaved) {
            // Remove from saved
            studentProfile.savedJobs = studentProfile.savedJobs.filter(
                id => id.toString() !== jobId
            );
        } else {
            // Add to saved
            studentProfile.savedJobs.push(jobId);
        }

        await studentProfile.save();

        res.json({
            success: true,
            isSaved: !isSaved,
            message: isSaved ? 'Job removed from saved' : 'Job saved successfully'
        });
    } catch (error) {
        console.error('Save job error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update saved jobs'
        });
    }
});

router.post('/update-profile', requireStudent, async (req, res) => {
    try {
        const studentId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(studentId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Please create a real account to update your profile.'
            });
        }

        const profileData = req.body;

        let studentProfile = await StudentProfile.findOne({ user: studentId });
        
        if (!studentProfile) {
            studentProfile = new StudentProfile({ 
                user: studentId,
                ...profileData
            });
        } else {
            Object.assign(studentProfile, profileData);
        }

        await studentProfile.save();

        res.json({
            success: true,
            message: 'Profile updated successfully!'
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile'
        });
    }
});

router.post('/upload-resume', requireStudent, upload.single('resume'), async (req, res) => {
    try {
        const studentId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(studentId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Please create a real account to upload resumes.'
            });
        }
        
        if (!req.file) {
            return res.json({
                success: false,
                message: 'Please select a file to upload'
            });
        }

        let studentProfile = await StudentProfile.findOne({ user: studentId });
        
        if (!studentProfile) {
            studentProfile = new StudentProfile({ 
                user: studentId,
                resume: req.file.filename
            });
        } else {
            studentProfile.resume = req.file.filename;
        }

        await studentProfile.save();

        res.json({
            success: true,
            message: 'Resume uploaded successfully!',
            filename: req.file.filename
        });
    } catch (error) {
        console.error('Resume upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload resume'
        });
    }
});

// Delete resume
router.delete('/delete-resume', requireStudent, async (req, res) => {
    try {
        const studentId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(studentId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Demo users cannot delete resumes.'
            });
        }

        const studentProfile = await StudentProfile.findOne({ user: studentId });
        
        if (!studentProfile || !studentProfile.resume) {
            return res.json({
                success: false,
                message: 'No resume found to delete'
            });
        }

        // Delete file from filesystem (optional)
        const fs = require('fs');
        const resumePath = path.join(__dirname, '../../public/uploads/resumes', studentProfile.resume);
        
        if (fs.existsSync(resumePath)) {
            fs.unlinkSync(resumePath);
        }

        // Update database
        studentProfile.resume = null;
        await studentProfile.save();

        res.json({
            success: true,
            message: 'Resume deleted successfully'
        });
    } catch (error) {
        console.error('Delete resume error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete resume'
        });
    }
});

// Delete application route
router.delete('/delete-application', async (req, res) => {
    try {
        const { applicationId } = req.body;
        const userId = req.user._id;

        if (!applicationId) {
            return res.json({ 
                success: false, 
                message: 'Application ID is required' 
            });
        }

        console.log('Deleting application:', applicationId);
        console.log('Current user ID:', userId);

        // Find application and verify ownership in one query
        const application = await Application.findOne({
            _id: applicationId,
            student: userId // This matches the student field in your schema
        });

        if (!application) {
            console.log('Application not found or unauthorized');
            return res.json({ 
                success: false, 
                message: 'Application not found or unauthorized' 
            });
        }

        console.log('Application found:', application._id);
        console.log('Application status:', application.status);

        // Only allow deletion for certain statuses
        const allowedStatuses = ['applied', 'under_review', 'shortlisted'];
        if (!allowedStatuses.includes(application.status)) {
            return res.json({ 
                success: false, 
                message: `Cannot delete application with current status: ${application.status.replace('_', ' ')}` 
            });
        }

        // Delete the application
        await Application.findByIdAndDelete(applicationId);

        console.log('Application deleted successfully');

        res.json({ 
            success: true, 
            message: 'Application deleted successfully' 
        });

    } catch (error) {
        console.error('Error deleting application:', error);
        res.json({ 
            success: false, 
            message: 'Failed to delete application' 
        });
    }
});

module.exports = router;