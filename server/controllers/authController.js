const bcrypt = require('bcryptjs');
const prisma = require('../prismaClient');

const mapRoleToEnum = (role) => {
  switch ((role || '').toLowerCase()) {
    case 'company':
      return 'COMPANY';
    case 'admin':
      return 'ADMIN';
    default:
      return 'STUDENT';
  }
};

const buildSessionUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role.toLowerCase(),
  isDemo: user.isDemo
});

const ensureStudentProfile = async (userId, tx) => {
  const client = tx || prisma;
  const existing = await client.studentProfile.findUnique({ where: { userId } });
  if (!existing) {
    await client.studentProfile.create({
      data: {
        userId,
        skills: [],
        profileCompletion: 0
      }
    });
  }
};

const ensureCompanyProfile = async (userId, name, industry = '', tx) => {
  const client = tx || prisma;
  const existing = await client.companyProfile.findUnique({ where: { userId } });
  if (!existing) {
    await client.companyProfile.create({
      data: {
        userId,
        companyName: name || 'Demo Company',
        industry: industry || ''
      }
    });
  }
};

const handleLoginSuccess = (req, res, user, redirectPath) => {
  req.session.user = buildSessionUser(user);
  res.json({
    success: true,
    message: 'Login successful!',
    redirectTo: redirectPath
  });
};

const getHashedPassword = async (password) => bcrypt.hash(password, 12);

const verifyPassword = async (password, hash) => {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
};

// Student Login
const studentLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.role !== 'STUDENT') {
      return res.status(400).json({
        success: false,
        message: 'No student account found with this email. Please sign up first.'
      });
    }

    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid && !user.isDemo) {
      return res.status(400).json({
        success: false,
        message: 'Invalid password'
      });
    }

    await ensureStudentProfile(user.id);

    handleLoginSuccess(req, res, user, '/student/dashboard');
  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// Company Login
const companyLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.role !== 'COMPANY') {
      return res.status(400).json({
        success: false,
        message: 'No company account found with this email. Please sign up first.'
      });
    }

    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid && !user.isDemo) {
      return res.status(400).json({
        success: false,
        message: 'Invalid password'
      });
    }

    await ensureCompanyProfile(user.id, user.name);

    handleLoginSuccess(req, res, user, '/company/dashboard');
  } catch (error) {
    console.error('Company login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// Student Signup
const studentSignup = async (req, res) => {
  try {
    const { name, email, password, college, course } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    const hashedPassword = await getHashedPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'STUDENT',
        studentProfile: {
          create: {
            college: college || '',
            course: course || '',
            skills: [],
            profileCompletion: 0
          }
        }
      }
    });

    handleLoginSuccess(req, res, user, '/student/dashboard');
  } catch (error) {
    console.error('Student signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during signup'
    });
  }
};

// Company Signup
const companySignup = async (req, res) => {
  try {
    const { name, email, password, companyName, industry } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    const hashedPassword = await getHashedPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'COMPANY',
        companyProfile: {
          create: {
            companyName: companyName || '',
            industry: industry || ''
          }
        }
      }
    });

    handleLoginSuccess(req, res, user, '/company/dashboard');
  } catch (error) {
    console.error('Company signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during company signup'
    });
  }
};

// Demo Login (student/company)
const demoLogin = async (req, res) => {
  try {
    const { email, role } = req.body;
    const roleEnum = mapRoleToEnum(role);
    const defaultName = roleEnum === 'COMPANY' ? 'Demo Company' : 'Demo Student';

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const hashedPassword = await getHashedPassword('demopassword123');
      user = await prisma.user.create({
        data: {
          name: defaultName,
          email,
          password: hashedPassword,
          role: roleEnum,
          isDemo: true,
          studentProfile: roleEnum === 'STUDENT'
            ? { create: { college: 'Demo University', course: 'Computer Science', skills: ['JavaScript', 'React', 'Node.js'] } }
            : undefined,
          companyProfile: roleEnum === 'COMPANY'
            ? { create: { companyName: 'Demo Tech Inc.', industry: 'Technology', contactPerson: 'Demo Company' } }
            : undefined
        }
      });
    } else {
      if (!user.isDemo || user.role !== roleEnum) {
        user = await prisma.user.update({
          where: { email },
          data: {
            role: roleEnum,
            isDemo: true
          }
        });
      }

      if (roleEnum === 'STUDENT') {
        await ensureStudentProfile(user.id);
      } else if (roleEnum === 'COMPANY') {
        await ensureCompanyProfile(user.id, user.name);
      }
    }

    handleLoginSuccess(req, res, user, `/${roleEnum.toLowerCase()}/dashboard`);
  } catch (error) {
    console.error('Demo login error:', error);
    res.status(500).json({
      success: false,
      message: 'Demo login failed'
    });
  }
};

const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
    res.clearCookie('connect.sid');
    res.json({
      success: true,
      message: 'Logout successful'
    });
  });
};

module.exports = {
  studentLogin,
  companyLogin,
  studentSignup,
  companySignup,
  demoLogin,
  logout
};