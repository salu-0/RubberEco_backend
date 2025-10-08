const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NurseryBooking',
    required: true
  },
  nurseryCenterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NurseryCenter',
    required: true
  },
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  farmerName: {
    type: String,
    required: true
  },
  farmerEmail: {
    type: String,
    required: true
  },
  paymentType: {
    type: String,
    enum: ['advance', 'balance', 'full'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'upi', 'netbanking', 'wallet', 'cash', 'cheque'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  paymentGateway: {
    type: String,
    enum: ['razorpay', 'stripe', 'payu', 'cashfree', 'manual'],
    default: 'razorpay'
  },
  gatewayDetails: {
    transactionId: { type: String },
    orderId: { type: String },
    paymentId: { type: String },
    signature: { type: String },
    gatewayResponse: { type: mongoose.Schema.Types.Mixed }
  },
  paymentTimeline: [{
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    amount: { type: Number },
    notes: { type: String },
    gatewayResponse: { type: mongoose.Schema.Types.Mixed }
  }],
  refundDetails: {
    refundId: { type: String },
    refundAmount: { type: Number },
    refundReason: { type: String },
    refundStatus: { type: String, enum: ['pending', 'processed', 'failed'] },
    refundedAt: { type: Date },
    refundMethod: { type: String }
  },
  invoiceDetails: {
    invoiceNumber: { type: String },
    invoiceDate: { type: Date },
    taxAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true }
  },
  // Shipment-related metadata (optional)
  shipmentRequired: {
    type: Boolean,
    default: false
  },
  shippingFee: {
    type: Number,
    default: 0
  },
  shippingAddressText: {
    type: String
  },
  route: {
    from: { type: String },
    to: { type: String }
  },
  nurseryCenterName: {
    type: String
  },
  notes: {
    type: String
  },
  processedBy: {
    type: String,
    default: 'system'
  }
}, {
  timestamps: true,
  collection: 'payments'
});

// Generate invoice number before saving
paymentSchema.pre('save', async function(next) {
  if (!this.invoiceDetails.invoiceNumber && this.paymentStatus === 'completed') {
    const prefix = 'INV';
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const count = await this.constructor.countDocuments({
      'invoiceDetails.invoiceNumber': { $regex: `^${prefix}${year}${month}` }
    });
    this.invoiceDetails.invoiceNumber = `${prefix}${year}${month}${String(count + 1).padStart(4, '0')}`;
    this.invoiceDetails.invoiceDate = new Date();
  }
  next();
});

// Index for efficient queries
paymentSchema.index({ bookingId: 1 });
paymentSchema.index({ nurseryCenterId: 1 });
paymentSchema.index({ farmerId: 1 });
paymentSchema.index({ paymentStatus: 1 });
paymentSchema.index({ paymentMethod: 1 });
paymentSchema.index({ 'gatewayDetails.transactionId': 1 });

module.exports = mongoose.model('Payment', paymentSchema);

