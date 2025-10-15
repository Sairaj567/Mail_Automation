const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

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

// Handle login based on role
router.post('/login', (req, res) => {
    const { role } = req.body;
    
    if (role === 'company') {
        authController.companyLogin(req, res);
    } else {
        authController.studentLogin(req, res);
    }
});

// Handle signup based on role
router.post('/signup', (req, res) => {
    const { role } = req.body;
    
    if (role === 'company') {
        authController.companySignup(req, res);
    } else {
        authController.studentSignup(req, res);
    }
});

// Handle demo login
router.post('/demo-login', authController.demoLogin);

// Logout
router.post('/logout', authController.logout);
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

module.exports = router;