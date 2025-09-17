const mongoose = require('mongoose');

const trainingEnrollmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Register',
    required: true
  },
  moduleId: {
    type: Number,
    required: true
  },
  moduleTitle: {
    type: String,
    required: true,
    trim: true
  },
  moduleLevel: {
    type: String,
    required: true,
    enum: ['Beginner', 'Intermediate', 'Advanced']
  },
  paymentAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['card', 'upi', 'netbanking', 'stripe']
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'completed'
  },
  paymentId: {
    type: String,
    default: null
  },
  enrollmentDate: {
    type: Date,
    default: Date.now
  },
  userDetails: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    experience: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', ''],
      default: ''
    },
    motivation: {
      type: String,
      trim: true,
      default: ''
    }
  },
  progress: {
    completedLessons: [{
      type: Number
    }],
    totalLessons: {
      type: Number,
      default: 0
    },
    progressPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    lastAccessedDate: {
      type: Date,
      default: Date.now
    }
  },
  certificateIssued: {
    type: Boolean,
    default: false
  },
  certificateIssuedDate: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'training_enrolled'
});

// Compound index to ensure one enrollment per user per module
trainingEnrollmentSchema.index({ userId: 1, moduleId: 1 }, { unique: true });

// Index for efficient queries
trainingEnrollmentSchema.index({ userId: 1 });
trainingEnrollmentSchema.index({ moduleId: 1 });
trainingEnrollmentSchema.index({ enrollmentDate: -1 });
trainingEnrollmentSchema.index({ paymentStatus: 1 });

// Virtual for enrollment duration
trainingEnrollmentSchema.virtual('enrollmentDuration').get(function() {
  return Math.floor((Date.now() - this.enrollmentDate) / (1000 * 60 * 60 * 24)); // days
});

// Method to update progress
trainingEnrollmentSchema.methods.updateProgress = function(completedLessons, totalLessons) {
  this.progress.completedLessons = completedLessons;
  this.progress.totalLessons = totalLessons;
  this.progress.progressPercentage = totalLessons > 0 ? Math.round((completedLessons.length / totalLessons) * 100) : 0;
  this.progress.lastAccessedDate = new Date();
  return this.save();
};

// Static method to get user enrollments
trainingEnrollmentSchema.statics.getUserEnrollments = function(userId) {
  return this.find({ userId, isActive: true })
    .populate('userId', 'name email')
    .sort({ enrollmentDate: -1 });
};

// Static method to get module enrollments
trainingEnrollmentSchema.statics.getModuleEnrollments = function(moduleId) {
  return this.find({ moduleId, isActive: true })
    .populate('userId', 'name email')
    .sort({ enrollmentDate: -1 });
};

// Static method to check if user is enrolled in module
trainingEnrollmentSchema.statics.isUserEnrolled = function(userId, moduleId) {
  return this.findOne({ userId, moduleId, isActive: true, paymentStatus: 'completed' });
};

module.exports = mongoose.model('TrainingEnrollment', trainingEnrollmentSchema);
