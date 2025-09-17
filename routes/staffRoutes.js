const express = require('express');
const router = express.Router();
const {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  getStaffStats,
  changeStaffPassword
} = require('../controllers/staffController');
const { protect, adminOnly } = require('../middlewares/auth');

// Routes accessible by authenticated users
router.get('/stats', protect, getStaffStats);
router.get('/', protect, getAllStaff);

// Routes accessible only by admins
router.post('/', protect, adminOnly, createStaff);

// Password change route (must come before /:id route)
router.put('/:id/change-password', protect, changeStaffPassword);



// Parameterized routes must come after specific routes
router.get('/:id', protect, getStaffById);
router.put('/:id', protect, adminOnly, updateStaff);
router.delete('/:id', protect, adminOnly, deleteStaff);

module.exports = router;
