const bcrypt = require('bcryptjs');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const CompanyProfile = require('../models/CompanyProfile');

const buildSessionUser = (user) => ({
  id: user._id,
  email: user.email,
  name: user.name,
  role: user.role.toLowerCase(),
  isDemo: user.isDemo || false,
});

const ensureStudentProfile = async (userId) => {
  let profile = await StudentProfile.findOne({ user: userId });
  if (!profile) {
    profile = await StudentProfile.create({
      user: userId,
      skills: [],
      profileCompletion: 0,
    });
  }
  return profile;
};

const ensureCompanyProfile = async (userId, name, industry = '') => {
  let profile = await CompanyProfile.findOne({ user: userId });
  if (!profile) {
    profile = await CompanyProfile.create({
      user: userId,
      companyName: name || 'Demo Company',
      industry: industry || '',
    });
  }
  return profile;
};

const handleLoginSuccess = (req, res, user, redirectPath) => {
  req.session.user = buildSessionUser(user);
  res.json({
    success: true,
    message: 'Login successful!',
    redirectTo: redirectPath,
  });
};

const getHashedPassword = async (password) => bcrypt.hash(password, 12);

// Student Login
const studentLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user || user.role !== 'student') {
      return res.status(400).json({
        success: false,
        message: 'No student account found with this email. Please sign up first.',
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid password',
      });
    }

    await ensureStudentProfile(user._id);

    handleLoginSuccess(req, res, user, '/student/dashboard');
  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
};

// Company Login
const companyLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user || user.role !== 'company') {
      return res.status(400).json({
        success: false,
        message: 'No company account found with this email. Please sign up first.',
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid password',
      });
    }

    await ensureCompanyProfile(user._id, user.name);

    handleLoginSuccess(req, res, user, '/company/dashboard');
  } catch (error) {
    console.error('Company login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
};

// Student Signup
const studentSignup = async (req, res) => {
  try {
    const { name, email, password, college, course } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
      });
    }

    const user = new User({
      name,
      email,
      password,
      role: 'student',
      studentProfile: {
        college: college || '',
        course: course || '',
      },
    });
    await user.save();

    await ensureStudentProfile(user._id);

    handleLoginSuccess(req, res, user, '/student/dashboard');
  } catch (error) {
    console.error('Student signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during signup',
    });
  }
};

// Company Signup
const companySignup = async (req, res) => {
  try {
    const { name, email, password, companyName, industry } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
      });
    }

    const user = new User({
      name,
      email,
      password,
      role: 'company',
      companyProfile: {
        companyName: companyName || '',
        industry: industry || '',
      },
    });
    await user.save();

    await ensureCompanyProfile(user._id, user.name, industry);

    handleLoginSuccess(req, res, user, '/company/dashboard');
  } catch (error) {
    console.error('Company signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during company signup',
    });
  }
};

// Demo Login (student/company)
const demoLogin = async (req, res) => {
  try {
    const { email, role } = req.body;
    const defaultName = role === 'company' ? 'Demo Company' : 'Demo Student';

    let user = await User.findOne({ email });

    if (!user) {
      const hashedPassword = await getHashedPassword('demopassword123');
      user = new User({
        name: defaultName,
        email,
        password: hashedPassword,
        role: role,
        isDemo: true,
      });
      await user.save();
    } else {
      user.isDemo = true;
      user.role = role;
      await user.save();
    }

    if (role === 'student') {
      await ensureStudentProfile(user._id);
    } else if (role === 'company') {
      await ensureCompanyProfile(user._id, user.name);
    }

    handleLoginSuccess(req, res, user, `/${role}/dashboard`);
  } catch (error) {
    console.error('Demo login error:', error);
    res.status(500).json({
      success: false,
      message: 'Demo login failed',
    });
  }
};

const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Logout failed',
      });
    }
    res.clearCookie('connect.sid');
    res.json({
      success: true,
      message: 'Logout successful',
    });
  });
};

module.exports = {
  studentLogin,
  companyLogin,
  studentSignup,
  companySignup,
  demoLogin,
  logout,
};