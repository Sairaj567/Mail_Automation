const express = require('express');
const router = express.Router();

const { requireAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// Admin dashboard
router.get('/dashboard', requireAdmin, adminController.getDashboard);

// Review pending jobs
router.get('/jobs/review', requireAdmin, adminController.getJobsForReview);
router.get('/jobs/data', requireAdmin, adminController.getJobsFromMongo);
router.get('/jobs/:id', requireAdmin, adminController.getJobDetailsPage);
router.get('/jobs/:id/edit', requireAdmin, adminController.getEditJobPage);
router.post('/jobs/:id/update', requireAdmin, adminController.updateJob);

// Activate a job posting
router.post('/jobs/:id/activate', requireAdmin, adminController.activateJob);

// Optional delete endpoints (supports both DELETE requests and POST fallbacks)
router.delete('/jobs/:id', requireAdmin, adminController.deleteJob);
router.post('/jobs/:id/delete', requireAdmin, adminController.deleteJob);
router.delete('/jobs/:id/remove-approved', requireAdmin, adminController.removeApprovedJob);
router.post('/jobs/:id/remove-approved', requireAdmin, adminController.removeApprovedJob);

// Placeholder routes for other admin pages
router.get('/students', requireAdmin, adminController.getStudentsPage);
router.get('/students/:id', requireAdmin, adminController.getStudentDetailsPage);
router.post('/students/:id/delete', requireAdmin, adminController.deleteStudent);
router.delete('/students/:id', requireAdmin, adminController.deleteStudent);
router.get('/companies', requireAdmin, adminController.getCompaniesPage);
router.get('/reports', requireAdmin, adminController.getReportsPage);
router.get('/mail-manager', requireAdmin, adminController.getMailManager);

module.exports = router;