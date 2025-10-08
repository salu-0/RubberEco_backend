const express = require('express');
const router = express.Router();
const { preventNurseryAdminAccess } = require('../middlewares/nurseryAdminAuth');
const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUsersByRole,
  getUserStats,
  getRegisterStats,
  getRecentRegistrations
} = require('../controllers/userController');
const { getSupabaseUsers, updateSupabaseUserRole } = require('../controllers/supabaseController');

// Middleware to verify JWT token (you can implement this based on your auth setup)
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  try {
    // For now, we'll skip token verification to get the API working
    // You can implement proper JWT verification here later
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

// GET /api/users/all - Get all users
router.get('/all', preventNurseryAdminAccess, verifyToken, getAllUsers);

// GET /api/users/stats - Get user statistics
router.get('/stats', preventNurseryAdminAccess, verifyToken, getUserStats);

// GET /api/users/register-stats - Get statistics from Register collection
router.get('/register-stats', preventNurseryAdminAccess, verifyToken, getRegisterStats);

// GET /api/users/recent-registrations - Get recent registrations from Register collection
router.get('/recent-registrations', preventNurseryAdminAccess, verifyToken, getRecentRegistrations);

// GET /api/users/role/:role - Get users by role
router.get('/role/:role', preventNurseryAdminAccess, verifyToken, getUsersByRole);

// GET /api/users/supabase - Get all Supabase users (must be before /:id route)
router.get('/supabase', preventNurseryAdminAccess, verifyToken, getSupabaseUsers);

// PUT /api/users/supabase/role - Update Supabase user role
router.put('/supabase/role', preventNurseryAdminAccess, verifyToken, updateSupabaseUserRole);

// PUT /api/users/supabase/:id - Update Supabase user profile
router.put('/supabase/:id', preventNurseryAdminAccess, (req, res, next) => {
  console.log('🎯 PUT /supabase/:id route hit with ID:', req.params.id);
  console.log('🎯 Request body:', req.body);
  next();
}, verifyToken, require('../controllers/supabaseController').updateSupabaseUserProfile);

// GET /api/users/:id - Get user by ID
router.get('/:id', preventNurseryAdminAccess, verifyToken, getUserById);

// PUT /api/users/:id - Update user (admin)
router.put('/:id', preventNurseryAdminAccess, (req, res, next) => {
  console.log('🎯 PUT /:id route hit with ID:', req.params.id);
  console.log('🎯 Request body:', req.body);
  next();
}, verifyToken, updateUser);

// DELETE /api/users/:id - Delete user
router.delete('/:id', preventNurseryAdminAccess, verifyToken, deleteUser);

module.exports = router;
