const fs = require('fs');
const path = require('path');
const prisma = require('../prismaClient');

const JOB_TYPE_VIEW = {
  INTERNSHIP: 'internship',
  FULL_TIME: 'fulltime',
  PART_TIME: 'parttime',
  REMOTE: 'remote'
};

const EXPERIENCE_VIEW = {
  FRESHER: 'fresher',
  ZERO_TO_TWO: '0-2',
  TWO_TO_FIVE: '2-5',
  FIVE_PLUS: '5+'
};

const STATUS_VIEW = {
  APPLIED: 'applied',
  UNDER_REVIEW: 'under_review',
  SHORTLISTED: 'shortlisted',
  INTERVIEW: 'interview',
  REJECTED: 'rejected',
  ACCEPTED: 'accepted'
};

const STATUS_DISPLAY = Object.values(STATUS_VIEW);

const mapEducationStatus = (value) => {
  if (!value) return null;
  const normalized = value.toString().toLowerCase();
  if (normalized === 'completed') return 'COMPLETED';
  if (normalized === 'pursuing') return 'PURSUING';
  return null;
};

const isDemo = (req) => Boolean(req.session?.user?.isDemo);

const parseId = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const ensureStudentProfile = async (userId) => {
  let profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) {
    profile = await prisma.studentProfile.create({
      data: {
        userId,
        skills: [],
        profileCompletion: 0
      }
    });
  }
  return profile;
};

const formatJob = (job) => {
  if (!job) return null;
  return {
    ...job,
    _id: job.id.toString(),
    jobType: job.jobType ? JOB_TYPE_VIEW[job.jobType] || job.jobType.toLowerCase() : null,
    experienceLevel: job.experienceLevel ? EXPERIENCE_VIEW[job.experienceLevel] || job.experienceLevel.toLowerCase() : null,
    requirements: job.requirements || [],
    responsibilities: job.responsibilities || [],
    skills: job.skills || [],
    company: job.companyName
  };
};

const formatApplication = (application) => {
  if (!application) return null;
  return {
    ...application,
    _id: application.id.toString(),
    status: STATUS_VIEW[application.status] || application.status.toLowerCase(),
    appliedDate: application.appliedAt,
    job: formatJob(application.job)
  };
};

const calculateProfileCompletion = (profile) => {
  if (!profile) return 0;
  const fields = ['college', 'course', 'graduationYear', 'cgpa', 'phone', 'skills', 'resumePath'];
  const increment = 100 / fields.length;
  let score = 0;

  fields.forEach((field) => {
    const value = profile[field];
    if (!value) return;

    if (Array.isArray(value)) {
      if (value.length > 0) score += increment;
    } else if (value !== null && value !== undefined && value !== '') {
      score += increment;
    }
  });

  return Math.round(score);
};

const renderDemoDashboard = async (req, res) => {
  const jobs = await prisma.job.findMany({
    where: { isActive: true },
    take: 5,
    orderBy: { createdAt: 'desc' }
  });

  const formattedJobs = jobs.map(formatJob);
  const demoApplications = formattedJobs.slice(0, 3).map((job) => ({
    job,
    status: STATUS_DISPLAY[Math.floor(Math.random() * STATUS_DISPLAY.length)],
    appliedDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
  }));

  res.render('pages/student/dashboard', {
    title: 'Student Dashboard - Placement Portal',
    user: req.session.user,
    stats: {
      totalJobs: formattedJobs.length,
      applications: 8,
      pendingApplications: 5,
      interviews: 2
    },
    recentApplications: demoApplications,
    profile: { profileCompletion: 65 },
    isDemo: true
  });
};

exports.getDashboard = async (req, res) => {
  try {
    if (isDemo(req)) {
      return renderDemoDashboard(req, res);
    }

    const studentId = req.session.user.id;

    const [totalJobs, applications, pendingApplications, interviews, recentApplications, profile] = await Promise.all([
      prisma.job.count({ where: { isActive: true } }),
      prisma.application.count({ where: { studentId } }),
      prisma.application.count({ where: { studentId, status: { in: ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED'] } } }),
      prisma.application.count({ where: { studentId, status: 'INTERVIEW' } }),
      prisma.application.findMany({
        where: { studentId },
        include: { job: true },
        orderBy: { appliedAt: 'desc' },
        take: 3
      }),
      prisma.studentProfile.findUnique({ where: { userId: studentId } })
    ]);

    res.render('pages/student/dashboard', {
      title: 'Student Dashboard - Placement Portal',
      user: req.session.user,
      stats: {
        totalJobs,
        applications,
        pendingApplications,
        interviews
      },
      recentApplications: recentApplications.map(formatApplication),
      profile: profile || { profileCompletion: 0 },
      isDemo: false
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return renderDemoDashboard(req, res);
  }
};

const mapJobTypeFilter = (value) => {
  if (!value) return undefined;
  const key = value.toString().toLowerCase();
  switch (key) {
    case 'internship':
      return 'INTERNSHIP';
    case 'fulltime':
      return 'FULL_TIME';
    case 'parttime':
      return 'PART_TIME';
    case 'remote':
      return 'REMOTE';
    default:
      return undefined;
  }
};

const mapExperienceFilter = (value) => {
  if (!value) return undefined;
  const key = value.toString().toLowerCase();
  switch (key) {
    case 'fresher':
      return 'FRESHER';
    case '0-2':
      return 'ZERO_TO_TWO';
    case '2-5':
      return 'TWO_TO_FIVE';
    case '5+':
      return 'FIVE_PLUS';
    default:
      return undefined;
  }
};

exports.getJobs = async (req, res) => {
  try {
    const { search, jobType, experience } = req.query;

    const where = { isActive: true };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const jobTypeFilter = mapJobTypeFilter(jobType);
    if (jobTypeFilter) {
      where.jobType = jobTypeFilter;
    }

    const experienceFilter = mapExperienceFilter(experience);
    if (experienceFilter) {
      where.experienceLevel = experienceFilter;
    }

    const jobs = await prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.render('pages/student/jobs', {
      title: 'Job Listings - Placement Portal',
      user: req.session.user,
      jobs: jobs.map(formatJob),
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

exports.getJobDetails = async (req, res) => {
  try {
    const jobId = parseId(req.params.id);
    if (jobId === null) {
      return res.status(404).render('404', { title: 'Job Not Found' });
    }

    const jobRecord = await prisma.job.findUnique({ where: { id: jobId } });
    if (!jobRecord) {
      return res.status(404).render('404', { title: 'Job Not Found' });
    }

    const job = formatJob(jobRecord);

    if (isDemo(req)) {
      return res.render('pages/student/job-details', {
        title: `${job.title} - Placement Portal`,
        user: req.session.user,
        job,
        hasApplied: false,
        applicationStatus: null,
        isSaved: false,
        isDemo: true
      });
    }

    const studentId = req.session.user.id;
    const profile = await ensureStudentProfile(studentId);

    const application = await prisma.application.findUnique({
      where: {
        jobId_studentId: {
          jobId,
          studentId
        }
      }
    });

    const savedJob = await prisma.studentSavedJob.findUnique({
      where: {
        studentProfileId_jobId: {
          studentProfileId: profile.id,
          jobId
        }
      }
    });

    res.render('pages/student/job-details', {
      title: `${job.title} - Placement Portal`,
      user: req.session.user,
      job,
      hasApplied: Boolean(application),
      applicationStatus: application ? STATUS_VIEW[application.status] || application.status.toLowerCase() : null,
      isSaved: Boolean(savedJob),
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

exports.applyForJob = async (req, res) => {
  try {
    if (isDemo(req)) {
      return res.json({
        success: false,
        message: 'Please create a real account to apply for jobs.'
      });
    }

    const studentId = req.session.user.id;
    const jobId = parseId(req.body.jobId);

    if (!jobId) {
      return res.json({ success: false, message: 'Invalid job selected' });
    }

    const existingApplication = await prisma.application.findUnique({
      where: {
        jobId_studentId: {
          jobId,
          studentId
        }
      }
    });

    if (existingApplication) {
      return res.json({
        success: false,
        message: 'You have already applied for this job'
      });
    }

    let resumeFilename = '';
    let coverLetterFilename = '';

    if (req.files) {
      if (req.files.resume && req.files.resume[0]) {
        resumeFilename = req.files.resume[0].filename;
      }
      if (req.files.coverLetterFile && req.files.coverLetterFile[0]) {
        coverLetterFilename = req.files.coverLetterFile[0].filename;
      }
    }

    if (!resumeFilename) {
      return res.json({
        success: false,
        message: 'Please upload your resume'
      });
    }

    const {
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

    const skillsArray = skills
      ? skills
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean)
      : [];

    const application = await prisma.application.create({
      data: {
        studentId,
        jobId,
        fullName,
        email,
        phone,
        linkedin,
        college,
        degree,
        educationStatus: mapEducationStatus(educationStatus),
        graduationYear: graduationYear ? Number(graduationYear) : null,
        cgpa: cgpa ? Number(cgpa) : null,
        marksType: marksType || null,
        skills: skillsArray,
        projects: projects || null,
        extracurricular: extracurricular || null,
        resumePath: resumeFilename,
        coverLetterPath: coverLetterFilename || null,
        coverLetterText: coverLetterText || null,
        communications: {
          create: {
            type: 'STATUS_UPDATE',
            content: 'Application submitted successfully',
            sentBy: 'SYSTEM'
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Application submitted successfully!',
      applicationId: application.id
    });
  } catch (error) {
    console.error('Apply job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit application'
    });
  }
};

exports.toggleSaveJob = async (req, res) => {
  try {
    if (isDemo(req)) {
      return res.json({
        success: false,
        message: 'Please create a real account to save jobs.'
      });
    }

    const studentId = req.session.user.id;
    const jobId = parseId(req.body.jobId);

    if (!jobId) {
      return res.json({ success: false, message: 'Invalid job' });
    }

    const profile = await ensureStudentProfile(studentId);

    const key = {
      studentProfileId: profile.id,
      jobId
    };

    const existing = await prisma.studentSavedJob.findUnique({
      where: { studentProfileId_jobId: key }
    });

    if (existing) {
      await prisma.studentSavedJob.delete({ where: { studentProfileId_jobId: key } });
      return res.json({ success: true, isSaved: false, message: 'Job removed from saved' });
    }

    await prisma.studentSavedJob.create({
      data: {
        studentProfileId: profile.id,
        jobId
      }
    });

    return res.json({ success: true, isSaved: true, message: 'Job saved successfully' });
  } catch (error) {
    console.error('Save job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update saved jobs'
    });
  }
};

exports.getApplications = async (req, res) => {
  try {
    if (isDemo(req)) {
      const jobs = await prisma.job.findMany({ where: { isActive: true }, take: 5 });
      const applications = jobs.map((job) => ({
        job: formatJob(job),
        status: STATUS_DISPLAY[Math.floor(Math.random() * STATUS_DISPLAY.length)],
        appliedDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
      }));

      return res.render('pages/student/applications', {
        title: 'My Applications - Placement Portal',
        user: req.session.user,
        applications,
        isDemo: true
      });
    }

    const studentId = req.session.user.id;

    const applications = await prisma.application.findMany({
      where: { studentId },
      include: { job: true },
      orderBy: { appliedAt: 'desc' }
    });

    res.render('pages/student/applications', {
      title: 'My Applications - Placement Portal',
      user: req.session.user,
      applications: applications.map(formatApplication),
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

exports.getProfile = async (req, res) => {
  try {
    const profile = isDemo(req)
      ? null
      : await prisma.studentProfile.findUnique({ where: { userId: req.session.user.id } });

    res.render('pages/student/profile', {
      title: 'Student Profile - Placement Portal',
      user: req.session.user,
      profile,
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

    if (typeof profilePayload.skills === 'string') {
      profilePayload.skills = profilePayload.skills
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean);
    }

    const data = {
      college: profilePayload.college || null,
      course: profilePayload.course || null,
      specialization: profilePayload.specialization || null,
      graduationYear: profilePayload.graduationYear ? Number(profilePayload.graduationYear) : null,
      cgpa: profilePayload.cgpa ? Number(profilePayload.cgpa) : null,
      phone: profilePayload.phone || null,
      dateOfBirth: profilePayload.dateOfBirth ? new Date(profilePayload.dateOfBirth) : null,
      skills: Array.isArray(profilePayload.skills) ? profilePayload.skills : [],
      linkedin: profilePayload.linkedin || null,
      github: profilePayload.github || null,
      portfolio: profilePayload.portfolio || null
    };

    const profile = await prisma.studentProfile.upsert({
      where: { userId: studentId },
      update: data,
      create: { userId: studentId, ...data }
    });

    const profileCompletion = calculateProfileCompletion(profile);
    const updated = await prisma.studentProfile.update({
      where: { id: profile.id },
      data: { profileCompletion }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully!',
      profileCompletion: updated.profileCompletion
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

exports.getResume = async (req, res) => {
  try {
    const profile = isDemo(req)
      ? null
      : await prisma.studentProfile.findUnique({ where: { userId: req.session.user.id } });

    res.render('pages/student/resume', {
      title: 'My Resume - Placement Portal',
      user: req.session.user,
      profile,
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

exports.uploadResume = async (req, res) => {
  try {
    if (isDemo(req)) {
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

    const studentId = req.session.user.id;

    const profile = await prisma.studentProfile.upsert({
      where: { userId: studentId },
      update: { resumePath: req.file.filename },
      create: {
        userId: studentId,
        resumePath: req.file.filename,
        skills: []
      }
    });

    const profileCompletion = calculateProfileCompletion({ ...profile, resumePath: req.file.filename });
    await prisma.studentProfile.update({
      where: { id: profile.id },
      data: { profileCompletion }
    });

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

exports.deleteApplication = async (req, res) => {
  try {
    if (isDemo(req)) {
      return res.json({
        success: false,
        message: 'Demo users cannot delete applications.'
      });
    }

    const studentId = req.session.user.id;
    const applicationId = parseId(req.body.applicationId);

    if (!applicationId) {
      return res.json({ success: false, message: 'Invalid application' });
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId }
    });

    if (!application || application.studentId !== studentId) {
      return res.json({
        success: false,
        message: 'Application not found'
      });
    }

    if (application.status !== 'APPLIED') {
      return res.json({
        success: false,
        message: 'Cannot delete application that is already under review'
      });
    }

    await prisma.application.delete({ where: { id: applicationId } });

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

exports.deleteResume = async (req, res) => {
  try {
    if (isDemo(req)) {
      return res.json({
        success: false,
        message: 'Demo users cannot delete resumes.'
      });
    }

    const studentId = req.session.user.id;
    const profile = await prisma.studentProfile.findUnique({ where: { userId: studentId } });

    if (!profile || !profile.resumePath) {
      return res.json({
        success: false,
        message: 'No resume found to delete'
      });
    }

    const resumePathOnDisk = path.join(__dirname, '../../public/uploads/resumes', profile.resumePath);
    if (fs.existsSync(resumePathOnDisk)) {
      fs.unlinkSync(resumePathOnDisk);
    }

    const profileCompletion = calculateProfileCompletion({ ...profile, resumePath: null });

    await prisma.studentProfile.update({
      where: { id: profile.id },
      data: {
        resumePath: null,
        profileCompletion
      }
    });

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
};