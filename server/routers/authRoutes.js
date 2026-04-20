const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');

// Rate limiting for authentication endpoints (prevent brute force attacks)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per IP per window
    message: 'Too many authentication attempts. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for GET requests (non-authentication)
        return req.method === 'GET';
    }
});

// Role selection page
router.get('/', (req, res) => {
    res.render('pages/auth/role-select', {
        title: 'Join Placement Portal - Select Role'
    });
});

// Login page with role
router.get('/login', (req, res) => {
    const role = req.query.role || 'student';
    res.render('pages/auth/login', {
        title: `${role.charAt(0).toUpperCase() + role.slice(1)} Login - Placement Portal`,
        role: role
    });
});

// Signup page with role
router.get('/signup', (req, res) => {
    const role = req.query.role || 'student';
    res.render('pages/auth/signup', {
        title: `${role.charAt(0).toUpperCase() + role.slice(1)} Sign Up - Placement Portal`,
        role: role
    });
});

// Handle login based on role (with rate limiting)
router.post('/login', authLimiter, (req, res) => {
    const { role } = req.body;
    
    if (role === 'company') {
        authController.companyLogin(req, res);
    } else if (role === 'admin') {
        authController.adminLogin(req, res);
    } else {
        authController.studentLogin(req, res);
    }
});

// Handle signup based on role (with rate limiting)
router.post('/signup', authLimiter, (req, res) => {
    const { role } = req.body;
    
    if (role === 'company') {
        authController.companySignup(req, res);
    } else if (role === 'admin') {
        return res.status(400).json({
            success: false,
            message: 'Admin accounts are provisioned by the placement office. Please contact support.',
        });
    } else {
        authController.studentSignup(req, res);
    }
});

// Handle demo login (with rate limiting)
router.post('/demo-login', authLimiter, authController.demoLogin);

// Logout
router.post('/logout', authController.logout);
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

module.exports = router;