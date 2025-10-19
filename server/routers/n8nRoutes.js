// server/routers/n8nRoutes.js
const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const mailController = require('../controllers/mailController'); // Assuming you created this earlier

// Route for n8n to POST company profile data
router.post('/company-profile', companyController.handleN8nCompanyUpdate);

// Route for n8n to POST new mail data (if you implemented it)
router.post('/mail', mailController.createMail);

module.exports = router;