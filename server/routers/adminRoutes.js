const express = require('express');
const router = express.Router();

const { requireAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// Admin dashboard
router.get('/dashboard', requireAdmin, adminController.getDashboard);

// Review pending jobs
router.get('/jobs/review', requireAdmin, adminController.getJobsForReview);

// Activate a job posting
router.post('/jobs/:id/activate', requireAdmin, adminController.activateJob);

// Optional delete endpoints (supports both DELETE requests and POST fallbacks)
router.delete('/jobs/:id', requireAdmin, adminController.deleteJob);
router.post('/jobs/:id/delete', requireAdmin, adminController.deleteJob);

// Placeholder routes for other admin pages
router.get('/students', requireAdmin, adminController.getStudentsPage);
router.get('/companies', requireAdmin, adminController.getCompaniesPage);
router.get('/reports', requireAdmin, adminController.getReportsPage);

module.exports = router;