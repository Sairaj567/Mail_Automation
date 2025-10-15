const Job = require('../models/Job');
const Application = require('../models/Application');
const StudentProfile = require('../models/StudentProfile');
const mongoose = require('mongoose');

// Get dashboard with real data
exports.getDashboard = async (req, res) => {
    try {
        const studentId = req.session.user.id;
        
        // Check if it's a demo user (not a valid ObjectId)
        const isDemoUser = !mongoose.Types.ObjectId.isValid(studentId);
        
        if (isDemoUser) {
            // Return demo data for temporary users
            return renderDemoDashboard(req, res);
        }

        // Get counts for dashboard for real users
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

        // Get recent applications
        const recentApplications = await Application.find({ student: studentId })
            .populate('job')
            .sort({ appliedDate: -1 })
            .limit(3);

        // Get student profile
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
            profile: profile || {}, // Always pass profile, even if empty
            isDemo: false
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        // Return demo data on error
        return renderDemoDashboard(req, res);
    }
};

// Demo dashboard data
async function renderDemoDashboard(req, res) {
    // Create some demo jobs
    const demoJobs = await Job.find({ isActive: true }).limit(5);
    
    // Demo applications data
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
        isDemo: true
    });
}

// Get jobs with filters and search
exports.getJobs = async (req, res) => {
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
            jobs,
            filters: { search, jobType, experience }
        });
    } catch (error) {
        console.error('Jobs error:', error);
        res.status(500).render('error', {
            title: 'Server Error',
            message: 'Failed to load jobs'
        });
    }
};

// Get job details
exports.getJobDetails = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) {
            return res.status(404).render('404', {
                title: 'Job Not Found'
            });
        }

        const studentId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(studentId);

        let hasApplied = false;
        let applicationStatus = null;
        let isSaved = false;

        if (!isDemoUser) {
            // Check if real user has applied
            const existingApplication = await Application.findOne({
                student: studentId,
                job: req.params.id
            });

            // Check if job is saved
            const studentProfile = await StudentProfile.findOne({ 
                user: studentId 
            });
            
            hasApplied = !!existingApplication;
            applicationStatus = existingApplication?.status;
            isSaved = studentProfile?.savedJobs.includes(req.params.id);
        }

        res.render('pages/student/job-details', {
            title: `${job.title} - Placement Portal`,
            user: req.session.user,
            job,
            hasApplied,
            applicationStatus,
            isSaved,
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Job details error:', error);
        res.status(500).render('error', {
            title: 'Server Error',
            message: 'Failed to load job details'
        });
    }
};

// Apply for job
// Enhanced apply for job function
exports.applyForJob = async (req, res) => {
    try {
        const {
            jobId,
            fullName,
            email,
            phone,
            linkedin,
            college,
            degree,
            educationStatus,
            graduationYear,
            cgpa,
            marksType,
            skills,
            projects,
            extracurricular,
            coverLetterText
        } = req.body;

        const studentId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(studentId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Please create a real account to apply for jobs.'
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

        // Handle file uploads
        let resumeFilename = '';
        let coverLetterFilename = '';

        if (req.files) {
            if (req.files.resume) {
                resumeFilename = req.files.resume[0].filename;
            }
            if (req.files.coverLetterFile) {
                coverLetterFilename = req.files.coverLetterFile[0].filename;
            }
        }

        if (!resumeFilename) {
            return res.json({
                success: false,
                message: 'Please upload your resume'
            });
        }

        // Parse skills array
        const skillsArray = skills ? skills.split(',').map(skill => skill.trim()).filter(skill => skill) : [];

        // Create enhanced application
        const application = new Application({
            student: studentId,
            job: jobId,
            
            personalInfo: {
                fullName,
                email,
                phone,
                linkedin: linkedin || ''
            },
            
            education: {
                college,
                degree,
                status: educationStatus,
                graduationYear: parseInt(graduationYear),
                cgpa: parseFloat(cgpa),
                marksType: marksType || 'cgpa'
            },
            
            skills: skillsArray,
            projects: projects || '',
            extracurricular: extracurricular || '',
            
            resume: resumeFilename,
            coverLetterFile: coverLetterFilename || '',
            coverLetterText: coverLetterText || '',
            
            status: 'applied',
            
            communications: [{
                type: 'status_update',
                content: 'Application submitted successfully',
                sentBy: 'system',
                timestamp: new Date()
            }]
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
};

// Save/unsave job
exports.toggleSaveJob = async (req, res) => {
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
};

// Get applications
exports.getApplications = async (req, res) => {
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
};

// Get profile
exports.getProfile = async (req, res) => {
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
            profile,
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).render('error', {
            title: 'Server Error',
            message: 'Failed to load profile'
        });
    }
};



// Update student profile
exports.updateProfile = async (req, res) => {
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

        // Calculate profile completion
        const completion = calculateProfileCompletion(studentProfile);
        studentProfile.profileCompletion = completion;

        await studentProfile.save();

        res.json({
            success: true,
            message: 'Profile updated successfully!',
            profileCompletion: completion
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile'
        });
    }
};

// Get resume page
exports.getResume = async (req, res) => {
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
            profile,
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Resume page error:', error);
        res.status(500).render('error', {
            title: 'Server Error',
            message: 'Failed to load resume page'
        });
    }
};

// Upload resume
exports.uploadResume = async (req, res) => {
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
};

// Helper function to calculate profile completion
function calculateProfileCompletion(profile) {
    let completion = 0;
    const fields = [
        'college', 'course', 'graduationYear', 'cgpa', 
        'phone', 'skills', 'resume'
    ];

    fields.forEach(field => {
        if (profile[field] && (Array.isArray(profile[field]) ? profile[field].length > 0 : true)) {
            completion += 100 / fields.length;
        }
    });

    return Math.round(completion);
}

// Delete application
exports.deleteApplication = async (req, res) => {
    try {
        const { applicationId } = req.body;
        const studentId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(studentId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Demo users cannot delete applications.'
            });
        }

        const application = await Application.findOne({
            _id: applicationId,
            student: studentId
        });

        if (!application) {
            return res.json({
                success: false,
                message: 'Application not found'
            });
        }

        // Only allow deletion if status is 'applied'
        if (application.status !== 'applied') {
            return res.json({
                success: false,
                message: 'Cannot delete application that is already under review'
            });
        }

        await Application.findByIdAndDelete(applicationId);

        res.json({
            success: true,
            message: 'Application deleted successfully'
        });
    } catch (error) {
        console.error('Delete application error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete application'
        });
    }
};