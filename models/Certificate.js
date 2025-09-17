const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  // Certificate identification
  certificateNumber: {
    type: String,
    required: true,
    unique: true
  },
  
  // User information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Register',
    required: true
  },
  
  // Training information
  trainingModuleId: {
    type: Number,
    required: true
  },
  trainingModuleTitle: {
    type: String,
    required: true
  },
  trainingLevel: {
    type: String,
    required: true,
    enum: ['Beginner', 'Intermediate', 'Advanced']
  },
  trainingCategory: {
    type: String,
    required: true,
    default: 'Rubber Tapping'
  },
  
  // Completion details
  completionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  completionPercentage: {
    type: Number,
    required: true,
    min: 100,
    max: 100,
    default: 100
  },
  
  // Certificate details
  issuedDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: true,
    default: function() {
      // Certificate valid for 2 years
      const validDate = new Date();
      validDate.setFullYear(validDate.getFullYear() + 2);
      return validDate;
    }
  },
  
  // Certificate status
  status: {
    type: String,
    enum: ['active', 'expired', 'revoked'],
    default: 'active'
  },
  
  // Additional metadata
  instructorName: {
    type: String,
    default: 'Sasidharan Kannal'
  },
  organizationName: {
    type: String,
    default: 'RubberEco Training Institute'
  },
  
  // Verification
  verificationCode: {
    type: String,
    required: true,
    unique: true
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Generate certificate number before saving
certificateSchema.pre('save', async function(next) {
  if (this.isNew && !this.certificateNumber) {
    const { generateCertificateNumber } = require('../utils/helpers');
    this.certificateNumber = generateCertificateNumber(this.trainingCategory, this.trainingLevel);
  }
  
  // Generate verification code if not exists
  if (this.isNew && !this.verificationCode) {
    const crypto = require('crypto');
    this.verificationCode = crypto.randomBytes(8).toString('hex').toUpperCase();
  }
  
  this.updatedAt = new Date();
  next();
});

// Instance method to check if certificate is valid
certificateSchema.methods.isValid = function() {
  return this.status === 'active' && this.validUntil > new Date();
};

// Static method to find user certificates
certificateSchema.statics.getUserCertificates = function(userId) {
  return this.find({ userId })
    .populate('userId', 'name email')
    .sort({ issuedDate: -1 });
};

// Static method to verify certificate
certificateSchema.statics.verifyCertificate = function(certificateNumber, verificationCode) {
  return this.findOne({ 
    certificateNumber, 
    verificationCode,
    status: 'active'
  }).populate('userId', 'name email');
};

module.exports = mongoose.model('Certificate', certificateSchema);
