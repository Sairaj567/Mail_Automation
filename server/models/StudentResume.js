const mongoose = require('mongoose');

const studentResumeSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    filename: {
        type: String,
        required: true,
        trim: true,
    },
    skills: {
        type: [String],
        default: [],
    },
    isPrimary: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });

studentResumeSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('StudentResume', studentResumeSchema);
