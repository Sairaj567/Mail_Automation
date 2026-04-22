const mongoose = require('mongoose');
const Job = require('../models/Job');
const CompanyProfile = require('../models/CompanyProfile');
const Application = require('../models/Application');
const StudentProfile = require('../models/StudentProfile');
const User = require('../models/User');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const isDemo = (req) => Boolean(req.session?.user?.isDemo);

const wantsJson = (req) =>
	req.xhr || req.headers.accept?.includes('application/json') || req.headers['content-type'] === 'application/json';

// Security: Input validation and sanitization
const ALLOWED_JOB_STATUSES = ['pending', 'active', 'all'];
const ALLOWED_MAIL_CATEGORIES = ['all', 'reply from company', 'urgent', 'competitions', 'internships', 'job opportunities'];
const ALLOWED_MONTHS_RANGE = [1, 24]; // 1 to 24 months for reports

const validateJobStatus = (status) => {
	const normalized = (status || 'pending').toLowerCase().trim();
	return ALLOWED_JOB_STATUSES.includes(normalized) ? normalized : 'pending';
};

const validateMailCategory = (category) => {
	const normalized = (category || 'all').toLowerCase().trim();
	return ALLOWED_MAIL_CATEGORIES.includes(normalized) ? normalized : 'all';
};

const sanitizeSearchQuery = (query) => {
	if (typeof query !== 'string') return '';
	// Remove special regex characters and limit length
	return query.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const validatePagination = (limit, defaultLimit = 150) => {
	const parsed = parseInt(limit, 10);
	return Math.min(Math.max(isNaN(parsed) ? defaultLimit : parsed, 1), 500);
};

const validateMonthsRange = (months) => {
	const parsed = parseInt(months, 10);
	return Math.min(Math.max(isNaN(parsed) ? 6 : parsed, ALLOWED_MONTHS_RANGE[0]), ALLOWED_MONTHS_RANGE[1]);
};

const calculateAdminProfileCompletion = (profile) => {
	if (!profile) return 0;
	const fields = ['college', 'course', 'graduationYear', 'cgpa', 'phone', 'skills', 'resume'];
	let completedFields = 0;

	fields.forEach((field) => {
		const value = profile[field];
		if (Array.isArray(value)) {
			if (value.length > 0) completedFields += 1;
		} else if (value !== null && value !== undefined && value !== '') {
			completedFields += 1;
		}
	});

	return Math.round((completedFields / fields.length) * 100);
};

const ADMIN_REVIEW_ROUTE = '/admin/jobs/review';
const ADMIN_MAIL_ROUTE = '/admin/mail-manager';
const JOB_ACTIVATION_WEBHOOK_URL =
	process.env.N8N_MAIL_SHEET_MAKER_WEBHOOK_URL ||
	process.env.N8N_JOB_APPLICATION_WEBHOOK_URL ||
	'';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toReadableText = (value) => {
	if (value === null || value === undefined) return 'Not available';
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);

	if (Array.isArray(value)) {
		return value
			.map((item) => toReadableText(item))
			.filter(Boolean)
			.join(', ');
	}

	if (typeof value === 'object') {
		if (value.address) return value.address;
		if (Array.isArray(value.value) && value.value[0]?.address) {
			return value.value[0].address;
		}
	}

	return String(value);
};

const isPlaceholderText = (value) => {
	if (typeof value !== 'string') return false;

	const normalized = value.trim().toLowerCase();
	return [
		'',
		'n/a',
		'na',
		'none',
		'null',
		'not mentioned',
		'not available',
		'not specified',
		'unknown',
		'unknown company',
	].includes(normalized);
};

const firstNonEmptyString = (...values) => {
	for (const value of values) {
		if (typeof value === 'string' && value.trim()) {
			return value.trim();
		}
	}
	return '';
};

const firstMeaningfulString = (...values) => {
	for (const value of values) {
		if (typeof value === 'string' && value.trim() && !isPlaceholderText(value)) {
			return value.trim();
		}
	}
	return '';
};

const normalizeStringArray = (value) => {
	if (Array.isArray(value)) {
		return value.map((item) => String(item).trim()).filter(Boolean);
	}

	if (typeof value === 'string' && value.trim()) {
		return value
			.split(/[\n,;]+/)
			.map((item) => item.trim())
			.filter(Boolean);
	}

	return [];
};

const normalizeDisplayLocation = (job = {}) => {
	const locationType = firstMeaningfulString(job.location);
	const locationDetails = firstMeaningfulString(job.location_details);

	if (!locationType && !locationDetails) {
		return 'Location not specified';
	}

	if (!locationDetails || locationDetails.toLowerCase() === 'n/a') {
		return locationType || 'Location not specified';
	}

	if (!locationType) {
		return locationDetails;
	}

	return `${locationType} - ${locationDetails}`;
};

const normalizeDisplayJobType = (job = {}) => {
	const rawJobType = firstMeaningfulString(job.jobType).toLowerCase().replace(/[\s_]+/g, '-');
	const jobTypeMap = {
		fulltime: 'full-time',
		'full-time': 'full-time',
		parttime: 'part-time',
		'part-time': 'part-time',
		internship: 'internship',
		intern: 'internship',
		remote: 'remote',
	};

	if (jobTypeMap[rawJobType]) {
		return jobTypeMap[rawJobType];
	}

	const title = firstMeaningfulString(job.title, job.job_title).toLowerCase();
	if (/\bintern(ship)?\b/.test(title)) {
		return 'internship';
	}

	const rawLocationType = firstMeaningfulString(job.location).toLowerCase();
	if (rawLocationType === 'remote') {
		return 'remote';
	}

	return 'full-time';
};

const normalizeAdminJob = (job) => {
	if (!job) return job;

	const formatted = { ...job };
	formatted.title = firstMeaningfulString(formatted.title, formatted.job_title) || 'Untitled Opportunity';
	formatted.company =
		firstMeaningfulString(formatted.company, formatted.company_name, formatted.recruiter_name) || 'Unknown Company';
	formatted.location = normalizeDisplayLocation(formatted);
	formatted.jobType = normalizeDisplayJobType(formatted);
	formatted.experienceLevel = firstMeaningfulString(formatted.experienceLevel) || 'fresher';
	formatted.salary = firstMeaningfulString(formatted.salary, formatted.compensation) || 'Not specified';
	formatted.description = firstMeaningfulString(formatted.description, formatted.summary) || 'No description available.';
	formatted.skills = normalizeStringArray(formatted.skills).length
		? normalizeStringArray(formatted.skills)
		: normalizeStringArray(formatted.key_skills_mentioned);
	formatted.externalApplyLink = firstMeaningfulString(formatted.externalApplyLink, formatted.link) || null;
	formatted.createdAt = formatted.createdAt || formatted.date || formatted.receivedAt || new Date();

	return formatted;
};

const normalizeEditArray = (value) => {
	if (Array.isArray(value)) {
		return value.map((item) => String(item).trim()).filter(Boolean);
	}

	if (typeof value === 'string' && value.trim()) {
		return value
			.split(/\n|,/)
			.map((item) => item.trim())
			.filter(Boolean);
	}

	return [];
};

const ALLOWED_ADMIN_JOB_TYPES = ['internship', 'full-time', 'part-time', 'remote'];
const ALLOWED_ADMIN_EXPERIENCE_LEVELS = ['fresher', '0-2', '2-5', '5+'];

const buildAdminJobUpdate = (body) => ({
	title: firstMeaningfulString(body.title) || 'Untitled Opportunity',
	company: firstMeaningfulString(body.company) || 'Unknown Company',
	location: firstMeaningfulString(body.location) || 'Location not specified',
	jobType: (() => {
		const normalized = firstMeaningfulString(body.jobType).toLowerCase();
		return ALLOWED_ADMIN_JOB_TYPES.includes(normalized) ? normalized : 'full-time';
	})(),
	salary: firstMeaningfulString(body.salary) || 'Not specified',
	description: firstMeaningfulString(body.description) || 'No description available.',
	requirements: normalizeEditArray(body.requirements),
	responsibilities: normalizeEditArray(body.responsibilities),
	skills: normalizeEditArray(body.skills),
	experienceLevel: (() => {
		const normalized = firstMeaningfulString(body.experienceLevel).toLowerCase();
		return ALLOWED_ADMIN_EXPERIENCE_LEVELS.includes(normalized) ? normalized : 'fresher';
	})(),
	applicationDeadline: (() => {
		if (!body.applicationDeadline) return null;
		const parsedDate = new Date(body.applicationDeadline);
		return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
	})(),
	externalApplyLink: firstMeaningfulString(body.externalApplyLink) || null,
	isActive: body.isActive === 'true' || body.isActive === true || body.isActive === 'on',
});

const buildJobActivationUpdate = (job) => {
	const normalizedJob = normalizeAdminJob(job);
	return {
		title: normalizedJob.title,
		company: normalizedJob.company,
		location: normalizedJob.location,
		jobType: normalizedJob.jobType,
		salary: normalizedJob.salary,
		description: normalizedJob.description,
		skills: normalizedJob.skills,
		experienceLevel: normalizedJob.experienceLevel,
		externalApplyLink: normalizedJob.externalApplyLink,
		isActive: true,
	};
};

const triggerJobActivationWebhook = async (jobId) => {
	if (!JOB_ACTIVATION_WEBHOOK_URL) {
		return { sent: false, reason: 'missing_webhook_url' };
	}

	const webhookUrl = new URL(JOB_ACTIVATION_WEBHOOK_URL);
	webhookUrl.searchParams.set('job_id', String(jobId));
	webhookUrl.searchParams.set('sync_source', 'admin_activation');

	const headers = {};
	if (process.env.N8N_WEBHOOK_SECRET) {
		headers['x-webhook-secret'] = process.env.N8N_WEBHOOK_SECRET;
	}

	const response = await fetch(webhookUrl.toString(), {
		method: 'POST',
		headers,
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Webhook failed (${response.status}): ${body.slice(0, 300)}`);
	}

	return { sent: true };
};

const isWorkflowJobOpportunity = (row = {}) =>
	Boolean(
		firstNonEmptyString(
			row.job_title,
			row.company_name,
			row.summary,
			row.compensation,
			row.recruiter_email
		)
	);

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
			companyDisplayName:
				firstMeaningfulString(job.company, job.company_name, job.postedBy?.name, job.recruiter_name) || 'Unknown Company',
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
			firstMeaningfulString(
				(postedById && profileMap.get(postedById)) || '',
				job.company,
				job.company_name,
				postedBy?.name,
				job.recruiter_name
			) || 'Unknown Company';

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
		]);

		const stats = {
			totalStudents: studentCount,
			totalCompanies: companyCount,
			activeJobs: activeJobsCount,
			pendingJobs: pendingJobsCount,
			totalJobs: activeJobsCount + pendingJobsCount,
			totalApplications: totalApplicationsCount,
		};

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
		const selectedStatus = validateJobStatus(req.query.status);
		let filter = { $or: [{ isActive: false }, { isActive: { $exists: false } }] };

		if (selectedStatus === 'active') {
			filter = { isActive: true };
		} else if (selectedStatus === 'all') {
			filter = {};
		}

		const jobs = await Job.find(filter)
			.populate({ path: 'postedBy', select: 'name email role' })
			.sort({ createdAt: -1 })
			.lean();

		const jobsWithMeta = await attachCompanyMeta(jobs.map(normalizeAdminJob));

		res.render('pages/admin/review-jobs', {
			title: 'Review Pending Jobs',
			subtitle: 'Review automation jobs and control activation/deletion.',
			user: req.session.user,
			jobs: jobsWithMeta,
			selectedStatus,
			status: req.query.status || null,
			error: req.query.error || null,
			sync: req.query.sync || null,
			isDemo: isDemo(req),
			currentPath: req.path,
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

exports.getJobDetailsPage = async (req, res) => {
	try {
		const jobId = req.params.id;

		if (!isValidObjectId(jobId)) {
			return res.status(404).render('404', { title: 'Job Not Found', layout: 'layouts/main' });
		}

		const job = await Job.findById(jobId).populate({ path: 'postedBy', select: 'name email role' }).lean();
		if (!job) {
			return res.status(404).render('404', { title: 'Job Not Found', layout: 'layouts/main' });
		}

		const applications = await Application.find({ job: jobId })
			.populate({ path: 'student', select: 'name email college skills' })
			.sort({ appliedDate: -1 })
			.lean();

		return res.render('pages/admin/job-details', {
			title: `${job.title || 'Job'} - Admin Job Details`,
			subtitle: 'Review full posting information and applicant activity.',
			user: req.session.user,
			job: normalizeAdminJob(job),
			applications,
			isDemo: isDemo(req),
			layout: 'layouts/admin',
		});
	} catch (error) {
		console.error('Admin job details error:', error);
		return res.status(500).render('error', {
			title: 'Server Error',
			message: 'Failed to load job details.',
			user: req.session.user,
			layout: 'layouts/main',
		});
	}
};

exports.getEditJobPage = async (req, res) => {
	try {
		const jobId = req.params.id;

		if (!isValidObjectId(jobId)) {
			return res.status(404).render('404', { title: 'Job Not Found', layout: 'layouts/main' });
		}

		const job = await Job.findById(jobId).lean();
		if (!job) {
			return res.status(404).render('404', { title: 'Job Not Found', layout: 'layouts/main' });
		}

		return res.render('pages/admin/edit-job', {
			title: `${job.title || 'Job'} - Edit Job`,
			subtitle: 'Update the job information as needed.',
			user: req.session.user,
			job: normalizeAdminJob(job),
			isDemo: isDemo(req),
			layout: 'layouts/admin',
		});
	} catch (error) {
		console.error('Admin edit job page error:', error);
		return res.status(500).render('error', {
			title: 'Server Error',
			message: 'Failed to load edit job page.',
			user: req.session.user,
			layout: 'layouts/main',
		});
	}
};

exports.updateJob = async (req, res) => {
	const jobId = req.params.id;

	const respond = (statusCode, payload, redirectQuery) => {
		if (wantsJson(req)) {
			return res.status(statusCode).json(payload);
		}
		const suffix = redirectQuery ? `?${redirectQuery}` : '';
		return res.redirect(`/admin/jobs/${jobId}${suffix}`);
	};

	if (!isValidObjectId(jobId)) {
		return respond(400, { success: false, message: 'Invalid job id.' }, 'error=invalid-id');
	}

	if (isDemo(req)) {
		return respond(403, { success: false, message: 'Demo admins cannot update jobs.' }, 'error=demo');
	}

	try {
		const job = await Job.findById(jobId);
		if (!job) {
			return respond(404, { success: false, message: 'Job not found.' }, 'error=not-found');
		}

		const updateData = buildAdminJobUpdate(req.body);
		Object.assign(job, updateData);
		await job.save();

		return respond(200, { success: true, message: 'Job updated successfully.', jobId: job._id }, 'status=updated');
	} catch (error) {
		console.error('Admin update job error:', error);
		return respond(500, { success: false, message: 'Failed to update job.' }, 'error=server');
	}
};

exports.getJobsFromMongo = async (req, res) => {
	try {
		const status = validateJobStatus(req.query.status);
		let filter = {};

		if (status === 'pending') {
			filter = { $or: [{ isActive: false }, { isActive: { $exists: false } }] };
		} else if (status === 'active') {
			filter = { isActive: true };
		}

		const jobs = await Job.find(filter)
			.populate({ path: 'postedBy', select: 'name email role' })
			.sort({ createdAt: -1 })
			.limit(200)
			.lean();

		const jobsWithMeta = await attachCompanyMeta(jobs.map(normalizeAdminJob));

		return res.json({
			success: true,
			count: jobsWithMeta.length,
			status,
			jobs: jobsWithMeta,
		});
	} catch (error) {
		console.error('Admin fetch jobs from MongoDB error:', error);
		return res.status(500).json({ success: false, message: 'Failed to fetch jobs from MongoDB.' });
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
		const job = await Job.findById(jobId).lean();

		if (!job) {
			return respond(404, { success: false, message: 'Job not found.' }, 'error=not-found');
		}

		await Job.updateOne({ _id: jobId }, { $set: buildJobActivationUpdate(job) });

		let webhookSync = { sent: false, reason: 'not_attempted' };
		try {
			webhookSync = await triggerJobActivationWebhook(job._id);
		} catch (webhookError) {
			console.error('Admin activation webhook sync failed:', webhookError.message);
			webhookSync = { sent: false, reason: 'webhook_error' };
		}

		const syncState = webhookSync.sent ? 'ok' : webhookSync.reason || 'pending';
		return respond(
			200,
			{
				success: true,
				message: webhookSync.sent
					? 'Job activated successfully and sync webhook triggered.'
					: 'Job activated successfully. Sync webhook is pending.',
				jobId: job._id,
				sync: webhookSync,
			},
			`status=activated&sync=${encodeURIComponent(syncState)}`
		);
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

exports.removeApprovedJob = async (req, res) => {
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
		return respond(403, { success: false, message: 'Demo admins cannot remove approved jobs.' }, 'error=demo');
	}

	try {
		const job = await Job.findById(jobId).lean();

		if (!job) {
			return respond(404, { success: false, message: 'Job not found.' }, 'error=not-found');
		}

		if (!job.isActive) {
			return respond(
				400,
				{ success: false, message: 'Only approved jobs can be removed with this action.' },
				'error=not-approved'
			);
		}

		await Job.deleteOne({ _id: jobId });

		if (job.postedBy) {
			await CompanyProfile.updateOne(
				{ user: job.postedBy },
				{ $pull: { jobsPosted: job._id } }
			);
		}

		return respond(
			200,
			{ success: true, message: 'Approved job removed successfully.', jobId: job._id },
			'status=deleted'
		);
	} catch (error) {
		console.error('Admin remove approved job error:', error);
		return respond(500, { success: false, message: 'Failed to remove approved job.' }, 'error=server');
	}
};

exports.getStudentsPage = async (req, res) => {
	try {
		const students = await User.find({ role: 'student' })
			.sort({ createdAt: -1 })
			.lean();

		const studentIds = students.map((student) => student._id);

		const [studentProfiles, studentApplicationResumes] = await Promise.all([
			StudentProfile.find({ user: { $in: studentIds } }).lean(),
			Application.find({
				student: { $in: studentIds },
				resume: { $exists: true, $ne: '' },
			})
				.select('student resume appliedDate')
				.sort({ appliedDate: -1 })
				.lean(),
		]);

		const profileMap = new Map(
			studentProfiles.map((profile) => [profile.user.toString(), profile])
		);

		const applicationResumeMap = new Map();
		for (const application of studentApplicationResumes) {
			const studentId = application.student?.toString();
			if (!studentId || applicationResumeMap.has(studentId)) continue;
			applicationResumeMap.set(studentId, application.resume);
		}

		const enrichedStudents = students.map((student) => {
			const studentId = student._id.toString();
			const embeddedProfile = student.studentProfile || {};
			const collectionProfile = profileMap.get(studentId) || {};

			const mergedProfile = {
				...embeddedProfile,
				...collectionProfile,
				skills:
					(Array.isArray(collectionProfile.skills) && collectionProfile.skills.length > 0)
						? collectionProfile.skills
						: (Array.isArray(embeddedProfile.skills) ? embeddedProfile.skills : []),
				resume:
					collectionProfile.resume ||
					embeddedProfile.resume ||
					applicationResumeMap.get(studentId) ||
					'',
			};

			const completion =
				typeof mergedProfile.profileCompletion === 'number' && !Number.isNaN(mergedProfile.profileCompletion)
					? mergedProfile.profileCompletion
					: calculateAdminProfileCompletion(mergedProfile);

			return {
				...student,
				studentProfile: {
					...mergedProfile,
					profileCompletion: completion,
				},
			};
		});

		const status = (req.query.status || '').toString();
		const error = (req.query.error || '').toString();
		let message = null;
		let messageType = null;

		if (status === 'deleted') {
			message = 'Student account deleted successfully.';
			messageType = 'success';
		} else if (error === 'invalid-id') {
			message = 'Invalid student id.';
			messageType = 'error';
		} else if (error === 'not-found') {
			message = 'Student not found.';
			messageType = 'error';
		} else if (error === 'demo') {
			message = 'Demo admins cannot delete students.';
			messageType = 'error';
		} else if (error === 'server') {
			message = 'Failed to delete student. Please try again.';
			messageType = 'error';
		}

		res.render('pages/admin/students', {
			title: 'Manage Students',
			subtitle: 'View and manage all student users.',
			user: req.session.user,
			students: enrichedStudents,
			message,
			messageType,
			isDemo: isDemo(req),
			layout: 'layouts/admin', // Use the admin layout
		});
	} catch (error) {
		console.error('Error fetching students for admin:', error);
		req.flash('error', 'Failed to load student data.');
		res.redirect('/admin/dashboard');
	}
};

exports.getStudentDetailsPage = async (req, res) => {
	const studentId = req.params.id;

	if (!isValidObjectId(studentId)) {
		return res.redirect('/admin/students?error=invalid-id');
	}

	try {
		const student = await User.findOne({ _id: studentId, role: 'student' })
			.populate('studentProfile')
			.lean();

		if (!student) {
			return res.redirect('/admin/students?error=not-found');
		}

		const applications = await Application.find({ student: studentId })
			.populate({ path: 'job', select: 'title company location jobType isActive createdAt' })
			.sort({ appliedDate: -1 })
			.lean();

		return res.render('pages/admin/student-details', {
			title: 'Student Details',
			subtitle: 'Review profile and application activity.',
			user: req.session.user,
			student,
			applications,
			isDemo: isDemo(req),
			layout: 'layouts/admin',
		});
	} catch (error) {
		console.error('Error fetching student details for admin:', error);
		return res.status(500).render('error', {
			title: 'Server Error',
			message: 'Failed to load student details.',
			user: req.session.user,
			layout: 'layouts/main',
		});
	}
};

exports.deleteStudent = async (req, res) => {
	const studentId = req.params.id;

	const respond = (statusCode, payload, redirectQuery) => {
		if (wantsJson(req)) {
			return res.status(statusCode).json(payload);
		}

		const suffix = redirectQuery ? `?${redirectQuery}` : '';
		return res.redirect(`/admin/students${suffix}`);
	};

	if (!isValidObjectId(studentId)) {
		return respond(400, { success: false, message: 'Invalid student id.' }, 'error=invalid-id');
	}

	if (isDemo(req)) {
		return respond(403, { success: false, message: 'Demo admins cannot delete students.' }, 'error=demo');
	}

	try {
		const student = await User.findOne({ _id: studentId, role: 'student' }).lean();

		if (!student) {
			return respond(404, { success: false, message: 'Student not found.' }, 'error=not-found');
		}

		await Promise.all([
			Application.deleteMany({ student: studentId }),
			StudentProfile.deleteOne({ user: studentId }),
			User.deleteOne({ _id: studentId, role: 'student' }),
		]);

		return respond(200, { success: true, message: 'Student deleted successfully.' }, 'status=deleted');
	} catch (error) {
		console.error('Admin delete student error:', error);
		return respond(500, { success: false, message: 'Failed to delete student.' }, 'error=server');
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
		const selectedMonths = validateMonthsRange(req.query.months);
		const sinceDate = new Date();
		sinceDate.setMonth(sinceDate.getMonth() - selectedMonths + 1);
		sinceDate.setDate(1);
		sinceDate.setHours(0, 0, 0, 0);

		if (isDemo(req)) {
			const now = new Date();
			const monthlyTrend = Array.from({ length: selectedMonths }).map((_, index) => {
				const monthDate = new Date(now.getFullYear(), now.getMonth() - (selectedMonths - 1 - index), 1);
				return {
					label: monthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
					jobs: Math.floor(8 + Math.random() * 10),
					applications: Math.floor(35 + Math.random() * 60),
				};
			});

			return res.render('pages/admin/reports', {
				title: 'Reports',
				subtitle: 'Analytics and placement performance overview.',
				user: req.session.user,
				isDemo: true,
				selectedMonths,
				metrics: {
					totalStudents: 1280,
					totalCompanies: 86,
					totalJobs: 142,
					activeJobs: 118,
					pendingJobs: 24,
					totalApplications: 5430,
				},
				monthlyTrend,
				applicationStatusBreakdown: [
					{ _id: 'applied', count: 2400 },
					{ _id: 'under_review', count: 1320 },
					{ _id: 'shortlisted', count: 760 },
					{ _id: 'interview', count: 430 },
					{ _id: 'accepted', count: 286 },
					{ _id: 'rejected', count: 234 },
				],
				jobTypeBreakdown: [
					{ _id: 'full-time', count: 82 },
					{ _id: 'internship', count: 41 },
					{ _id: 'remote', count: 12 },
					{ _id: 'part-time', count: 7 },
				],
				topCompaniesByJobs: [
					{ _id: 'Demo Cloud Ltd.', count: 18 },
					{ _id: 'Demo Analytics Co.', count: 14 },
					{ _id: 'Demo Studios', count: 11 },
					{ _id: 'Demo Tech Pvt Ltd', count: 10 },
					{ _id: 'Demo Fintech', count: 8 },
				],
				topCompaniesByApplications: [
					{ _id: 'Demo Cloud Ltd.', count: 620 },
					{ _id: 'Demo Analytics Co.', count: 540 },
					{ _id: 'Demo Studios', count: 492 },
					{ _id: 'Demo Tech Pvt Ltd', count: 475 },
					{ _id: 'Demo Fintech', count: 416 },
				],
				topSkillsDemand: [
					{ _id: 'javascript', count: 54 },
					{ _id: 'python', count: 43 },
					{ _id: 'react', count: 37 },
					{ _id: 'node.js', count: 34 },
					{ _id: 'sql', count: 28 },
				],
				recentApplications: [
					{
						_id: 'demo-app-1',
						status: 'under_review',
						appliedDate: new Date(Date.now() - 1000 * 60 * 90),
						student: { name: 'Priya Singh', email: 'priya@example.com' },
						job: { title: 'Frontend Developer', company: 'Demo Cloud Ltd.' },
					},
				],
				layout: 'layouts/admin',
			});
		}

		const [
			totalStudents,
			totalCompanies,
			totalJobs,
			activeJobs,
			pendingJobs,
			totalApplications,
			monthlyJobsRaw,
			monthlyApplicationsRaw,
			applicationStatusBreakdown,
			jobTypeBreakdown,
			topCompaniesByJobs,
			topCompaniesByApplications,
			topSkillsDemand,
			recentApplications,
		] = await Promise.all([
			User.countDocuments({ role: 'student' }),
			User.countDocuments({ role: 'company' }),
			Job.countDocuments({}),
			Job.countDocuments({ isActive: true }),
			Job.countDocuments({ $or: [{ isActive: false }, { isActive: { $exists: false } }] }),
			Application.countDocuments({}),
			Job.aggregate([
				{ $match: { createdAt: { $gte: sinceDate } } },
				{
					$group: {
						_id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
						count: { $sum: 1 },
					},
				},
			]),
			Application.aggregate([
				{ $match: { appliedDate: { $gte: sinceDate } } },
				{
					$group: {
						_id: { year: { $year: '$appliedDate' }, month: { $month: '$appliedDate' } },
						count: { $sum: 1 },
					},
				},
			]),
			Application.aggregate([
				{ $group: { _id: '$status', count: { $sum: 1 } } },
				{ $sort: { count: -1 } },
			]),
			Job.aggregate([
				{ $group: { _id: '$jobType', count: { $sum: 1 } } },
				{ $sort: { count: -1 } },
			]),
			Job.aggregate([
				{ $group: { _id: '$company', count: { $sum: 1 } } },
				{ $sort: { count: -1 } },
				{ $limit: 5 },
			]),
			Application.aggregate([
				{ $lookup: { from: 'jobs', localField: 'job', foreignField: '_id', as: 'jobDoc' } },
				{ $unwind: '$jobDoc' },
				{ $group: { _id: '$jobDoc.company', count: { $sum: 1 } } },
				{ $sort: { count: -1 } },
				{ $limit: 5 },
			]),
			Job.aggregate([
				{ $unwind: '$skills' },
				{ $project: { normalizedSkill: { $trim: { input: { $toLower: '$skills' } } } } },
				{ $match: { normalizedSkill: { $ne: '' } } },
				{ $group: { _id: '$normalizedSkill', count: { $sum: 1 } } },
				{ $sort: { count: -1 } },
				{ $limit: 10 },
			]),
			Application.find({})
				.populate({ path: 'student', select: 'name email' })
				.populate({ path: 'job', select: 'title company' })
				.sort({ appliedDate: -1 })
				.limit(10)
				.lean(),
		]);

		const monthlyJobsMap = new Map(
			monthlyJobsRaw.map((item) => [`${item._id.year}-${item._id.month}`, item.count])
		);
		const monthlyApplicationsMap = new Map(
			monthlyApplicationsRaw.map((item) => [`${item._id.year}-${item._id.month}`, item.count])
		);

		const monthlyTrend = Array.from({ length: selectedMonths }).map((_, index) => {
			const monthDate = new Date();
			monthDate.setDate(1);
			monthDate.setHours(0, 0, 0, 0);
			monthDate.setMonth(monthDate.getMonth() - (selectedMonths - 1 - index));

			const key = `${monthDate.getFullYear()}-${monthDate.getMonth() + 1}`;

			return {
				label: monthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
				jobs: monthlyJobsMap.get(key) || 0,
				applications: monthlyApplicationsMap.get(key) || 0,
			};
		});

		res.render('pages/admin/reports', {
			title: 'Reports',
			subtitle: 'Analytics and placement performance overview.',
			user: req.session.user,
			selectedMonths,
			metrics: {
				totalStudents,
				totalCompanies,
				totalJobs,
				activeJobs,
				pendingJobs,
				totalApplications,
			},
			monthlyTrend,
			applicationStatusBreakdown,
			jobTypeBreakdown,
			topCompaniesByJobs,
			topCompaniesByApplications,
			topSkillsDemand,
			recentApplications,
			isDemo: isDemo(req),
			layout: 'layouts/admin', // Use the admin layout
		});
	} catch (error) {
		console.error('Error loading reports page:', error);
		req.flash('error', 'Failed to load reports page.');
		res.redirect('/admin/dashboard');
	}
};

exports.getMailManager = async (req, res) => {
	const selectedCategory = validateMailCategory(req.query.category);
	const searchQuery = sanitizeSearchQuery(req.query.q);
	const limit = validatePagination(req.query.limit);

	if (isDemo(req)) {
		const demoMails = [
			{
				_id: 'demo-mail-1',
				from: 'jobs@company-example.com',
				to: 'student@example.com',
				subject: 'Interview Scheduling for Frontend Intern Role',
				category: 'Reply from Company',
				bodyPreview: 'Please share your availability for a 30-minute technical interview this week.',
				receivedAt: new Date(Date.now() - 1000 * 60 * 90),
			},
			{
				_id: 'demo-mail-2',
				from: 'alerts@contesthub.org',
				to: 'student@example.com',
				subject: 'Last day to register for Hack the Future Challenge',
				category: 'Urgent',
				bodyPreview: 'Registration closes tonight. Submit your team details before 11:59 PM.',
				receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 10),
			},
			{
				_id: 'demo-mail-3',
				from: 'updates@internships.example',
				to: 'student@example.com',
				subject: 'Remote Cybersecurity Internship Openings',
				category: 'Internships',
				bodyPreview: 'We found three internship opportunities matching your profile and skills.',
				receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
			},
		];

		const filteredDemoMails = demoMails.filter((mail) => {
			const matchesCategory = selectedCategory === 'all' || mail.category === selectedCategory;
			const normalizedSearch = searchQuery.toLowerCase();
			const matchesQuery =
				!normalizedSearch ||
				mail.subject.toLowerCase().includes(normalizedSearch) ||
				mail.from.toLowerCase().includes(normalizedSearch) ||
				mail.bodyPreview.toLowerCase().includes(normalizedSearch);

			return matchesCategory && matchesQuery;
		});

		const categorySummary = filteredDemoMails.reduce((acc, mail) => {
			acc[mail.category] = (acc[mail.category] || 0) + 1;
			return acc;
		}, {});

		return res.render('pages/admin/mail-manager', {
			title: 'Mail Manager',
			subtitle: 'Review categorized incoming emails with filters and search.',
			user: req.session.user,
			mails: filteredDemoMails,
			selectedCategory,
			searchQuery,
			availableCategories: ['Competitions', 'Internships', 'Job Opportunities', 'Reply from Company', 'Urgent'],
			totalCount: filteredDemoMails.length,
			categorySummary,
			isDemo: true,
			currentPath: ADMIN_MAIL_ROUTE,
			layout: 'layouts/admin',
		});
	}

	try {
		const db = mongoose.connection?.db;
		if (!db) {
			throw new Error('Database connection is not ready.');
		}

		const emailCollection = db.collection('emails');
		const jobsCollection = db.collection('jobs');
		const emailFilter = {};
		const includeJobOpportunities = selectedCategory === 'all' || selectedCategory === 'Job Opportunities';

		if (selectedCategory && selectedCategory !== 'all' && selectedCategory !== 'Job Opportunities') {
			emailFilter.category = selectedCategory;
		}

		if (searchQuery) {
			const regex = new RegExp(escapeRegex(searchQuery), 'i');
			emailFilter.$or = [
				{ subject: regex },
				{ from: regex },
				{ to: regex },
				{ body: regex },
				{ category: regex },
			];
		}

		const workflowJobBaseFilter = {
			$or: [
				{ job_title: { $exists: true, $ne: '' } },
				{ company_name: { $exists: true, $ne: '' } },
				{ summary: { $exists: true, $ne: '' } },
				{ compensation: { $exists: true, $ne: '' } },
			],
		};

		const workflowJobFilter = includeJobOpportunities ? { ...workflowJobBaseFilter } : { _id: null };
		if (includeJobOpportunities && searchQuery) {
			const regex = new RegExp(escapeRegex(searchQuery), 'i');
			workflowJobFilter.$and = [
				{
					$or: [
						{ job_title: regex },
						{ company_name: regex },
						{ recruiter_name: regex },
						{ recruiter_email: regex },
						{ summary: regex },
						{ key_skills_mentioned: regex },
					],
				},
			];
		}

		const [mailRows, emailCount, availableCategoriesRaw, groupedCounts, rawJobRows, rawJobCount] = await Promise.all([
			emailCollection.find(emailFilter).sort({ date: -1, receivedAt: -1, _id: -1 }).limit(limit).toArray(),
			emailCollection.countDocuments(emailFilter),
			emailCollection.distinct('category'),
			emailCollection
				.aggregate([
					{ $match: emailFilter },
					{ $group: { _id: '$category', count: { $sum: 1 } } },
					{ $sort: { count: -1 } },
				])
				.toArray(),
			jobsCollection.find(workflowJobFilter).sort({ date: -1, createdAt: -1, _id: -1 }).limit(limit).toArray(),
			jobsCollection.countDocuments(workflowJobFilter),
		]);

		const emailMails = mailRows.map((row) => {
			const subject = toReadableText(row.subject);
			const body = toReadableText(row.body);
			const collapsedBody = body.replace(/\s+/g, ' ').trim();
			const preview = collapsedBody.length > 180 ? `${collapsedBody.slice(0, 180)}...` : collapsedBody;

			const candidateDate = row.date || row.receivedAt || row.createdAt;
			const parsedDate = candidateDate ? new Date(candidateDate) : null;

			return {
				_id: row._id?.toString?.() || String(row._id),
				sourceType: 'email',
				from: toReadableText(row.from),
				to: toReadableText(row.to),
				subject,
				category: toReadableText(row.category),
				bodyPreview: preview || 'No preview available.',
				receivedAt: parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null,
			};
		});

		const workflowJobMails = rawJobRows.filter(isWorkflowJobOpportunity).map((row) => {
			const companyName = firstNonEmptyString(row.company_name, row.company) || 'Unknown Company';
			const jobTitle = firstNonEmptyString(row.job_title, row.title) || 'Untitled Opportunity';
			const summary = firstNonEmptyString(row.summary, row.description) || 'No summary available.';
			const candidateDate = row.date || row.createdAt || row.receivedAt;
			const parsedDate = candidateDate ? new Date(candidateDate) : null;

			return {
				_id: row._id?.toString?.() || String(row._id),
				sourceType: 'job-opportunity',
				from: firstNonEmptyString(row.recruiter_email, companyName) || 'Unknown Sender',
				to: firstNonEmptyString(row.next_step, row.link, 'Placement Portal'),
				subject: `${jobTitle} at ${companyName}`,
				category: 'Job Opportunities',
				bodyPreview: summary.length > 180 ? `${summary.slice(0, 180)}...` : summary,
				receivedAt: parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null,
			};
		});

		const mails = [...emailMails, ...workflowJobMails]
			.sort((left, right) => {
				const leftDate = left.receivedAt ? new Date(left.receivedAt).getTime() : 0;
				const rightDate = right.receivedAt ? new Date(right.receivedAt).getTime() : 0;
				return rightDate - leftDate;
			})
			.slice(0, limit);

		const categorySummary = groupedCounts.reduce((acc, item) => {
			const key = item?._id ? String(item._id) : 'Uncategorized';
			acc[key] = item.count || 0;
			return acc;
		}, {});

		if (rawJobCount > 0) {
			categorySummary['Job Opportunities'] = rawJobCount;
		}

		const availableCategories = (availableCategoriesRaw || [])
			.filter((category) => typeof category === 'string' && category.trim())
			.sort((a, b) => a.localeCompare(b));

		if (rawJobCount > 0 && !availableCategories.includes('Job Opportunities')) {
			availableCategories.push('Job Opportunities');
			availableCategories.sort((a, b) => a.localeCompare(b));
		}

		return res.render('pages/admin/mail-manager', {
			title: 'Mail Manager',
			subtitle: 'Review categorized incoming emails with filters and search.',
			user: req.session.user,
			mails,
			selectedCategory,
			searchQuery,
			availableCategories,
			totalCount: emailCount + rawJobCount,
			categorySummary,
			isDemo: false,
			currentPath: ADMIN_MAIL_ROUTE,
			layout: 'layouts/admin',
		});
	} catch (error) {
		console.error('Error loading admin mail manager:', error);
		return res.status(500).render('error', {
			title: 'Server Error',
			message: 'Failed to load mail manager data.',
			user: req.session.user,
			layout: 'layouts/main',
		});
	}
};
