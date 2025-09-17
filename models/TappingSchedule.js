const mongoose = require('mongoose');

const tappingScheduleSchema = new mongoose.Schema({
  // Schedule identification
  scheduleId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Reference to the original tapping request
  tappingRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TappingRequest',
    required: true
  },
  requestId: {
    type: String,
    required: true
  },
  
  // Farmer information
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Register',
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
  
  // Tapper information
  tapperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  tapperName: {
    type: String,
    required: true
  },
  tapperPhone: {
    type: String,
    required: true
  },
  tapperEmail: {
    type: String
  },
  
  // Farm details
  farmLocation: {
    type: String,
    required: true
  },
  farmSize: {
    type: String,
    required: true
  },
  numberOfTrees: {
    type: Number,
    required: true
  },
  
  // Schedule details
  tappingType: {
    type: String,
    required: true,
    enum: ['daily', 'alternate_day', 'weekly', 'custom']
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // Duration in days
    required: true
  },
  preferredTime: {
    type: String,
    required: true,
    enum: ['early_morning', 'morning', 'afternoon', 'evening']
  },
  
  // Schedule status
  status: {
    type: String,
    required: true,
    enum: ['scheduled', 'active', 'paused', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  
  // Progress tracking
  totalScheduledDays: {
    type: Number,
    required: true
  },
  completedDays: {
    type: Number,
    default: 0
  },
  missedDays: {
    type: Number,
    default: 0
  },
  progressPercentage: {
    type: Number,
    default: 0
  },
  
  // Daily tapping records
  dailyRecords: [{
    date: {
      type: Date,
      required: true
    },
    scheduledTime: {
      type: String,
      required: true
    },
    actualStartTime: {
      type: Date
    },
    actualEndTime: {
      type: Date
    },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'missed', 'cancelled'],
      default: 'scheduled'
    },
    treesCompleted: {
      type: Number,
      default: 0
    },
    latexCollected: {
      type: Number, // in kg
      default: 0
    },
    quality: {
      type: String,
      enum: ['excellent', 'good', 'average', 'poor'],
      default: 'good'
    },
    notes: {
      type: String,
      default: ''
    },
    weather: {
      type: String,
      enum: ['sunny', 'cloudy', 'rainy', 'stormy'],
      default: 'sunny'
    },
    tapperNotes: {
      type: String,
      default: ''
    },
    farmerFeedback: {
      type: String,
      default: ''
    },
    images: [{
      url: String,
      description: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    completedAt: {
      type: Date
    }
  }],
  
  // Financial details
  budgetRange: {
    type: String
  },
  estimatedCost: {
    type: Number
  },
  actualCost: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'completed'],
    default: 'pending'
  },
  
  // Performance metrics
  averageLatexPerDay: {
    type: Number,
    default: 0
  },
  averageTreesPerDay: {
    type: Number,
    default: 0
  },
  averageTimePerTree: {
    type: Number, // in minutes
    default: 0
  },
  qualityRating: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  
  // Schedule modifications
  modifications: [{
    date: {
      type: Date,
      default: Date.now
    },
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Register'
    },
    modificationType: {
      type: String,
      enum: ['reschedule', 'pause', 'resume', 'cancel', 'extend', 'notes']
    },
    oldValue: String,
    newValue: String,
    reason: String,
    notes: String
  }],
  
  // Notifications and alerts
  notifications: [{
    type: {
      type: String,
      enum: ['reminder', 'missed', 'completed', 'issue', 'weather']
    },
    message: String,
    sentAt: {
      type: Date,
      default: Date.now
    },
    sentTo: [{
      type: String,
      enum: ['farmer', 'tapper', 'admin']
    }],
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent'
    }
  }],
  
  // Admin notes and observations
  adminNotes: [{
    note: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Register'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high'],
      default: 'normal'
    }
  }],
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastActivityAt: {
    type: Date,
    default: Date.now
  }
  
}, {
  timestamps: true,
  collection: 'tapping_schedules'
});

// Indexes for better query performance
tappingScheduleSchema.index({ farmerId: 1 });
tappingScheduleSchema.index({ tapperId: 1 });
tappingScheduleSchema.index({ status: 1 });
tappingScheduleSchema.index({ startDate: 1, endDate: 1 });
tappingScheduleSchema.index({ scheduleId: 1 });
tappingScheduleSchema.index({ tappingRequestId: 1 });
tappingScheduleSchema.index({ 'dailyRecords.date': 1 });

// Pre-save middleware to update timestamps and calculate progress
tappingScheduleSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  this.lastActivityAt = new Date();
  
  // Calculate progress percentage
  if (this.totalScheduledDays > 0) {
    this.progressPercentage = Math.round((this.completedDays / this.totalScheduledDays) * 100);
  }
  
  // Calculate average metrics
  const completedRecords = this.dailyRecords.filter(record => record.status === 'completed');
  if (completedRecords.length > 0) {
    this.averageLatexPerDay = completedRecords.reduce((sum, record) => sum + record.latexCollected, 0) / completedRecords.length;
    this.averageTreesPerDay = completedRecords.reduce((sum, record) => sum + record.treesCompleted, 0) / completedRecords.length;
  }
  
  next();
});

// Generate schedule ID
tappingScheduleSchema.pre('save', async function(next) {
  if (this.isNew && !this.scheduleId) {
    const count = await this.constructor.countDocuments();
    this.scheduleId = `SCH${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Virtual for formatted dates
tappingScheduleSchema.virtual('formattedStartDate').get(function() {
  return this.startDate.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
});

tappingScheduleSchema.virtual('formattedEndDate').get(function() {
  return this.endDate.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
});

// Static methods
tappingScheduleSchema.statics.getActiveSchedules = function() {
  return this.find({ status: 'active' }).sort({ startDate: 1 });
};

tappingScheduleSchema.statics.getSchedulesByFarmer = function(farmerId) {
  return this.find({ farmerId }).sort({ startDate: -1 });
};

tappingScheduleSchema.statics.getSchedulesByTapper = function(tapperId) {
  return this.find({ tapperId }).sort({ startDate: -1 });
};

// Instance methods
tappingScheduleSchema.methods.addDailyRecord = function(recordData) {
  this.dailyRecords.push(recordData);
  if (recordData.status === 'completed') {
    this.completedDays += 1;
  } else if (recordData.status === 'missed') {
    this.missedDays += 1;
  }
  return this.save();
};

tappingScheduleSchema.methods.updateProgress = function() {
  const completedRecords = this.dailyRecords.filter(record => record.status === 'completed');
  const missedRecords = this.dailyRecords.filter(record => record.status === 'missed');
  
  this.completedDays = completedRecords.length;
  this.missedDays = missedRecords.length;
  this.progressPercentage = Math.round((this.completedDays / this.totalScheduledDays) * 100);
  
  return this.save();
};

// Ensure virtual fields are serialized
tappingScheduleSchema.set('toJSON', { virtuals: true });
tappingScheduleSchema.set('toObject', { virtuals: true });

const TappingSchedule = mongoose.model('TappingSchedule', tappingScheduleSchema);

module.exports = TappingSchedule;
