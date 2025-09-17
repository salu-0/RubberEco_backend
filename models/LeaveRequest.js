const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  requestId: {
    type: String,
    unique: true
  },
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  staffName: {
    type: String,
    required: true
  },
  staffEmail: {
    type: String,
    required: true
  },
  staffRole: {
    type: String,
    required: true
  },
  leaveType: {
    type: String,
    required: true,
    enum: ['sick', 'personal', 'emergency', 'vacation', 'maternity', 'paternity', 'other']
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  totalDays: {
    type: Number
  },
  reason: {
    type: String,
    required: true,
    maxlength: 500
  },
  documents: [{
    filename: String,
    originalName: String,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminResponse: {
    respondedBy: {
      type: String
    },
    respondedAt: {
      type: Date
    },
    comments: {
      type: String,
      maxlength: 500
    }
  },
  urgency: {
    type: String,
    enum: ['low', 'normal', 'high', 'emergency'],
    default: 'normal'
  },
  contactDuringLeave: {
    phone: String,
    alternateContact: String,
    address: String
  },
  workHandover: {
    assignedTo: String,
    handoverNotes: String,
    completedTasks: [String],
    pendingTasks: [String]
  },
  submittedAt: {
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

// Pre-save middleware to generate requestId
leaveRequestSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      const count = await mongoose.model('LeaveRequest').countDocuments();
      this.requestId = `LR${String(count + 1).padStart(6, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Calculate total days between start and end date
leaveRequestSchema.pre('save', function(next) {
  if (this.startDate && this.endDate) {
    const timeDiff = this.endDate.getTime() - this.startDate.getTime();
    this.totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end dates
  }
  next();
});

// Static method to get staff leave requests
leaveRequestSchema.statics.getStaffLeaveRequests = function(staffId, status = null) {
  const query = { staffId };
  if (status && status !== 'all') {
    query.status = status;
  }
  
  return this.find(query)
    .sort({ submittedAt: -1 })
    .lean();
};

// Static method to get all leave requests for admin
leaveRequestSchema.statics.getAllLeaveRequests = function(status = null, page = 1, limit = 10) {
  const query = {};
  if (status && status !== 'all') {
    query.status = status;
  }
  
  const skip = (page - 1) * limit;
  
  return this.find(query)
    .sort({ submittedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

// Instance method to approve leave
leaveRequestSchema.methods.approve = function(adminName, comments = '') {
  this.status = 'approved';
  this.adminResponse = {
    respondedBy: adminName,
    respondedAt: new Date(),
    comments: comments
  };
  this.updatedAt = new Date();
  return this.save();
};

// Instance method to reject leave
leaveRequestSchema.methods.reject = function(adminName, comments = '') {
  this.status = 'rejected';
  this.adminResponse = {
    respondedBy: adminName,
    respondedAt: new Date(),
    comments: comments
  };
  this.updatedAt = new Date();
  return this.save();
};

// Virtual for formatted dates
leaveRequestSchema.virtual('formattedStartDate').get(function() {
  return this.startDate.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
});

leaveRequestSchema.virtual('formattedEndDate').get(function() {
  return this.endDate.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
});

leaveRequestSchema.virtual('formattedSubmittedAt').get(function() {
  return this.submittedAt.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Ensure virtual fields are serialized
leaveRequestSchema.set('toJSON', { virtuals: true });
leaveRequestSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
