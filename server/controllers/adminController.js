const mongoose = require('mongoose');
const Job = require('../models/Job');
const CompanyProfile = require('../models/CompanyProfile');
const Application = require('../models/Application');
const User = require('../models/User');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const isDemo = (req) => Boolean(req.session?.user?.isDemo);

const wantsJson = (req) =>
	req.xhr || req.headers.accept?.includes('application/json') || req.headers['content-type'] === 'application/json';

const ADMIN_REVIEW_ROUTE = '/admin/jobs/review';

const parseSalaryToLakhs = (salary) => {
	if (!salary) return null;
	const normalized = salary.toString().toLowerCase().replace(/[₹,]/g, '').trim();
	const matches = normalized.match(/(\d+(?:\.\d+)?)/g);
	if (!matches) return null;
	const values = matches
		.map((value) => parseFloat(value))
		.filter((value) => !Number.isNaN(value));
	if (!values.length) return null;
	let average = values.reduce((sum, value) => sum + value, 0) / values.length;

	const includesLpa = /(lpa|lakh|lac)/.test(normalized);
	const includesThousand = /(k|thousand)/.test(normalized);
	const perMonth = /(per\s*month|\/month|monthly)/.test(normalized);

	if (perMonth) {
		// If monthly and expressed in thousands, convert to LPA assuming 1 LPA = 100k
		if (includesThousand) {
			average = (average * 12) / 100;
		} else {
			// Assume amount is in currency units per month (e.g., INR)
			average = (average * 12) / 100000;
		}
	} else if (includesThousand && !includesLpa) {
		// Annual salary expressed in thousands (e.g., 800k)
		average = average / 100;
	}

	if (!Number.isFinite(average)) return null;
	return average;
};

async function attachCompanyMeta(jobs) {
	if (!jobs || !jobs.length) return jobs;

	const companyUserIds = jobs
		.map((job) => {
			const postedBy = job.postedBy;
			if (!postedBy) return null;
			if (typeof postedBy === 'object' && postedBy !== null) {
				if (postedBy._id) return postedBy._id.toString();
				return postedBy.toString();
			}
			return postedBy.toString();
		})
		.filter(Boolean);

	if (companyUserIds.length === 0) {
		return jobs.map((job) => ({
			...job,
			companyDisplayName: job.company || job.postedBy?.name || 'Unknown Company',
			postedByEmail: job.postedBy?.email || null,
		}));
	}

	const companyProfiles = await CompanyProfile.find({ user: { $in: companyUserIds } })
		.select('user companyName')
		.lean();

	const profileMap = new Map(
		companyProfiles.map((profile) => [profile.user.toString(), profile.companyName])
	);

	return jobs.map((job) => {
		const postedBy = job.postedBy;
		const postedById =
			typeof postedBy === 'object' && postedBy !== null && postedBy._id
				? postedBy._id.toString()
				: postedBy?.toString?.();

		const companyDisplayName =
			(postedById && profileMap.get(postedById)) || job.company || postedBy?.name || 'Unknown Company';

		return {
			...job,
			companyDisplayName,
			postedByEmail: postedBy?.email || null,
		};
	});
}

exports.getDashboard = async (req, res) => {
	try {
		if (isDemo(req)) {
			const demoStats = {
				totalStudents: 1280,
				totalCompanies: 86,
				totalJobs: 142,
				activeJobs: 118,
				pendingJobs: 24,
				totalApplications: 5430,
				placedStudents: 286,
				averagePackage: 6.5,
			};

			const demoPendingJobs = [
				{
					_id: 'demo-job-1',
					title: 'Data Analyst Intern',
					companyDisplayName: 'Demo Analytics Co.',
					location: 'Remote',
					jobType: 'internship',
					createdAt: new Date(),
				},
				{
					_id: 'demo-job-2',
					title: 'Product Designer',
					companyDisplayName: 'Demo Studios',
					location: 'Bengaluru, IN',
					jobType: 'full-time',
					createdAt: new Date(Date.now() - 3600 * 1000 * 5),
				},
			];

			const demoRecentJobs = [
				{
					_id: 'demo-job-3',
					title: 'Backend Engineer',
					companyDisplayName: 'Demo Cloud Ltd.',
					location: 'Hyderabad, IN',
					jobType: 'full-time',
					createdAt: new Date(Date.now() - 3600 * 1000 * 12),
					isActive: true,
				},
			];

			const demoRecentApplications = [
				{
					_id: 'demo-app-1',
					studentName: 'Priya Singh',
					studentEmail: 'priya@example.com',
					jobTitle: 'Frontend Developer',
					company: 'Demo Tech Pvt Ltd',
					status: 'under_review',
					appliedDate: new Date(Date.now() - 3600 * 1000 * 6),
				},
				{
					_id: 'demo-app-2',
					studentName: 'Rahul Mehta',
					studentEmail: 'rahul@example.com',
					jobTitle: 'Product Manager',
					company: 'Demo Labs',
					status: 'applied',
					appliedDate: new Date(Date.now() - 3600 * 1000 * 20),
				},
			];

			const demoRecentStudents = [
				{ _id: 'demo-student-1', name: 'Asha Nair', email: 'asha@example.com', createdAt: new Date() },
				{ _id: 'demo-student-2', name: 'Nitin Patel', email: 'nitin@example.com', createdAt: new Date(Date.now() - 86400000) },
			];

			const demoRecentCompanies = [
				{ _id: 'demo-company-1', name: 'Demo Ventures', email: 'talent@demoventures.com', createdAt: new Date() },
			];

			return res.render('pages/admin/dashboard', {
				title: 'Admin Dashboard',
				subtitle: 'Monitor opportunities, students, and hiring activity.',
				user: req.session.user,
				stats: demoStats,
				pendingJobs: demoPendingJobs,
				recentJobs: demoRecentJobs,
				recentApplications: demoRecentApplications,
				recentStudents: demoRecentStudents,
				recentCompanies: demoRecentCompanies,
				isDemo: true,
				layout: 'layouts/admin', // Use the admin layout
			});
		}

		const [
			studentCount,
			companyCount,
			activeJobsCount,
			pendingJobsCount,
			totalApplicationsCount,
			recentJobsRaw,
			pendingJobsRaw,
			recentApplicationsRaw,
			recentStudents,
			recentCompanies,
			placedStudentIds,
			jobSalaryDocs,
		] = await Promise.all([
			User.countDocuments({ role: 'student' }),
			User.countDocuments({ role: 'company' }),
			Job.countDocuments({ isActive: true }),
			Job.countDocuments({ isActive: false }),
			Application.countDocuments({}),
			Job.find({})
				.populate({ path: 'postedBy', select: 'name email role' })
				.sort({ createdAt: -1 })
				.limit(5)
				.lean(),
			Job.find({ isActive: false })
				.populate({ path: 'postedBy', select: 'name email role' })
				.sort({ createdAt: -1 })
				.limit(5)
				.lean(),
			Application.find({})
				.populate({ path: 'job', select: 'title company location' })
				.populate({ path: 'student', select: 'name email' })
				.sort({ appliedDate: -1 })
				.limit(5)
				.lean(),
			User.find({ role: 'student' })
				.select('name email createdAt')
				.sort({ createdAt: -1 })
				.limit(5)
				.lean(),
			User.find({ role: 'company' })
				.select('name email createdAt')
				.sort({ createdAt: -1 })
				.limit(5)
				.lean(),
			Application.distinct('student', { status: 'accepted' }),
			Job.find({ salary: { $exists: true, $ne: '' } }).select('salary').lean(),
		]);

		const stats = {
			totalStudents: studentCount,
			totalCompanies: companyCount,
			activeJobs: activeJobsCount,
			pendingJobs: pendingJobsCount,
			totalJobs: activeJobsCount + pendingJobsCount,
			totalApplications: totalApplicationsCount,
		};

		const placedStudentsCount = Array.isArray(placedStudentIds) ? placedStudentIds.length : 0;
		const salaryValues = (jobSalaryDocs || [])
			.map((doc) => parseSalaryToLakhs(doc.salary))
			.filter((value) => typeof value === 'number' && !Number.isNaN(value));
		const averagePackageValue = salaryValues.length
			? Number((salaryValues.reduce((sum, value) => sum + value, 0) / salaryValues.length).toFixed(2))
			: null;

		stats.placedStudents = placedStudentsCount;
		stats.averagePackage = averagePackageValue;

		const [recentJobs, pendingJobs] = await Promise.all([
			attachCompanyMeta(recentJobsRaw),
			attachCompanyMeta(pendingJobsRaw),
		]);

		const recentApplications = recentApplicationsRaw.map((application) => ({
			_id: application._id.toString(),
			studentName: application.student?.name || 'Unknown Student',
			studentEmail: application.student?.email || null,
			jobTitle: application.job?.title || 'Unknown Job',
			company: application.job?.company || 'Unknown Company',
			status: application.status,
			appliedDate: application.appliedDate,
		}));

		res.render('pages/admin/dashboard', {
			title: 'Admin Dashboard',
			subtitle: 'Monitor opportunities, students, and hiring activity.',
			user: req.session.user,
			stats,
			pendingJobs,
			recentJobs,
			recentApplications,
			recentStudents,
			recentCompanies,
			isDemo: false,
			layout: 'layouts/admin', // Use the admin layout
		});
	} catch (error) {
		console.error('Admin dashboard error:', error);
		res.status(500).render('error', {
			title: 'Server Error',
			message: 'Failed to load admin dashboard.',
			user: req.session.user,
			layout: 'layouts/main', // Or a generic error layout
		});
	}
};

exports.getJobsForReview = async (req, res) => {
	try {
		const jobs = await Job.find({ isActive: false })
			.populate({ path: 'postedBy', select: 'name email role' })
			.sort({ createdAt: -1 })
			.lean();

		const jobsWithMeta = await attachCompanyMeta(jobs);

		res.render('pages/admin/review-jobs', {
			title: 'Review Pending Jobs',
			subtitle: 'Activate or delete job postings submitted via n8n.',
			user: req.session.user,
			jobs: jobsWithMeta,
			isDemo: isDemo(req),
			layout: 'layouts/admin', // Use the admin layout
		});
	} catch (error) {
		console.error('Admin review jobs error:', error);
		res.status(500).render('error', {
			title: 'Server Error',
			message: 'Failed to load pending jobs.',
			user: req.session.user,
			layout: 'layouts/main',
		});
	}
};

exports.activateJob = async (req, res) => {
	const jobId = req.params.id;

	const respond = (statusCode, payload, redirectQuery) => {
		if (wantsJson(req)) {
			return res.status(statusCode).json(payload);
		}
		const suffix = redirectQuery ? `?${redirectQuery}` : '';
		return res.redirect(`${ADMIN_REVIEW_ROUTE}${suffix}`);
	};

	if (!isValidObjectId(jobId)) {
		return respond(400, { success: false, message: 'Invalid job id.' }, 'error=invalid-id');
	}

	if (isDemo(req)) {
		return respond(403, { success: false, message: 'Demo admins cannot activate jobs.' }, 'error=demo');
	}

	try {
		const job = await Job.findByIdAndUpdate(jobId, { isActive: true }, { new: true });

		if (!job) {
			return respond(404, { success: false, message: 'Job not found.' }, 'error=not-found');
		}

		return respond(200, { success: true, message: 'Job activated successfully.', jobId: job._id }, 'status=activated');
	} catch (error) {
		console.error('Admin activate job error:', error);
		return respond(500, { success: false, message: 'Failed to activate job.' }, 'error=server');
	}
};

exports.deleteJob = async (req, res) => {
	const jobId = req.params.id;

	const respond = (statusCode, payload, redirectQuery) => {
		if (wantsJson(req)) {
			return res.status(statusCode).json(payload);
		}
		const suffix = redirectQuery ? `?${redirectQuery}` : '';
		return res.redirect(`${ADMIN_REVIEW_ROUTE}${suffix}`);
	};

	if (!isValidObjectId(jobId)) {
		return respond(400, { success: false, message: 'Invalid job id.' }, 'error=invalid-id');
	}

	if (isDemo(req)) {
		return respond(403, { success: false, message: 'Demo admins cannot delete jobs.' }, 'error=demo');
	}

	try {
		const job = await Job.findById(jobId);

		if (!job) {
			return respond(404, { success: false, message: 'Job not found.' }, 'error=not-found');
		}

		await Job.deleteOne({ _id: jobId });

		if (job.postedBy) {
			await CompanyProfile.updateOne(
				{ user: job.postedBy },
				{ $pull: { jobsPosted: job._id } }
			);
		}

		return respond(200, { success: true, message: 'Job deleted successfully.', jobId: job._id }, 'status=deleted');
	} catch (error) {
		console.error('Admin delete job error:', error);
		return respond(500, { success: false, message: 'Failed to delete job.' }, 'error=server');
	}
};

exports.getStudentsPage = async (req, res) => {
	try {
		const students = await User.find({ role: 'student' })
			.populate('studentProfile')
			.sort({ createdAt: -1 })
			.lean();

		res.render('pages/admin/students', {
			title: 'Manage Students',
			subtitle: 'View and manage all student users.',
			user: req.session.user,
			students,
			isDemo: isDemo(req),
			layout: 'layouts/admin', // Use the admin layout
		});
	} catch (error) {
		console.error('Error fetching students for admin:', error);
		req.flash('error', 'Failed to load student data.');
		res.redirect('/admin/dashboard');
	}
};

exports.getCompaniesPage = async (req, res) => {
	try {
		const companies = await User.find({ role: 'company' })
			.populate('companyProfile')
			.sort({ createdAt: -1 })
			.lean();

		res.render('pages/admin/companies', {
			title: 'Manage Companies',
			subtitle: 'View and manage all company users.',
			user: req.session.user,
			companies,
			isDemo: isDemo(req),
			layout: 'layouts/admin', // Use the admin layout
		});
	} catch (error) {
		console.error('Error fetching companies for admin:', error);
		req.flash('error', 'Failed to load company data.');
		res.redirect('/admin/dashboard');
	}
};

exports.getReportsPage = async (req, res) => {
	try {
		res.render('pages/admin/reports', {
			title: 'Reports',
			subtitle: 'Analytics and insights are under construction.',
			user: req.session.user,
			isDemo: isDemo(req),
			layout: 'layouts/admin', // Use the admin layout
		});
	} catch (error) {
		console.error('Error loading reports page:', error);
		req.flash('error', 'Failed to load reports page.');
		res.redirect('/admin/dashboard');
	}
};
