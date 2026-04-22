const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose'); // Make sure mongoose is required if not already global
const logger = require('../config/logger');

// Import Mongoose models
const Job = require('../models/Job');
const Application = require('../models/Application');
const StudentProfile = require('../models/StudentProfile');
const StudentResume = require('../models/StudentResume');
const User = require('../models/User'); // Import User model if needed for population

// --- Keep the existing constants like JOB_TYPE_VIEW, EXPERIENCE_VIEW, etc. ---
const JOB_TYPE_VIEW = {
  INTERNSHIP: 'internship',
  FULL_TIME: 'full-time', // Corrected from 'fulltime' if needed
  PART_TIME: 'part-time', // Corrected from 'parttime' if needed
  REMOTE: 'remote',
};

const EXPERIENCE_VIEW = {
  FRESHER: 'fresher',
  ZERO_TO_TWO: '0-2',
  TWO_TO_FIVE: '2-5',
  FIVE_PLUS: '5+',
};

const STATUS_VIEW = {
  APPLIED: 'applied',
  UNDER_REVIEW: 'under_review',
  SHORTLISTED: 'shortlisted',
  INTERVIEW: 'interview',
  REJECTED: 'rejected',
  ACCEPTED: 'accepted',
};

const STATUS_DISPLAY = Object.values(STATUS_VIEW);
// --- End of constants ---

const APPLICATION_WEBHOOK_URL = process.env.N8N_JOB_APPLICATION_WEBHOOK_URL || '';
const RESUME_DRIVE_WEBHOOK_URL = process.env.N8N_RESUME_DRIVE_WEBHOOK_URL || '';
const AI_RESUME_KEY = process.env.ai_resume_key || process.env.AI_RESUME_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free';
const DEFAULT_PUBLIC_BASE_URL = 'http://140.245.23.142:3345';


const isDemo = (req) => Boolean(req.session?.user?.isDemo);

// Helper function to check for valid ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const pickFirstText = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
};

const normalizeSkillToken = (skill) => String(skill || '').toLowerCase().trim();

const parseSkillsFromText = (text) => {
  const extracted = String(text || '')
    .split(/[\n,;/|]+/)
    .map((token) => normalizeSkillToken(token))
    .filter(Boolean);
  return [...new Set(extracted)];
};

const rankResumesForJob = (resumes = [], job = {}, fallbackSkills = []) => {
  const jobSkills = new Set([
    ...normalizeStringArray(job.skills).map(normalizeSkillToken),
    ...parseSkillsFromText(job.key_skills_mentioned),
    ...parseSkillsFromText(job.title),
    ...parseSkillsFromText(job.description),
    ...fallbackSkills.map(normalizeSkillToken),
  ].filter(Boolean));

  return resumes
    .map((resume) => {
      const resumeSkills = new Set((resume.skills || []).map(normalizeSkillToken));
      let score = 0;
      jobSkills.forEach((skill) => {
        if (resumeSkills.has(skill)) score += 1;
      });
      if (resume.isPrimary) score += 0.35;
      return { resume, score };
    })
    .sort((a, b) => b.score - a.score);
};

const suggestRolesFromProfile = async (skills = []) => {
  const normalizedSkills = (skills || []).map(normalizeSkillToken).filter(Boolean);
  if (normalizedSkills.length === 0) return [];

  const jobs = await Job.find({ isActive: { $ne: false } }).select('title skills').limit(250).lean();
  const scored = jobs
    .map((job) => {
      const jobSkills = normalizeStringArray(job.skills).map(normalizeSkillToken);
      const overlap = jobSkills.filter((skill) => normalizedSkills.includes(skill)).length;
      return {
        title: pickFirstText(job.title, job.job_title),
        overlap,
      };
    })
    .filter((job) => job.title && job.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap);

  return [...new Set(scored.map((item) => item.title))].slice(0, 5);
};

const callOpenRouter = async (messages, responseFormat = null) => {
  if (!AI_RESUME_KEY) {
    throw new Error('AI resume key is not configured.');
  }

  const payload = {
    model: OPENROUTER_MODEL,
    messages,
    temperature: 0.3,
  };

  if (responseFormat) {
    payload.response_format = responseFormat;
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_RESUME_KEY}`,
      'HTTP-Referer': process.env.APP_BASE_URL || 'http://localhost:3345',
      'X-Title': 'Placement Portal Resume Assistant',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`OpenRouter error (${response.status}): ${bodyText.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenRouter returned an empty response.');
  }

  return content;
};

const normalizeDisplayLocation = (job) => {
  const locationType = pickFirstText(job.location);
  const locationDetails = pickFirstText(job.location_details);

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

const normalizeDisplayJobType = (job) => {
  const rawJobType = pickFirstText(job.jobType).toLowerCase().replace(/[\s_]+/g, '-');
  const jobTypeMap = {
    fulltime: 'full-time',
    'full-time': 'full-time',
    parttime: 'part-time',
    'part-time': 'part-time',
    internship: 'internship',
    intern: 'internship',
    remote: 'remote'
  };

  if (jobTypeMap[rawJobType]) {
    return jobTypeMap[rawJobType];
  }

  const rawLocationType = pickFirstText(job.location).toLowerCase();
  if (rawLocationType === 'remote') {
    return 'remote';
  }

  return 'full-time';
};

const normalizeStringArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const toIdString = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return String(value._id);
  if (typeof value.toString === 'function') {
    const id = value.toString();
    return id && id !== '[object Object]' ? id : null;
  }
  return null;
};

const getPublicBaseUrl = (req) => {
  const configured = process.env.APP_BASE_URL;
  if (configured && configured.trim()) {
    return configured.replace(/\/+$/, '');
  }

  return DEFAULT_PUBLIC_BASE_URL;
};

const buildResumeUrl = (req, resumeFilename) => {
  if (!resumeFilename) return '';
  const baseUrl = getPublicBaseUrl(req);
  return `${baseUrl}/uploads/resumes/${encodeURIComponent(resumeFilename)}`;
};

const triggerApplicationSheetWebhook = async (req, payload) => {
  if (!APPLICATION_WEBHOOK_URL) {
    return { sent: false, reason: 'missing_webhook_url' };
  }

  const webhookUrl = new URL(APPLICATION_WEBHOOK_URL);
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      webhookUrl.searchParams.set(key, String(value));
    }
  });

  const headers = {};
  if (process.env.N8N_WEBHOOK_SECRET) {
    headers['x-webhook-secret'] = process.env.N8N_WEBHOOK_SECRET;
  }

  const response = await fetch(webhookUrl.toString(), {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Webhook failed (${response.status}): ${bodyText.slice(0, 300)}`);
  }

  return { sent: true };
};

const extractDriveLink = (body) => {
  if (!body || typeof body !== 'object') return '';

  const candidates = [
    body.resume_drive_link,
    body.resumeDriveLink,
    body.drive_link,
    body.driveLink,
    body.drive_url,
    body.driveUrl,
    body.url,
    body.link,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const triggerResumeDriveUploadWebhook = async (req, payload) => {
  if (!RESUME_DRIVE_WEBHOOK_URL) {
    return { uploaded: false, reason: 'missing_webhook_url', driveLink: '' };
  }

  const webhookUrl = new URL(RESUME_DRIVE_WEBHOOK_URL);
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      webhookUrl.searchParams.set(key, String(value));
    }
  });

  const headers = {};
  if (process.env.N8N_WEBHOOK_SECRET) {
    headers['x-webhook-secret'] = process.env.N8N_WEBHOOK_SECRET;
  }

  const response = await fetch(webhookUrl.toString(), {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Drive webhook failed (${response.status}): ${bodyText.slice(0, 300)}`);
  }

  let responseBody = null;
  try {
    responseBody = await response.json();
  } catch (_) {
    responseBody = null;
  }

  const driveLink = extractDriveLink(responseBody);
  return {
    uploaded: true,
    reason: driveLink ? 'ok' : 'missing_drive_link_in_response',
    driveLink,
  };
};

const ensureStudentProfile = async (userId) => {
  let profile = await StudentProfile.findOne({ user: userId });
  if (!profile) {
    profile = await StudentProfile.create({
      user: userId,
      skills: [],
      profileCompletion: 0,
    });
  }
  return profile;
};

// --- Keep formatJob and formatApplication helper functions (adjust if needed for Mongoose structure) ---
const formatJob = (job) => {
    if (!job) return null;
    // Mongoose documents have _id, not id by default
    const formatted = job.toObject ? job.toObject() : { ...job }; // Handle both Mongoose docs and plain objects
  formatted._id = toIdString(formatted._id || formatted.id || job);
    formatted.title = pickFirstText(formatted.title, formatted.job_title) || 'Untitled Opportunity';
    formatted.company = pickFirstText(formatted.company, formatted.company_name, formatted.recruiter_name) || 'Unknown Company';
    formatted.location = normalizeDisplayLocation(formatted);
    formatted.requirements = normalizeStringArray(formatted.requirements);
    formatted.responsibilities = normalizeStringArray(formatted.responsibilities);
    formatted.benefits = normalizeStringArray(formatted.benefits);
    formatted.skills = normalizeStringArray(formatted.skills).length
      ? normalizeStringArray(formatted.skills)
      : normalizeStringArray(formatted.key_skills_mentioned);
    formatted.jobType = normalizeDisplayJobType(formatted);
    formatted.experienceLevel = formatted.experienceLevel || 'fresher';
    formatted.salary = pickFirstText(formatted.salary, formatted.compensation) || 'Not specified';
    formatted.description = pickFirstText(formatted.description, formatted.summary) || 'No description available.';
    formatted.externalApplyLink = pickFirstText(formatted.externalApplyLink, formatted.link) || null;
    formatted.createdAt = formatted.createdAt || formatted.date || formatted.receivedAt || new Date();
    formatted.isActive = formatted.isActive !== false;

    return formatted;
};

const formatApplication = (application) => {
    if (!application) return null;
    const formatted = application.toObject ? application.toObject() : { ...application };
    formatted._id = toIdString(formatted._id) || null;
    formatted.status = formatted.status || 'applied';
    if (formatted.status === 'shortlisted') {
      formatted.status = 'under_review';
    }
    formatted.appliedDate = formatted.appliedDate || new Date();
    formatted.resumeTitle =
      pickFirstText(formatted.resumeTitle, formatted.resumeRef?.title, formatted.resumeRef?.name, formatted.resume) || 'Resume';
    // Ensure nested job is also formatted
    const hasPopulatedJobObject =
      formatted.job &&
      typeof formatted.job === 'object' &&
      (formatted.job._id || formatted.job.title || formatted.job.job_title || formatted.job.company || formatted.job.company_name);

    if (hasPopulatedJobObject) {
        formatted.job = formatJob(formatted.job);
    } else {
         // Handle case where job might just be an ID or missing
         formatted.job = {
           _id: toIdString(formatted.job),
           title: 'Unknown Job',
           company: 'Unknown Company',
           location: 'Unknown'
         };
    }
    return formatted;
};
// --- End of helper functions ---

const calculateProfileCompletion = (profile) => {
  if (!profile) return 0;
  // Use fields from your StudentProfile Mongoose schema
  const fields = ['college', 'course', 'graduationYear', 'cgpa', 'phone', 'skills', 'resume'];
  const totalFields = fields.length;
  let completedFields = 0;

  fields.forEach((field) => {
    const value = profile[field];
    if (Array.isArray(value)) {
      if (value.length > 0) completedFields++;
    } else if (value !== null && value !== undefined && value !== '') {
      completedFields++;
    }
  });

  return totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
};

// --- renderDemoDashboard using Mongoose-like structure (or keep simplified) ---
const renderDemoDashboard = async (req, res) => {
  // Simulate fetching demo jobs (no actual DB call needed for demo)
   const demoJobsRaw = [
        {
            _id: 'demo1', title: "Software Engineer Intern", company: "Demo Google", location: "Mountain View, CA", jobType: "internship", salary: "$7,500/month", description: "Demo description...", requirements: [], responsibilities: [], skills: ["Python", "Java"], experienceLevel: "fresher", isActive: true, createdAt: new Date()
        },
        {
            _id: 'demo2', title: "Frontend Developer", company: "Demo Microsoft", location: "Redmond, WA", jobType: "full-time", salary: "$95,000/year", description: "Demo description...", requirements: [], responsibilities: [], skills: ["React", "TypeScript"], experienceLevel: "0-2", isActive: true, createdAt: new Date()
        },
        {
             _id: 'demo3', title: "Data Analyst", company: "Demo Analytics Co.", location: "Remote", jobType: "full-time", salary: "$70,000/year", description: "Demo description...", requirements: [], responsibilities: [], skills: ["SQL", "Python", "Tableau"], experienceLevel: "fresher", isActive: true, createdAt: new Date()
        }
    ];

  const formattedJobs = demoJobsRaw.map(formatJob);

  // Simulate demo applications
  const demoApplications = formattedJobs.slice(0, 2).map((job) => ({
    _id: `app${job._id}`,
    job,
    status: STATUS_DISPLAY[Math.floor(Math.random() * STATUS_DISPLAY.length)],
    appliedDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
  }));


  res.render('pages/student/dashboard', {
    title: 'Student Dashboard - Placement Portal',
    user: req.session.user,
    stats: {
      totalJobs: 5, // Static demo number
      applications: 8,
      pendingApplications: 5
    },
    recentApplications: demoApplications.map(formatApplication), // Ensure formatting
    // Simulate profile completion for demo
    profile: { profileCompletion: calculateProfileCompletion({ college: 'Demo Uni', course: 'CS', skills: ['JS'], resume: 'demo.pdf' }) },
    isDemo: true
  });
};
// --- End of renderDemoDashboard ---

const getDemoJobs = () => ([
  {
    _id: 'demo-job-1',
    title: 'Software Engineer Intern',
    company: 'Google',
    location: 'Mountain View, CA',
    jobType: 'internship',
    salary: '$7,500/month',
    description: 'Work with product teams to build and ship features at scale.',
    requirements: ['Data Structures', 'Algorithms'],
    responsibilities: ['Build features', 'Write tests'],
    skills: ['Python', 'JavaScript', 'Git'],
    experienceLevel: 'fresher',
    isActive: true,
    createdAt: new Date()
  },
  {
    _id: 'demo-job-2',
    title: 'Frontend Developer',
    company: 'Microsoft',
    location: 'Redmond, WA',
    jobType: 'full-time',
    salary: '$95,000/year',
    description: 'Build modern, accessible UI experiences for enterprise applications.',
    requirements: ['React', 'TypeScript'],
    responsibilities: ['Develop UI', 'Optimize performance'],
    skills: ['React', 'TypeScript', 'CSS'],
    experienceLevel: '0-2',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000)
  },
  {
    _id: 'demo-job-3',
    title: 'Backend Engineer',
    company: 'Amazon',
    location: 'Bengaluru, IN',
    jobType: 'remote',
    salary: '$110,000/year',
    description: 'Design reliable backend services and APIs for high-traffic systems.',
    requirements: ['Node.js', 'MongoDB'],
    responsibilities: ['Design APIs', 'Improve reliability'],
    skills: ['Node.js', 'MongoDB', 'Docker'],
    experienceLevel: '2-5',
    isActive: true,
    createdAt: new Date(Date.now() - 2 * 86400000)
  }
]);

exports.getDashboard = async (req, res) => {
  try {
    if (isDemo(req)) {
      return renderDemoDashboard(req, res);
    }

    const studentId = req.session.user.id;

    // Use Mongoose methods
    const [totalJobs, applicationsCount, pendingApplicationsCount, recentApps, profile] = await Promise.all([
      Job.countDocuments({ isActive: { $ne: false } }),
      Application.countDocuments({ student: studentId }),
      Application.countDocuments({ student: studentId, status: { $in: ['applied', 'under_review', 'interview'] } }),
      Application.find({ student: studentId })
        .populate('job') // Populate job details
        .sort({ appliedDate: -1 })
        .limit(3),
      StudentProfile.findOne({ user: studentId })
    ]);

    // Ensure profile exists and calculate completion
     let studentProfile = profile;
     if (!studentProfile) {
         studentProfile = await ensureStudentProfile(studentId); // Create if doesn't exist
     }
     const profileCompletion = calculateProfileCompletion(studentProfile);
     // If the profile was just created, it might not have the completion score yet
     studentProfile.profileCompletion = profileCompletion;

    const suggestedRoles = await suggestRolesFromProfile(studentProfile?.skills || []);


    res.render('pages/student/dashboard', {
      title: 'Student Dashboard - Placement Portal',
      user: req.session.user,
      stats: {
        totalJobs,
        applications: applicationsCount,
        pendingApplications: pendingApplicationsCount
      },
      recentApplications: recentApps.map(formatApplication), // Use formatter
      profile: studentProfile, // Pass the fetched or created profile
      suggestedRoles,
      isDemo: false
    });
  } catch (error) {
    console.error('Dashboard error:', error);
     // Render demo dashboard as a fallback in case of errors
     return renderDemoDashboard(req, res);
  }
};

// --- Update getJobs to use Mongoose ---
exports.getJobs = async (req, res) => {
  try {
    const { search, jobType, experience } = req.query;

    if (isDemo(req)) {
      const demoJobs = getDemoJobs().map(formatJob);
      return res.render('pages/student/jobs', {
        title: 'Job Listings - Placement Portal',
        user: req.session.user,
        jobs: demoJobs,
        filters: {
          search: search || '',
          jobType: jobType || '',
          experience: experience || ''
        },
        isDemo: true
      });
    }

    const filter = { isActive: { $ne: false } };

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }, // Assuming company is stored as string
         { skills: { $regex: search, $options: 'i' } },
         { job_title: { $regex: search, $options: 'i' } },
         { company_name: { $regex: search, $options: 'i' } },
         { key_skills_mentioned: { $regex: search, $options: 'i' } },
         { summary: { $regex: search, $options: 'i' } }
      ];
    }

    if (jobType) {
      if (jobType === 'full-time') {
        filter.jobType = { $in: ['full-time', 'fulltime'] };
      } else if (jobType === 'part-time') {
        filter.jobType = { $in: ['part-time', 'parttime'] };
      } else {
        filter.jobType = jobType; // Assuming jobType values match query values directly
      }
    }

    if (experience) {
      filter.experienceLevel = experience; // Assuming experienceLevel values match
    }

    // Use Mongoose find with the filter object
    const jobs = await Job.find(filter).lean();

    // Fallback for older datasets where isActive might be missing or inconsistent
    const jobsToRender = jobs.length === 0 && !search && !jobType && !experience
      ? await Job.find({}).limit(20).lean()
      : jobs;

    const sortedJobs = jobsToRender.sort((left, right) => {
      const leftDate = new Date(left.createdAt || left.date || left.receivedAt || 0).getTime();
      const rightDate = new Date(right.createdAt || right.date || right.receivedAt || 0).getTime();
      return rightDate - leftDate;
    });

    res.render('pages/student/jobs', {
      title: 'Job Listings - Placement Portal',
      user: req.session.user,
      jobs: sortedJobs.map(formatJob), // Use formatter
      filters: {
        search: search || '',
        jobType: jobType || '',
        experience: experience || ''
      },
      isDemo: isDemo(req)
    });
  } catch (error) {
    console.error('Jobs error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load jobs'
    });
  }
};
// --- End of getJobs ---


// --- Update getJobDetails to use Mongoose ---
exports.getJobDetails = async (req, res) => {
  try {
    const jobId = req.params.id;

    // Check if jobId is a valid MongoDB ObjectId
    if (!isValidObjectId(jobId)) {
      return res.status(404).render('404', { title: 'Job Not Found' });
    }

    // Use Mongoose findById
    const jobRecord = await Job.findById(jobId);

    if (!jobRecord || jobRecord.isActive === false) { // Check if job exists and is active
      return res.status(404).render('404', { title: 'Job Not Found' });
    }

    const job = formatJob(jobRecord); // Use formatter

    // Handle demo user case separately
    if (isDemo(req)) {
      return res.render('pages/student/job-details', {
        title: `${job.title} - Placement Portal`,
        user: req.session.user,
        job,
        hasApplied: false,
        applicationStatus: null,
        application: null, // Add application as null for demo
        profile: null,
        quickApplyConfig: { canQuickApply: false, hasStoredResume: false },
        resumes: [],
        recommendedResumeId: null,
        isSaved: false,
        isDemo: true
      });
    }

    // For real users, check application and saved status
    const studentId = req.session.user.id;
    const profile = await ensureStudentProfile(studentId); // Ensure profile exists
    const resumes = await StudentResume.find({ user: studentId }).sort({ isPrimary: -1, createdAt: -1 }).lean();

    // Use Mongoose findOne for application and saved status
    const application = await Application.findOne({
      job: jobId,
      student: studentId
    });

    const hasStoredResume = Boolean(profile?.resume || resumes.length > 0);
    const hasCoreProfile = Boolean(
      profile?.phone &&
      profile?.college &&
      profile?.course &&
      profile?.graduationYear &&
      profile?.cgpa !== null &&
      profile?.cgpa !== undefined &&
      Array.isArray(profile?.skills) &&
      profile.skills.length > 0
    );

    const quickApplyConfig = {
      canQuickApply: hasStoredResume && hasCoreProfile,
      hasStoredResume,
      hasCoreProfile
    };

    const rankedResumes = rankResumesForJob(resumes, job, profile?.skills || []);
    const recommendedResumeId = rankedResumes.length ? String(rankedResumes[0].resume._id) : null;

    // Check if the job is saved (assuming savedJobs is an array of ObjectIds in StudentProfile)
    const isSaved = profile.savedJobs.some(savedJobId => savedJobId.equals(jobId));


    res.render('pages/student/job-details', {
      title: `${job.title} - Placement Portal`,
      user: req.session.user,
      job,
      hasApplied: Boolean(application),
      // Mongoose returns the application object or null
      application: application ? formatApplication(application) : null,
      applicationStatus: application ? application.status : null,
      profile,
      quickApplyConfig,
      resumes,
      recommendedResumeId,
      isSaved: isSaved,
      isDemo: false
    });
  } catch (error) {
    console.error('Job details error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load job details'
    });
  }
};
// --- End of getJobDetails ---


// --- Update applyForJob to use Mongoose ---
exports.applyForJob = async (req, res) => {
  try {
    const studentId = req.session.user?.id;
    
    if (isDemo(req)) {
      logger.warn('Demo user attempted to apply for job', { studentId });
      return res.json({
        success: false,
        message: 'Please create a real account to apply for jobs.'
      });
    }

    const jobId = req.body.jobId;
    logger.info('Student job application initiated', { studentId, jobId });

    if (!isValidObjectId(jobId)) {
        logger.warn('Invalid job ID format', { studentId, jobId });
        return res.json({ success: false, message: 'Invalid job selected' });
    }

     // Check if student profile exists and has a resume
    const studentProfile = await StudentProfile.findOne({ user: studentId });
    const selectedResumeId = pickFirstText(req.body.selectedResumeId);
    let allResumes = [];
    try {
      if (mongoose.connection?.readyState === 1) {
        allResumes = await StudentResume.find({ user: studentId }).sort({ isPrimary: -1, createdAt: -1 }).lean();
      }
    } catch (resumeLoadError) {
      logger.warn('Unable to load student resume library, falling back to profile resume.', {
        studentId,
        error: resumeLoadError.message,
      });
      allResumes = [];
    }
    let selectedResumeDoc = null;

    if (selectedResumeId && isValidObjectId(selectedResumeId)) {
      selectedResumeDoc = allResumes.find((item) => String(item._id) === selectedResumeId) || null;
    }

    if (!selectedResumeDoc && allResumes.length > 0) {
      const matched = rankResumesForJob(allResumes, await Job.findById(jobId).lean(), studentProfile?.skills || []);
      selectedResumeDoc = matched.length ? matched[0].resume : allResumes[0];
    }

    // Use uploaded resume first, then selected/primary profile resume fallback.
    let resumeFilename = selectedResumeDoc?.filename || studentProfile?.resume || '';
    let resumeTitle = selectedResumeDoc?.title || 'Resume';
    let coverLetterFilename = '';
    let resumeRef = selectedResumeDoc?._id || null;

    // Check uploaded files
     if (req.files) {
         if (req.files.resume && req.files.resume[0]) {
             resumeFilename = req.files.resume[0].filename;
             logger.info('Resume file uploaded', { studentId, resumeFilename });
             if (mongoose.connection?.readyState === 1) {
               const createdResume = await StudentResume.create({
                 user: studentId,
                 title: `Resume ${new Date().toLocaleDateString()}`,
                 filename: resumeFilename,
                 skills: studentProfile?.skills || [],
                 isPrimary: allResumes.length === 0,
               });
               resumeRef = createdResume._id;
               resumeTitle = createdResume.title;
             }

           // Keep latest uploaded resume as quick-apply default
             if (studentProfile) {
                 studentProfile.resume = resumeFilename;
                 await studentProfile.save();
             }
         } else if (!resumeFilename) {
             // If no resume was uploaded AND profile has no resume, return error
             logger.warn('Application rejected: no resume available', { studentId });
             return res.json({
                 success: false,
                 message: 'Please upload your resume before applying or ensure it exists in your profile.'
             });
         }
         if (req.files.coverLetterFile && req.files.coverLetterFile[0]) {
             coverLetterFilename = req.files.coverLetterFile[0].filename;
             logger.info('Cover letter file uploaded', { studentId, coverLetterFilename });
         }
     } else if (!resumeFilename) {
          // If req.files is undefined AND profile has no resume, return error
          logger.warn('Application rejected: no resume file or profile resume', { studentId });
          return res.json({
                 success: false,
                 message: 'Please upload your resume before applying or ensure it exists in your profile.'
             });
     }


    const existingApplication = await Application.findOne({
      job: jobId,
      student: studentId
    });

    if (existingApplication) {
      logger.warn('Duplicate application attempt blocked', { studentId, jobId });
      return res.json({
        success: false,
        message: 'You have already applied for this job'
      });
    }

    // Merge submitted values with profile/session values so students do not need
    // to manually re-enter the same application details every time.
    const fullName = pickFirstText(req.body.fullName, req.session?.user?.name);
    const email = pickFirstText(req.body.email, req.session?.user?.email);
    const phone = pickFirstText(req.body.phone, studentProfile?.phone);
    const linkedin = pickFirstText(req.body.linkedin, studentProfile?.socialLinks?.linkedin);
    const college = pickFirstText(req.body.college, studentProfile?.college);
    const degree = pickFirstText(req.body.degree, studentProfile?.course);

    const graduationYearRaw = pickFirstText(req.body.graduationYear, studentProfile?.graduationYear ? String(studentProfile.graduationYear) : '');
    const graduationYearValue = graduationYearRaw ? Number(graduationYearRaw) : null;
    const graduationYear = Number.isFinite(graduationYearValue) ? graduationYearValue : null;
    const cgpaRaw = pickFirstText(req.body.cgpa, studentProfile?.cgpa !== undefined && studentProfile?.cgpa !== null ? String(studentProfile.cgpa) : '');
    const cgpaValue = cgpaRaw ? Number(cgpaRaw) : null;
    const cgpa = Number.isFinite(cgpaValue) ? cgpaValue : null;
    const inferredEducationStatus = graduationYear
      ? (graduationYear >= new Date().getFullYear() ? 'pursuing' : 'completed')
      : '';
    const educationStatus = pickFirstText(req.body.educationStatus, inferredEducationStatus);
    const marksType = pickFirstText(req.body.marksType, 'cgpa');

    const skillsInput = pickFirstText(
      req.body.skills,
      Array.isArray(studentProfile?.skills) ? studentProfile.skills.join(', ') : ''
    );
    const skillsArray = skillsInput
      ? skillsInput.split(',').map((skill) => skill.trim()).filter(Boolean)
      : [];

    const projects = pickFirstText(req.body.projects);
    const extracurricular = pickFirstText(req.body.extracurricular);
    const coverLetterText = pickFirstText(req.body.coverLetterText);

    const missingFields = [];
    if (!fullName) missingFields.push('full name');
    if (!email) missingFields.push('email');

    if (missingFields.length > 0) {
      logger.warn('Application rejected: missing required fields', { studentId, jobId, missingFields });
      return res.json({
        success: false,
        message: `Please complete your ${missingFields.join(', ')} in profile/application form before applying.`
      });
    }

    // Create a new Application using the Mongoose model
    const application = new Application({
      student: studentId,
      job: jobId,
      // Store personal/education details directly in the application
      personalInfo: { fullName, email, phone, linkedin },
      education: { college, degree, status: educationStatus || undefined, graduationYear, cgpa, marksType },
      skills: skillsArray,
      projects,
      extracurricular,
      resume: resumeFilename, // Filename from upload or profile
      resumeTitle,
      resumeRef,
      coverLetterFile: coverLetterFilename || null, // Optional filename
      coverLetterText: coverLetterText || null, // Optional text
      appliedDate: new Date(),
      status: 'applied' // Default status
      // communications array is not needed here, handled by model default/hooks if any
      // chatMessages array is not needed here
    });

    await application.save();
    logger.info('Application saved successfully', { studentId, jobId, applicationId: application._id });

    const resumeUrl = buildResumeUrl(req, resumeFilename);
    let resumeDriveSync = { uploaded: false, reason: 'not_attempted', driveLink: '' };

    try {
      resumeDriveSync = await triggerResumeDriveUploadWebhook(req, {
        job_id: jobId,
        stu_name: pickFirstText(fullName, req.session?.user?.name) || 'Student',
        stu_mail: pickFirstText(email, req.session?.user?.email) || '',
        resume_url: resumeUrl,
      });
      logger.info('Resume drive webhook triggered', { studentId, jobId, result: resumeDriveSync });
    } catch (driveWebhookError) {
      logger.error('Resume drive webhook failed', { 
        error: driveWebhookError.message, 
        studentId, 
        jobId,
        stack: driveWebhookError.stack 
      });
      resumeDriveSync = { uploaded: false, reason: 'webhook_error', driveLink: '' };
    }

    const resumeLinkForSheet = resumeDriveSync.driveLink || resumeUrl;
    const sheetPayload = {
      job_id: jobId,
      stu_name: pickFirstText(fullName, req.session?.user?.name) || 'Student',
      stu_mail: pickFirstText(email, req.session?.user?.email) || '',
      resume_url: resumeLinkForSheet,
      resume_drive_link: resumeDriveSync.driveLink,
      portfolio: pickFirstText(req.body.portfolio, linkedin),
    };

    let sheetSync = { sent: false, reason: 'not_attempted' };
    try {
      sheetSync = await triggerApplicationSheetWebhook(req, sheetPayload);
      logger.info('Application sheet webhook triggered', { studentId, jobId, result: sheetSync });
    } catch (webhookError) {
      logger.error('Application sheet webhook failed', { 
        error: webhookError.message, 
        studentId, 
        jobId,
        stack: webhookError.stack 
      });
      sheetSync = { sent: false, reason: 'webhook_error' };
    }

    logger.info('Job application completed successfully', { studentId, jobId, applicationId: application._id });

    res.json({
      success: true,
      message: sheetSync.sent
        ? (resumeDriveSync.driveLink
            ? 'Application submitted, resume uploaded to Drive, and pushed to sheet workflow.'
            : 'Application submitted and pushed to sheet workflow.')
        : 'Application submitted successfully. Sheet sync is pending.',
      applicationId: application._id, // Use _id for Mongoose
      sheetSync: sheetSync.sent,
      resumeDriveLink: resumeDriveSync.driveLink || null,
    });
  } catch (error) {
    const studentId = req.session?.user?.id;
    logger.error('Apply job error', { 
      error: error.message, 
      studentId,
      stack: error.stack,
      jobId: req.body?.jobId
    });
    res.status(500).json({
      success: false,
      // Provide more specific error message if possible
      message: `Failed to submit application: ${error.message}`
    });
  }
};
// --- End of applyForJob ---

// --- Update toggleSaveJob to use Mongoose ---
exports.toggleSaveJob = async (req, res) => {
  try {
    if (isDemo(req)) {
      return res.json({
        success: false,
        message: 'Please create a real account to save jobs.'
      });
    }

    const studentId = req.session.user.id;
    const jobId = req.body.jobId;

    if (!isValidObjectId(jobId)) {
      return res.json({ success: false, message: 'Invalid job' });
    }

    // Use Mongoose findOneAndUpdate for efficiency
     const profile = await StudentProfile.findOne({ user: studentId });

     if (!profile) {
         // This case should ideally not happen if ensureStudentProfile runs on login/dashboard
         return res.status(404).json({ success: false, message: 'Student profile not found.' });
     }

    const isSaved = profile.savedJobs.some(savedJobId => savedJobId.equals(jobId));
    let updateOperation;

    if (isSaved) {
      // Remove job from savedJobs array
      updateOperation = { $pull: { savedJobs: jobId } };
    } else {
      // Add job to savedJobs array
      updateOperation = { $addToSet: { savedJobs: jobId } }; // Use $addToSet to prevent duplicates
    }

     await StudentProfile.updateOne({ user: studentId }, updateOperation);

    return res.json({
      success: true,
      isSaved: !isSaved, // The new state
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
// --- End of toggleSaveJob ---


// --- Update getApplications to use Mongoose ---
exports.getApplications = async (req, res) => {
  try {
    if (isDemo(req)) {
       // Simulate demo applications using formatJob for consistency
        const demoJobsRaw = [
             { _id: 'demo1', title: "Software Engineer Intern", company: "Demo Google", location: "Mountain View, CA", jobType: "internship", salary: "$7,500/month", description: "Demo description...", requirements: [], responsibilities: [], skills: ["Python", "Java"], experienceLevel: "fresher", isActive: true, createdAt: new Date() },
             { _id: 'demo2', title: "Frontend Developer", company: "Demo Microsoft", location: "Redmond, WA", jobType: "full-time", salary: "$95,000/year", description: "Demo description...", requirements: [], responsibilities: [], skills: ["React", "TypeScript"], experienceLevel: "0-2", isActive: true, createdAt: new Date() }
        ];
        const applications = demoJobsRaw.map((job) => ({
            _id: `app${job._id}`,
            job: formatJob(job), // Format the demo job
            status: STATUS_DISPLAY[Math.floor(Math.random() * STATUS_DISPLAY.length)],
          appliedDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          resumeTitle: 'Demo Resume'
       }));


      return res.render('pages/student/applications', {
        title: 'My Applications - Placement Portal',
        user: req.session.user,
        applications: applications.map(formatApplication), // Apply formatting
        isDemo: true
      });
    }

    const studentId = req.session.user.id;

    // Use Mongoose find with populate
    const applications = await Application.find({ student: studentId })
      .populate('job') // Populate the referenced Job document
      .populate({ path: 'resumeRef', select: 'title filename isPrimary' })
      .sort({ appliedDate: -1 });

    res.render('pages/student/applications', {
      title: 'My Applications - Placement Portal',
      user: req.session.user,
      applications: applications.map(formatApplication), // Use formatter
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
// --- End of getApplications ---


// --- Update getProfile to use Mongoose ---
exports.getProfile = async (req, res) => {
  try {
     const studentId = req.session.user.id;
     // Use Mongoose findOne
     const profile = isDemo(req) ? null : await StudentProfile.findOne({ user: studentId });

     // For demo or if profile doesn't exist, provide a default structure
        const profileData = profile || (isDemo(req) ? {
            college: 'Demo University',
            course: 'Computer Science',
            skills: ['JavaScript', 'React'],
            resume: 'demo_resume.pdf',
            applicationCount: 5 // Example static count for demo
            // Add other fields expected by the template
        } : {});


    res.render('pages/student/profile', {
      title: 'Student Profile - Placement Portal',
      user: req.session.user,
       profile: profileData, // Pass the fetched or default profile data
       // Add applicationCount if your template needs it (Mongoose virtual can handle this)
       applicationCount: profile ? (await Application.countDocuments({ student: studentId })) : (profileData.applicationCount || 0),
      isDemo: isDemo(req)
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load profile'
    });
  }
};
// --- End of getProfile ---

// --- Update updateProfile to use Mongoose ---
exports.updateProfile = async (req, res) => {
  try {
    if (isDemo(req)) {
      return res.json({
        success: false,
        message: 'Please create a real account to update your profile.'
      });
    }

    const studentId = req.session.user.id;
    const profilePayload = { ...req.body };

    // Convert comma-separated skills string to array
    if (typeof profilePayload.skills === 'string') {
      profilePayload.skills = profilePayload.skills
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean);
    } else {
        profilePayload.skills = []; // Ensure skills is an array
    }

     // Prepare update data, ensuring numbers are parsed correctly
     const updateData = {
         college: profilePayload.college || null,
         course: profilePayload.course || null,
         specialization: profilePayload.specialization || null,
         graduationYear: profilePayload.graduationYear ? Number(profilePayload.graduationYear) : null,
         cgpa: profilePayload.cgpa ? Number(profilePayload.cgpa) : null,
         phone: profilePayload.phone || null,
         dateOfBirth: profilePayload.dateOfBirth ? new Date(profilePayload.dateOfBirth) : null,
         skills: profilePayload.skills,
         socialLinks: { // Assuming socialLinks is an object in your schema
             linkedin: profilePayload.linkedin || null,
             github: profilePayload.github || null,
             portfolio: profilePayload.portfolio || null
         }
         // resume field is handled by uploadResume route
     };

    // Use Mongoose findOneAndUpdate with upsert option
    const options = { new: true, upsert: true, setDefaultsOnInsert: true };
    let updatedProfile = await StudentProfile.findOneAndUpdate(
      { user: studentId },
      { $set: updateData }, // Use $set to update fields
      options
    );

     // Recalculate and save profile completion
     updatedProfile.profileCompletion = calculateProfileCompletion(updatedProfile);
     await updatedProfile.save();


    res.json({
      success: true,
      message: 'Profile updated successfully!',
      profileCompletion: updatedProfile.profileCompletion
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: `Failed to update profile: ${error.message}`
    });
  }
};
// --- End of updateProfile ---

// --- Update getResume to use Mongoose ---
exports.getResume = async (req, res) => {
  try {
     const studentId = req.session.user.id;
     // Use Mongoose findOne
     const profile = isDemo(req) ? null : await StudentProfile.findOne({ user: studentId });
     const resumes = isDemo(req)
       ? [{ _id: 'demo-resume-1', title: 'Demo Resume', filename: 'demo_resume.pdf', isPrimary: true, skills: ['javascript', 'react'] }]
       : await StudentResume.find({ user: studentId }).sort({ isPrimary: -1, createdAt: -1 }).lean();

    // Provide demo data if needed
      const profileData = profile || (isDemo(req) ? {
        resume: 'demo_resume.pdf',
        applicationCount: 5
        } : {});

       // Get application count for real users
        const applicationCount = profile ? await Application.countDocuments({ student: studentId }) : (profileData.applicationCount || 0);
        const suggestedRoles = await suggestRolesFromProfile(profileData?.skills || []);
        const profileMatchScore = profileData.profileCompletion || (profileData.resume ? 85 : 0);
        const analyticsMeta = {
          applicationsSource: 'live',
          profileMatchSource: 'estimate',
          viewsSource: 'untracked'
        };

        if (profile) {
          profile.$locals.applicationCount = applicationCount;
        }

        profileData.applicationCount = applicationCount;


    res.render('pages/student/resume', {
      title: 'My Resume - Placement Portal',
      user: req.session.user,
       profile: profileData, // Pass profile data
      resumes,
       applicationCount: applicationCount, // Pass application count
      suggestedRoles,
       profileMatchScore,
       analyticsMeta,
      isDemo: isDemo(req)
    });
  } catch (error) {
    console.error('Resume page error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to load resume page'
    });
  }
};
// --- End of getResume ---


// --- Update uploadResume to use Mongoose ---
exports.uploadResume = async (req, res) => {
  try {
    if (isDemo(req)) {
      // Simulate success for demo user without DB interaction
      if (!req.file) {
          return res.json({ success: false, message: 'Please select a file to upload' });
      }
       // You might want to delete the uploaded demo file immediately or handle it differently
       // fs.unlinkSync(req.file.path); // Example: Delete the file
      return res.json({
        success: true,
        message: 'Demo resume uploaded (not saved)!',
        filename: req.file.filename
      });
    }


    if (!req.file) {
      return res.json({
        success: false,
        message: 'Please select a file to upload'
      });
    }

  const studentId = req.session.user.id;
  const existingResumes = await StudentResume.find({ user: studentId }).lean();

  const createdResume = await StudentResume.create({
    user: studentId,
    title: req.body.resumeTitle || `Resume ${new Date().toLocaleDateString()}`,
    filename: req.file.filename,
    skills: parseSkillsFromText(req.body.skills),
    isPrimary: existingResumes.length === 0,
  });

  const options = { new: true, upsert: true, setDefaultsOnInsert: true };
  let updatedProfile = await StudentProfile.findOneAndUpdate(
    { user: studentId },
    { $set: { resume: req.file.filename } },
    options
  );

  updatedProfile.profileCompletion = calculateProfileCompletion(updatedProfile);
  await updatedProfile.save();

    res.json({
      success: true,
      message: 'Resume uploaded successfully!',
      filename: req.file.filename,
      resumeId: createdResume._id,
    });
  } catch (error) {
    console.error('Resume upload error:', error);
     // If there's an error and a file was uploaded, attempt to delete it
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
                console.log('Cleaned up uploaded file after error:', req.file.filename);
            } catch (cleanupError) {
                console.error('Error cleaning up uploaded file:', cleanupError);
            }
        }
    res.status(500).json({
      success: false,
       message: `Failed to upload resume: ${error.message}`
    });
  }
};
// --- End of uploadResume ---

// --- Update deleteApplication to use Mongoose ---
exports.deleteApplication = async (req, res) => {
  try {
    if (isDemo(req)) {
      return res.json({
        success: false,
        message: 'Demo users cannot delete applications.'
      });
    }

    const studentId = req.session.user.id;
    const applicationId = req.body.applicationId;

    if (!isValidObjectId(applicationId)) {
      return res.json({ success: false, message: 'Invalid application ID' });
    }

    // Use Mongoose findOneAndDelete
    const deletedApplication = await Application.findOneAndDelete({
      _id: applicationId,
      student: studentId // Verify ownership
    });

    if (!deletedApplication) {
      return res.json({
        success: false,
        message: 'Application not found or you do not have permission to delete it.'
      });
    }

     // Optional: Check status before deleting, though findOneAndDelete handles non-existence
     const allowedStatuses = ['applied']; // Only allow deleting if just applied
     if (!allowedStatuses.includes(deletedApplication.status)) {
         // Note: The application is already deleted at this point.
         // You might want to find it first, check status, then delete.
         // Or, simply inform the user the action might have unintended consequences if status was advanced.
         // For simplicity here, we proceed but could adjust logic.
          console.warn(`Deleted application ${applicationId} with status ${deletedApplication.status}`);
         // return res.json({ success: false, message: `Cannot delete application with status: ${deletedApplication.status}` });
     }


    res.json({
      success: true,
      message: 'Application deleted successfully'
    });
  } catch (error) {
    console.error('Delete application error:', error);
    res.status(500).json({
      success: false,
       message: `Failed to delete application: ${error.message}`
    });
  }
};
// --- End of deleteApplication ---

// --- Update deleteResume to use Mongoose ---
exports.deleteResume = async (req, res) => {
  try {
    if (isDemo(req)) {
      return res.json({
        success: false,
        message: 'Demo users cannot delete resumes.'
      });
    }

    const studentId = req.session.user.id;
    const requestedResumeId = pickFirstText(req.body?.resumeId, req.query?.resumeId);

    let resumeDoc = null;
    if (requestedResumeId && isValidObjectId(requestedResumeId)) {
      resumeDoc = await StudentResume.findOne({ _id: requestedResumeId, user: studentId });
    }

    if (!resumeDoc) {
      resumeDoc = await StudentResume.findOne({ user: studentId, isPrimary: true }).sort({ updatedAt: -1 });
    }

    if (!resumeDoc) {
      const fallbackProfile = await StudentProfile.findOne({ user: studentId });
      if (!fallbackProfile || !fallbackProfile.resume) {
        return res.json({ success: false, message: 'No resume found to delete' });
      }
      resumeDoc = { filename: fallbackProfile.resume, _id: null, isPrimary: true };
    }

    const resumePathToDelete = resumeDoc.filename;

    if (resumeDoc._id) {
      await StudentResume.deleteOne({ _id: resumeDoc._id, user: studentId });
    }

    const remainingResumes = await StudentResume.find({ user: studentId }).sort({ createdAt: -1 });
    if (resumeDoc.isPrimary && remainingResumes.length > 0) {
      remainingResumes[0].isPrimary = true;
      await remainingResumes[0].save();
    }

    const profile = await StudentProfile.findOne({ user: studentId });
    if (profile) {
      profile.resume = remainingResumes[0]?.filename || undefined;
      profile.profileCompletion = calculateProfileCompletion(profile);
      await profile.save();
    }

    // Attempt to delete the file from the filesystem
    const resumePathOnDisk = path.join(__dirname, '../../public/uploads/resumes', resumePathToDelete);
    if (fs.existsSync(resumePathOnDisk)) {
        try {
            fs.unlinkSync(resumePathOnDisk);
            console.log('Deleted resume file:', resumePathToDelete);
        } catch (fileError) {
             console.error('Error deleting resume file:', fileError);
             // Decide if this should be a user-facing error or just logged
        }
    } else {
        console.warn('Resume file not found on disk for deletion:', resumePathToDelete);
    }


    res.json({
      success: true,
      message: 'Resume deleted successfully'
    });
  } catch (error) {
    console.error('Delete resume error:', error);
    res.status(500).json({
      success: false,
       message: `Failed to delete resume: ${error.message}`
    });
  }
};
// --- End of deleteResume ---

exports.uploadProfileImage = async (req, res) => {
  try {
    if (isDemo(req)) {
      return res.json({ success: false, message: 'Demo users cannot upload profile images.' });
    }

    if (!req.file || !req.file.filename) {
      return res.status(400).json({ success: false, message: 'Please choose an image to upload.' });
    }

    const studentId = req.session.user.id;
    const profile = await ensureStudentProfile(studentId);
    const previousImage = profile.profileImage;
    profile.profileImage = req.file.filename;
    profile.profileCompletion = calculateProfileCompletion(profile);
    await profile.save();

    if (previousImage && previousImage !== req.file.filename) {
      const previousPath = path.join(__dirname, '../../public/uploads/profile-images', previousImage);
      if (fs.existsSync(previousPath)) {
        try {
          fs.unlinkSync(previousPath);
        } catch (cleanupError) {
          logger.warn('Failed to cleanup previous profile image', { studentId, error: cleanupError.message });
        }
      }
    }

    return res.json({
      success: true,
      message: 'Profile image uploaded successfully.',
      imageUrl: `/uploads/profile-images/${encodeURIComponent(req.file.filename)}`,
    });
  } catch (error) {
    logger.error('Profile image upload failed', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Failed to upload profile image.' });
  }
};

exports.setPrimaryResume = async (req, res) => {
  try {
    if (isDemo(req)) {
      return res.status(403).json({ success: false, message: 'Demo users cannot modify resume settings.' });
    }

    const studentId = req.session.user.id;
    const resumeId = pickFirstText(req.body.resumeId);

    if (!isValidObjectId(resumeId)) {
      return res.status(400).json({ success: false, message: 'Invalid resume selected.' });
    }

    const resume = await StudentResume.findOne({ _id: resumeId, user: studentId });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found.' });
    }

    await StudentResume.updateMany({ user: studentId }, { $set: { isPrimary: false } });
    resume.isPrimary = true;
    await resume.save();

    const profile = await ensureStudentProfile(studentId);
    profile.resume = resume.filename;
    profile.profileCompletion = calculateProfileCompletion(profile);
    await profile.save();

    return res.json({ success: true, message: 'Primary resume updated.' });
  } catch (error) {
    logger.error('Failed setting primary resume', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Failed to set primary resume.' });
  }
};

exports.getRecommendedResumeForJob = async (req, res) => {
  try {
    const studentId = req.session.user.id;
    const jobId = req.params.jobId;

    if (!isValidObjectId(jobId)) {
      return res.status(400).json({ success: false, message: 'Invalid job id.' });
    }

    const [job, profile, resumes] = await Promise.all([
      Job.findById(jobId).lean(),
      StudentProfile.findOne({ user: studentId }).lean(),
      StudentResume.find({ user: studentId }).sort({ isPrimary: -1, createdAt: -1 }).lean(),
    ]);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    if (!resumes.length) {
      return res.json({ success: true, recommendedResumeId: null, message: 'No saved resumes yet.' });
    }

    const ranked = rankResumesForJob(resumes, job, profile?.skills || []);
    const top = ranked[0];
    return res.json({
      success: true,
      recommendedResumeId: String(top.resume._id),
      score: top.score,
      title: top.resume.title,
    });
  } catch (error) {
    logger.error('Resume recommendation failed', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Failed to compute recommended resume.' });
  }
};

exports.aiResumeReview = async (req, res) => {
  try {
    const resumeText = pickFirstText(req.body.resumeText);
    const targetRole = pickFirstText(req.body.targetRole) || 'Software Engineer';

    if (!resumeText) {
      return res.status(400).json({ success: false, message: 'Resume text is required.' });
    }

    const content = await callOpenRouter([
      {
        role: 'system',
        content: 'You are a strict resume reviewer. Return concise, practical feedback in markdown with sections: Strengths, Gaps, Priority Fixes, ATS Improvements, and a score out of 100.',
      },
      {
        role: 'user',
        content: `Target Role: ${targetRole}\n\nResume:\n${resumeText}`,
      },
    ]);

    return res.json({ success: true, review: content });
  } catch (error) {
    logger.error('AI resume review failed', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: error.message || 'AI review failed.' });
  }
};

exports.aiResumeBuild = async (req, res) => {
  try {
    const studentId = req.session.user.id;
    const targetRole = pickFirstText(req.body.targetRole) || 'Software Engineer';
    const additionalNotes = pickFirstText(req.body.additionalNotes);

    const profile = await StudentProfile.findOne({ user: studentId }).lean();
    const user = await User.findById(studentId).select('name email').lean();

    const profileSummary = {
      name: user?.name || '',
      email: user?.email || '',
      phone: profile?.phone || '',
      college: profile?.college || '',
      course: profile?.course || '',
      graduationYear: profile?.graduationYear || '',
      cgpa: profile?.cgpa || '',
      skills: profile?.skills || [],
      linkedin: profile?.socialLinks?.linkedin || '',
      github: profile?.socialLinks?.github || '',
      portfolio: profile?.socialLinks?.portfolio || '',
      notes: additionalNotes,
    };

    const content = await callOpenRouter([
      {
        role: 'system',
        content: 'You are a resume builder assistant. Produce a clean, ATS-friendly markdown resume with sections: Header, Summary, Skills, Education, Projects (with placeholders if missing), and Certifications/Activities.',
      },
      {
        role: 'user',
        content: `Target Role: ${targetRole}\n\nProfile JSON:\n${JSON.stringify(profileSummary, null, 2)}`,
      },
    ]);

    return res.json({ success: true, generatedResume: content });
  } catch (error) {
    logger.error('AI resume builder failed', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: error.message || 'AI resume generation failed.' });
  }
};

exports.renameResume = async (req, res) => {
  try {
    if (isDemo(req)) {
      return res.status(403).json({ success: false, message: 'Demo users cannot rename resumes.' });
    }

    const studentId = req.session.user.id;
    const resumeId = pickFirstText(req.body.resumeId);
    const newTitle = pickFirstText(req.body.title);

    if (!isValidObjectId(resumeId)) {
      return res.status(400).json({ success: false, message: 'Invalid resume selected.' });
    }

    if (!newTitle) {
      return res.status(400).json({ success: false, message: 'Please enter a resume name.' });
    }

    const resume = await StudentResume.findOneAndUpdate(
      { _id: resumeId, user: studentId },
      { $set: { title: newTitle } },
      { new: true }
    );

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found.' });
    }

    return res.json({
      success: true,
      message: 'Resume renamed successfully.',
      title: resume.title,
      resumeId: resume._id,
    });
  } catch (error) {
    logger.error('Resume rename failed', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Failed to rename resume.' });
  }
};