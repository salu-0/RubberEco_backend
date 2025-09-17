const express = require('express');
const router = express.Router();

const {
  generateCertificate,
  getUserCertificates,
  verifyCertificate,
  getCertificateById
} = require('../controllers/certificateController');
const { protect } = require('../middlewares/auth');

// Public route for certificate verification
router.post('/verify', verifyCertificate);

// Protected routes (authentication required)
router.use(protect);

// POST /api/certificates/generate/:enrollmentId - Generate certificate for completed training
router.post('/generate/:enrollmentId', generateCertificate);

// GET /api/certificates/user/:userId - Get all certificates for a user
router.get('/user/:userId', getUserCertificates);

// GET /api/certificates/:certificateId - Get specific certificate
router.get('/:certificateId', getCertificateById);

console.log('🎓 Certificate routes file loaded successfully');
module.exports = router;
