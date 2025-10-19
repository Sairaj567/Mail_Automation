// server/server.js

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // To store sessions in MongoDB
const path = require('path');
const helmet = require('helmet'); // For security headers
const morgan = require('morgan'); // For request logging
const cookieParser = require('cookie-parser'); // If needed, though session handles cookies
require('dotenv').config(); // Load environment variables from .env file

const app = express();

// --- Middleware ---

// Basic Security Headers
app.use(helmet());

// Logging (use 'dev' for development, consider 'combined' for production)
app.use(morgan('dev'));

// Body Parsers
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// Cookie Parser (if needed separately from session)
app.use(cookieParser());

// Static Files Setup
// Serve files from 'public' directory at the root URL
app.use(express.static(path.join(__dirname, '../public')));
// Serve specific client-side assets from 'client' directory under specific paths
app.use('/css', express.static(path.join(__dirname, '../client/css')));
app.use('/js', express.static(path.join(__dirname, '../client/js')));
// If you have images in client/images:
// app.use('/images', express.static(path.join(__dirname, '../client/images')));
// Serve uploaded files (ensure this path is correct and secure)
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads'))); // Serve uploads from public/uploads

// Session Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/placement_portal'; // Define URI here for session store

app.use(session({
    secret: process.env.SESSION_SECRET || 'a-very-strong-secret-key-change-it', // CHANGE THIS to a strong secret from .env
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    store: MongoStore.create({ mongoUrl: MONGODB_URI }), // Store session in MongoDB
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (requires HTTPS)
        httpOnly: true, // Prevent client-side JS from accessing the cookie
        maxAge: 24 * 60 * 60 * 1000 // Cookie expiry: 1 day
    }
}));

// --- View Engine Setup ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Middleware to pass user session data to all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null; // Make user available in EJS templates
  next();
});

// Helper function for role icons (Example - keep if used in EJS)
app.locals.getRoleIcon = function(role) {
    const icons = {
        student: 'fas fa-user-graduate',
        company: 'fas fa-building',
        admin: 'fas fa-user-shield'
    };
    return icons[role] || 'fas fa-user';
};


// --- MongoDB Connection ---
// MONGODB_URI is already defined above for session store
mongoose.connect(MONGODB_URI)
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
    console.error('MongoDB connection error:', err);
    // Exit process if DB connection fails on startup
    process.exit(1);
});


// --- Import Routers ---
const authRoutes = require('./routers/authRoutes');
const studentRoutes = require('./routers/studentRoutes');
const companyRoutes = require('./routers/companyRoutes');
const adminRoutes = require('./routers/adminRoutes');
const n8nRoutes = require('./routers/n8nRoutes'); // Import the new n8n router
// const mailRoutes = require('./routers/mailRoutes'); // Import mail router if you created it separately


// --- Use Routers ---
app.use('/auth', authRoutes);
app.use('/student', studentRoutes);
app.use('/company', companyRoutes); // User-facing company routes
app.use('/admin', adminRoutes);
app.use('/api/n8n', n8nRoutes);   // Mount n8n webhook routes under /api/n8n
// app.use('/', mailRoutes); // Mount mail routes if created separately


// --- Core Routes ---

// Home route
app.get('/', (req, res) => {
    // Pass user data to the index template
    res.render('index', {
        title: 'Placement Portal - Find Your Dream Job',
        user: req.session.user || null // Ensure user is passed
    });
});

// Remove simple dashboard routes if they are fully handled by specific routers
// (e.g., '/student/dashboard' should be handled within studentRoutes)


// --- Error Handling Middleware ---

// Improved Error Handler (Must be defined AFTER all other app.use() and routes)
app.use((err, req, res, next) => {
    console.error('Error Timestamp:', new Date().toISOString());
    console.error('Request URL:', req.originalUrl);
    console.error('Error Stack:', err.stack); // Log the full error stack

    const statusCode = err.status || 500;
    const message = err.message || 'An unexpected error occurred. Please try again later.';

    // Check if the request likely expects JSON (e.g., API routes)
    const expectsJson = req.originalUrl.startsWith('/api/') ||
                        req.originalUrl.startsWith('/company/') || // Assuming company routes might have API parts
                        req.originalUrl.startsWith('/student/') || // Assuming student routes might have API parts
                        req.originalUrl.startsWith('/auth/');    // Assuming auth routes might have API parts

    if (expectsJson) {
        // Send JSON error response for API routes
        return res.status(statusCode).json({
            success: false,
            message: `Server error: ${message}`
        });
    } else {
        // Render HTML error page for non-API routes
        res.status(statusCode).render('error', { // Ensure you have an 'error.ejs' view
            title: `Error ${statusCode}`,
            message: message,
            user: req.session.user || null // Pass user data to error page if needed
        });
    }
});


// 404 Not Found Handler (Must be the LAST route handler)
app.use((req, res) => {
    const statusCode = 404;
    // Check if the request likely expects JSON
     const expectsJson = req.originalUrl.startsWith('/api/') ||
                        req.originalUrl.startsWith('/company/') ||
                        req.originalUrl.startsWith('/student/') ||
                        req.originalUrl.startsWith('/auth/');

    if (expectsJson) {
        return res.status(statusCode).json({
            success: false,
            message: 'API endpoint not found'
        });
    }

    res.status(statusCode).render('404', { // Ensure you have a '404.ejs' view
        title: 'Page Not Found',
        user: req.session.user || null // Pass user data if needed
    });
});
// --- End Error Handling ---


// --- Start Server ---
const PORT = process.env.PORT || 3000;
// Listen on 0.0.0.0 to be accessible from outside the host (e.g., from n8n Docker container)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`   (Accessible externally, e.g., via http://<your_host_ip>:${PORT})`);
});