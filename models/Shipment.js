const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema({
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
  farmerPhone: {
    type: String,
    required: true
  },
  shippingAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    landmark: { type: String }
  },
  plantDetails: {
    plantId: { type: mongoose.Schema.Types.ObjectId, ref: 'NurseryPlant' },
    plantName: { type: String, required: true },
    variety: { type: String },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true }
  },
  shipmentDetails: {
    trackingNumber: { type: String, unique: true },
    carrier: { type: String, required: true },
    estimatedDelivery: { type: Date, required: true },
    actualDelivery: { type: Date },
    shippingCost: { type: Number, required: true },
    packagingType: { type: String, default: 'Standard' },
    specialInstructions: { type: String }
  },
  status: {
    type: String,
    enum: ['preparing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'],
    default: 'preparing'
  },
  statusHistory: [{
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    notes: { type: String },
    updatedBy: { type: String }
  }],
  deliveryProof: {
    signature: { type: String },
    photo: { type: String },
    deliveredBy: { type: String },
    deliveredAt: { type: Date }
  },
  issues: [{
    type: { type: String, required: true },
    description: { type: String, required: true },
    reportedAt: { type: Date, default: Date.now },
    resolved: { type: Boolean, default: false },
    resolution: { type: String }
  }]
}, {
  timestamps: true,
  collection: 'shipments'
});

// Generate tracking number before saving
shipmentSchema.pre('save', async function(next) {
  if (!this.shipmentDetails.trackingNumber) {
    const prefix = 'SH';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    this.shipmentDetails.trackingNumber = `${prefix}${timestamp}${random}`;
  }
  next();
});

// Index for efficient queries
shipmentSchema.index({ bookingId: 1 });
shipmentSchema.index({ nurseryCenterId: 1 });
shipmentSchema.index({ farmerId: 1 });
shipmentSchema.index({ status: 1 });
shipmentSchema.index({ 'shipmentDetails.trackingNumber': 1 });

module.exports = mongoose.model('Shipment', shipmentSchema);

