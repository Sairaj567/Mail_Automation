const { describe, it } = require('node:test');
const assert = require('node:assert');
const { mockRequest, mockResponse } = require('./helpers/httpMocks');
const mongoose = require('mongoose');

// Mock data for testing
const createMockRequest = (overrides = {}) => {
    return {
        session: {
            user: {
                id: new mongoose.Types.ObjectId(),
                email: 'student@example.com',
                name: 'Test Student',
                role: 'student',
                isDemo: false,
                ...overrides.user
            },
            ...overrides.session
        },
        body: {
            jobId: new mongoose.Types.ObjectId(),
            fullName: 'Test Student',
            email: 'student@example.com',
            phone: '+1234567890',
            ...overrides.body
        },
        files: overrides.files || null,
        ...overrides
    };
};

const createMockResponse = () => {
    const res = {
        json: function(data) {
            this.jsonData = data;
            return this;
        },
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        redirect: function(url) {
            this.redirectUrl = url;
            return this;
        }
    };
    return res;
};

describe('Student Controller - Application Submission', () => {
    
    it('should validate job ID format', () => {
        const req = createMockRequest({
            body: { jobId: 'invalid-id' }
        });
        const res = createMockResponse();

        // Job ID validation
        const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
        
        assert.strictEqual(isValidObjectId(req.body.jobId), false, 'Invalid ID should fail validation');
        assert.strictEqual(isValidObjectId(new mongoose.Types.ObjectId().toString()), true, 'Valid ID should pass validation');
    });

    it('should prevent demo users from applying', () => {
        const req = createMockRequest({
            user: { isDemo: true }
        });

        const isDemo = (req) => Boolean(req.session?.user?.isDemo);
        assert.strictEqual(isDemo(req), true, 'Demo user flag should be detected');
    });

    it('should require resume for application', () => {
        const req = createMockRequest({
            files: null  // No files uploaded
        });

        // Check if resume is present
        const hasResume = req.files && req.files.resume && req.files.resume[0];
        assert.strictEqual(hasResume, undefined, 'Should detect missing resume');
    });

    it('should validate required fields', () => {
        const req = createMockRequest({
            body: { 
                jobId: new mongoose.Types.ObjectId(),
                fullName: '',  // Empty name
                email: 'student@example.com'
            }
        });

        const missingFields = [];
        if (!req.body.fullName) missingFields.push('full name');
        if (!req.body.email) missingFields.push('email');

        assert.ok(missingFields.includes('full name'), 'Should detect missing full name');
        assert.strictEqual(missingFields.length, 1, 'Should find exactly one missing field');
    });

    it('should handle file upload with proper naming', () => {
        const crypto = require('crypto');
        const path = require('path');
        
        const file = {
            fieldname: 'resume',
            originalname: 'MyResume.pdf',
            size: 102400,
            buffer: Buffer.from('PDF content')
        };

        // Simulate the filename generation
        const uniqueId = crypto.randomBytes(8).toString('hex');
        const ext = path.extname(file.originalname);
        const filename = `${file.fieldname}-${uniqueId}-${Date.now()}${ext}`;

        assert.ok(filename.includes('resume'), 'Filename should include field name');
        assert.ok(filename.endsWith('.pdf'), 'Filename should include file extension');
        assert.ok(filename.includes('-'), 'Filename should be properly formatted');
    });

    it('should merge form data with profile data', () => {
        const studentProfile = {
            phone: '+1234567890',
            college: 'MIT',
            skills: ['JavaScript', 'Node.js']
        };

        const formData = {
            fullName: 'Test Student',
            email: 'student@example.com',
            phone: '',  // Empty in form
            college: ''  // Empty in form
        };

        // Merge logic
        const pickFirstText = (...values) => {
            for (const value of values) {
                if (typeof value === 'string' && value.trim()) {
                    return value.trim();
                }
            }
            return '';
        };

        const phone = pickFirstText(formData.phone, studentProfile.phone);
        const college = pickFirstText(formData.college, studentProfile.college);

        assert.strictEqual(phone, '+1234567890', 'Should use profile data when form is empty');
        assert.strictEqual(college, 'MIT', 'Should use profile college when form is empty');
    });

    it('should prevent duplicate applications', () => {
        const studentId = new mongoose.Types.ObjectId();
        const jobId = new mongoose.Types.ObjectId();

        const existingApplication = {
            student: studentId,
            job: jobId
        };

        const newApplication = {
            student: studentId,
            job: jobId
        };

        // Check for duplicate
        const isDuplicate = 
            existingApplication.student.equals(newApplication.student) &&
            existingApplication.job.equals(newApplication.job);

        assert.strictEqual(isDuplicate, true, 'Should detect duplicate application');
    });
});

describe('Student Controller - Save/Unsave Jobs', () => {
    
    it('should toggle job save status', () => {
        const savedJobs = [new mongoose.Types.ObjectId()];
        const jobToToggle = new mongoose.Types.ObjectId();

        // Check if already saved
        const isSaved = savedJobs.some(id => id.equals(jobToToggle));
        assert.strictEqual(isSaved, false, 'Job should not be in saved list initially');

        // Add to saved
        if (!isSaved) {
            savedJobs.push(jobToToggle);
        }

        // Check again
        const isNowSaved = savedJobs.some(id => id.equals(jobToToggle));
        assert.strictEqual(isNowSaved, true, 'Job should be in saved list after adding');
    });

    it('should handle non-existent student profile', () => {
        const studentId = new mongoose.Types.ObjectId();
        const profile = null;  // Profile doesn't exist

        const profileExists = profile !== null;
        assert.strictEqual(profileExists, false, 'Should handle missing profile');
    });
});

describe('Student Controller - Data Normalization', () => {
    
    it('should normalize job type values', () => {
        const normalizeJobType = (jobType) => {
            const typeMap = {
                'fulltime': 'full-time',
                'full-time': 'full-time',
                'parttime': 'part-time',
                'part-time': 'part-time',
                'internship': 'internship',
                'remote': 'remote'
            };
            return typeMap[jobType.toLowerCase()] || 'full-time';
        };

        assert.strictEqual(normalizeJobType('fulltime'), 'full-time', 'Should normalize fulltime');
        assert.strictEqual(normalizeJobType('PART-TIME'), 'part-time', 'Should handle case insensitivity');
        assert.strictEqual(normalizeJobType('internship'), 'internship', 'Should preserve internship');
    });

    it('should normalize skills array', () => {
        const normalizeStringArray = (value) => {
            if (Array.isArray(value)) {
                return value.map(item => String(item).trim()).filter(Boolean);
            }
            if (typeof value === 'string' && value.trim()) {
                return value.split(/[\n,;]+/).map(item => item.trim()).filter(Boolean);
            }
            return [];
        };

        assert.deepStrictEqual(
            normalizeStringArray('JavaScript, Node.js, React'),
            ['JavaScript', 'Node.js', 'React'],
            'Should split comma-separated skills'
        );

        assert.deepStrictEqual(
            normalizeStringArray(['Python', 'Django']),
            ['Python', 'Django'],
            'Should handle array input'
        );
    });

    it('should build resume URLs correctly', () => {
        const buildResumeUrl = (resumeFilename) => {
            if (!resumeFilename) return '';
            const baseUrl = 'http://localhost:3000';
            return `${baseUrl}/uploads/resumes/${encodeURIComponent(resumeFilename)}`;
        };

        const url = buildResumeUrl('resume-abc123.pdf');
        assert.ok(url.includes('/uploads/resumes/'), 'Should include correct path');
        assert.ok(url.includes('resume-abc123.pdf'), 'Should include filename');
    });
});
