const express = require('express');
const router = express.Router();

// Admin dashboard
router.get('/dashboard', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/auth/login?role=admin');
    }
    
    res.render('pages/admin/dashboard', {
        title: 'Admin Dashboard - Placement Portal',
        user: req.session.user
    });
});

module.exports = router;