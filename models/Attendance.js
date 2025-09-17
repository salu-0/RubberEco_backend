const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  // User who marked attendance
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  
  // Task/Assignment ID
  taskId: {
    type: String,
    required: true
  },
  
  // Task name for reference
  taskName: {
    type: String,
    required: true
  },
  
  // Attendance type
  attendanceType: {
    type: String,
    enum: ['present', 'absent', 'late', 'half_day'],
    default: 'present'
  },
  
  // Date of attendance
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // Location where attendance was marked
  location: {
    type: String,
    default: 'field'
  },
  
  // Additional notes
  notes: {
    type: String,
    default: ''
  },
  
  // When attendance was marked
  markedAt: {
    type: Date,
    default: Date.now
  },
  
  // GPS coordinates (optional)
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  
  // Device information (optional)
  deviceInfo: {
    userAgent: String,
    platform: String,
    timestamp: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
attendanceSchema.index({ userId: 1, date: -1 });
attendanceSchema.index({ taskId: 1, date: -1 });
attendanceSchema.index({ userId: 1, taskId: 1, date: -1 });
attendanceSchema.index({ attendanceType: 1, date: -1 });

// Prevent duplicate attendance for the same user, task, and date
attendanceSchema.index({ userId: 1, taskId: 1, date: 1 }, { unique: true });

// Virtual for formatted date
attendanceSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString();
});

// Virtual for formatted time
attendanceSchema.virtual('formattedTime').get(function() {
  return this.markedAt.toLocaleTimeString();
});

// Static method to get attendance for a specific date range
attendanceSchema.statics.getAttendanceForDateRange = function(userId, startDate, endDate) {
  return this.find({
    userId: userId,
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: -1, markedAt: -1 });
};

// Static method to get attendance summary
attendanceSchema.statics.getAttendanceSummary = function(userId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: '$attendanceType',
        count: { $sum: 1 }
      }
    }
  ]);
};

// Instance method to check if attendance is on time
attendanceSchema.methods.isOnTime = function() {
  const expectedTime = new Date(this.date);
  expectedTime.setHours(9, 0, 0, 0); // Expected 9 AM
  
  return this.markedAt <= expectedTime;
};

// Instance method to get attendance status
attendanceSchema.methods.getStatus = function() {
  if (this.attendanceType === 'present') {
    return this.isOnTime() ? 'On Time' : 'Late';
  }
  return this.attendanceType.charAt(0).toUpperCase() + this.attendanceType.slice(1);
};

module.exports = mongoose.model('Attendance', attendanceSchema);




