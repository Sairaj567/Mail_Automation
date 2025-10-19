// server/routers/n8nRoutes.js
const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
// const mailController = require('../controllers/mailController'); // Uncomment if using

// ***** ADD THIS TEST ROUTE *****
router.get('/', (req, res) => {
  console.log("Accessed GET /api/n8n test route!"); // Add a log
  res.status(200).json({ success: true, message: 'n8n API base endpoint is active!' });
});
// *******************************

// Route for n8n to POST company profile data
router.post('/company-profile', companyController.handleN8nCompanyUpdate);

// Route for n8n to POST new mail data (if you implemented it)
// router.post('/mail', mailController.createMail);

module.exports = router;