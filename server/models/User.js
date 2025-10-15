const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    role: {
        type: String,
        enum: ['student', 'company', 'admin'],
        required: true
    },
    // Student-specific fields
    studentProfile: {
        college: String,
        course: String,
        semester: String,
        phone: String,
        resume: String,
        skills: [String]
    },
    // Company-specific fields
    companyProfile: {
        companyName: String,
        industry: String,
        website: String,
        description: String,
        logo: String,
        contactPerson: String,
        phone: String
    },
    // Admin-specific fields
    adminProfile: {
        department: String,
        phone: String
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);