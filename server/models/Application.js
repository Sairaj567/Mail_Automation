const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    job: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: true
    },
    
    // Enhanced application details
    personalInfo: {
        fullName: String,
        email: String,
        phone: String,
        linkedin: String
    },
    
    education: {
        college: String,
        degree: String,
        status: {
            type: String,
            enum: ['pursuing', 'completed']
        },
        graduationYear: Number,
        cgpa: Number,
        marksType: String
    },
    
    skills: [String],
    projects: String,
    extracurricular: String,
    
    // Documents
    resume: {
        type: String,
        required: true
    },
    coverLetterFile: String,
    coverLetterText: String,
    
    // Application status and tracking
    status: {
        type: String,
        enum: ['applied', 'under_review', 'shortlisted', 'interview', 'rejected', 'accepted'],
        default: 'applied'
    },
    
    appliedDate: {
        type: Date,
        default: Date.now
    },
    
    // Interview scheduling
    interviewSchedule: {
        scheduledDate: Date,
        interviewType: {
            type: String,
            enum: ['phone', 'video', 'in_person']
        },
        interviewLink: String,
        location: String,
        notes: String
    },
    
    // Communication tracking
    communications: [{
        type: {
            type: String,
            enum: ['email', 'message', 'interview_invite', 'status_update']
        },
        content: String,
        sentBy: {
            type: String,
            enum: ['student', 'company']
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    
    // Chat messages (when accepted)
    chatMessages: [{
        sender: {
            type: String,
            enum: ['student', 'company']
        },
        message: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        read: {
            type: Boolean,
            default: false
        }
    }]
});

module.exports = mongoose.model('Application', applicationSchema);