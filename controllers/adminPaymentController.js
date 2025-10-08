const Payment = require('../models/Payment');

// Fetch all payments for admin (all types)
exports.getAllPayments = async (req, res) => {
  try {
    const { status, paymentMethod, type, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.paymentStatus = status;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (type) query.paymentType = type; // e.g., 'advance', 'balance', 'full', or custom

    // Populate references for all payment types
    const payments = await Payment.find(query)
      .populate('farmerId', 'name email phone')
      .populate('bookingId', 'plantName quantity amountTotal')
      .populate('nurseryCenterId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Admin getAllPayments error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching payments' });
  }
};
