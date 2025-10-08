const mongoose = require('mongoose');

const nurseryBookingSchema = new mongoose.Schema({
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  farmerName: { type: String, required: true },
  farmerEmail: { type: String, required: true },
  nurseryCenterId: { type: mongoose.Schema.Types.ObjectId, ref: 'NurseryCenter', required: true },
  nurseryCenterName: { type: String, required: true },
  plantId: { type: mongoose.Schema.Types.ObjectId, ref: 'NurseryPlant', required: true },
  plantName: { type: String, required: true },
  unitPrice: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  amountTotal: { type: Number, required: true },
  advancePercent: { type: Number, required: true, default: 10 },
  amountAdvance: { type: Number, required: true },
  amountBalance: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'], default: 'pending' },
  approvalNotes: { type: String },
  shipmentRequired: { type: Boolean, default: false },
  shippingFee: { type: Number, default: 0 },
  shippingAddressText: { type: String },
  payment: {
    advancePaid: { type: Boolean, default: false },
    advanceTxnId: { type: String },
    advanceOrderId: { type: String },
    advancePaymentId: { type: String },
    advanceSignature: { type: String },
    balancePaid: { type: Boolean, default: false },
    balanceTxnId: { type: String }
  },
  reservationExpiresAt: { type: Date },
  reservedStock: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('NurseryBooking', nurseryBookingSchema);





