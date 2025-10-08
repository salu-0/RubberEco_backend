const mongoose = require('mongoose');

const nurseryAdminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  nurseryCenterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NurseryCenter',
    required: true
  },
  nurseryCenterName: {
    type: String,
    required: true
  },
  location: {
    type: String,
    trim: true,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: true // Nursery admins are pre-verified
  },
  lastLogin: {
    type: Date,
    default: null
  },
  permissions: {
    managePlants: {
      type: Boolean,
      default: true
    },
    manageStock: {
      type: Boolean,
      default: true
    },
    managePricing: {
      type: Boolean,
      default: true
    },
    manageShipments: {
      type: Boolean,
      default: true
    },
    managePayments: {
      type: Boolean,
      default: true
    },
    viewReports: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true,
  collection: 'nursery_admins'
});

// Index for efficient queries
nurseryAdminSchema.index({ email: 1 });
nurseryAdminSchema.index({ nurseryCenterId: 1 });
nurseryAdminSchema.index({ isActive: 1 });

module.exports = mongoose.model('NurseryAdmin', nurseryAdminSchema);

