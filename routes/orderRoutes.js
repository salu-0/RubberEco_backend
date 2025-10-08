const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
  createOrder,
  verifyPayment,
  getOrderStatus,
  getUserOrders
} = require('../controllers/orderController');

// Create Razorpay order
router.post('/create', protect, createOrder);

// Verify payment signature
router.post('/verify', protect, verifyPayment);

// Get order status
router.get('/:orderId/status', protect, getOrderStatus);

// Get user orders
router.get('/user/orders', protect, getUserOrders);

module.exports = router;
