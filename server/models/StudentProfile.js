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

// Add application count virtual
studentProfileSchema.virtual('applicationCount').get(function() {
    return this.constructor.countDocuments({ user: this.user });
});

module.exports = mongoose.model('StudentProfile', studentProfileSchema);