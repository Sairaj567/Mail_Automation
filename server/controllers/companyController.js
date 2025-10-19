// server/controllers/companyController.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Needed for potential user creation
const Job = require('../models/Job');
const Application = require('../models/Application');
const CompanyProfile = require('../models/CompanyProfile');
const User = require('../models/User'); // Make sure User model is imported
const ExcelJS = require('exceljs'); // For Excel export
const PDFDocument = require('pdfkit'); // For PDF export

// --- Helper Functions ---
const isDemo = (req) => Boolean(req.session?.user?.isDemo);
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Mongoose version to ensure profile exists (copied from student controller logic)
const ensureCompanyProfile = async (userId, name, industry = '') => {
    let profile = await CompanyProfile.findOne({ user: userId });
    if (!profile) {
         console.log(`Creating new company profile for user: ${userId}`);
        profile = await CompanyProfile.create({
            user: userId,
            companyName: name || 'Demo Company', // Use provided name or default
            industry: industry || '',
            // Initialize other fields if necessary
        });
    }
    return profile;
};

// Mongoose version to format job data
const formatJob = (job) => {
    if (!job) return null;
    const formatted = job.toObject ? job.toObject({ virtuals: true }) : { ...job };
    formatted._id = formatted._id.toString();
    formatted.company = formatted.company || 'Unknown Company';
    formatted.requirements = formatted.requirements || [];
    formatted.responsibilities = formatted.responsibilities || [];
    formatted.skills = formatted.skills || [];
    formatted.benefits = formatted.benefits || []; // Add benefits if missing
    formatted.jobType = formatted.jobType || 'full-time';
    formatted.experienceLevel = formatted.experienceLevel || 'fresher';
    formatted.salary = formatted.salary || 'Not specified';
    formatted.createdAt = formatted.createdAt || new Date();
    // Add application count if needed (e.g., via aggregation or virtual)
    formatted.applicationsCount = formatted.applicationsCount || 0;
    return formatted;
};

// Mongoose version to format application data
const formatApplication = (application) => {
    if (!application) return null;
    const formatted = application.toObject ? application.toObject({ virtuals: true }) : { ...application };
    formatted._id = formatted._id.toString();
    formatted.status = formatted.status || 'applied';
    formatted.appliedDate = formatted.appliedDate || new Date();
    if (formatted.job && typeof formatted.job === 'object' && formatted.job._id) {
        formatted.job = formatJob(formatted.job);
    } else if (formatted.job) { // Only ID present
        formatted.job = { _id: formatted.job.toString(), title: 'Unknown Job', company: 'Unknown Company', location: 'Unknown' };
    } else { // Job missing
        formatted.job = { _id: null, title: 'Unknown Job', company: 'Unknown Company', location: 'Unknown' };
    }
    // Format student info if populated
    if (formatted.student && typeof formatted.student === 'object' && formatted.student._id) {
         // Assuming student object has name, email, etc. directly from population
         formatted.student = {
             _id: formatted.student._id.toString(),
             name: formatted.student.name || 'Unknown Student',
             email: formatted.student.email || 'No email',
             college: formatted.student.studentProfile?.college || 'Unknown College', // Check if studentProfile was populated
             skills: formatted.student.studentProfile?.skills || []
         };
    } else {
         formatted.student = { _id: formatted.student?.toString(), name: 'Unknown Student' };
    }

    return formatted;
};

// --- Demo Data Functions ---
// Demo dashboard data for companies (Mongoose compatible)
const renderDemoDashboard = async (req, res) => { // Keep async if formatJob/formatApplication become async
    const demoStats = {
        totalJobs: 5, activeJobs: 3, totalApplications: 24, newApplications: 6, interviews: 3
    };
    const demoApplicantsRaw = [
        { student: { name: 'John Smith', college: 'Tech University' }, job: { title: 'Frontend Developer' }, appliedDate: new Date(), status: 'applied', _id: 'app1' },
        { student: { name: 'Sarah Johnson', college: 'Engineering College' }, job: { title: 'Backend Developer' }, appliedDate: new Date(Date.now() - 2 * 86400000), status: 'under_review', _id: 'app2' },
        { student: { name: 'Mike Chen', college: 'Business School' }, job: { title: 'Product Manager' }, appliedDate: new Date(Date.now() - 1 * 86400000), status: 'interview', _id: 'app3' }
    ];
     const demoJobsRaw = [
        { _id: 'job1', title: 'Senior Software Engineer', location: 'Remote', jobType: 'full-time', description: '...', applicationsCount: 12, createdAt: new Date() },
        { _id: 'job2', title: 'Product Designer', location: 'New York, NY', jobType: 'full-time', description: '...', applicationsCount: 8, createdAt: new Date() },
        { _id: 'job3', title: 'Marketing Intern', location: 'Remote', jobType: 'internship', description: '...', applicationsCount: 4, createdAt: new Date() }
    ];

    res.render('pages/company/dashboard', {
        title: 'Company Dashboard - Placement Portal',
        user: req.session.user,
        stats: demoStats,
        recentApplicants: demoApplicantsRaw.map(formatApplication), // Format demo data
        activeJobs: demoJobsRaw.filter(j => j.isActive !== false).map(formatJob), // Format demo data
        companyProfile: { companyName: 'Demo Company Inc.' }, // Provide minimal profile
        isDemo: true
    });
};

// Demo analytics data (Mongoose compatible)
const renderDemoAnalytics = (req, res) => { // No need for async if static
     const demoAnalytics = {
        overview: { totalJobs: 12, totalApplications: 156, hiredCount: 8, interviewCount: 24, conversionRate: 5, interviewToHireRate: 33, activeJobs: 8 },
        applicationsByStatus: { applied: 45, under_review: 32, shortlisted: 18, interview: 24, rejected: 29, accepted: 8 }, // Use 'accepted'
        applicationsOverTime: [ { _id: '2024-01-01', count: 5 }, { _id: '2024-01-05', count: 15 }, /* more items */ ],
        popularJobs: [ { title: 'Senior Software Engineer', applications: 45 }, { title: 'Frontend Developer', applications: 38 }, /* more items */ ],
        popularJobsWithDetails: [ { title: 'Senior Software Engineer', applications: 45, location:'Remote', jobType:'full-time' }, { title: 'Frontend Developer', applications: 38, location:'NY', jobType:'full-time' } /* more */ ],
        collegeDemographics: [ { college: 'Tech University', count: 34 }, { college: 'Engineering College', count: 28 }, /* more items */ ],
        skillsAnalysis: [ { _id: 'JavaScript', count: 45 }, { _id: 'React', count: 38 }, /* more items */ ],
        timePeriod: 'last_30_days',
        recentApplications: [] // Can add demo recent apps if needed for report
    };

    res.render('pages/company/analytics', {
        title: 'Analytics Dashboard - Placement Portal',
        user: req.session.user,
        analytics: demoAnalytics,
        isDemo: true
    });
};

// Helper for Demo Chart Data
function getDemoChartData(period) {
     // Generate slightly different data based on period for demo purposes
    const multiplier = period === '7d' ? 0.2 : (period === '90d' ? 2.5 : 1);
    const baseData = {
        applicationsOverTime: [ { _id: '2024-01-01', count: Math.round(5 * multiplier) }, { _id: '2024-01-02', count: Math.round(8 * multiplier) }, { _id: '2024-01-03', count: Math.round(12 * multiplier) } ],
        statusDistribution: [ { _id: 'applied', count: Math.round(45 * multiplier) }, { _id: 'under_review', count: Math.round(32 * multiplier) }, { _id: 'shortlisted', count: Math.round(18 * multiplier) }, { _id: 'interview', count: Math.round(24 * multiplier) }, { _id: 'rejected', count: Math.round(29 * multiplier) }, { _id: 'accepted', count: Math.round(8 * multiplier) } ], // Use 'accepted'
        jobPerformance: [ { jobTitle: 'Senior Software Engineer', applications: Math.round(45 * multiplier) }, { jobTitle: 'Frontend Developer', applications: Math.round(38 * multiplier) }, { jobTitle: 'Product Manager', applications: Math.round(32 * multiplier) } ]
    };
    return baseData;
}
// --- End Demo Data Functions ---


// --- Controller Functions ---

// Get company dashboard (Mongoose version)
exports.getDashboard = async (req, res) => {
    try {
        if (isDemo(req)) {
            return await renderDemoDashboard(req, res); // Use await if demo function becomes async
        }

        const companyId = req.session.user.id;
        if (!isValidObjectId(companyId)) {
            console.error(`Invalid companyId in session for dashboard: ${companyId}`);
            return res.redirect('/auth/login?role=company');
        }

        const companyProfile = await CompanyProfile.findOne({ user: companyId }); // Fetch profile
        const companyJobs = await Job.find({ postedBy: companyId }); // Fetch jobs posted by company
        const jobIds = companyJobs.map(job => job._id);

        // Perform counts and fetches using Mongoose
        const [totalApplications, newApplicantsCount, interviewsCount, activeJobsCount, recentApps, activeJobsList] = await Promise.all([
            Application.countDocuments({ job: { $in: jobIds } }),
             // Count applications created in the last 24 hours
            Application.countDocuments({ job: { $in: jobIds }, appliedDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
            Application.countDocuments({ job: { $in: jobIds }, status: 'interview' }),
            Job.countDocuments({ postedBy: companyId, isActive: true }), // Count active jobs
            Application.find({ job: { $in: jobIds } })
                .populate({ path: 'student', select: 'name studentProfile.college' }) // Populate student name and college
                .populate({ path: 'job', select: 'title' }) // Populate job title
                .sort({ appliedDate: -1 })
                .limit(5),
             Job.find({ postedBy: companyId, isActive: true })
                .sort({ createdAt: -1 })
                .limit(3)
                .lean() // Use lean for performance if just reading data
        ]);

         // Add application counts to activeJobsList
        const activeJobsWithCounts = await Promise.all(
            activeJobsList.map(async (job) => {
                const count = await Application.countDocuments({ job: job._id });
                return { ...job, applicationsCount: count }; // Use Mongoose field name if different
            })
        );


        res.render('pages/company/dashboard', {
            title: 'Company Dashboard - Placement Portal',
            user: req.session.user,
            stats: {
                totalJobs: companyJobs.length,
                activeJobs: activeJobsCount, // Use the count
                totalApplications: totalApplications,
                newApplicants: newApplicantsCount, // Use new applicant count
                interviews: interviewsCount
            },
            recentApplicants: recentApps.map(formatApplication), // Use formatter
            activeJobs: activeJobsWithCounts.map(formatJob), // Use formatter
            companyProfile: companyProfile ? companyProfile.toObject() : {}, // Pass profile
            isDemo: false
        });
    } catch (error) {
        console.error('Company dashboard error:', error);
        // Fallback to demo dashboard on error
        try {
           await renderDemoDashboard(req, res); // Use await if demo func is async
        } catch(renderError) {
             console.error('Error rendering demo dashboard fallback:', renderError);
             res.status(500).render('error', { title: 'Server Error', message: 'Failed to load dashboard.' });
        }
    }
};

// Post new job (Mongoose version)
exports.postJob = async (req, res) => {
    try {
        if (isDemo(req)) {
            return res.json({ success: false, message: 'Please create a real company account to post jobs.' });
        }
        const companyId = req.session.user.id;
        if (!isValidObjectId(companyId)) {
             return res.status(400).json({ success: false, message: 'Invalid company ID in session.' });
        }


        const companyProfile = await CompanyProfile.findOne({ user: companyId });
        const companyName = companyProfile?.companyName || req.session.user.name; // Use profile name or user name

         const {
            title, location, jobType, salary, description, requirements,
            responsibilities, benefits, skills, experienceLevel,
            applicationDeadline, vacancies
        } = req.body;

         // Convert multi-line text areas or comma-separated strings to arrays
         const parseToArray = (text) => text ? text.split('\n').map(s => s.trim()).filter(Boolean) : [];
         const parseSkillsToArray = (text) => text ? text.split(',').map(s => s.trim()).filter(Boolean) : [];

        const jobData = {
            title,
            company: companyName, // Store company name directly in job
            location, jobType, salary, description,
            requirements: parseToArray(requirements),
            responsibilities: parseToArray(responsibilities),
            benefits: parseToArray(benefits), // Assuming benefits is handled similarly
            skills: parseSkillsToArray(skills),
            experienceLevel,
            applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : null,
            vacancies: vacancies ? parseInt(vacancies) : 1,
            postedBy: companyId, // Link to the User ID
            isActive: true
        };

        const job = new Job(jobData);
        await job.save();

        // Optionally link job back to CompanyProfile if schema supports it
        if (companyProfile && companyProfile.jobsPosted) {
             await CompanyProfile.updateOne({ _id: companyProfile._id }, { $push: { jobsPosted: job._id } });
        }


        res.json({ success: true, message: 'Job posted successfully!', jobId: job._id });
    } catch (error) {
        console.error('Post job error:', error);
        res.status(500).json({ success: false, message: `Failed to post job: ${error.message}` });
    }
};

// Get company applications (Mongoose version)
exports.getApplications = async (req, res) => {
     try {
        const companyId = req.session.user.id;
        const { status, job: jobIdFilter, search } = req.query; // Rename job query param
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);

        let applications = [];
        let companyJobs = [];
        let companyProfile = null;

        if (isDemoUser) {
             // Demo data
            companyJobs = [ { _id: '1', title: 'Frontend Developer' }, { _id: '2', title: 'Backend Engineer' } ];
            companyProfile = { companyName: 'Demo Tech Inc.', logo: null }; // Add logo field
            applications = [ /* ... array of demo application objects using formatApplication ... */ ];
             applications = [
                { _id: 'app1', student: { name: 'John Doe', email: 'j@d.com', college: 'Demo Uni', skills: ['JS', 'React'] }, job: { _id: '1', title: 'Frontend Dev' }, status: 'applied', appliedDate: new Date(), resume: 'r1.pdf', coverLetter:'...' },
                { _id: 'app2', student: { name: 'Jane Smith', email: 'j@s.com', college: 'Demo Col', skills: ['Python', 'SQL'] }, job: { _id: '2', title: 'Backend Eng' }, status: 'under_review', appliedDate: new Date(Date.now()-86400000), resume: 'r2.pdf', coverLetter:'...' }
             ].map(formatApplication); // Format demo data

        } else {
            companyJobs = await Job.find({ postedBy: companyId }).select('_id title').lean(); // Fetch only needed fields
            companyProfile = await CompanyProfile.findOne({ user: companyId }).lean(); // Fetch profile

            const jobIds = companyJobs.map(j => j._id);
            let filter = { job: { $in: jobIds } };

            if (status && status !== 'all') filter.status = status;
            if (jobIdFilter && jobIdFilter !== 'all' && isValidObjectId(jobIdFilter)) {
                 filter.job = jobIdFilter; // Filter by specific job ID
            }
            // Build search query if present
             if (search) {
                const searchRegex = { $regex: search, $options: 'i' };
                // We need to query related student data, requires lookup or denormalization
                // Simple search on application fields first:
                // filter.$or = [
                //     // Need student name/email/college on application schema or use $lookup
                //     { 'personalInfo.fullName': searchRegex },
                //     { 'personalInfo.email': searchRegex },
                //     { 'education.college': searchRegex },
                // ];
                 // More complex search requires aggregation pipeline with $lookup
                 // For now, let's skip search or make it basic if data is denormalized
                 console.warn("Search filter is complex with current schema, skipping advanced search.");
            }


            applications = await Application.find(filter)
                .populate({ path: 'job', select: 'title' }) // Populate job title
                .populate({ path: 'student', select: 'name email studentProfile.college studentProfile.skills' }) // Populate student details
                .sort({ appliedDate: -1 });
        }

        res.render('pages/company/applicants', {
            title: 'Applicants - Placement Portal',
            user: req.session.user,
            applications: applications.map(formatApplication), // Use formatter
            companyJobs: companyJobs.map(j => ({ _id: j._id.toString(), title: j.title })), // Format for dropdown
            companyProfile: companyProfile || {}, // Pass profile
            filters: { status: status || '', job: jobIdFilter || '', search: search || '' },
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Applicants error:', error);
        res.status(500).render('error', { title: 'Server Error', message: 'Failed to load applicants' });
    }
};

// Update application status (Mongoose version)
exports.updateApplicationStatus = async (req, res) => {
    try {
        if (isDemo(req)) {
            return res.json({ success: false, message: 'Demo companies cannot update application status.' });
        }
        const { applicationId, status } = req.body;
        const companyId = req.session.user.id;

        if (!isValidObjectId(applicationId)) {
             return res.status(400).json({ success: false, message: 'Invalid application ID.' });
        }
         if (!STATUS_DISPLAY.includes(status)) { // Validate status value
             return res.status(400).json({ success: false, message: 'Invalid status value.' });
         }


        // Find application and verify ownership by checking the job's postedBy field
        const application = await Application.findById(applicationId).populate('job');

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }
        // Check if job exists and if postedBy matches companyId
        if (!application.job || !application.job.postedBy || !application.job.postedBy.equals(companyId)) {
            return res.status(403).json({ success: false, message: 'Unauthorized action' });
        }

        application.status = status;
        await application.save();

        res.json({ success: true, message: 'Application status updated successfully!' });
    } catch (error) {
        console.error('Update application status error:', error);
        res.status(500).json({ success: false, message: 'Failed to update application status' });
    }
};

// Get company profile (Mongoose version)
exports.getProfile = async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        let profile = null;

        if (isDemoUser) {
            profile = { companyName: 'Demo Company Inc.', industry: 'Technology' /* add more demo fields */ };
        } else {
            profile = await CompanyProfile.findOne({ user: companyId });
             if (!profile) {
                 // Optionally create a basic profile if none exists yet
                 profile = await ensureCompanyProfile(companyId, req.session.user.name);
             }
        }

        res.render('pages/company/profile', {
            title: 'Company Profile - Placement Portal',
            user: req.session.user,
            companyProfile: profile ? (profile.toObject ? profile.toObject() : profile) : {}, // Use companyProfile variable
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Company profile error:', error);
        res.status(500).render('error', { title: 'Server Error', message: 'Failed to load company profile' });
    }
};


// Update company profile (Mongoose version) - Already provided, ensure it matches the one with file upload
exports.updateProfile = async (req, res) => { /* ... (Implementation from previous response with file handling) ... */ };

// Get analytics (Mongoose version)
exports.getAnalytics = async (req, res) => {
    try {
        if (isDemo(req)) {
            return renderDemoAnalytics(req, res); // Use the demo renderer
        }

        const companyId = req.session.user.id;
        if (!isValidObjectId(companyId)) {
            console.error(`Invalid companyId for analytics: ${companyId}`);
            return renderDemoAnalytics(req, res); // Fallback to demo
        }

        const companyJobs = await Job.find({ postedBy: companyId });
        const jobIds = companyJobs.map(job => job._id);

        // Fetch data using Mongoose aggregation
        const [statusCountsData, appsOverTimeData, popularJobsData, collegeDataRaw, skillsDataRaw, totalApps, hiredCountData, interviewCountData] = await Promise.all([
            Application.aggregate([ { $match: { job: { $in: jobIds } } }, { $group: { _id: '$status', count: { $sum: 1 } } } ]),
            Application.aggregate([ { $match: { job: { $in: jobIds }, appliedDate: { $gte: new Date(Date.now() - 30 * 86400000) } } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$appliedDate" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } } ]),
            Application.aggregate([ { $match: { job: { $in: jobIds } } }, { $group: { _id: '$job', applications: { $sum: 1 } } }, { $sort: { applications: -1 } }, { $limit: 5 } ]),
            Application.aggregate([ { $match: { job: { $in: jobIds } } }, { $lookup: { from: 'studentprofiles', localField: 'student', foreignField: 'user', as: 'studentProfileData' } }, { $unwind: '$studentProfileData' }, { $group: { _id: '$studentProfileData.college', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 } ]), // Assumes StudentProfile has college
            Application.aggregate([ { $match: { job: { $in: jobIds } } }, { $lookup: { from: 'studentprofiles', localField: 'student', foreignField: 'user', as: 'studentProfileData' } }, { $unwind: '$studentProfileData' }, { $unwind: '$studentProfileData.skills' }, { $group: { _id: '$studentProfileData.skills', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 } ]), // Assumes StudentProfile has skills array
            Application.countDocuments({ job: { $in: jobIds } }),
            Application.countDocuments({ job: { $in: jobIds }, status: 'accepted' }), // Use 'accepted' status
            Application.countDocuments({ job: { $in: jobIds }, status: 'interview' })
        ]);

        // Process aggregated data
        const statusCounts = statusCountsData.reduce((acc, item) => { acc[item._id] = item.count; return acc; }, {});
        const popularJobsWithDetails = await Promise.all(
            popularJobsData.map(async (job) => {
                const jobDetails = await Job.findById(job._id).select('title').lean();
                return { title: jobDetails?.title || 'Unknown Job', applications: job.applications };
            })
        );
        const collegeDemographics = collegeDataRaw.map(item => ({ college: item._id || 'Not Specified', count: item.count }));
        const skillsAnalysis = skillsDataRaw; // Already in correct format {_id: skill, count: number}

        const analytics = {
            overview: {
                totalJobs: companyJobs.length,
                totalApplications: totalApps,
                hiredCount: hiredCountData, // Use direct count
                interviewCount: interviewCountData, // Use direct count
                conversionRate: totalApps > 0 ? Math.round((hiredCountData / totalApps) * 100) : 0,
                interviewToHireRate: interviewCountData > 0 ? Math.round((hiredCountData / interviewCountData) * 100) : 0,
                activeJobs: companyJobs.filter(j => j.isActive).length // Calculate active jobs
            },
            applicationsByStatus: statusCounts,
            applicationsOverTime: appsOverTimeData,
            popularJobs: popularJobsWithDetails,
            collegeDemographics: collegeDemographics,
            skillsAnalysis: skillsAnalysis,
            timePeriod: 'last_30_days' // Assuming default, can be dynamic later
        };

        res.render('pages/company/analytics', {
            title: 'Analytics Dashboard - Placement Portal', user: req.session.user, analytics, isDemo: false
        });

    } catch (error) {
        console.error('Company analytics error:', error);
        renderDemoAnalytics(req, res); // Fallback to demo on error
    }
};

// Get analytics data for charts (API endpoint, Mongoose version)
exports.getAnalyticsData = async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const { period = '30d' } = req.query;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);

        if (isDemoUser) {
            return res.json({ success: true, data: getDemoChartData(period) });
        }

        const companyJobs = await Job.find({ postedBy: companyId }).select('_id').lean(); // Only need IDs
        const jobIds = companyJobs.map(job => job._id);

        let startDate;
        const endDate = new Date();
        if (period === '7d') startDate = new Date(Date.now() - 7 * 86400000);
        else if (period === '90d') startDate = new Date(Date.now() - 90 * 86400000);
        else startDate = new Date(Date.now() - 30 * 86400000); // Default 30d

        // Fetch data using Mongoose aggregation
        const [appsOverTime, statusDist, jobPerfRaw] = await Promise.all([
             Application.aggregate([ { $match: { job: { $in: jobIds }, appliedDate: { $gte: startDate, $lte: endDate } } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$appliedDate" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } } ]),
             Application.aggregate([ { $match: { job: { $in: jobIds } } }, { $group: { _id: '$status', count: { $sum: 1 } } } ]),
             Application.aggregate([ { $match: { job: { $in: jobIds } } }, { $group: { _id: '$job', applications: { $sum: 1 } } }, { $sort: { applications: -1 } }, { $limit: 5 } ]) // Limit to top 5 jobs
        ]);

        // Populate job titles for job performance
        const jobPerformance = await Promise.all(
            jobPerfRaw.map(async (job) => {
                const jobDetails = await Job.findById(job._id).select('title').lean();
                return { jobTitle: jobDetails?.title || 'Unknown Job', applications: job.applications };
            })
        );

        res.json({
            success: true,
            data: {
                applicationsOverTime: appsOverTime,
                statusDistribution: statusDist,
                jobPerformance: jobPerformance,
                period: period
            }
        });

    } catch (error) {
        console.error('Analytics data API error:', error);
        res.status(500).json({ success: false, message: 'Failed to load analytics data' });
    }
};

// --- Export Functions (Excel, PDF, Full Report) ---
// Add the Mongoose implementations for these here if you need them now,
// similar to how getAnalytics was converted. They involve aggregating data
// and then formatting it using exceljs or pdfkit.

exports.exportToExcel = async (req, res) => {
     try {
         if (isDemo(req)) return res.status(403).send('Excel export not available for demo users.');
         const companyId = req.session.user.id;
         // Fetch necessary data using Mongoose (similar to getAnalytics)
         const companyJobs = await Job.find({ postedBy: companyId }).lean();
         const jobIds = companyJobs.map(j => j._id);
         const totalApps = await Application.countDocuments({ job: { $in: jobIds } });
         const statusData = await Application.aggregate([ { $match: { job: { $in: jobIds } } }, { $group: { _id: '$status', count: { $sum: 1 } } } ]);
         const popularJobsData = await Application.aggregate([ { $match: { job: { $in: jobIds } } }, { $group: { _id: '$job', applications: { $sum: 1 } } }, { $sort: { applications: -1 } }, { $limit: 10 } ]);

         // Create Excel Workbook
         const workbook = new ExcelJS.Workbook();
         const worksheet = workbook.addWorksheet('Analytics Summary');
         worksheet.columns = [ { header: 'Metric', key: 'metric', width: 30 }, { header: 'Value', key: 'value', width: 20 } ];

         // Add Data
         worksheet.addRow({ metric: 'Total Jobs Posted', value: companyJobs.length });
         worksheet.addRow({ metric: 'Total Applications Received', value: totalApps });
         worksheet.addRow({}); // Spacer
         worksheet.addRow({ metric: 'Applications by Status', value: '' }).font = { bold: true };
         statusData.forEach(s => worksheet.addRow({ metric: s._id, value: s.count }));
         worksheet.addRow({}); // Spacer
         worksheet.addRow({ metric: 'Top 10 Jobs by Applications', value: '' }).font = { bold: true };
         for(const job of popularJobsData) {
             const jobDetails = await Job.findById(job._id).select('title').lean();
             worksheet.addRow({ metric: jobDetails?.title || 'Unknown', value: job.applications });
         }

         // Send File
         res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
         res.setHeader('Content-Disposition', 'attachment; filename=company_analytics.xlsx');
         await workbook.xlsx.write(res);
         res.end();

     } catch (error) {
         console.error('Excel export error:', error);
         res.status(500).send('Error generating Excel report');
     }
};

exports.exportToPDF = async (req, res) => {
     try {
         if (isDemo(req)) return res.status(403).send('PDF export not available for demo users.');
         const companyId = req.session.user.id;
         const companyProfile = await CompanyProfile.findOne({ user: companyId }).lean();
         // Fetch data (similar to Excel export)
         const companyJobs = await Job.find({ postedBy: companyId }).lean();
         const jobIds = companyJobs.map(j => j._id);
         const totalApps = await Application.countDocuments({ job: { $in: jobIds } });
         const statusData = await Application.aggregate([ { $match: { job: { $in: jobIds } } }, { $group: { _id: '$status', count: { $sum: 1 } } } ]);
         const popularJobsData = await Application.aggregate([ { $match: { job: { $in: jobIds } } }, { $group: { _id: '$job', applications: { $sum: 1 } } }, { $sort: { applications: -1 } }, { $limit: 5 } ]);

         // Create PDF
         const doc = new PDFDocument({ margin: 50 });
         res.setHeader('Content-Type', 'application/pdf');
         res.setHeader('Content-Disposition', 'attachment; filename=company_analytics.pdf');
         doc.pipe(res);

         // Add Content
         doc.fontSize(18).text(`Analytics Report - ${companyProfile?.companyName || 'Your Company'}`, { align: 'center' });
         doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center'});
         doc.moveDown(2);

         doc.fontSize(14).text('Overview', { underline: true });
         doc.fontSize(12).text(`Total Jobs Posted: ${companyJobs.length}`);
         doc.text(`Total Applications Received: ${totalApps}`);
         doc.moveDown();

         doc.fontSize(14).text('Applications by Status', { underline: true });
         statusData.forEach(s => doc.text(`${s._id}: ${s.count}`));
         doc.moveDown();

         doc.fontSize(14).text('Top 5 Jobs by Applications', { underline: true });
          for(const job of popularJobsData) {
             const jobDetails = await Job.findById(job._id).select('title').lean();
             doc.text(`${jobDetails?.title || 'Unknown'}: ${job.applications}`);
         }

         // Finalize PDF
         doc.end();

     } catch (error) {
         console.error('PDF export error:', error);
         res.status(500).send('Error generating PDF report');
     }
};

exports.generateFullReport = async (req, res) => {
     try {
        if (isDemo(req)) {
             // You *could* render the report page with demo data if desired
             // For now, let's just block it.
            return res.status(403).send('Full report generation not available for demo users.');
        }

        const companyId = req.session.user.id;
        const companyProfile = await CompanyProfile.findOne({ user: companyId }).lean();
        const companyJobs = await Job.find({ postedBy: companyId }).lean();
        const jobIds = companyJobs.map(job => job._id);

        // Fetch comprehensive data similar to getAnalytics
        const [statusCountsData, popularJobsData, totalApps, activeJobsCount] = await Promise.all([
             Application.aggregate([ { $match: { job: { $in: jobIds } } }, { $group: { _id: '$status', count: { $sum: 1 } } } ]),
             Application.aggregate([ { $match: { job: { $in: jobIds } } }, { $group: { _id: '$job', applications: { $sum: 1 } } }, { $sort: { applications: -1 } }, { $limit: 10 } ]), // Top 10 for report
             Application.countDocuments({ job: { $in: jobIds } }),
             Job.countDocuments({ postedBy: companyId, isActive: true })
        ]);

        const popularJobsWithDetails = await Promise.all(
            popularJobsData.map(async (job) => {
                const jobDetails = await Job.findById(job._id).select('title location jobType').lean();
                return {
                    title: jobDetails?.title || 'Unknown Job',
                    applications: job.applications,
                    location: jobDetails?.location || 'N/A',
                    jobType: jobDetails?.jobType || 'N/A'
                };
            })
        );

        const analyticsData = {
            overview: {
                totalJobs: companyJobs.length,
                totalApplications: totalApps,
                activeJobs: activeJobsCount
            },
            applicationsByStatus: statusCountsData, // Pass the array directly
            popularJobsWithDetails: popularJobsWithDetails,
            // Add other data sections if needed for the report template
        };

        res.render('pages/company/analytics-report', {
            title: 'Analytics Report - Placement Portal',
            analytics: analyticsData,
            companyName: companyProfile?.companyName || req.session.user.name,
            generatedDate: new Date().toLocaleDateString()
        });

    } catch (error) {
        console.error('Full report error:', error);
        res.status(500).render('error', { title:'Server Error', message: 'Failed to generate full report'});
    }
};
// --- End Export Functions ---

// N8N Handler (Mongoose version)
exports.handleN8nCompanyUpdate = async (req, res) => {
    // 1. Verify Webhook Secret
    const requiredSecret = process.env.N8N_WEBHOOK_SECRET;
    if (requiredSecret) {
        const receivedSecret = req.headers['x-webhook-secret'] || req.headers['x-n8n-secret'];
        if (receivedSecret !== requiredSecret) {
            console.warn("N8N Webhook: Invalid secret received.");
            return res.status(401).json({ success: false, message: 'Unauthorized: Invalid webhook secret.' });
        }
    } else { console.warn("N8N_WEBHOOK_SECRET not set..."); }

    const { email, companyName, name, industry, website, description, contactPerson, phone, street, city, state, country, zipCode, size, founded, linkedin, twitter, facebook } = req.body;

    if (!email || !companyName) {
        return res.status(400).json({ success: false, message: 'Missing required fields: email and companyName' });
    }

    try {
        let user;
        let isNewUser = false;
        user = await User.findOne({ email: email, role: 'company' });

        if (!user) {
            isNewUser = true;
            console.log(`N8N Webhook: No company user for ${email}. Creating...`);
            const tempPassword = Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(tempPassword, 12);
            user = new User({ name: name || companyName, email: email, password: hashedPassword, role: 'company', isVerified: false });
            await user.save();
            console.log(`N8N Webhook: Created company user ${user._id}.`);
            // NOTE: Consider how to handle the temp password or activation for this user.
        } else {
            console.log(`N8N Webhook: Found existing company user ${user._id} for ${email}.`);
        }

        const profileData = { user: user._id, companyName };
        // Conditionally add fields only if they exist in the payload
        if (industry) profileData.industry = industry;
        if (website) profileData.website = website;
        if (description) profileData.description = description;
        if (contactPerson) profileData.contactPerson = contactPerson;
        if (phone) profileData.phone = phone;
        if (size) profileData.size = size;
        if (founded && !isNaN(parseInt(founded)) && parseInt(founded) > 0) profileData.founded = parseInt(founded);

        const address = {};
        if (street) address.street = street;
        if (city) address.city = city;
        if (state) address.state = state;
        if (country) address.country = country;
        if (zipCode) address.zipCode = zipCode;
        if (Object.keys(address).length > 0) profileData.address = address;

        const socialLinks = {};
        if (linkedin) socialLinks.linkedin = linkedin;
        if (twitter) socialLinks.twitter = twitter;
        if (facebook) socialLinks.facebook = facebook;
        if (Object.keys(socialLinks).length > 0) profileData.socialLinks = socialLinks;

        const updatedProfile = await CompanyProfile.findOneAndUpdate(
            { user: user._id },
            { $set: profileData },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log(`N8N Webhook: ${isNewUser ? 'Created' : 'Updated'} company profile ${updatedProfile._id}.`);
        res.status(isNewUser ? 201 : 200).json({ success: true, message: `Company profile ${isNewUser ? 'created' : 'updated'}.`, userId: user._id, profileId: updatedProfile._id });

    } catch (error) {
        console.error('N8N Company Update Error:', error);
        res.status(500).json({ success: false, message: `Server error: ${error.message}` });
    }
};


