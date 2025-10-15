// server/models/Job.js
const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    company: {
        type: String,
        required: true
    },
    companyLogo: String,
    location: {
        type: String,
        required: true
    },
    jobType: {
        type: String,
        enum: ['internship', 'full-time', 'part-time', 'remote'],
        required: true
    },
    salary: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    requirements: [String],
    responsibilities: [String],
    skills: [String],
    experienceLevel: {
        type: String,
        enum: ['fresher', '0-2', '2-5', '5+']
    },
    applicationDeadline: Date,
    isActive: {
        type: Boolean,
        default: true
    },
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Job', jobSchema);