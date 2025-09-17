const mongoose = require('mongoose');

const staffRequestSchema = new mongoose.Schema({
  // Personal Information
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  gender: {
    type: String,
    required: true,
    enum: ['male', 'female', 'other']
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  
  // Address Information
  presentAddress: {
    street: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    state: {
      type: String,
      required: true,
      trim: true
    },
    pincode: {
      type: String,
      required: true,
      trim: true
    }
  },
  
  permanentAddress: {
    street: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    state: {
      type: String,
      required: true,
      trim: true
    },
    pincode: {
      type: String,
      required: true,
      trim: true
    },
    sameAsPresent: {
      type: Boolean,
      default: false
    }
  },
  
  // Professional Information
  qualification: {
    type: String,
    required: true,
    trim: true
  },
  workExperience: {
    type: String,
    trim: true,
    default: ''
  },
  skills: {
    type: String,
    trim: true,
    default: ''
  },
  applyForPosition: {
    type: String,
    required: true,
    enum: ['tapper', 'latex_collector', 'supervisor', 'field_officer', 'trainer', 'skilled_worker', 'manager']
  },
  
  // File Uploads
  photo: {
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    path: String,
    url: String
  },
  idProof: {
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    path: String,
    url: String
  },
  resume: {
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    path: String,
    url: String
  },
  
  // Automated document verification metadata
  verification: {
    idOcr: {
      status: {
        type: String,
        enum: ['passed', 'failed', 'skipped', 'error'],
        default: 'skipped'
      },
      confidence: {
        type: Number,
        default: 0
      },
      extracted: {
        name: { type: String, default: '' },
        dob: { type: String, default: '' },
        idNumber: { type: String, default: '' }
      },
      matched: {
        name: { type: Boolean, default: false },
        dob: { type: Boolean, default: false },
        idNumber: { type: Boolean, default: false }
      },
      rawText: { type: String, default: '' },
      notes: { type: String, default: '' },
      verifiedAt: { type: Date }
    }
  },
  
  // Application Status
  status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected'],
    default: 'pending'
  },
  
  // Admin Actions
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  reviewNotes: {
    type: String,
    trim: true,
    default: ''
  },
  
  // If approved, reference to created staff account
  staffAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  
  // Application metadata
  applicationId: {
    type: String,
    unique: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  
  // Contact preferences
  preferredContactMethod: {
    type: String,
    enum: ['email', 'phone', 'both'],
    default: 'email'
  },
  
  // Additional notes from applicant
  additionalNotes: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for better query performance
staffRequestSchema.index({ email: 1 });
staffRequestSchema.index({ status: 1 });
staffRequestSchema.index({ applyForPosition: 1 });
staffRequestSchema.index({ submittedAt: -1 });
staffRequestSchema.index({ applicationId: 1 });

// Generate unique application ID before saving
staffRequestSchema.pre('save', function(next) {
  if (!this.applicationId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    this.applicationId = `APP-${timestamp}-${random}`.toUpperCase();
  }
  next();
});

// Virtual for full address
staffRequestSchema.virtual('fullPresentAddress').get(function() {
  return `${this.presentAddress.street}, ${this.presentAddress.city}, ${this.presentAddress.state} - ${this.presentAddress.pincode}`;
});

staffRequestSchema.virtual('fullPermanentAddress').get(function() {
  return `${this.permanentAddress.street}, ${this.permanentAddress.city}, ${this.permanentAddress.state} - ${this.permanentAddress.pincode}`;
});

// Virtual for age calculation
staffRequestSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Virtual for application duration
staffRequestSchema.virtual('applicationDuration').get(function() {
  const now = new Date();
  const submitted = new Date(this.submittedAt);
  const diffTime = Math.abs(now - submitted);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Ensure virtual fields are serialized
staffRequestSchema.set('toJSON', { virtuals: true });
staffRequestSchema.set('toObject', { virtuals: true });

// Static method to get applications by status
staffRequestSchema.statics.getByStatus = function(status) {
  return this.find({ status }).sort({ submittedAt: -1 });
};

// Static method to get recent applications
staffRequestSchema.statics.getRecent = function(limit = 10) {
  return this.find().sort({ submittedAt: -1 }).limit(limit);
};

// Instance method to approve application
staffRequestSchema.methods.approve = function(reviewerId, notes = '') {
  this.status = 'approved';
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.reviewNotes = notes;
  return this.save();
};

// Instance method to reject application
staffRequestSchema.methods.reject = function(reviewerId, notes = '') {
  this.status = 'rejected';
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.reviewNotes = notes;
  return this.save();
};

// Instance method to move to review
staffRequestSchema.methods.moveToReview = function(reviewerId, notes = '') {
  this.status = 'under_review';
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.reviewNotes = notes;
  return this.save();
};

module.exports = mongoose.model('StaffRequest', staffRequestSchema, 'staff_requests');
