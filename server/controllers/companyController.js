const Job = require('../models/Job');
const Application = require('../models/Application');
const CompanyProfile = require('../models/CompanyProfile');
const mongoose = require('mongoose');

// Get company dashboard with real data
exports.getDashboard = async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            return renderDemoDashboard(req, res);
        }

        // Get counts for dashboard for real companies
        const activeJobs = await Job.countDocuments({ 
            company: companyId, 
            isActive: true 
        });
        
        const totalApplications = await Application.countDocuments({ 
            job: { $in: await Job.find({ company: companyId }).distinct('_id') } 
        });
        
        const newApplicants = await Application.countDocuments({
            job: { $in: await Job.find({ company: companyId }).distinct('_id') },
            appliedDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });
        
        const interviews = await Application.countDocuments({
            job: { $in: await Job.find({ company: companyId }).distinct('_id') },
            status: 'interview'
        });

        // Get recent applicants
        const recentApplicants = await Application.find({
            job: { $in: await Job.find({ company: companyId }).distinct('_id') }
        })
        .populate('job')
        .populate('student')
        .sort({ appliedDate: -1 })
        .limit(5)
        .then(applications => applications.map(app => ({
            studentName: app.student?.name || 'Unknown Student',
            college: app.student?.college || 'Unknown College',
            jobTitle: app.job?.title || 'Unknown Position',
            appliedDate: app.appliedDate,
            status: app.status
        })));

        // Get active jobs
        const activeJobsList = await Job.find({ 
            company: companyId, 
            isActive: true 
        })
        .sort({ createdAt: -1 })
        .limit(3);

        res.render('pages/company/dashboard', {
            title: 'Company Dashboard - Placement Portal',
            user: req.session.user,
            stats: {
                activeJobs,
                totalApplications,
                newApplicants,
                interviews
            },
            recentApplicants,
            activeJobs: activeJobsList,
            isDemo: false
        });
    } catch (error) {
        console.error('Company dashboard error:', error);
        return renderDemoDashboard(req, res);
    }
};

// Demo dashboard data for companies
async function renderDemoDashboard(req, res) {
    // Create demo data
    const demoStats = {
        activeJobs: 5,
        totalApplications: 24,
        newApplicants: 6,
        interviews: 3
    };

    const demoApplicants = [
        {
            studentName: 'John Smith',
            college: 'Tech University',
            jobTitle: 'Frontend Developer',
            appliedDate: new Date(),
            status: 'new'
        },
        {
            studentName: 'Sarah Johnson',
            college: 'Engineering College',
            jobTitle: 'Backend Developer',
            appliedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            status: 'review'
        },
        {
            studentName: 'Mike Chen',
            college: 'Business School',
            jobTitle: 'Product Manager',
            appliedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            status: 'interview'
        }
    ];

    const demoJobs = [
        {
            title: 'Senior Software Engineer',
            location: 'Remote',
            type: 'Full-time',
            description: 'We are looking for an experienced software engineer to join our team...',
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
    ];

    res.render('pages/company/dashboard', {
        title: 'Company Dashboard - Placement Portal',
        user: req.session.user,
        stats: demoStats,
        recentApplicants: demoApplicants,
        activeJobs: demoJobs,
        isDemo: true
    });
}

// Post new job
exports.postJob = async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Please create a real company account to post jobs.'
            });
        }

        const jobData = {
            ...req.body,
            company: companyId,
            isActive: true
        };

        const job = new Job(jobData);
        await job.save();

        res.json({
            success: true,
            message: 'Job posted successfully!',
            jobId: job._id
        });
    } catch (error) {
        console.error('Post job error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to post job'
        });
    }
};

// Get company applications
exports.getApplications = async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            // Return demo applications
            return res.render('pages/company/applicants', {
                title: 'Applicants - Placement Portal',
                user: req.session.user,
                applications: [],
                isDemo: true
            });
        }

        const applications = await Application.find({
            job: { $in: await Job.find({ company: companyId }).distinct('_id') }
        })
        .populate('job')
        .populate('student')
        .sort({ appliedDate: -1 });

        res.render('pages/company/applicants', {
            title: 'Applicants - Placement Portal',
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

// Update application status
exports.updateApplicationStatus = async (req, res) => {
    try {
        const { applicationId, status } = req.body;
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Demo companies cannot update application status.'
            });
        }

        const application = await Application.findById(applicationId)
            .populate('job');
        
        if (!application) {
            return res.json({
                success: false,
                message: 'Application not found'
            });
        }

        // Verify the job belongs to the company
        if (application.job.company.toString() !== companyId) {
            return res.json({
                success: false,
                message: 'Unauthorized action'
            });
        }

        application.status = status;
        await application.save();

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
};

// Get company profile
exports.getProfile = async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        let profile = null;
        
        if (!isDemoUser) {
            profile = await CompanyProfile.findOne({ user: companyId });
        }

        res.render('pages/company/profile', {
            title: 'Company Profile - Placement Portal',
            user: req.session.user,
            profile,
            isDemo: isDemoUser
        });
    } catch (error) {
        console.error('Company profile error:', error);
        res.status(500).render('error', {
            title: 'Server Error',
            message: 'Failed to load company profile'
        });
    }
};

// Update company profile
exports.updateProfile = async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            return res.json({
                success: false,
                message: 'Please create a real account to update company profile.'
            });
        }

        const profileData = req.body;

        let companyProfile = await CompanyProfile.findOne({ user: companyId });
        
        if (!companyProfile) {
            companyProfile = new CompanyProfile({ 
                user: companyId,
                ...profileData
            });
        } else {
            Object.assign(companyProfile, profileData);
        }

        await companyProfile.save();

        res.json({
            success: true,
            message: 'Company profile updated successfully!'
        });
    } catch (error) {
        console.error('Company profile update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update company profile'
        });
    }
};

// Get comprehensive company analytics
exports.getAnalytics = async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            return renderDemoAnalytics(req, res);
        }

        // Get company jobs
        const companyJobs = await Job.find({ postedBy: companyId });
        const jobIds = companyJobs.map(job => job._id);

        // Applications by status
        const applicationsByStatus = await Application.aggregate([
            { $match: { job: { $in: jobIds } } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Convert to object for easier access
        const statusCounts = {};
        applicationsByStatus.forEach(item => {
            statusCounts[item._id] = item.count;
        });

        // Applications over time (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const applicationsOverTime = await Application.aggregate([
            { 
                $match: { 
                    job: { $in: jobIds },
                    appliedDate: { $gte: thirtyDaysAgo }
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

        // Popular jobs (most applications)
        const popularJobs = await Application.aggregate([
            { $match: { job: { $in: jobIds } } },
            { $group: { _id: '$job', applications: { $sum: 1 } } },
            { $sort: { applications: -1 } },
            { $limit: 5 }
        ]);

        // Populate job details for popular jobs
        const popularJobsWithDetails = await Promise.all(
            popularJobs.map(async (job) => {
                const jobDetails = await Job.findById(job._id);
                return {
                    title: jobDetails?.title || 'Unknown Job',
                    applications: job.applications
                };
            })
        );

        // Conversion rates
        const totalApplications = await Application.countDocuments({ job: { $in: jobIds } });
        const hiredCount = statusCounts['hired'] || 0;
        const interviewCount = statusCounts['interview'] || 0;

        // College demographics
        const collegeDemographics = await Application.aggregate([
            { $match: { job: { $in: jobIds } } },
            { $group: { _id: '$student', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // Populate college names
        const collegeData = await Promise.all(
            collegeDemographics.map(async (item) => {
                const student = await mongoose.model('User').findById(item._id);
                return {
                    college: student?.college || 'Unknown College',
                    count: item.count
                };
            })
        );

        // Skills analysis
        const skillsAnalysis = await Application.aggregate([
            { $match: { job: { $in: jobIds } } },
            { $unwind: '$skills' },
            { $group: { _id: '$skills', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        const analytics = {
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

        res.render('pages/company/analytics', {
            title: 'Analytics Dashboard - Placement Portal',
            user: req.session.user,
            analytics,
            isDemo: false
        });

    } catch (error) {
        console.error('Company analytics error:', error);
        return renderDemoAnalytics(req, res);
    }
};

// Demo analytics data
async function renderDemoAnalytics(req, res) {
    const demoAnalytics = {
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
            hired: 8
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

    res.render('pages/company/analytics', {
        title: 'Analytics Dashboard - Placement Portal',
        user: req.session.user,
        analytics: demoAnalytics,
        isDemo: true
    });
}

// Get analytics data for charts (API endpoint)
exports.getAnalyticsData = async (req, res) => {
    try {
        const companyId = req.session.user.id;
        const { period = '30d' } = req.query;
        const isDemoUser = !mongoose.Types.ObjectId.isValid(companyId);
        
        if (isDemoUser) {
            return res.json({
                success: true,
                data: getDemoChartData(period)
            });
        }

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

        // Applications over time for chart
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
            { $limit: 10 }
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
};

function getDemoChartData(period) {
    // Generate demo chart data based on period
    const baseData = {
        applicationsOverTime: [
            { _id: '2024-01-01', count: 5 },
            { _id: '2024-01-02', count: 8 },
            { _id: '2024-01-03', count: 12 },
            { _id: '2024-01-04', count: 7 },
            { _id: '2024-01-05', count: 15 },
            { _id: '2024-01-06', count: 9 },
            { _id: '2024-01-07', count: 11 }
        ],
        statusDistribution: [
            { _id: 'applied', count: 45 },
            { _id: 'under_review', count: 32 },
            { _id: 'shortlisted', count: 18 },
            { _id: 'interview', count: 24 },
            { _id: 'rejected', count: 29 },
            { _id: 'hired', count: 8 }
        ],
        jobPerformance: [
            { jobTitle: 'Senior Software Engineer', applications: 45 },
            { jobTitle: 'Frontend Developer', applications: 38 },
            { jobTitle: 'Product Manager', applications: 32 },
            { jobTitle: 'Data Analyst', applications: 25 },
            { jobTitle: 'UX Designer', applications: 16 }
        ]
    };

    return baseData;
}