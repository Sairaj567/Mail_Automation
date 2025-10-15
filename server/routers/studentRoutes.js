const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');

// Import models
const Job = require('../models/Job');
const Application = require('../models/Application');
const StudentProfile = require('../models/StudentProfile');
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
router.get('/dashboard', requireStudent, async (req, res) => {
    try {
        const studentId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(studentId);
        
        if (isDemoUser) {
            // Return demo data for temporary users
            const demoJobs = await Job.find({ isActive: true }).limit(5);
            const demoApplications = demoJobs.slice(0, 3).map(job => ({
                job: job,
                status: ['applied', 'under_review', 'shortlisted'][Math.floor(Math.random() * 3)],
                appliedDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
            }));

            res.render('pages/student/dashboard', {
                title: 'Student Dashboard - Placement Portal',
                user: req.session.user,
                stats: {
                    totalJobs: demoJobs.length,
                    applications: 8,
                    pendingApplications: 5,
                    interviews: 2
                },
                recentApplications: demoApplications,
                profile: { profileCompletion: 65 },
                isDemo: true
            });
        } else {
            // Real user data
            const totalJobs = await Job.countDocuments({ isActive: true });
            const applications = await Application.countDocuments({ student: studentId });
            const pendingApplications = await Application.countDocuments({ 
                student: studentId, 
                status: { $in: ['applied', 'under_review', 'shortlisted'] } 
            });
            const interviews = await Application.countDocuments({ 
                student: studentId, 
                status: 'interview' 
            });

            const recentApplications = await Application.find({ student: studentId })
                .populate('job')
                .sort({ appliedDate: -1 })
                .limit(3);

            const profile = await StudentProfile.findOne({ user: studentId });

            res.render('pages/student/dashboard', {
                title: 'Student Dashboard - Placement Portal',
                user: req.session.user,
                stats: {
                    totalJobs,
                    applications,
                    pendingApplications,
                    interviews
                },
                recentApplications,
                profile: profile || { profileCompletion: 0 },
                isDemo: false
            });
        }
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', {
            title: 'Server Error',
            message: 'Failed to load dashboard'
        });
    }
});

// Jobs route - FIXED
router.get('/jobs', requireStudent, async (req, res) => {
    try {
        const { search, jobType, experience } = req.query;
        let filter = { isActive: true };

        // Apply filters
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { company: { $regex: search, $options: 'i' } },
                { skills: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        if (jobType) filter.jobType = jobType;
        if (experience) filter.experienceLevel = experience;

        const jobs = await Job.find(filter).sort({ createdAt: -1 });

        res.render('pages/student/jobs', {
            title: 'Job Listings - Placement Portal',
            user: req.session.user,
            jobs: jobs || [],
            filters: { search: search || '', jobType: jobType || '', experience: experience || '' },
            isDemo: !mongoose.Types.ObjectId.isValid(req.session.user.id)
        });
    } catch (error) {
        console.error('Jobs error:', error);
        res.render('pages/student/jobs', {
            title: 'Job Listings - Placement Portal',
            user: req.session.user,
            jobs: [],
            filters: { search: '', jobType: '', experience: '' },
            isDemo: true
        });
    }
});

// Job details
router.get('/jobs/:id', requireStudent, async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) {
            return res.status(404).render('404', {
                title: 'Job Not Found'
            });
        }

        const studentId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(studentId);

        res.render('pages/student/job-details', {
            title: `${job.title} - Placement Portal`,
            user: req.session.user,
            job,
            hasApplied: false,
            applicationStatus: null,
            isSaved: false,
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Job details error:', error);
        res.status(500).render('error', {
            title: 'Server Error',
            message: 'Failed to load job details'
        });
    }
});

// Applications
router.get('/applications', requireStudent, async (req, res) => {
    try {
        const studentId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(studentId);
        
        if (isDemoUser) {
            // Return demo applications
            const demoJobs = await Job.find({ isActive: true }).limit(5);
            const demoApplications = demoJobs.map(job => ({
                job: job,
                status: ['applied', 'under_review', 'shortlisted', 'interview', 'rejected'][Math.floor(Math.random() * 5)],
                appliedDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
            }));
            
            return res.render('pages/student/applications', {
                title: 'My Applications - Placement Portal',
                user: req.session.user,
                applications: demoApplications,
                isDemo: true
            });
        }

        const applications = await Application.find({ student: studentId })
            .populate('job')
            .sort({ appliedDate: -1 });

        res.render('pages/student/applications', {
            title: 'My Applications - Placement Portal',
            user: req.session.user,
            applications,
            isDemo: false
        });
    } catch (error) {
        console.error('Applications error:', error);
        res.status(500).render('error', {
            title: 'Server Error',
            message: 'Failed to load applications'
        });
    }
});

// Profile
router.get('/profile', requireStudent, async (req, res) => {
    try {
        const studentId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(studentId);
        
        let profile = null;
        
        if (!isDemoUser) {
            profile = await StudentProfile.findOne({ user: studentId });
        }

        res.render('pages/student/profile', {
            title: 'Student Profile - Placement Portal',
            user: req.session.user,
            profile: profile || {},
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).render('error', {
            title: 'Server Error',
            message: 'Failed to load profile'
        });
    }
});

// Resume
router.get('/resume', requireStudent, async (req, res) => {
    try {
        const studentId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(studentId);
        
        let profile = null;
        
        if (!isDemoUser) {
            profile = await StudentProfile.findOne({ user: studentId });
        }

        res.render('pages/student/resume', {
            title: 'My Resume - Placement Portal',
            user: req.session.user,
            profile: profile || {},
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Resume page error:', error);
        res.status(500).render('error', {
            title: 'Server Error',
            message: 'Failed to load resume page'
        });
    }
});

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