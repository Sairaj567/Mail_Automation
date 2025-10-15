const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../public')));
app.use('/css', express.static(path.join(__dirname, '../client/css')));
app.use('/js', express.static(path.join(__dirname, '../client/js')));
app.use('/images', express.static(path.join(__dirname, '../client/images')));
app.use('/uploads', express.static(path.join(__dirname, '../client/uploads')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'placement-portal-secret-key-2023',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Helper function for role icons
app.locals.getRoleIcon = function(role) {
    const icons = {
        student: 'fas fa-user-graduate',
        company: 'fas fa-building',
        admin: 'fas fa-user-shield'
    };
    return icons[role] || 'fas fa-user';
};

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/placement_portal';
mongoose.connect(MONGODB_URI)
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.log('MongoDB connection error:', err));

// Import routes
const authRoutes = require('./routers/authRoutes');
const studentRoutes = require('./routers/studentRoutes');
const companyRoutes = require('./routers/companyRoutes');
const adminRoutes = require('./routers/adminRoutes');


// Use routes
app.use('/auth', authRoutes);
app.use('/student', studentRoutes);
app.use('/company', companyRoutes);
app.use('/admin', adminRoutes);


// Home route
app.get('/', (req, res) => {
    res.render('index', { 
        title: 'Placement Portal - Find Your Dream Job',
        user: req.session.user || null
    });
});

// Simple dashboard routes for testing
app.get('/student/dashboard', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') {
        return res.redirect('/auth/login?role=student');
    }
    res.render('pages/student/dashboard', {
        title: 'Student Dashboard',
        user: req.session.user
    });
});

app.get('/company/dashboard', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'company') {
        return res.redirect('/auth/login?role=company');
    }
    res.render('pages/company/dashboard', {
        title: 'Company Dashboard',
        user: req.session.user
    });
});

app.get('/admin/dashboard', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/auth/login?role=admin');
    }
    res.render('pages/admin/dashboard', {
        title: 'Admin Dashboard',
        user: req.session.user
    });
});

// Error handling middleware
// app.use((err, req, res, next) => {
//     console.error('Error:', err.stack);
//     res.status(500).render('error', { 
//         title: 'Server Error',
//         message: 'Something went wrong! Please try again later.'
//     });
// });

// IMPROVED ERROR HANDLING MIDDLEWARE
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    
    // Check if it's an API route (starts with /company, /student, etc.)
    if (req.path.startsWith('/company/') || req.path.startsWith('/student/') || req.path.startsWith('/auth/')) {
        // Return JSON for API routes
        return res.status(500).json({
            success: false,
            message: 'Server error: ' + err.message
        });
    } else {
        // Return HTML for page routes
        res.status(500).render('error', { 
            title: 'Server Error',
            message: 'Something went wrong! Please try again later.'
        });
    }
});

// API-specific error handler for multer file upload errors
app.use('/company/update-profile', (err, req, res, next) => {
    if (err) {
        console.error('File upload error:', err);
        return res.status(400).json({
            success: false,
            message: 'File upload error: ' + err.message
        });
    }
    next();
});

// 404 handler - FIXED: Use Express syntax
// app.use((req, res) => {
//     res.status(404).render('404', { 
//         title: 'Page Not Found'
//     });
// });

// 404 handler - FIXED: Use Express syntax
app.use((req, res) => {
    // Check if it's an API route
    if (req.path.startsWith('/api/') || req.path.startsWith('/company/') || req.path.startsWith('/student/')) {
        return res.status(404).json({
            success: false,
            message: 'API endpoint not found'
        });
    }
    
    res.status(404).render('404', { 
        title: 'Page Not Found'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    
});

