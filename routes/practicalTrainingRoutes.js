const express = require('express');
const router = express.Router();
const {
  createPracticalTraining,
  getAllPracticalTrainings,
  getAvailableTrainings,
  getPracticalTrainingById,
  enrollInPracticalTraining,
  createPracticalTrainingOrder,
  verifyPracticalTrainingPayment,
  updatePracticalTraining,
  updateTrainingStatus,
  getUserPracticalTrainings,
  recordAttendance,
  removeUserEnrollment,
  removeUserFromAllTrainings,
  removeSelfFromAllTrainings,
  clearTrainingParticipants
} = require('../controllers/practicalTrainingController');
const { protect, adminOnly } = require('../middlewares/auth');

// Public routes (no authentication required)
router.get('/available', getAvailableTrainings);

// Protected routes (authentication required)
router.use(protect);

// GET /api/practical-training - Get all practical training sessions
router.get('/', getAllPracticalTrainings);

// GET /api/practical-training/:id - Get specific practical training session
router.get('/:id', getPracticalTrainingById);

// POST /api/practical-training/:id/enroll - Enroll in practical training
router.post('/:id/enroll', enrollInPracticalTraining);

// Razorpay order + verify for practical training (payment + training_enrolled record)
router.post('/:id/razorpay/create-order', (req, res, next) => protect(req, res, next), require('../controllers/practicalTrainingController').createPracticalRazorpayOrder);
router.post('/:id/razorpay/verify', (req, res, next) => protect(req, res, next), require('../controllers/practicalTrainingController').verifyPracticalRazorpayPayment);

// POST /api/practical-training/:id/payment/order - Create Razorpay order for training
router.post('/:id/payment/order', createPracticalTrainingOrder);

// POST /api/practical-training/:id/payment/verify - Verify Razorpay payment and confirm
router.post('/:id/payment/verify', verifyPracticalTrainingPayment);

// GET /api/practical-training/user/:userId - Get user's practical training enrollments
router.get('/user/:userId', getUserPracticalTrainings);

// DELETE /api/practical-training/:id/enrollment/:userId - Remove a user's enrollment (self or admin)
router.delete('/:id/enrollment/:userId', removeUserEnrollment);

// DELETE /api/practical-training/self/clear - Remove authenticated user from all trainings
router.delete('/self/clear', removeSelfFromAllTrainings);

// Admin only routes
router.use(adminOnly);

// POST /api/practical-training - Create new practical training session
router.post('/', createPracticalTraining);

// PUT /api/practical-training/:id - Update practical training session
router.put('/:id', updatePracticalTraining);

// PATCH /api/practical-training/:id/status - Update training status
router.patch('/:id/status', updateTrainingStatus);

// POST /api/practical-training/:id/attendance - Record attendance
router.post('/:id/attendance', recordAttendance);

// DELETE /api/practical-training/admin/clear-user/:userId - Remove a user from all trainings
router.delete('/admin/clear-user/:userId', removeUserFromAllTrainings);

// DELETE /api/practical-training/admin/clear-training/:id - Clear all participants in a training
router.delete('/admin/clear-training/:id', clearTrainingParticipants);

module.exports = router;
