const fs = require('fs');
const path = require('path');
// Remove Prisma client import
// const prisma = require('../prismaClient');
const mongoose = require('mongoose'); // Make sure mongoose is required if not already global

// Import Mongoose models
const Job = require('../models/Job');
const Application = require('../models/Application');
const StudentProfile = require('../models/StudentProfile');
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


const isDemo = (req) => Boolean(req.session?.user?.isDemo);

// Helper function to check for valid ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

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
    formatted._id = formatted._id.toString(); // Ensure _id is a string
    // You might need additional transformations depending on your model vs. view needs
    formatted.company = formatted.company || 'Unknown Company'; // Assuming 'company' is a string field in Job model
    formatted.requirements = formatted.requirements || [];
    formatted.responsibilities = formatted.responsibilities || [];
    formatted.skills = formatted.skills || [];
    formatted.jobType = formatted.jobType || 'full-time'; // Default if missing
    formatted.experienceLevel = formatted.experienceLevel || 'fresher'; // Default if missing
    formatted.salary = formatted.salary || 'Not specified'; // Default if missing

    return formatted;
};

const formatApplication = (application) => {
    if (!application) return null;
    const formatted = application.toObject ? application.toObject() : { ...application };
    formatted._id = formatted._id.toString();
    formatted.status = formatted.status || 'applied';
    formatted.appliedDate = formatted.appliedDate || new Date();
    // Ensure nested job is also formatted
    if (formatted.job && typeof formatted.job === 'object') {
        formatted.job = formatJob(formatted.job);
    } else {
         // Handle case where job might just be an ID or missing
         formatted.job = { _id: formatted.job?.toString(), title: 'Unknown Job', company: 'Unknown Company', location: 'Unknown' };
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
      pendingApplications: 5,
      interviews: 2
    },
    recentApplications: demoApplications.map(formatApplication), // Ensure formatting
    // Simulate profile completion for demo
    profile: { profileCompletion: calculateProfileCompletion({ college: 'Demo Uni', course: 'CS', skills: ['JS'], resume: 'demo.pdf' }) },
    isDemo: true
  });
};
// --- End of renderDemoDashboard ---

exports.getDashboard = async (req, res) => {
  try {
    if (isDemo(req)) {
      // The demo function no longer uses Prisma
      return renderDemoDashboard(req, res);
    }

    const studentId = req.session.user.id;

    // Use Mongoose methods
    const [totalJobs, applicationsCount, pendingApplicationsCount, interviewsCount, recentApps, profile] = await Promise.all([
      Job.countDocuments({ isActive: true }),
      Application.countDocuments({ student: studentId }),
      Application.countDocuments({ student: studentId, status: { $in: ['applied', 'under_review', 'shortlisted'] } }),
      Application.countDocuments({ student: studentId, status: 'interview' }),
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


    res.render('pages/student/dashboard', {
      title: 'Student Dashboard - Placement Portal',
      user: req.session.user,
      stats: {
        totalJobs,
        applications: applicationsCount,
        pendingApplications: pendingApplicationsCount,
        interviews: interviewsCount
      },
      recentApplications: recentApps.map(formatApplication), // Use formatter
      profile: studentProfile, // Pass the fetched or created profile
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

    const filter = { isActive: true };

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }, // Assuming company is stored as string
         { skills: { $regex: search, $options: 'i' } } // Search skills array
      ];
    }

    if (jobType) {
      filter.jobType = jobType; // Assuming jobType values match query values directly
    }

    if (experience) {
      filter.experienceLevel = experience; // Assuming experienceLevel values match
    }

    // Use Mongoose find with the filter object
    const jobs = await Job.find(filter).sort({ createdAt: -1 });

    res.render('pages/student/jobs', {
      title: 'Job Listings - Placement Portal',
      user: req.session.user,
      jobs: jobs.map(formatJob), // Use formatter
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

    if (!jobRecord || !jobRecord.isActive) { // Check if job exists and is active
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
        isSaved: false,
        isDemo: true
      });
    }

    // For real users, check application and saved status
    const studentId = req.session.user.id;
    const profile = await ensureStudentProfile(studentId); // Ensure profile exists

    // Use Mongoose findOne for application and saved status
    const application = await Application.findOne({
      job: jobId,
      student: studentId
    });

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
    if (isDemo(req)) {
      return res.json({
        success: false,
        message: 'Please create a real account to apply for jobs.'
      });
    }

    const studentId = req.session.user.id;
    const jobId = req.body.jobId;

    if (!isValidObjectId(jobId)) {
        return res.json({ success: false, message: 'Invalid job selected' });
    }

     // Check if student profile exists and has a resume
    const studentProfile = await StudentProfile.findOne({ user: studentId });
    // Use the resume filename from the uploaded file if available, otherwise fallback to profile
    let resumeFilename = studentProfile?.resume || ''; // Default to profile resume
    let coverLetterFilename = '';

    // Check uploaded files
     if (req.files) {
         if (req.files.resume && req.files.resume[0]) {
             resumeFilename = req.files.resume[0].filename;
             // Optionally update the profile with the new resume
             if (studentProfile) {
                 studentProfile.resume = resumeFilename;
                 await studentProfile.save();
             }
         } else if (!resumeFilename) {
             // If no resume was uploaded AND profile has no resume, return error
             return res.json({
                 success: false,
                 message: 'Please upload your resume before applying or ensure it exists in your profile.'
             });
         }
         if (req.files.coverLetterFile && req.files.coverLetterFile[0]) {
             coverLetterFilename = req.files.coverLetterFile[0].filename;
         }
     } else if (!resumeFilename) {
          // If req.files is undefined AND profile has no resume, return error
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
      return res.json({
        success: false,
        message: 'You have already applied for this job'
      });
    }

    // Extract other form data
     const {
      fullName, email, phone, linkedin,
      college, degree, educationStatus, graduationYear, cgpa, marksType,
      skills, projects, extracurricular,
      coverLetterText
    } = req.body;

     const skillsArray = skills ? skills.split(',').map(skill => skill.trim()).filter(Boolean) : [];

    // Create a new Application using the Mongoose model
    const application = new Application({
      student: studentId,
      job: jobId,
      // Store personal/education details directly in the application
      personalInfo: { fullName, email, phone, linkedin },
      education: { college, degree, status: educationStatus, graduationYear: Number(graduationYear), cgpa: Number(cgpa), marksType },
      skills: skillsArray,
      projects,
      extracurricular,
      resume: resumeFilename, // Filename from upload or profile
      coverLetterFile: coverLetterFilename || null, // Optional filename
      coverLetterText: coverLetterText || null, // Optional text
      appliedDate: new Date(),
      status: 'applied' // Default status
      // communications array is not needed here, handled by model default/hooks if any
      // chatMessages array is not needed here
    });

    await application.save();

    res.json({
      success: true,
      message: 'Application submitted successfully!',
      applicationId: application._id // Use _id for Mongoose
    });
  } catch (error) {
    console.error('Apply job error:', error);
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
            appliedDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
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

    // Provide demo data if needed
      const profileData = profile || (isDemo(req) ? {
            resume: 'demo_resume.pdf',
            applicationCount: 5 // Static count for demo
        } : {});

       // Get application count for real users
        const applicationCount = profile ? await Application.countDocuments({ student: studentId }) : (profileData.applicationCount || 0);


    res.render('pages/student/resume', {
      title: 'My Resume - Placement Portal',
      user: req.session.user,
       profile: profileData, // Pass profile data
       applicationCount: applicationCount, // Pass application count
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

    // Use Mongoose findOneAndUpdate with upsert
    const options = { new: true, upsert: true, setDefaultsOnInsert: true };
    let updatedProfile = await StudentProfile.findOneAndUpdate(
        { user: studentId },
        { $set: { resume: req.file.filename } },
        options
    );

    // Recalculate and save profile completion
    updatedProfile.profileCompletion = calculateProfileCompletion(updatedProfile);
    await updatedProfile.save();


    res.json({
      success: true,
      message: 'Resume uploaded successfully!',
      filename: req.file.filename
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
     // Use Mongoose findOneAndUpdate to remove the resume field
     const updatedProfile = await StudentProfile.findOneAndUpdate(
         { user: studentId },
         { $unset: { resume: "" } }, // Use $unset to remove the field
         { new: true } // Return the updated document
     );

    if (!updatedProfile) {
        // This case means the profile didn't exist, which shouldn't happen if ensureProfile works
         return res.json({ success: false, message: 'Profile not found.' });
    }

     // Check if a resume path existed before deletion to attempt file cleanup
     // Note: `updatedProfile` here will *not* have the resume field. We need the old value if we want to delete the file.
     // A better approach might be to find first, then update/delete.
     // Let's find first for cleaner file deletion:
     const profile = await StudentProfile.findOne({ user: studentId });
     if (!profile || !profile.resume) {
         return res.json({ success: false, message: 'No resume found to delete' });
     }
     const resumePathToDelete = profile.resume;

    // Proceed with update to remove resume path from DB
     profile.resume = undefined; // Or null, depending on schema design
      // Recalculate completion score *before* saving the final update
     profile.profileCompletion = calculateProfileCompletion(profile);
     await profile.save();


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