const mongoose = require('mongoose');

const bidAlertSchema = new mongoose.Schema({
  lotId: {
    type: String,
    required: true,
    index: true
  },
  bidderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Register',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['ending_soon'],
    default: 'ending_soon'
  },
  notified: {
    type: Boolean,
    default: false,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  notifiedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  collection: 'bid_alerts'
});

bidAlertSchema.index({ lotId: 1, bidderId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('BidAlert', bidAlertSchema);


