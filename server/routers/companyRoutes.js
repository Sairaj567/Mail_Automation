const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

//file works
const multer = require('multer');
const path = require('path');

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Import controllers
const companyController = require('../controllers/companyController'); // ADD THIS LINE

// Import models
const Job = require('../models/Job');
const Application = require('../models/Application');
const CompanyProfile = require('../models/CompanyProfile');


// Configure multer for company logo uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../../public/uploads/company-logos'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'company-logo-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Middleware to check if user is company
const requireCompany = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'company') {
        next();
    } else {
        res.redirect('/auth/login?role=company');
    }
};

// Company Dashboard
router.get('/dashboard', requireCompany, async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            // Demo data for company
            return res.render('pages/company/dashboard', {
                title: 'Company Dashboard - Placement Portal',
                user: req.session.user,
                companyProfile: { // ADD THIS
                    companyName: 'Demo Tech Inc.',
                    industry: 'Technology'
                },
                stats: {
                    totalJobs: 12,
                    activeJobs: 8,
                    totalApplications: 45,
                    newApplications: 5,
                    interviews: 3
                },
                recentApplications: [
                    {
                        student: { name: 'John Doe' },
                        job: { title: 'Frontend Developer' },
                        status: 'applied',
                        appliedDate: new Date()
                    },
                    {
                        student: { name: 'Jane Smith' },
                        job: { title: 'Backend Developer' },
                        status: 'under_review',
                        appliedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
                    }
                ],
                activeJobs: [
                    {
                        title: 'Senior Software Engineer',
                        location: 'Remote',
                        type: 'Full-time',
                        description: 'We are looking for an experienced software engineer...',
                        applications: 12,
                        views: 45,
                        shortlisted: 3
                    },
                    {
                        title: 'Product Designer',
                        location: 'New York, NY', 
                        type: 'Full-time',
                        description: 'Join our design team to create amazing user experiences...',
                        applications: 8,
                        views: 32,
                        shortlisted: 2
                    }
                ],
                isDemo: true
            });
        }

        // Real company data - matching student structure
        const companyProfile = await CompanyProfile.findOne({ user: companyId }); // GET COMPANY PROFILE
        const companyJobs = await Job.find({ postedBy: companyId });
        const jobIds = companyJobs.map(job => job._id);

        const stats = {
            totalJobs: companyJobs.length,
            totalApplications: await Application.countDocuments({ job: { $in: jobIds } }),
            newApplications: await Application.countDocuments({ 
                job: { $in: jobIds },
                status: 'applied'
            }),
            interviews: await Application.countDocuments({ 
                job: { $in: jobIds },
                status: 'interview'
            })
        };

        const recentApplications = await Application.find({ 
            job: { $in: jobIds } 
        })
        .populate('job')
        .populate('student', 'name college')
        .sort({ appliedDate: -1 })
        .limit(3);

        const activeJobs = await Job.find({ 
            postedBy: companyId, 
            isActive: true 
        })
        .limit(3)
        .then(jobs => Promise.all(jobs.map(async (job) => ({
            title: job.title,
            location: job.location,
            jobType: job.jobType, // USE jobType NOT type
            applications: await Application.countDocuments({ job: job._id })
        }))));

        res.render('pages/company/dashboard', {
            title: 'Company Dashboard - Placement Portal',
            user: req.session.user,
            companyProfile: companyProfile || {}, // ADD THIS LINE - PASS COMPANY PROFILE
            stats,
            recentApplications,
            activeJobs,
            isDemo: false
        });
            }
            catch (error) {
        console.error('Company dashboard error:', error);
        // Fallback with safe data
        res.render('pages/company/dashboard', {
            title: 'Company Dashboard - Placement Portal',
            user: req.session.user,
            companyProfile: {}, // ADD THIS
            stats: {
                totalJobs: 0,
                totalApplications: 0,
                newApplications: 0,
                interviews: 0
            },
            recentApplications: [],
            activeJobs: [],
            isDemo: false
        });
    }
});


// Update company profile with file upload - CORRECTED VERSION
router.post('/update-profile', requireCompany, upload.single('companyLogo'), async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Please create a real account to update company profile.'
            });
        }

        console.log('=== UPDATE PROFILE REQUEST ===');
        console.log('Request body:', req.body);
        console.log('Request file:', req.file);
        console.log('Company ID:', companyId);

        // Extract data from form fields - SIMPLIFIED APPROACH
        const profileData = {
            companyName: req.body.companyName,
            industry: req.body.industry,
            website: req.body.website,
            size: req.body.size,
            founded: req.body.founded ? parseInt(req.body.founded) : undefined,
            contactPerson: req.body.contactPerson,
            phone: req.body.phone,
            description: req.body.description
        };

        // Handle address - CORRECTED
        if (req.body['address.street'] || req.body['address.city']) {
            profileData.address = {
                street: req.body['address.street'] || '',
                city: req.body['address.city'] || '',
                state: req.body['address.state'] || '',
                country: req.body['address.country'] || '',
                zipCode: req.body['address.zipCode'] || ''
            };
        }

        // Handle file upload
        if (req.file) {
            profileData.logo = req.file.filename;
            console.log('Logo uploaded:', req.file.filename);
        }

        console.log('Processed profile data:', profileData);

        // Find or create company profile
        let companyProfile = await CompanyProfile.findOne({ user: companyId });
        
        if (!companyProfile) {
            console.log('Creating new company profile');
            companyProfile = new CompanyProfile({ 
                user: companyId,
                ...profileData
            });
        } else {
            console.log('Updating existing company profile');
            // Update only the fields that are provided
            Object.keys(profileData).forEach(key => {
                if (profileData[key] !== undefined && profileData[key] !== '') {
                    companyProfile[key] = profileData[key];
                }
            });
        }

        // Save the profile
        await companyProfile.save();
        console.log('Profile saved successfully');

        // Update session with company name
        if (profileData.companyName) {
            req.session.user.companyName = profileData.companyName;
            console.log('Updated session company name:', profileData.companyName);
        }

        res.json({
            success: true,
            message: 'Company profile updated successfully!',
            companyName: companyProfile.companyName
        });

    } catch (error) {
        console.error('Company profile update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update company profile: ' + error.message
        });
    }
});

// Get single job for viewing/editing
router.get('/jobs/:id', requireCompany, async (req, res) => {
    try {
        const jobId = req.params.id;
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Demo companies cannot view job details.'
            });
        }

        const job = await Job.findOne({ _id: jobId, postedBy: companyId })
            .populate('applications');

        if (!job) {
            return res.status(404).render('error', {
                title: 'Job Not Found',
                message: 'Job not found or you do not have permission to view it.'
            });
        }

        // Get applications for this job
        const applications = await Application.find({ job: jobId })
            .populate('student', 'name email college skills')
            .sort({ appliedDate: -1 });

        res.render('pages/company/job-details', {
            title: `${job.title} - Job Details`,
            user: req.session.user,
            job,
            applications,
            isDemo: false
        });
    } catch (error) {
        console.error('Get job error:', error);
        res.status(500).render('error', {
            title: 'Server Error',
            message: 'Failed to load job details'
        });
    }
});

// Edit job page
router.get('/edit-job/:id', requireCompany, async (req, res) => {
    try {
        const jobId = req.params.id;
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Demo companies cannot edit jobs.'
            });
        }

        const job = await Job.findOne({ _id: jobId, postedBy: companyId });

        if (!job) {
            return res.status(404).render('error', {
                title: 'Job Not Found',
                message: 'Job not found or you do not have permission to edit it.'
            });
        }

        res.render('pages/company/edit-job', {
            title: `Edit ${job.title} - Placement Portal`,
            user: req.session.user,
            job,
            isDemo: false
        });
    } catch (error) {
        console.error('Edit job page error:', error);
        res.status(500).render('error', {
            title: 'Server Error',
            message: 'Failed to load edit job page'
        });
    }
});

// Update job
router.put('/jobs/:id', requireCompany, async (req, res) => {
    try {
        const jobId = req.params.id;
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Demo companies cannot update jobs.'
            });
        }

        const job = await Job.findOne({ _id: jobId, postedBy: companyId });

        if (!job) {
            return res.json({
                success: false,
                message: 'Job not found or you do not have permission to update it.'
            });
        }

        // Update job fields
        Object.assign(job, req.body);
        await job.save();

        res.json({
            success: true,
            message: 'Job updated successfully!',
            jobId: job._id
        });
    } catch (error) {
        console.error('Update job error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update job'
        });
    }
});

// Toggle job status (active/inactive)
router.put('/jobs/:id/status', requireCompany, async (req, res) => {
    try {
        const jobId = req.params.id;
        const companyId = req.session.user.id;
        const { isActive } = req.body;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Demo companies cannot update job status.'
            });
        }

        const job = await Job.findOne({ _id: jobId, postedBy: companyId });

        if (!job) {
            return res.json({
                success: false,
                message: 'Job not found or you do not have permission to update it.'
            });
        }

        job.isActive = isActive;
        await job.save();

        res.json({
            success: true,
            message: `Job ${isActive ? 'activated' : 'paused'} successfully!`,
            isActive: job.isActive
        });
    } catch (error) {
        console.error('Toggle job status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update job status'
        });
    }
});

// Delete job
router.delete('/jobs/:id', requireCompany, async (req, res) => {
    try {
        const jobId = req.params.id;
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Demo companies cannot delete jobs.'
            });
        }

        const job = await Job.findOne({ _id: jobId, postedBy: companyId });

        if (!job) {
            return res.json({
                success: false,
                message: 'Job not found or you do not have permission to delete it.'
            });
        }

        // Delete associated applications first
        await Application.deleteMany({ job: jobId });

        // Delete the job
        await Job.findByIdAndDelete(jobId);

        // Remove job from company profile
        await CompanyProfile.findOneAndUpdate(
            { user: companyId },
            { $pull: { jobsPosted: jobId } }
        );

        res.json({
            success: true,
            message: 'Job deleted successfully!'
        });
    } catch (error) {
        console.error('Delete job error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete job'
        });
    }
});

// Company Profile View Page
router.get('/profile-view', requireCompany, async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        let companyProfile = null;
        if (!isDemoUser) {
            companyProfile = await CompanyProfile.findOne({ user: companyId });
        } else {
            companyProfile = {
                companyName: 'Demo Tech Inc.',
                industry: 'Technology',
                website: 'https://demotech.com',
                description: 'A leading technology company specializing in innovative solutions.',
                contactPerson: 'Demo Company',
                phone: '+1-555-0123',
                address: {
                    street: '123 Tech Street',
                    city: 'San Francisco',
                    state: 'CA',
                    country: 'USA',
                    zipCode: '94105'
                },
                size: '51-200',
                founded: 2015
            };
        }

        res.render('pages/company/profile-view', {
            title: 'Company Profile - Placement Portal',
            user: req.session.user,
            companyProfile: companyProfile || {},
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Profile view error:', error);
        res.status(500).render('error', {
            title: 'Server Error',
            message: 'Failed to load company profile'
        });
    }
});

// Get job analytics
router.get('/jobs/:id/analytics', requireCompany, async (req, res) => {
    try {
        const jobId = req.params.id;
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Demo companies cannot view job analytics.'
            });
        }

        const job = await Job.findOne({ _id: jobId, postedBy: companyId });

        if (!job) {
            return res.json({
                success: false,
                message: 'Job not found'
            });
        }

        // Get application statistics
        const applicationsByStatus = await Application.aggregate([
            { $match: { job: job._id } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const applicationsOverTime = await Application.aggregate([
            { $match: { job: job._id } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$appliedDate" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const totalApplications = await Application.countDocuments({ job: job._id });
        const uniqueApplicants = await Application.distinct('student', { job: job._id });

        res.json({
            success: true,
            analytics: {
                applicationsByStatus,
                applicationsOverTime,
                totalApplications,
                uniqueApplicants: uniqueApplicants.length,
                jobViews: job.views || 0
            }
        });
    } catch (error) {
        console.error('Job analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load job analytics'
        });
    }
});

// Duplicate job
router.post('/jobs/:id/duplicate', requireCompany, async (req, res) => {
    try {
        const jobId = req.params.id;
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Demo companies cannot duplicate jobs.'
            });
        }

        const originalJob = await Job.findOne({ _id: jobId, postedBy: companyId });

        if (!originalJob) {
            return res.json({
                success: false,
                message: 'Job not found or you do not have permission to duplicate it.'
            });
        }

        // Create a copy of the job
        const jobData = originalJob.toObject();
        delete jobData._id;
        delete jobData.createdAt;
        delete jobData.updatedAt;
        
        jobData.title = `${jobData.title} (Copy)`;
        jobData.isActive = false; // Start as inactive
        jobData.views = 0;

        const newJob = new Job(jobData);
        await newJob.save();

        // Add to company profile
        await CompanyProfile.findOneAndUpdate(
            { user: companyId },
            { $push: { jobsPosted: newJob._id } }
        );

        res.json({
            success: true,
            message: 'Job duplicated successfully!',
            jobId: newJob._id
        });
    } catch (error) {
        console.error('Duplicate job error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to duplicate job'
        });
    }
});

// Manage Jobs Page - UPDATED
router.get('/jobs', requireCompany, async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        let jobs = [];
        let companyProfile = null;
        
        if (!isDemoUser) {
            jobs = await Job.find({ postedBy: companyId }).sort({ createdAt: -1 });
            companyProfile = await CompanyProfile.findOne({ user: companyId });
        } else {
            // Demo jobs
            jobs = [
                {
                    _id: '1',
                    title: 'Frontend Developer',
                    company: 'Demo Tech Inc.',
                    location: 'Remote',
                    jobType: 'fulltime',
                    salary: '$80,000 - $100,000',
                    isActive: true,
                    createdAt: new Date(),
                    applicationsCount: 8
                },
                {
                    _id: '2',
                    title: 'Backend Engineer',
                    company: 'Demo Tech Inc.',
                    location: 'New York, NY',
                    jobType: 'fulltime',
                    salary: '$90,000 - $120,000',
                    isActive: true,
                    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    applicationsCount: 12
                }
            ];
            companyProfile = {
                companyName: 'Demo Tech Inc.'
            };
        }

        res.render('pages/company/jobs', {
            title: 'Manage Jobs - Placement Portal',
            user: req.session.user,
            jobs,
            companyProfile: companyProfile || {},
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Manage jobs error:', error);
        res.status(500).render('error', {
            title: 'Server Error',
            message: 'Failed to load jobs'
        });
    }
});

// Enhanced Applicants with Filters
router.get('/applicants', requireCompany, async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const { status, job, search } = req.query;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        let applications = [];
        let companyJobs = [];
        let companyProfile = null;
        
        if (!isDemoUser) {
            companyJobs = await Job.find({ postedBy: companyId });
            companyProfile = await CompanyProfile.findOne({ user: companyId });
            
            let filter = { job: { $in: companyJobs.map(job => job._id) } };
            
            // Apply filters
            if (status && status !== 'all') filter.status = status;
            if (job && job !== 'all') filter.job = job;
            if (search) {
                filter.$or = [
                    { 'student.name': { $regex: search, $options: 'i' } },
                    { 'job.title': { $regex: search, $options: 'i' } },
                    { 'student.college': { $regex: search, $options: 'i' } }
                ];
            }

            applications = await Application.find(filter)
                .populate('job')
                .populate('student', 'name email college skills')
                .sort({ appliedDate: -1 });
        } else {
            // Demo data with enhanced info
            companyJobs = [
                { _id: '1', title: 'Frontend Developer' },
                { _id: '2', title: 'Backend Engineer' },
                { _id: '3', title: 'Product Manager' }
            ];
            
            companyProfile = {
                companyName: 'Demo Tech Inc.'
            };
            
            applications = [
                {
                    _id: '1',
                    student: { 
                        name: 'John Doe', 
                        email: 'john@demo.com',
                        college: 'Tech University',
                        skills: ['JavaScript', 'React', 'Node.js', 'HTML', 'CSS']
                    },
                    job: { _id: '1', title: 'Frontend Developer' },
                    status: 'applied',
                    appliedDate: new Date(),
                    resume: 'resume-john.pdf',
                    coverLetter: 'I am excited to apply for the Frontend Developer position at your company. I have 2 years of experience in React and JavaScript development, and I believe my skills align perfectly with your requirements.\n\nI have worked on several projects including e-commerce platforms and dashboard applications. I am passionate about creating user-friendly interfaces and am always eager to learn new technologies.'
                },
                {
                    _id: '2',
                    student: { 
                        name: 'Jane Smith', 
                        email: 'jane@demo.com',
                        college: 'Engineering College',
                        skills: ['Python', 'Django', 'AWS', 'MySQL', 'Docker']
                    },
                    job: { _id: '2', title: 'Backend Engineer' },
                    status: 'under_review',
                    appliedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                    resume: 'resume-jane.pdf',
                    coverLetter: 'I am writing to express my interest in the Backend Engineer position. With 3 years of experience in Python and Django development, I have successfully built scalable backend systems for various applications.\n\nMy expertise includes API development, database design, and cloud deployment. I am particularly interested in your company because of your innovative approach to technology.'
                },
                {
                    _id: '3',
                    student: { 
                        name: 'Mike Chen', 
                        email: 'mike@demo.com',
                        college: 'Business School',
                        skills: ['Product Management', 'Agile', 'User Research', 'Data Analysis']
                    },
                    job: { _id: '3', title: 'Product Manager' },
                    status: 'interview',
                    appliedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
                    resume: 'resume-mike.pdf',
                    coverLetter: 'I am thrilled to apply for the Product Manager position. With my background in technology and business, I have successfully led product teams to deliver innovative solutions that drive user engagement and business growth.\n\nI am impressed by your company\'s product portfolio and would love to contribute to your continued success.'
                }
            ];
        }

        res.render('pages/company/applicants', {
            title: 'Applicants - Placement Portal',
            user: req.session.user,
            applications,
            companyJobs,
            companyProfile: companyProfile || {},
            filters: { status: status || '', job: job || '', search: search || '' },
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Applicants error:', error);
        res.status(500).render('error', {
            title: 'Server Error',
            message: 'Failed to load applicants'
        });
    }
});

// Company Profile Page
router.get('/profile', requireCompany, async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        let companyProfile = null;
        if (!isDemoUser) {
            companyProfile = await CompanyProfile.findOne({ user: companyId });
        } else {
            companyProfile = {
                companyName: 'Demo Tech Inc.',
                industry: 'Technology',
                website: 'https://demotech.com',
                description: 'A leading technology company specializing in innovative solutions.',
                contactPerson: 'Demo Company',
                phone: '+1-555-0123',
                address: {
                    street: '123 Tech Street',
                    city: 'San Francisco',
                    state: 'CA',
                    country: 'USA',
                    zipCode: '94105'
                },
                size: '51-200',
                founded: 2015
            };
        }

        res.render('pages/company/profile', {
            title: 'Company Profile - Placement Portal',
            user: req.session.user,
            companyProfile: companyProfile || {},
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Company profile error:', error);
        res.status(500).render('error', {
            title: 'Server Error',
            message: 'Failed to load company profile'
        });
    }
});

// Post Job Page
router.get('/post-job', requireCompany, async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        let companyProfile = null;
        if (!isDemoUser) {
            companyProfile = await CompanyProfile.findOne({ user: companyId });
        }

        res.render('pages/company/post-job', {
            title: 'Post New Job - Placement Portal',
            user: req.session.user,
            companyProfile: companyProfile || {},
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Post job page error:', error);
        res.status(500).render('error', {
            title: 'Server Error',
            message: 'Failed to load post job page'
        });
    }
});

// Handle job posting
router.post('/post-job', requireCompany, async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Demo companies cannot post jobs. Please create a real account.'
            });
        }

        const {
            title,
            location,
            jobType,
            salary,
            description,
            requirements,
            responsibilities,
            benefits,
            skills,
            experienceLevel,
            applicationDeadline,
            vacancies
        } = req.body;

        // Get company profile for company name
        const companyProfile = await CompanyProfile.findOne({ user: companyId });
        const companyName = companyProfile?.companyName || req.session.user.name;

        // Convert requirements and responsibilities from strings to arrays if needed
        const requirementsArray = requirements ? requirements.split('\n').filter(req => req.trim()) : [];
        const responsibilitiesArray = responsibilities ? responsibilities.split('\n').filter(resp => resp.trim()) : [];
        const benefitsArray = benefits ? benefits.split('\n').filter(benefit => benefit.trim()) : [];
        const skillsArray = skills ? skills.split(',').map(skill => skill.trim()).filter(skill => skill) : [];

        const jobData = {
            title,
            company: companyName,
            location,
            jobType,
            salary,
            description,
            requirements: requirementsArray,
            responsibilities: responsibilitiesArray,
            benefits: benefitsArray,
            skills: skillsArray,
            experienceLevel,
            applicationDeadline: applicationDeadline || null,
            vacancies: vacancies ? parseInt(vacancies) : 1,
            postedBy: companyId,
            isActive: true
        };

        const newJob = new Job(jobData);
        await newJob.save();

        // Add job to company profile
        await CompanyProfile.findOneAndUpdate(
            { user: companyId },
            { $push: { jobsPosted: newJob._id } }
        );

        res.json({
            success: true,
            message: 'Job posted successfully!',
            jobId: newJob._id
        });
    } catch (error) {
        console.error('Post job error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to post job: ' + error.message
        });
    }
});

// Update application status
router.post('/update-application-status', requireCompany, async (req, res) => {
    try {
        const { applicationId, status } = req.body;
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Demo companies cannot update applications.'
            });
        }

        await Application.findByIdAndUpdate(applicationId, { status });

        res.json({
            success: true,
            message: 'Application status updated successfully!'
        });
    } catch (error) {
        console.error('Update application status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update application status'
        });
    }
});

// Analytics Page - UPDATED FOR YOUR SCHEMA
router.get('/analytics', requireCompany, async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        let analytics = {};
        if (!isDemoUser) {
            const companyJobs = await Job.find({ postedBy: companyId });
            const jobIds = companyJobs.map(job => job._id);
            
            // Applications by status
            const applicationsByStatus = await Application.aggregate([
                { $match: { job: { $in: jobIds } } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]);
            
            // Convert to object format that the view expects
            const statusCounts = {};
            applicationsByStatus.forEach(item => {
                statusCounts[item._id] = item.count;
            });

            // Applications over time (last 30 days)
            const applicationsOverTime = await Application.aggregate([
                { 
                    $match: { 
                        job: { $in: jobIds },
                        appliedDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                    } 
                },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$appliedDate" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            // Get popular jobs
            const popularJobs = await Application.aggregate([
                { $match: { job: { $in: jobIds } } },
                { $group: { _id: '$job', applications: { $sum: 1 } } },
                { $sort: { applications: -1 } },
                { $limit: 5 }
            ]);

            const popularJobsWithDetails = await Promise.all(
                popularJobs.map(async (job) => {
                    const jobDetails = await Job.findById(job._id);
                    return {
                        title: jobDetails?.title || 'Unknown Job',
                        applications: job.applications
                    };
                })
            );

            // Get college demographics - FIXED FOR YOUR SCHEMA
            const collegeDemographics = await Application.aggregate([
                { $match: { job: { $in: jobIds } } },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'student',
                        foreignField: '_id',
                        as: 'studentData'
                    }
                },
                { $unwind: '$studentData' },
                { 
                    $group: { 
                        _id: '$studentData.studentProfile.college', 
                        count: { $sum: 1 } 
                    } 
                },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]);

            const collegeData = collegeDemographics.map(item => ({
                college: item._id || 'College not specified',
                count: item.count
            }));

            // Get skills analysis - FIXED FOR YOUR SCHEMA
            const skillsAnalysis = await Application.aggregate([
                { $match: { job: { $in: jobIds } } },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'student',
                        foreignField: '_id',
                        as: 'studentData'
                    }
                },
                { $unwind: '$studentData' },
                { $unwind: '$studentData.studentProfile.skills' },
                { 
                    $group: { 
                        _id: '$studentData.studentProfile.skills', 
                        count: { $sum: 1 } 
                    } 
                },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]);

            const totalApplications = await Application.countDocuments({ job: { $in: jobIds } });
            const hiredCount = statusCounts['accepted'] || 0; // Note: your schema uses 'accepted' not 'hired'
            const interviewCount = statusCounts['interview'] || 0;

            analytics = {
                overview: {
                    totalJobs: companyJobs.length,
                    totalApplications: totalApplications,
                    hiredCount: hiredCount,
                    interviewCount: interviewCount,
                    conversionRate: totalApplications > 0 ? Math.round((hiredCount / totalApplications) * 100) : 0,
                    interviewToHireRate: interviewCount > 0 ? Math.round((hiredCount / interviewCount) * 100) : 0
                },
                applicationsByStatus: statusCounts,
                applicationsOverTime: applicationsOverTime,
                popularJobs: popularJobsWithDetails,
                collegeDemographics: collegeData,
                skillsAnalysis: skillsAnalysis,
                timePeriod: 'last_30_days'
            };
        } else {
            // Demo analytics - STRUCTURED PROPERLY
            analytics = {
                overview: {
                    totalJobs: 12,
                    totalApplications: 156,
                    hiredCount: 8,
                    interviewCount: 24,
                    conversionRate: 5,
                    interviewToHireRate: 33
                },
                applicationsByStatus: {
                    applied: 45,
                    under_review: 32,
                    shortlisted: 18,
                    interview: 24,
                    rejected: 29,
                    accepted: 8  // Note: using 'accepted' to match your schema
                },
                applicationsOverTime: [
                    { _id: '2024-01-01', count: 5 },
                    { _id: '2024-01-02', count: 8 },
                    { _id: '2024-01-03', count: 12 },
                    { _id: '2024-01-04', count: 7 },
                    { _id: '2024-01-05', count: 15 },
                    { _id: '2024-01-06', count: 9 },
                    { _id: '2024-01-07', count: 11 }
                ],
                popularJobs: [
                    { title: 'Senior Software Engineer', applications: 45 },
                    { title: 'Frontend Developer', applications: 38 },
                    { title: 'Product Manager', applications: 32 },
                    { title: 'Data Analyst', applications: 25 },
                    { title: 'UX Designer', applications: 16 }
                ],
                collegeDemographics: [
                    { college: 'Tech University', count: 34 },
                    { college: 'Engineering College', count: 28 },
                    { college: 'Business School', count: 22 },
                    { college: 'Science Institute', count: 18 },
                    { college: 'Arts College', count: 12 }
                ],
                skillsAnalysis: [
                    { _id: 'JavaScript', count: 45 },
                    { _id: 'React', count: 38 },
                    { _id: 'Node.js', count: 32 },
                    { _id: 'Python', count: 28 },
                    { _id: 'SQL', count: 25 }
                ],
                timePeriod: 'last_30_days'
            };
        }

        res.render('pages/company/analytics', {
            title: 'Analytics Dashboard - Placement Portal',
            user: req.session.user,
            analytics: analytics,
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Analytics error:', error);
        // Fallback with safe structure
        res.render('pages/company/analytics', {
            title: 'Analytics Dashboard - Placement Portal',
            user: req.session.user,
            analytics: {
                overview: {
                    totalJobs: 0,
                    totalApplications: 0,
                    hiredCount: 0,
                    interviewCount: 0,
                    conversionRate: 0,
                    interviewToHireRate: 0
                },
                applicationsByStatus: {},
                applicationsOverTime: [],
                popularJobs: [],
                collegeDemographics: [],
                skillsAnalysis: []
            },
            isDemo: false
        });
    }
});

// Enhanced Applicants with Filters
router.get('/applicants', requireCompany, async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const { status, job, search } = req.query;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        let applications = [];
        let companyJobs = [];
        
        if (!isDemoUser) {
            companyJobs = await Job.find({ postedBy: companyId });
            
            let filter = { job: { $in: companyJobs.map(job => job._id) } };
            
            // Apply filters
            if (status && status !== 'all') filter.status = status;
            if (job && job !== 'all') filter.job = job;
            if (search) {
                filter.$or = [
                    { 'student.name': { $regex: search, $options: 'i' } },
                    { 'job.title': { $regex: search, $options: 'i' } }
                ];
            }

            applications = await Application.find(filter)
                .populate('job')
                .populate('student', 'name email college skills')
                .sort({ appliedDate: -1 });
        } else {
            // Demo data with enhanced info
            companyJobs = [
                { _id: '1', title: 'Frontend Developer' },
                { _id: '2', title: 'Backend Engineer' },
                { _id: '3', title: 'Product Manager' }
            ];
            
            applications = [
                {
                    _id: '1',
                    student: { 
                        name: 'John Doe', 
                        email: 'john@demo.com',
                        college: 'Tech University',
                        skills: ['JavaScript', 'React', 'Node.js']
                    },
                    job: { _id: '1', title: 'Frontend Developer' },
                    status: 'applied',
                    appliedDate: new Date(),
                    resume: 'resume-john.pdf',
                    coverLetter: 'I am excited to apply for this position...'
                },
                {
                    _id: '2',
                    student: { 
                        name: 'Jane Smith', 
                        email: 'jane@demo.com',
                        college: 'Engineering College',
                        skills: ['Python', 'Django', 'AWS']
                    },
                    job: { _id: '2', title: 'Backend Engineer' },
                    status: 'under_review',
                    appliedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                    resume: 'resume-jane.pdf',
                    coverLetter: 'I have extensive experience in backend development...'
                }
            ];
        }

        res.render('pages/company/applicants', {
            title: 'Applicants - Placement Portal',
            user: req.session.user,
            applications,
            companyJobs,
            filters: { status: status || 'all', job: job || 'all', search: search || '' },
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Applicants error:', error);
        res.status(500).render('error', {
            title: 'Server Error',
            message: 'Failed to load applicants'
        });
    }
});

// Analytics routes - ADD THESE AT THE BOTTOM BEFORE module.exports
router.get('/analytics', requireCompany, companyController.getAnalytics);

// Analytics data API endpoint
router.get('/analytics/data', requireCompany, async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const { period = '30d' } = req.query;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            // Return demo data for different periods
            const demoData = getDemoAnalyticsData(period);
            return res.json({
                success: true,
                data: demoData
            });
        }

        // Your real data logic here...
        const companyJobs = await Job.find({ postedBy: companyId });
        const jobIds = companyJobs.map(job => job._id);

        // Calculate date range based on period
        let startDate;
        const endDate = new Date();
        
        switch (period) {
            case '7d':
                startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        }

        // Applications over time
        const applicationsOverTime = await Application.aggregate([
            { 
                $match: { 
                    job: { $in: jobIds },
                    appliedDate: { $gte: startDate, $lte: endDate }
                } 
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$appliedDate" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Status distribution
        const statusDistribution = await Application.aggregate([
            { $match: { job: { $in: jobIds } } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Job performance
        const jobPerformance = await Application.aggregate([
            { $match: { job: { $in: jobIds } } },
            { $group: { _id: '$job', applications: { $sum: 1 } } },
            { $sort: { applications: -1 } },
            { $limit: 5 }
        ]);

        const jobPerformanceWithDetails = await Promise.all(
            jobPerformance.map(async (job) => {
                const jobDetails = await Job.findById(job._id);
                return {
                    jobTitle: jobDetails?.title || 'Unknown Job',
                    applications: job.applications
                };
            })
        );

        res.json({
            success: true,
            data: {
                applicationsOverTime,
                statusDistribution,
                jobPerformance: jobPerformanceWithDetails,
                period: period
            }
        });

    } catch (error) {
        console.error('Analytics data error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load analytics data'
        });
    }
});

// Helper function for demo analytics data
function getDemoAnalyticsData(period) {
    const baseData = {
        applicationsOverTime: [
            { _id: '2024-01-01', count: 5 },
            { _id: '2024-01-02', count: 8 },
            { _id: '2024-01-03', count: 12 }
        ],
        statusDistribution: [
            { _id: 'applied', count: 45 },
            { _id: 'under_review', count: 32 },
            { _id: 'shortlisted', count: 18 },
            { _id: 'interview', count: 24 },
            { _id: 'rejected', count: 29 },
            { _id: 'accepted', count: 8 }
        ],
        jobPerformance: [
            { jobTitle: 'Senior Software Engineer', applications: 45 },
            { jobTitle: 'Frontend Developer', applications: 38 },
            { jobTitle: 'Product Manager', applications: 32 }
        ]
    };

    return baseData;
}

// Export to Excel
router.get('/analytics/export/excel', requireCompany, async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Demo companies cannot export data.'
            });
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Analytics Data');

        // Get analytics data
        const companyJobs = await Job.find({ postedBy: companyId });
        const jobIds = companyJobs.map(job => job._id);

        // Applications by status
        const applicationsByStatus = await Application.aggregate([
            { $match: { job: { $in: jobIds } } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Add headers
        worksheet.columns = [
            { header: 'Metric', key: 'metric', width: 30 },
            { header: 'Value', key: 'value', width: 20 }
        ];

        // Add overview data
        worksheet.addRow({ metric: 'Total Jobs', value: companyJobs.length });
        worksheet.addRow({ metric: 'Total Applications', value: await Application.countDocuments({ job: { $in: jobIds } }) });
        
        // Add status distribution
        worksheet.addRow({ metric: '', value: '' }); // Empty row
        worksheet.addRow({ metric: 'APPLICATION STATUS', value: 'COUNT' });
        
        applicationsByStatus.forEach(status => {
            worksheet.addRow({ 
                metric: status._id.toUpperCase().replace('_', ' '), 
                value: status.count 
            });
        });

        // Add popular jobs
        worksheet.addRow({ metric: '', value: '' }); // Empty row
        worksheet.addRow({ metric: 'POPULAR JOBS', value: 'APPLICATIONS' });
        
        const popularJobs = await Application.aggregate([
            { $match: { job: { $in: jobIds } } },
            { $group: { _id: '$job', applications: { $sum: 1 } } },
            { $sort: { applications: -1 } },
            { $limit: 10 }
        ]);

        for (const job of popularJobs) {
            const jobDetails = await Job.findById(job._id);
            worksheet.addRow({ 
                metric: jobDetails?.title || 'Unknown Job', 
                value: job.applications 
            });
        }

        // Set response headers for Excel download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=analytics-report.xlsx');

        // Write to response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Excel export error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export Excel file'
        });
    }
});

// Export to PDF
router.get('/analytics/export/pdf', requireCompany, async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Demo companies cannot export data.'
            });
        }

        const doc = new PDFDocument();
        
        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=analytics-report.pdf');

        doc.pipe(res);

        // Add content to PDF
        doc.fontSize(20).text('Analytics Report', { align: 'center' });
        doc.moveDown();
        
        // Get analytics data
        const companyJobs = await Job.find({ postedBy: companyId });
        const jobIds = companyJobs.map(job => job._id);
        const totalApplications = await Application.countDocuments({ job: { $in: jobIds } });

        // Overview section
        doc.fontSize(16).text('Overview', { underline: true });
        doc.fontSize(12);
        doc.text(`Total Jobs: ${companyJobs.length}`);
        doc.text(`Total Applications: ${totalApplications}`);
        doc.moveDown();

        // Applications by status
        doc.fontSize(16).text('Application Status', { underline: true });
        const applicationsByStatus = await Application.aggregate([
            { $match: { job: { $in: jobIds } } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        applicationsByStatus.forEach(status => {
            doc.text(`${status._id.toUpperCase().replace('_', ' ')}: ${status.count}`);
        });

        doc.moveDown();

        // Popular jobs
        doc.fontSize(16).text('Popular Jobs', { underline: true });
        const popularJobs = await Application.aggregate([
            { $match: { job: { $in: jobIds } } },
            { $group: { _id: '$job', applications: { $sum: 1 } } },
            { $sort: { applications: -1 } },
            { $limit: 5 }
        ]);

        for (const job of popularJobs) {
            const jobDetails = await Job.findById(job._id);
            doc.text(`${jobDetails?.title || 'Unknown Job'}: ${job.applications} applications`);
        }

        // Footer
        doc.moveDown();
        doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });

        doc.end();

    } catch (error) {
        console.error('PDF export error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export PDF file'
        });
    }
});

// Generate Full Report (HTML/PDF with more details)
router.get('/analytics/export/full-report', requireCompany, async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Demo companies cannot export data.'
            });
        }

        // Get comprehensive analytics data
        const companyJobs = await Job.find({ postedBy: companyId });
        const jobIds = companyJobs.map(job => job._id);

        const analyticsData = {
            overview: {
                totalJobs: companyJobs.length,
                totalApplications: await Application.countDocuments({ job: { $in: jobIds } }),
                activeJobs: await Job.countDocuments({ postedBy: companyId, isActive: true })
            },
            applicationsByStatus: await Application.aggregate([
                { $match: { job: { $in: jobIds } } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            popularJobs: await Application.aggregate([
                { $match: { job: { $in: jobIds } } },
                { $group: { _id: '$job', applications: { $sum: 1 } } },
                { $sort: { applications: -1 } },
                { $limit: 10 }
            ]),
            recentApplications: await Application.find({ job: { $in: jobIds } })
                .populate('job')
                .populate('student', 'name college')
                .sort({ appliedDate: -1 })
                .limit(20)
        };

        // Populate job details for popular jobs
        analyticsData.popularJobsWithDetails = await Promise.all(
            analyticsData.popularJobs.map(async (job) => {
                const jobDetails = await Job.findById(job._id);
                return {
                    title: jobDetails?.title || 'Unknown Job',
                    applications: job.applications,
                    location: jobDetails?.location,
                    jobType: jobDetails?.jobType
                };
            })
        );

        // Render the full report as HTML (you can convert to PDF later if needed)
        res.render('pages/company/analytics-report', {
            title: 'Analytics Report - Placement Portal',
            analytics: analyticsData,
            companyName: req.session.user.name,
            generatedDate: new Date().toLocaleDateString()
        });

    } catch (error) {
        console.error('Full report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate full report'
        });
    }
});


// Get applicant details - FIXED VERSION
router.get('/applicants/:id', requireCompany, async (req, res) => {
    try {
        const applicationId = req.params.id;
        const companyId = req.session.user.id;

        const application = await Application.findById(applicationId)
            .populate('job')
            .populate('student', 'name email');

        if (!application) {
            return res.status(404).render('error', {
                title: 'Application Not Found',
                message: 'The requested application was not found.'
            });
        }

        // Verify the job belongs to the company
        const job = await Job.findOne({ 
            _id: application.job._id, 
            postedBy: companyId 
        });

        if (!job) {
            return res.status(403).render('error', {
                title: 'Access Denied',
                message: 'You do not have permission to view this application.'
            });
        }

        res.render('pages/company/applicant-details', {
            title: 'Applicant Details - Placement Portal',
            user: req.session.user,
            application: application
        });
    } catch (error) {
        console.error('Applicant details error:', error);
        res.status(500).render('error', {
            title: 'Server Error',
            message: 'Failed to load applicant details'
        });
    }
});


// Schedule interview
router.post('/schedule-interview', requireCompany, async (req, res) => {
    try {
        const { applicationId, scheduledDate, interviewType, interviewLink, location, notes } = req.body;

        await Application.findByIdAndUpdate(applicationId, {
            status: 'interview',
            interviewSchedule: {
                scheduledDate: new Date(scheduledDate),
                interviewType,
                interviewLink: interviewLink || '',
                location: location || '',
                notes: notes || ''
            },
            $push: {
                communications: {
                    type: 'interview_invite',
                    content: `Interview scheduled for ${new Date(scheduledDate).toLocaleString()}`,
                    sentBy: 'company',
                    timestamp: new Date()
                }
            }
        });

        res.json({
            success: true,
            message: 'Interview scheduled successfully!'
        });
    } catch (error) {
        console.error('Schedule interview error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to schedule interview'
        });
    }
});

// Send chat message
router.post('/send-message', requireCompany, async (req, res) => {
    try {
        const { applicationId, message } = req.body;

        await Application.findByIdAndUpdate(applicationId, {
            $push: {
                chatMessages: {
                    sender: 'company',
                    message: message,
                    timestamp: new Date(),
                    read: false
                }
            }
        });

        res.json({
            success: true,
            message: 'Message sent successfully!'
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send message'
        });
    }
});

module.exports = router;