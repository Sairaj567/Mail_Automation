const mongoose = require('mongoose');

const companyProfileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    companyName: {
        type: String,
        required: true
    },
    industry: String,
    website: String,
    description: String,
    logo: String,
    contactPerson: String,
    phone: String,
    address: {
        street: String,
        city: String,
        state: String,
        country: String,
        zipCode: String
    },
    size: {
        type: String,
        enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']
    },
    founded: Number,
    socialLinks: {
        linkedin: String,
        twitter: String,
        facebook: String
    },
    jobsPosted: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('CompanyProfile', companyProfileSchema);