const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const CompanyProfile = require('../models/CompanyProfile');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Student Login Controller - FIXED
const studentLogin = async (req, res) => {
    try {
        const { email, password, role } = req.body;
        
        // Find existing user
        let user = await User.findOne({ email, role: 'student' });
        
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'No student account found with this email. Please sign up first.'
            });
        }

        // In a real app, you would verify the password here
        // const isPasswordValid = await bcrypt.compare(password, user.password);
        // if (!isPasswordValid) {
        //     return res.status(400).json({
        //         success: false,
        //         message: 'Invalid password'
        //     });
        // }
        
        // Set session
        req.session.user = {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role
        };
        
        res.json({ 
            success: true, 
            message: 'Login successful!',
            redirectTo: `/student/dashboard`
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during login' 
        });
    }
};

// Company Login Controller - NEW
const companyLogin = async (req, res) => {
    try {
        const { email, password, role } = req.body;
        
        // Find existing company user
        let user = await User.findOne({ email, role: 'company' });
        
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'No company account found with this email. Please sign up first.'
            });
        }

        // Set session
        req.session.user = {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role
        };
        
        res.json({ 
            success: true, 
            message: 'Login successful!',
            redirectTo: `/company/dashboard`
        });
        
    } catch (error) {
        console.error('Company login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during login' 
        });
    }
};

// Student Signup Controller
const studentSignup = async (req, res) => {
    try {
        const { name, email, password, role, college, course } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: 'User already exists with this email' 
            });
        }
        
        // Create new user with hashed password
        const newUser = new User({
            name,
            email,
            password: await bcrypt.hash(password, 12),
            role: role || 'student'
        });
        
        await newUser.save();

        // Create student profile
        const studentProfile = new StudentProfile({
            user: newUser._id,
            college: college || '',
            course: course || '',
            skills: []
        });
        await studentProfile.save();
        
        // Set session
        req.session.user = {
            id: newUser._id.toString(),
            email: newUser.email,
            name: newUser.name,
            role: newUser.role
        };
        
        res.json({ 
            success: true, 
            message: 'Account created successfully!',
            redirectTo: `/student/dashboard`
        });
        
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during signup' 
        });
    }
};

// Company Signup Controller - NEW
const companySignup = async (req, res) => {
    try {
        const { name, email, password, role, companyName, industry } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: 'User already exists with this email' 
            });
        }
        
        // Create new company user
        const newUser = new User({
            name,
            email,
            password: await bcrypt.hash(password, 12),
            role: role || 'company'
        });
        
        await newUser.save();

        // Create company profile
        const companyProfile = new CompanyProfile({
            user: newUser._id,
            companyName: companyName || '',
            industry: industry || '',
            contactPerson: name
        });
        await companyProfile.save();
        
        // Set session
        req.session.user = {
            id: newUser._id.toString(),
            email: newUser.email,
            name: newUser.name,
            role: newUser.role
        };
        
        res.json({ 
            success: true, 
            message: 'Company account created successfully!',
            redirectTo: `/company/dashboard`
        });
        
    } catch (error) {
        console.error('Company signup error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during company signup' 
        });
    }
};

// Universal Login for Demo - FIXED
const demoLogin = async (req, res) => {
    try {
        const { email, role } = req.body;
        
        // Find or create user based on role
        let user = await User.findOne({ email, role });
        
        if (!user) {
            // Create a demo user
            user = new User({
                name: role === 'student' ? 'Demo Student' : 'Demo Company',
                email: email,
                password: await bcrypt.hash('demopassword123', 12),
                role: role
            });
            await user.save();

            // Create appropriate profile
            if (role === 'student') {
                const studentProfile = new StudentProfile({
                    user: user._id,
                    college: 'Demo University',
                    course: 'Computer Science',
                    skills: ['JavaScript', 'React', 'Node.js']
                });
                await studentProfile.save();
            } else if (role === 'company') {
                const companyProfile = new CompanyProfile({
                    user: user._id,
                    companyName: 'Demo Tech Inc.',
                    industry: 'Technology',
                    contactPerson: 'Demo Company'
                });
                await companyProfile.save();
            }
        }
        
        // Set session
        req.session.user = {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role
        };
        
        res.json({ 
            success: true, 
            message: 'Demo login successful!',
            redirectTo: `/${role}/dashboard`
        });
        
    } catch (error) {
        console.error('Demo login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Demo login failed' 
        });
    }
};

module.exports = {
    studentLogin,
    companyLogin,
    studentSignup,
    companySignup,
    demoLogin,
    logout: (req, res) => {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ 
                    success: false, 
                    message: 'Logout failed' 
                });
            }
            res.json({ 
                success: true, 
                message: 'Logout successful' 
            });
        });
    }
};