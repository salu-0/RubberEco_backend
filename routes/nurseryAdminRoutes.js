const express = require('express');
const router = express.Router();
const { requireNurseryAdmin } = require('../middlewares/nurseryAdminAuth');
const {
  loginNurseryAdmin,
  getProfile,
  updateProfile,
  getPlants,
  updatePlant,
  getBookings,
  updateBookingStatus,
  getDashboardStats,
  getShipments,
  updateShipmentStatus,
  createShipment,
  getPayments,
  updatePaymentStatus
} = require('../controllers/nurseryAdminController');

// Public routes
router.post('/login', loginNurseryAdmin);

// Protected routes (require nursery admin authentication)
router.use(requireNurseryAdmin);

// Profile management
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// Plant management
router.get('/plants', getPlants);
router.put('/plants/:plantId', updatePlant);

// Booking management
router.get('/bookings', getBookings);
router.put('/bookings/:bookingId/status', updateBookingStatus);

// Dashboard
router.get('/dashboard/stats', getDashboardStats);

// Shipment management
router.get('/shipments', getShipments);
router.post('/shipments', createShipment);
router.put('/shipments/:shipmentId/status', updateShipmentStatus);

// Payment management
router.get('/payments', getPayments);
router.put('/payments/:paymentId/status', updatePaymentStatus);

module.exports = router;
