const express = require('express');
const router = express.Router();
const { getAllPayments } = require('../controllers/adminPaymentController');
// TODO: Add admin authentication middleware if needed

// GET /api/admin/payments - fetch all payments (all types)
router.get('/payments', getAllPayments);

module.exports = router;
