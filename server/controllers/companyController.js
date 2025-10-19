// server/controllers/companyController.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Job = require('../models/Job');
const Application = require('../models/Application');
const CompanyProfile = require('../models/CompanyProfile');
const User = require('../models/User');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// --- Helper Functions ---
const isDemo = (req) => Boolean(req.session?.user?.isDemo);
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Mongoose version to ensure profile exists
const ensureCompanyProfile = async (userId, name, industry = '') => {
    let profile = await CompanyProfile.findOne({ user: userId });
    if (!profile) {
         console.log(`Creating new company profile for user: ${userId}`);
        profile = await CompanyProfile.create({
            user: userId,
            companyName: name || 'Demo Company',
            industry: industry || '',
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
    formatted.benefits = formatted.benefits || [];
    formatted.jobType = formatted.jobType || 'full-time';
    formatted.experienceLevel = formatted.experienceLevel || 'fresher';
    formatted.salary = formatted.salary || 'Not specified';
    formatted.createdAt = formatted.createdAt || new Date();
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
    } else if (formatted.job) {
        formatted.job = { _id: formatted.job.toString(), title: 'Unknown Job', company: 'Unknown Company', location: 'Unknown' };
    } else {
        formatted.job = { _id: null, title: 'Unknown Job', company: 'Unknown Company', location: 'Unknown' };
    }
    if (formatted.student && typeof formatted.student === 'object' && formatted.student._id) {
         formatted.student = {
             _id: formatted.student._id.toString(),
             name: formatted.student.name || 'Unknown Student',
             email: formatted.student.email || 'No email',
             college: formatted.student.studentProfile?.college || 'Unknown College',
             skills: formatted.student.studentProfile?.skills || []
         };
    } else {
         formatted.student = { _id: formatted.student?.toString(), name: 'Unknown Student' };
    }
    return formatted;
};

// --- Demo Data Functions ---
const renderDemoDashboard = (req, res) => { // No async needed for static demo
    const demoStats = { totalJobs: 5, activeJobs: 3, totalApplications: 24, newApplications: 6, interviews: 3 };
    const demoApplicantsRaw = [
        { student: { name: 'John Smith', college: 'Tech University' }, job: { title: 'Frontend Developer' }, appliedDate: new Date(), status: 'applied', _id: 'app1' },
        { student: { name: 'Sarah Johnson', college: 'Engineering College' }, job: { title: 'Backend Developer' }, appliedDate: new Date(Date.now() - 2 * 86400000), status: 'under_review', _id: 'app2' },
        { student: { name: 'Mike Chen', college: 'Business School' }, job: { title: 'Product Manager' }, appliedDate: new Date(Date.now() - 1 * 86400000), status: 'interview', _id: 'app3' }
    ];
     const demoJobsRaw = [
        { _id: 'job1', title: 'Senior Software Engineer', location: 'Remote', jobType: 'full-time', description: '...', applicationsCount: 12, createdAt: new Date(), isActive: true },
        { _id: 'job2', title: 'Product Designer', location: 'New York, NY', jobType: 'full-time', description: '...', applicationsCount: 8, createdAt: new Date(), isActive: true },
        { _id: 'job3', title: 'Marketing Intern', location: 'Remote', jobType: 'internship', description: '...', applicationsCount: 4, createdAt: new Date(), isActive: false } // Example paused job
    ];

    res.render('pages/company/dashboard', {
        title: 'Company Dashboard - Placement Portal', user: req.session.user, stats: demoStats,
        recentApplicants: demoApplicantsRaw.map(formatApplication),
        activeJobs: demoJobsRaw.filter(j => j.isActive).map(formatJob),
        companyProfile: { companyName: 'Demo Company Inc.' }, isDemo: true
    });
};

const renderDemoAnalytics = (req, res) => { /* ... (Static demo data implementation from previous response) ... */ };
function getDemoChartData(period) { /* ... (Static demo data implementation from previous response) ... */ };
// --- End Demo Data Functions ---


// --- Controller Functions ---

// Get company dashboard (Mongoose version) - DEFINE USING exports.
exports.getDashboard = async (req, res) => {
    try {
        if (isDemo(req)) {
            return renderDemoDashboard(req, res); // No await needed if sync
        }

        const companyId = req.session.user.id;
        if (!isValidObjectId(companyId)) {
            console.error(`Invalid companyId in session for dashboard: ${companyId}`);
            return res.redirect('/auth/login?role=company');
        }

        const companyProfile = await CompanyProfile.findOne({ user: companyId });
        const companyJobs = await Job.find({ postedBy: companyId });
        const jobIds = companyJobs.map(job => job._id);

        const [totalApplications, newApplicantsCount, interviewsCount, activeJobsCount, recentApps, activeJobsList] = await Promise.all([
            Application.countDocuments({ job: { $in: jobIds } }),
            Application.countDocuments({ job: { $in: jobIds }, appliedDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
            Application.countDocuments({ job: { $in: jobIds }, status: 'interview' }),
            Job.countDocuments({ postedBy: companyId, isActive: true }),
            Application.find({ job: { $in: jobIds } })
                .populate({ path: 'student', select: 'name studentProfile.college' })
                .populate({ path: 'job', select: 'title' })
                .sort({ appliedDate: -1 }).limit(5),
             Job.find({ postedBy: companyId, isActive: true }).sort({ createdAt: -1 }).limit(3).lean()
        ]);

        const activeJobsWithCounts = await Promise.all(
            activeJobsList.map(async (job) => {
                const count = await Application.countDocuments({ job: job._id });
                return { ...job, applicationsCount: count };
            })
        );

        res.render('pages/company/dashboard', {
            title: 'Company Dashboard - Placement Portal', user: req.session.user,
            stats: {
                totalJobs: companyJobs.length, activeJobs: activeJobsCount, totalApplications: totalApplications,
                newApplicants: newApplicantsCount, interviews: interviewsCount
            },
            recentApplicants: recentApps.map(formatApplication),
            activeJobs: activeJobsWithCounts.map(formatJob),
            companyProfile: companyProfile ? companyProfile.toObject() : {},
            isDemo: false
        });
    } catch (error) {
        console.error('Company dashboard error:', error);
        try { renderDemoDashboard(req, res); } catch(renderError) {
             console.error('Error rendering demo dashboard fallback:', renderError);
             res.status(500).render('error', { title: 'Server Error', message: 'Failed to load dashboard.' });
        }
    }
};

// Post new job (Mongoose version) - DEFINE USING exports.
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
        const companyName = companyProfile?.companyName || req.session.user.name;

         const { title, location, jobType, salary, description, requirements, responsibilities, benefits, skills, experienceLevel, applicationDeadline, vacancies } = req.body;
         const parseToArray = (text) => text ? text.split('\n').map(s => s.trim()).filter(Boolean) : [];
         const parseSkillsToArray = (text) => text ? text.split(',').map(s => s.trim()).filter(Boolean) : [];

        const jobData = {
            title, company: companyName, location, jobType, salary, description,
            requirements: parseToArray(requirements), responsibilities: parseToArray(responsibilities),
            benefits: parseToArray(benefits), skills: parseSkillsToArray(skills),
            experienceLevel, applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : null,
            vacancies: vacancies ? parseInt(vacancies) : 1, postedBy: companyId, isActive: true
        };

        const job = new Job(jobData);
        await job.save();

        if (companyProfile && companyProfile.jobsPosted?.push) { // Safely check if jobsPosted exists and is an array
             await CompanyProfile.updateOne({ _id: companyProfile._id }, { $push: { jobsPosted: job._id } });
        } else if (companyProfile) {
             // If jobsPosted doesn't exist or isn't an array, initialize it
             await CompanyProfile.updateOne({ _id: companyProfile._id }, { $set: { jobsPosted: [job._id] } });
        }


        res.json({ success: true, message: 'Job posted successfully!', jobId: job._id });
    } catch (error) {
        console.error('Post job error:', error);
        res.status(500).json({ success: false, message: `Failed to post job: ${error.message}` });
    }
};

// Get company applications (Mongoose version) - DEFINE USING exports.
exports.getApplications = async (req, res) => {
     try {
        const companyId = req.session.user.id;
        const { status, job: jobIdFilter, search } = req.query;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);

        let applications = [];
        let companyJobs = [];
        let companyProfile = null;

        if (isDemoUser) {
            companyJobs = [ { _id: '1', title: 'Frontend Developer' }, { _id: '2', title: 'Backend Engineer' } ];
            companyProfile = { companyName: 'Demo Tech Inc.', logo: null };
            applications = [
                { _id: 'app1', student: { name: 'John Doe', email: 'j@d.com', college: 'Demo Uni', skills: ['JS', 'React'] }, job: { _id: '1', title: 'Frontend Dev' }, status: 'applied', appliedDate: new Date(), resume: 'r1.pdf', coverLetter:'...' },
                { _id: 'app2', student: { name: 'Jane Smith', email: 'j@s.com', college: 'Demo Col', skills: ['Python', 'SQL'] }, job: { _id: '2', title: 'Backend Eng' }, status: 'under_review', appliedDate: new Date(Date.now()-86400000), resume: 'r2.pdf', coverLetter:'...' }
             ].map(formatApplication);

        } else {
            companyJobs = await Job.find({ postedBy: companyId }).select('_id title').lean();
            companyProfile = await CompanyProfile.findOne({ user: companyId }).lean();
            const jobIds = companyJobs.map(j => j._id);
            let filter = { job: { $in: jobIds } };

            if (status && status !== 'all') filter.status = status;
            if (jobIdFilter && jobIdFilter !== 'all' && isValidObjectId(jobIdFilter)) { filter.job = jobIdFilter; }
            // Basic search implementation (adjust fields as needed)
            if (search) {
                 const searchRegex = { $regex: search, $options: 'i' };
                 // Need to lookup student data to search effectively
                 const studentIds = await User.find({ name: searchRegex, role: 'student' }).select('_id').lean();
                 const studentIdList = studentIds.map(s => s._id);
                 filter.$or = [
                     { student: { $in: studentIdList } }, // Search by student name (indirectly)
                     // Add search on application fields if needed, e.g., personalInfo
                     // { 'personalInfo.fullName': searchRegex }
                 ];
                 // Note: Searching job title requires populating or denormalizing job title onto application
            }

            applications = await Application.find(filter)
                .populate({ path: 'job', select: 'title' })
                .populate({ path: 'student', select: 'name email studentProfile.college studentProfile.skills' }) // Adjust population as needed
                .sort({ appliedDate: -1 });
        }

        res.render('pages/company/applicants', {
            title: 'Applicants - Placement Portal', user: req.session.user,
            applications: applications.map(formatApplication),
            companyJobs: companyJobs.map(j => ({ _id: j._id.toString(), title: j.title })),
            companyProfile: companyProfile || {},
            filters: { status: status || '', job: jobIdFilter || '', search: search || '' },
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Applicants error:', error);
        res.status(500).render('error', { title: 'Server Error', message: 'Failed to load applicants' });
    }
};


// Update application status (Mongoose version) - DEFINE USING exports.
exports.updateApplicationStatus = async (req, res) => {
    try {
        if (isDemo(req)) {
            return res.json({ success: false, message: 'Demo companies cannot update application status.' });
        }
        const { applicationId, status } = req.body;
        const companyId = req.session.user.id;

        if (!isValidObjectId(applicationId)) { return res.status(400).json({ success: false, message: 'Invalid application ID.' }); }
        if (!STATUS_DISPLAY.includes(status)) { return res.status(400).json({ success: false, message: 'Invalid status value.' }); }

        const application = await Application.findById(applicationId).populate('job');
        if (!application) { return res.status(404).json({ success: false, message: 'Application not found' }); }
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

// Get company profile (Mongoose version) - DEFINE USING exports.
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
                 profile = await ensureCompanyProfile(companyId, req.session.user.name); // Create if needed
             }
        }

        res.render('pages/company/profile', {
            title: 'Company Profile - Placement Portal', user: req.session.user,
            companyProfile: profile ? (profile.toObject ? profile.toObject() : profile) : {},
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Company profile error:', error);
        res.status(500).render('error', { title: 'Server Error', message: 'Failed to load company profile' });
    }
};


// Update company profile (Mongoose version with file upload) - DEFINE USING exports.
exports.updateProfile = async (req, res) => {
    try {
        if (isDemo(req)) {
            // Simulate success for demo
             if (req.file) { // Cleanup demo file upload
                 try { fs.unlinkSync(req.file.path); } catch(e) {}
             }
            return res.json({ success: true, message: 'Demo profile updated (not saved)!', companyName: req.body.companyName || 'Demo Company Inc.' });
        }
        const companyId = req.session.user.id;
        if (!isValidObjectId(companyId)) {
            return res.status(400).json({ success: false, message: 'Invalid company ID.' });
        }

        const profileData = {
            companyName: req.body.companyName, industry: req.body.industry, website: req.body.website,
            size: req.body.size, founded: req.body.founded ? parseInt(req.body.founded) : undefined,
            contactPerson: req.body.contactPerson, phone: req.body.phone, description: req.body.description
        };
        if (req.body['address.street'] || req.body['address.city']) {
            profileData.address = { street: req.body['address.street'] || '', city: req.body['address.city'] || '', state: req.body['address.state'] || '', country: req.body['address.country'] || '', zipCode: req.body['address.zipCode'] || '' };
        }
        if (req.body['socialLinks.linkedin'] || req.body['socialLinks.twitter'] || req.body['socialLinks.facebook']) {
             profileData.socialLinks = { linkedin: req.body['socialLinks.linkedin'] || '', twitter: req.body['socialLinks.twitter'] || '', facebook: req.body['socialLinks.facebook'] || '' };
        }


        // Handle file upload
        if (req.file) {
            profileData.logo = req.file.filename;
            console.log('Logo uploaded:', req.file.filename);
            // Optional: Delete old logo file if it exists
        }

        const options = { new: true, upsert: true, setDefaultsOnInsert: true };
        const updatedProfile = await CompanyProfile.findOneAndUpdate(
            { user: companyId },
            { $set: profileData },
            options
        );

        // Update session if company name changed
        if (updatedProfile.companyName && req.session.user.name !== updatedProfile.companyName) {
            // Assuming req.session.user.name might store the company name for display
            // Adjust if you store it differently in the session
             req.session.user.companyName = updatedProfile.companyName; // Or req.session.user.name if that's used
        }


        res.json({ success: true, message: 'Company profile updated successfully!', companyName: updatedProfile.companyName });

    } catch (error) {
        console.error('Company profile update error:', error);
         // Cleanup uploaded file if update fails
        if (req.file?.path) { try { fs.unlinkSync(req.file.path); } catch(e){} }
        res.status(500).json({ success: false, message: `Failed to update company profile: ${error.message}` });
    }
};


// Get analytics (Mongoose version) - DEFINE USING exports.
exports.getAnalytics = async (req, res) => {
    try {
        if (isDemo(req)) {
            return renderDemoAnalytics(req, res);
        }
        const companyId = req.session.user.id;
        if (!isValidObjectId(companyId)) { return renderDemoAnalytics(req, res); } // Fallback

        const companyJobs = await Job.find({ postedBy: companyId });
        const jobIds = companyJobs.map(job => job._id);

        const [statusCountsData, appsOverTimeData, popularJobsData, collegeDataRaw, skillsDataRaw, totalApps, hiredCountData, interviewCountData] = await Promise.all([
            Application.aggregate([ { $match: { job: { $in: jobIds } } }, { $group: { _id: '$status', count: { $sum: 1 } } } ]),
            Application.aggregate([ { $match: { job: { $in: jobIds }, appliedDate: { $gte: new Date(Date.now() - 30 * 86400000) } } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$appliedDate" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } } ]),
            Application.aggregate([ { $match: { job: { $in: jobIds } } }, { $group: { _id: '$job', applications: { $sum: 1 } } }, { $sort: { applications: -1 } }, { $limit: 5 } ]),
            // Corrected College Aggregation using $lookup with User and then StudentProfile
            Application.aggregate([ { $match: { job: { $in: jobIds } } }, { $lookup: { from: 'users', localField: 'student', foreignField: '_id', as: 'studentUser' } }, { $unwind: '$studentUser' }, { $lookup: { from: 'studentprofiles', localField: 'student', foreignField: 'user', as: 'studentProfileData'} }, { $unwind: '$studentProfileData' }, { $match: {'studentProfileData.college': {$ne: null, $ne: ""}} }, { $group: { _id: '$studentProfileData.college', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 } ]),
            // Corrected Skills Aggregation
            Application.aggregate([ { $match: { job: { $in: jobIds } } }, { $lookup: { from: 'studentprofiles', localField: 'student', foreignField: 'user', as: 'studentProfileData'} }, { $unwind: '$studentProfileData' }, { $unwind: '$studentProfileData.skills' }, { $match: {'studentProfileData.skills': {$ne: null, $ne: ""}} }, { $group: { _id: '$studentProfileData.skills', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 } ]),
            Application.countDocuments({ job: { $in: jobIds } }),
            Application.countDocuments({ job: { $in: jobIds }, status: 'accepted' }),
            Application.countDocuments({ job: { $in: jobIds }, status: 'interview' })
        ]);

        const statusCounts = statusCountsData.reduce((acc, item) => { acc[item._id] = item.count; return acc; }, {});
        const popularJobsWithDetails = await Promise.all(
            popularJobsData.map(async (job) => {
                const jobDetails = await Job.findById(job._id).select('title').lean();
                return { title: jobDetails?.title || 'Unknown Job', applications: job.applications };
            })
        );
        const collegeDemographics = collegeDataRaw.map(item => ({ college: item._id || 'Not Specified', count: item.count }));
        const skillsAnalysis = skillsDataRaw;

        const analytics = {
            overview: { totalJobs: companyJobs.length, totalApplications: totalApps, hiredCount: hiredCountData, interviewCount: interviewCountData, conversionRate: totalApps > 0 ? Math.round((hiredCountData / totalApps) * 100) : 0, interviewToHireRate: interviewCountData > 0 ? Math.round((hiredCountData / interviewCountData) * 100) : 0, activeJobs: companyJobs.filter(j => j.isActive).length },
            applicationsByStatus: statusCounts, applicationsOverTime: appsOverTimeData, popularJobs: popularJobsWithDetails,
            collegeDemographics: collegeDemographics, skillsAnalysis: skillsAnalysis, timePeriod: 'last_30_days'
        };

        res.render('pages/company/analytics', { title: 'Analytics Dashboard - Placement Portal', user: req.session.user, analytics, isDemo: false });
    } catch (error) {
        console.error('Company analytics error:', error);
        renderDemoAnalytics(req, res); // Fallback
    }
};

// Get analytics data for charts (API, Mongoose version) - DEFINE USING exports.
exports.getAnalyticsData = async (req, res) => { /* ... (Mongoose implementation from previous response) ... */ };
exports.exportToExcel = async (req, res) => { /* ... (Mongoose implementation from previous response) ... */ };
exports.exportToPDF = async (req, res) => { /* ... (Mongoose implementation from previous response) ... */ };
exports.generateFullReport = async (req, res) => { /* ... (Mongoose implementation from previous response) ... */ };
exports.handleN8nCompanyUpdate = async (req, res) => { /* ... (Mongoose implementation from previous response) ... */ };

// ADD Mongoose versions of other required functions if they exist (e.g., getJobDetails, editJob, updateJob, toggleJobStatus, deleteJob, getProfileView etc.)

// Example: Get Job Details Page (needed by other routes potentially)
exports.getJobDetailsPage = async (req, res) => {
     try {
        const jobId = req.params.id;
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);

        if (!isValidObjectId(jobId)) {
             return res.status(404).render('404', { title: 'Not Found' });
        }

        let job;
        let applications = [];

        if (isDemoUser) {
             // Find the specific demo job
             const demoJobsRaw = [ { _id: 'job1', title: 'Senior Software Engineer', location: 'Remote', jobType: 'full-time', description: '...', applicationsCount: 12, createdAt: new Date(), isActive: true, postedBy: 'demo_company_id' }, /* ... other demo jobs ... */ ];
             job = demoJobsRaw.find(j => j._id === jobId);
             if (job) job = formatJob(job); // Format it
             // Find demo applications for this job
             const demoApplicantsRaw = [ { student: { name: 'John Smith' }, job: { _id: 'job1' }, appliedDate: new Date(), status: 'applied', _id: 'app1' }, /* ... */];
             applications = demoApplicantsRaw.filter(app => app.job._id === jobId).map(formatApplication);

        } else {
             job = await Job.findOne({ _id: jobId, postedBy: companyId }); // Verify ownership
             if (job) {
                 applications = await Application.find({ job: jobId })
                    .populate({ path: 'student', select: 'name email studentProfile.college studentProfile.skills' })
                    .sort({ appliedDate: -1 });
             }
        }

        if (!job) {
            return res.status(404).render('404', { title: 'Job Not Found' });
        }


        res.render('pages/company/job-details', { // Ensure you have this EJS file
            title: `${job.title} - Job Details`,
            user: req.session.user,
            job: formatJob(job), // Pass formatted job
            applications: applications.map(formatApplication), // Pass formatted applications
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Get job details page error:', error);
        res.status(500).render('error', { title: 'Server Error', message: 'Failed to load job details page' });
    }
};

// Example: Get Edit Job Page
exports.getEditJobPage = async (req, res) => {
     try {
        const jobId = req.params.id;
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);

        if (!isValidObjectId(jobId)) { return res.status(404).render('404', { title: 'Not Found' }); }

        let job = null;
        if (!isDemoUser) {
             job = await Job.findOne({ _id: jobId, postedBy: companyId }); // Verify ownership
        } else {
            // Find specific demo job to edit
             const demoJobsRaw = [ { _id: 'job1', title: 'Senior SWE', /*...*/ postedBy: 'demo_id' }, /*...*/];
             job = demoJobsRaw.find(j => j._id === jobId);
        }


        if (!job) {
             return res.status(404).render('404', { title: 'Job Not Found' });
        }

        // Convert arrays back to multiline strings or comma-separated for the form
        const jobFormData = {
            ...formatJob(job), // Use formatter, then adjust arrays
            requirements: job.requirements?.join('\n') || '',
            responsibilities: job.responsibilities?.join('\n') || '',
            benefits: job.benefits?.join('\n') || '',
            skills: job.skills?.join(', ') || '',
            applicationDeadline: job.applicationDeadline ? job.applicationDeadline.toISOString().split('T')[0] : '' // Format date for input
        };


        res.render('pages/company/edit-job', { // Ensure you have this EJS file
            title: `Edit Job: ${job.title}`,
            user: req.session.user,
            job: jobFormData, // Pass formatted data for form
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Get edit job page error:', error);
        res.status(500).render('error', { title: 'Server Error', message: 'Failed to load edit job page' });
    }
};

// Example: Update Job (Handles PUT request from edit form)
exports.updateJob = async (req, res) => {
     try {
        const jobId = req.params.id;
        if (isDemo(req)) { return res.json({ success: false, message: 'Demo users cannot update jobs.' }); }
        const companyId = req.session.user.id;

        if (!isValidObjectId(jobId)) { return res.status(400).json({ success: false, message: 'Invalid Job ID.' }); }

        // Fetch job to verify ownership
        const job = await Job.findOne({ _id: jobId, postedBy: companyId });
        if (!job) { return res.status(404).json({ success: false, message: 'Job not found or unauthorized.' }); }

        // Prepare update data from req.body (similar to postJob)
         const { title, location, jobType, salary, description, requirements, responsibilities, benefits, skills, experienceLevel, applicationDeadline, vacancies, isActive } = req.body;
         const parseToArray = (text) => text ? text.split('\n').map(s => s.trim()).filter(Boolean) : [];
         const parseSkillsToArray = (text) => text ? text.split(',').map(s => s.trim()).filter(Boolean) : [];

        const updateData = {
            title, location, jobType, salary, description,
            requirements: parseToArray(requirements), responsibilities: parseToArray(responsibilities),
            benefits: parseToArray(benefits), skills: parseSkillsToArray(skills),
            experienceLevel, applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : null,
            vacancies: vacancies ? parseInt(vacancies) : 1,
            isActive: isActive === 'true' || isActive === true // Handle boolean conversion
        };

        // Update the job
        const updatedJob = await Job.findByIdAndUpdate(jobId, updateData, { new: true }); // {new: true} returns the updated doc

        res.json({ success: true, message: 'Job updated successfully!', jobId: updatedJob._id });

    } catch (error) {
        console.error('Update job error:', error);
        res.status(500).json({ success: false, message: `Failed to update job: ${error.message}` });
    }
};

// Example: Toggle Job Status
exports.toggleJobStatus = async (req, res) => {
     try {
        const jobId = req.params.id;
        const { isActive } = req.body; // Expecting { isActive: boolean }
        if (isDemo(req)) { return res.json({ success: false, message: 'Demo users cannot toggle job status.' }); }
        const companyId = req.session.user.id;

        if (!isValidObjectId(jobId)) { return res.status(400).json({ success: false, message: 'Invalid Job ID.' }); }
        if (typeof isActive !== 'boolean') { return res.status(400).json({ success: false, message: 'Invalid isActive value.' }); }


        const updatedJob = await Job.findOneAndUpdate(
            { _id: jobId, postedBy: companyId }, // Verify ownership
            { $set: { isActive: isActive } },
            { new: true } // Return updated doc
        );

        if (!updatedJob) {
            return res.status(404).json({ success: false, message: 'Job not found or unauthorized.' });
        }

        res.json({ success: true, message: `Job ${isActive ? 'activated' : 'paused'} successfully!`, isActive: updatedJob.isActive });
    } catch (error) {
        console.error('Toggle job status error:', error);
        res.status(500).json({ success: false, message: 'Failed to update job status' });
    }
};

// Example: Delete Job
exports.deleteJob = async (req, res) => {
     try {
        const jobId = req.params.id;
        if (isDemo(req)) { return res.json({ success: false, message: 'Demo users cannot delete jobs.' }); }
        const companyId = req.session.user.id;

        if (!isValidObjectId(jobId)) { return res.status(400).json({ success: false, message: 'Invalid Job ID.' }); }

        // Find and delete job, verifying ownership
        const deletedJob = await Job.findOneAndDelete({ _id: jobId, postedBy: companyId });

        if (!deletedJob) {
            return res.status(404).json({ success: false, message: 'Job not found or unauthorized.' });
        }

        // Delete associated applications
        const deleteResult = await Application.deleteMany({ job: jobId });
        console.log(`Deleted ${deleteResult.deletedCount} applications associated with job ${jobId}`);

        // Remove job ID from CompanyProfile.jobsPosted array
        await CompanyProfile.updateOne({ user: companyId }, { $pull: { jobsPosted: jobId } });

        res.json({ success: true, message: 'Job and associated applications deleted successfully!' });
    } catch (error) {
        console.error('Delete job error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete job' });
    }
};

// Example: Get Profile View Page
exports.getProfileViewPage = async (req, res) => {
     try {
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        let companyProfile = null;

        if (isDemoUser) {
            companyProfile = { companyName: 'Demo Tech Inc.', industry: 'Technology', website: 'https://demo.com', description: 'Demo Desc.', contactPerson: 'Demo Person', phone: '123', address: { city: 'Demo City'}, size: '11-50', founded: 2020, logo: null };
        } else {
            companyProfile = await CompanyProfile.findOne({ user: companyId }).lean(); // Use lean for read-only view
             if (!companyProfile) {
                 // If no profile, maybe show a limited view or redirect to edit?
                 // For now, let's provide an empty object structure
                 companyProfile = {};
             }
        }

        res.render('pages/company/profile-view', { // Ensure you have this EJS file
            title: 'Company Profile View', user: req.session.user,
            companyProfile: companyProfile, // Pass lean object or demo object
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Get profile view page error:', error);
        res.status(500).render('error', { title: 'Server Error', message: 'Failed to load profile view page' });
    }
};


// --- Final module.exports ---
// Make sure ALL functions needed by your routes are listed here
module.exports = {
    getDashboard,
    postJob,
    getApplications,
    updateApplicationStatus,
    getProfile,
    updateProfile,
    getAnalytics,
    getAnalyticsData,
    exportToExcel,
    exportToPDF,
    generateFullReport,
    handleN8nCompanyUpdate,
    // Add the examples if you created corresponding routes:
    getJobDetailsPage,      // Corresponds to GET /company/jobs/:id (if used for a page)
    getEditJobPage,       // Corresponds to GET /company/edit-job/:id
    updateJob,            // Corresponds to PUT /company/jobs/:id
    toggleJobStatus,      // Corresponds to PUT /company/jobs/:id/status
    deleteJob,            // Corresponds to DELETE /company/jobs/:id
    getProfileViewPage    // Corresponds to GET /company/profile-view
};