const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    college: String,
    course: String,
    specialization: String,
    graduationYear: Number,
    cgpa: Number,
    phone: String,
    dateOfBirth: Date,
    skills: [String],
    socialLinks: {
        linkedin: String,
        github: String,
        portfolio: String
    },
    profileImage: String,
    resume: String,
    profileCompletion: {
        type: Number,
        default: 0
    },
    savedJobs: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job'
    }]
});

studentProfileSchema.virtual('applicationCount').get(function() {
    return this.$locals?.applicationCount ?? 0;
});

// Indexes for performance optimization
studentProfileSchema.index({ user: 1 });

module.exports = mongoose.model('StudentProfile', studentProfileSchema);