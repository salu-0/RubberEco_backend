const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const {
  enrollInTraining,
  getUserEnrollments,
  getModuleEnrollments,
  checkEnrollmentStatus,
  updateProgress,
  getAllEnrollments,
  getEnrollmentStats
} = require('../controllers/trainingEnrollmentController');
const { protect: verifyToken } = require('../middlewares/auth');

// POST /api/training/enroll - Enroll user in a training module
router.post('/enroll', verifyToken, enrollInTraining);

// GET /api/training/user/:userId - Get all enrollments for a user
router.get('/user/:userId', verifyToken, getUserEnrollments);

// GET /api/training/module/:moduleId - Get all enrollments for a module
router.get('/module/:moduleId', verifyToken, getModuleEnrollments);

// GET /api/training/check/:userId/:moduleId - Check if user is enrolled in module
router.get('/check/:userId/:moduleId', verifyToken, checkEnrollmentStatus);

// PUT /api/training/progress/:enrollmentId - Update progress for an enrollment
router.put('/progress/:enrollmentId', verifyToken, updateProgress);

// GET /api/training/all - Get all enrollments (admin only)
router.get('/all', verifyToken, getAllEnrollments);

// GET /api/training/stats - Get enrollment statistics (admin only)
router.get('/stats', verifyToken, getEnrollmentStats);



// Demo enrollment route (no auth required for testing)
router.post('/demo-enroll', async (req, res) => {
  try {
    const TrainingEnrollment = require('../models/TrainingEnrollment');

    const enrollmentData = {
      userId: req.body.userId,
      moduleId: req.body.moduleId,
      moduleTitle: req.body.moduleTitle,
      moduleLevel: req.body.moduleLevel,
      paymentAmount: req.body.paymentAmount,
      paymentMethod: req.body.paymentMethod || 'stripe',
      paymentStatus: 'completed',
      paymentId: req.body.paymentId,
      userDetails: req.body.userDetails,
      progress: {
        completedLessons: [],
        totalLessons: 0,
        progressPercentage: 0,
        lastAccessedDate: new Date()
      }
    };

    const enrollment = new TrainingEnrollment(enrollmentData);
    await enrollment.save();

    res.json({
      success: true,
      message: 'Demo enrollment successful',
      enrollmentId: enrollment._id
    });
  } catch (error) {
    console.error('Demo enrollment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Demo enrollment failed'
    });
  }
});

module.exports = router;

// Razorpay for training enrollment
// Create order for a course
router.post('/razorpay/create-order', async (req, res) => {
  try {
    const { amount, moduleId, moduleTitle } = req.body;

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ success: false, message: 'Razorpay keys not configured' });
    }

    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const order = await razorpay.orders.create({
      amount: Math.max(1, Math.round(Number(amount || 0) * 100)),
      currency: 'INR',
      receipt: `training-${moduleId}-${Date.now()}`,
      notes: { moduleId: String(moduleId || ''), moduleTitle: String(moduleTitle || '') }
    });

    res.json({ success: true, data: { orderId: order.id, amount: order.amount, currency: order.currency, key: process.env.RAZORPAY_KEY_ID } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Verify payment and create enrollment
router.post('/razorpay/verify', async (req, res) => {
  try {
    const TrainingEnrollment = require('../models/TrainingEnrollment');
    const { userId, moduleId, moduleTitle, moduleLevel, paymentAmount, userDetails, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ success: false, message: 'Razorpay not configured' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Signature verification failed' });
    }

    const enrollment = await TrainingEnrollment.create({
      userId,
      moduleId,
      moduleTitle,
      moduleLevel,
      paymentAmount,
      paymentMethod: 'razorpay',
      paymentStatus: 'completed',
      paymentId: razorpay_payment_id,
      userDetails,
      progress: { completedLessons: [], totalLessons: 0, progressPercentage: 0, lastAccessedDate: new Date() }
    });

    res.json({ success: true, message: 'Enrollment completed', enrollmentId: enrollment._id });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});
