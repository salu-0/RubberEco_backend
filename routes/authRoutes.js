const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
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
router.post('/register', registerUser);

// POST /api/auth/login
router.post('/login', loginUser);

// POST /api/auth/forgot-password
router.post('/forgot-password', forgotPassword);

// POST /api/auth/reset-password
router.post('/reset-password', resetPassword);

// GET /api/auth/verify-email
router.get('/verify-email', verifyEmail);

// POST /api/auth/resend-verification
router.post('/resend-verification', resendVerificationEmail);

// GET /api/auth/check-user
router.get('/check-user', checkUserExists);



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
router.post('/register-broker', async (req, res) => {
  try {
    console.log('Received broker registration request:', req.body);
    const {
      name,
      email,
      password,
      phone,
      location,
      bio,
      brokerProfile
    } = req.body;

    // Validate required fields
    if (!name || !email || !password || !phone || !location) {
      console.log('Missing required fields:', { name: !!name, email: !!email, password: !!password, phone: !!phone, location: !!location });
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Validate broker-specific fields
    if (!brokerProfile || !brokerProfile.experience ||
        !brokerProfile.specialization || brokerProfile.specialization.length === 0) {
      console.log('Missing broker fields:', { 
        brokerProfile: !!brokerProfile, 
        experience: brokerProfile?.experience, 
        specialization: brokerProfile?.specialization 
      });
      return res.status(400).json({
        success: false,
        message: 'Please provide all required broker information'
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

    // License number check removed since it's no longer required

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new broker user
    const newBroker = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone.trim(),
      location: location.trim(),
      bio: bio?.trim() || '',
      role: 'broker',
      brokerProfile: {
        experience: brokerProfile.experience,
        specialization: brokerProfile.specialization,
        companyName: brokerProfile.companyName?.trim() || '',
        companyAddress: brokerProfile.companyAddress?.trim() || '',
        education: brokerProfile.education?.trim() || '',
        previousWork: brokerProfile.previousWork?.trim() || '',
        verificationStatus: 'pending'
      }
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
      message: 'Broker registration successful! Your account is pending verification.',
      data: {
        id: newBroker._id,
        name: newBroker.name,
        email: newBroker.email,
        role: newBroker.role,
        verificationStatus: newBroker.brokerProfile.verificationStatus
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