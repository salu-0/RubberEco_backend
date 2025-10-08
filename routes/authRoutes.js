const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { preventNurseryAdminAccess } = require('../middlewares/nurseryAdminAuth');
const upload = require('../middlewares/brokerUpload');
const { ocrIdProofAndValidate } = require('../utils/ocr');
const fs = require('fs');
// const passport = require('passport'); // Temporarily disabled for debugging
const {
  registerUser,
  loginUser,
  googleAuthCallback,
  handleGoogleAuth,
  forgotPassword,
  resetPassword,
  testEmailConfig,
  sendTestEmail,
  verifyEmail,
  resendVerificationEmail,
  checkUserExists
} = require('../controllers/authController');

// POST /api/auth/register
router.post('/register', preventNurseryAdminAccess, registerUser);

// POST /api/auth/login
router.post('/login', preventNurseryAdminAccess, loginUser);

// POST /api/auth/forgot-password
router.post('/forgot-password', preventNurseryAdminAccess, forgotPassword);

// POST /api/auth/reset-password
router.post('/reset-password', preventNurseryAdminAccess, resetPassword);

// GET /api/auth/verify-email
router.get('/verify-email', preventNurseryAdminAccess, verifyEmail);

// POST /api/auth/resend-verification
router.post('/resend-verification', preventNurseryAdminAccess, resendVerificationEmail);

// GET /api/auth/check-user
router.get('/check-user', preventNurseryAdminAccess, checkUserExists);



// Google OAuth Routes (temporarily disabled for debugging)
// router.get('/google', (req, res, next) => {
//   passport.authenticate('google', {
//     scope: ['profile', 'email'],
//     prompt: 'select_account',
//     state: req.query.redirect || '/home' // Store redirect URL
//   })(req, res, next);
// });

// router.get('/google/callback',
//   passport.authenticate('google', {
//     session: false,
//     failureRedirect: '/login?error=google_auth_failed'
//   }),
//   googleAuthCallback
// );

// Alternative API endpoint for mobile apps
router.get('/google/api', handleGoogleAuth, googleAuthCallback);

// @route   POST /api/auth/register-broker
// @desc    Register a new broker
// @access  Public
router.post('/register-broker', preventNurseryAdminAccess, upload.single('idProof'), async (req, res) => {
  try {
    // Accept both form-data and JSON fallback
    const isMultipart = req.is('multipart/form-data');
    let name, email, password, phone, location, bio, experience, companyName, dob;
    if (isMultipart) {
      name = req.body.name;
      email = req.body.email;
      password = req.body.password;
      phone = req.body.phone;
      location = req.body.location;
      bio = req.body.bio;
      experience = req.body.experience;
      companyName = req.body.companyName;
      dob = req.body.dob;
    } else {
      // fallback for JSON
      ({ name, email, password, phone, location, bio, experience, companyName, dob } = req.body);
    }

    // Validate required fields
    if (!name || !email || !password || !phone || !location) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }
    if (!experience) {
      return res.status(400).json({
        success: false,
        message: 'Experience is required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // OCR verification for ID proof
    let ocrResult = { status: 'skipped' };
    let verificationStatus = 'pending';
    if (req.file && req.file.mimetype && req.file.path) {
      if (req.file.mimetype.startsWith('image/')) {
        console.log('🔍 OCR Validation Input:', {
          expectedName: name,
          expectedDob: dob || '',
          filePath: req.file.path
        });
        
        ocrResult = await ocrIdProofAndValidate({
          filePath: req.file.path,
          expectedName: name,
          expectedDob: dob || '',
          expectedIdNumber: ''
        });
        
        console.log('🔍 OCR Validation Result:', {
          status: ocrResult.status,
          extracted: ocrResult.extracted,
          matched: ocrResult.matched,
          notes: ocrResult.notes
        });
        // Always require admin approval, regardless of OCR status
        if (ocrResult.status !== 'passed') {
          verificationStatus = 'under_review';
        } else {
          verificationStatus = 'pending'; // Changed from 'approved' to 'pending' to require admin approval
        }
      } else {
        // Only allow images for now
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({
          success: false,
          message: 'ID proof must be an image file (JPG, PNG)'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'ID proof image is required'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

  // Create new broker user (use Register model)
  const Register = require('../models/Register');
    const newBroker = new Register({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone.trim(),
      location: location.trim(),
      bio: bio?.trim() || '',
      role: 'broker',
      brokerProfile: {
        licenseNumber: '',
        experience: experience,
        specialization: ['Rubber Trading'],
        companyName: companyName?.trim() || '',
        companyAddress: '',
        education: '',
        previousWork: '',
        verificationStatus,
        ocrValidationStatus: ocrResult.status || 'not_checked',
        ocrValidationReason: ocrResult.notes || '',
        rating: 0,
        totalDeals: 0,
        successfulDeals: 0
      },
      idProof: req.file ? {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        url: `/uploads/broker-idproofs/${req.file.filename}`
      } : undefined,
      verification: { idOcr: ocrResult }
    });

    await newBroker.save();

    // Send verification email (optional)
    try {
      const { sendWelcomeEmail } = require('../controllers/authController');
      await sendWelcomeEmail(newBroker.email, newBroker.name, 'broker');
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
      // Don't fail registration if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Broker registration successful! Your account is pending admin approval.',
      data: {
        id: newBroker._id,
        name: newBroker.name,
        email: newBroker.email,
        role: newBroker.role,
        verificationStatus: newBroker.brokerProfile.verificationStatus,
        ocrResult: ocrResult
      }
    });

  } catch (error) {
    console.error('Broker registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

module.exports = router;