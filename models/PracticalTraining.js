const mongoose = require('mongoose');

const practicalTrainingSchema = new mongoose.Schema({
  // Training Session Identification
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Training Details
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['rubber_tapping', 'plantation_management', 'disease_control', 'harvesting', 'equipment_maintenance', 'safety_protocols']
  },
  level: {
    type: String,
    required: true,
    enum: ['Beginner', 'Intermediate', 'Advanced']
  },
  
  // Instructor Information
  instructor: {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    specialization: {
      type: String,
      required: true
    },
    experience: {
      type: Number, // years
      required: true
    }
  },
  
  // Schedule Information
  schedule: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    duration: {
      type: Number, // duration in hours
      required: true
    },
    timeSlots: [{
      day: {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      },
      startTime: {
        type: String, // "09:00"
        required: true
      },
      endTime: {
        type: String, // "17:00"
        required: true
      }
    }],
    totalSessions: {
      type: Number,
      required: true
    }
  },
  
  // Location Information
  location: {
    type: {
      type: String,
      enum: ['training_center', 'field_location', 'plantation_site', 'hybrid'],
      required: true
    },
    address: {
      type: String,
      required: true
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    facilities: [{
      type: String,
      enum: ['parking', 'restroom', 'cafeteria', 'equipment_storage', 'first_aid', 'accommodation']
    }],
    capacity: {
      type: Number,
      required: true,
      min: 1,
      max: 50
    }
  },
  
  // Training Content
  curriculum: [{
    sessionNumber: {
      type: Number,
      required: true
    },
    topic: {
      type: String,
      required: true
    },
    objectives: [String],
    activities: [{
      type: String,
      enum: ['demonstration', 'hands_on_practice', 'group_exercise', 'assessment', 'field_work', 'equipment_training']
    }],
    duration: Number, // minutes
    materials: [String],
    safetyRequirements: [String]
  }],
  
  // Prerequisites
  prerequisites: {
    requiredModules: [{
      moduleId: Number,
      moduleTitle: String
    }],
    experienceLevel: {
      type: String,
      enum: ['none', 'basic', 'intermediate', 'advanced']
    },
    physicalRequirements: [String],
    equipmentNeeded: [String]
  },
  
  // Enrollment Management
  enrollment: {
    maxParticipants: {
      type: Number,
      required: true,
      min: 1,
      max: 50
    },
    currentEnrollments: {
      type: Number,
      default: 0
    },
    waitingList: {
      type: Number,
      default: 0
    },
    registrationDeadline: {
      type: Date,
      required: true
    },
    fee: {
      type: Number,
      required: true,
      min: 0
    },
    includesEquipment: {
      type: Boolean,
      default: false
    },
    includesMaterials: {
      type: Boolean,
      default: true
    },
    includesRefreshments: {
      type: Boolean,
      default: false
    }
  },
  
  // Status and Management
  status: {
    type: String,
    required: true,
    enum: ['draft', 'published', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled'],
    default: 'draft'
  },
  
  // Participants
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Register',
      required: true
    },
    name: String,
    email: String,
    phone: String,
    enrollmentDate: {
      type: Date,
      default: Date.now
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    attendance: [{
      sessionNumber: Number,
      date: Date,
      status: {
        type: String,
        enum: ['present', 'absent', 'late', 'excused']
      },
      arrivalTime: Date,
      departureTime: Date,
      notes: String
    }],
    assessments: [{
      type: {
        type: String,
        enum: ['practical_skill', 'written_test', 'demonstration', 'project']
      },
      score: {
        type: Number,
        min: 0,
        max: 100
      },
      feedback: String,
      assessedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff'
      },
      assessedAt: Date
    }],
    certificateEarned: {
      type: Boolean,
      default: false
    },
    certificateIssuedDate: Date,
    finalGrade: {
      type: String,
      enum: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F']
    },
    feedback: String,
    status: {
      type: String,
      enum: ['enrolled', 'active', 'completed', 'dropped', 'failed'],
      default: 'enrolled'
    }
  }],
  
  // Training Resources
  resources: {
    equipment: [{
      name: String,
      quantity: Number,
      condition: {
        type: String,
        enum: ['excellent', 'good', 'fair', 'needs_replacement']
      }
    }],
    materials: [{
      name: String,
      type: {
        type: String,
        enum: ['handout', 'manual', 'video', 'tool', 'sample']
      },
      quantity: Number
    }],
    safetyEquipment: [{
      name: String,
      quantity: Number,
      required: Boolean
    }]
  },
  
  // Weather and Environmental Considerations
  weatherRequirements: {
    suitableConditions: [{
      type: String,
      enum: ['sunny', 'cloudy', 'light_rain', 'dry', 'humid']
    }],
    unsuitableConditions: [{
      type: String,
      enum: ['heavy_rain', 'storm', 'extreme_heat', 'fog']
    }],
    contingencyPlan: String
  },
  
  // Feedback and Evaluation
  feedback: {
    participantRatings: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Register'
      },
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      comments: String,
      submittedAt: {
        type: Date,
        default: Date.now
      }
    }],
    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    instructorNotes: String,
    improvementSuggestions: [String]
  },
  
  // Administrative
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Register',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Register'
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
  timestamps: true,
  collection: 'practical_training'
});

// Indexes for efficient queries
practicalTrainingSchema.index({ sessionId: 1 }, { unique: true });
practicalTrainingSchema.index({ category: 1, level: 1 });
practicalTrainingSchema.index({ 'schedule.startDate': 1, 'schedule.endDate': 1 });
practicalTrainingSchema.index({ status: 1 });
practicalTrainingSchema.index({ 'location.type': 1 });
practicalTrainingSchema.index({ 'instructor.staffId': 1 });
practicalTrainingSchema.index({ 'participants.userId': 1 });

// Virtual for available spots
practicalTrainingSchema.virtual('availableSpots').get(function() {
  return this.enrollment.maxParticipants - this.enrollment.currentEnrollments;
});

// Virtual for enrollment status
practicalTrainingSchema.virtual('enrollmentStatus').get(function() {
  if (this.enrollment.currentEnrollments >= this.enrollment.maxParticipants) {
    return 'full';
  } else if (new Date() > this.enrollment.registrationDeadline) {
    return 'closed';
  } else {
    return 'open';
  }
});

// Method to check if user can enroll
practicalTrainingSchema.methods.canUserEnroll = function(userId) {
  // Check if already enrolled with an active status
  const hasActiveEnrollment = this.participants.some(p =>
    p.userId.toString() === userId.toString() && ['enrolled', 'active'].includes(p.status)
  );
  if (hasActiveEnrollment) return { canEnroll: false, reason: 'Already enrolled' };
  
  // Check capacity
  if (this.enrollment.currentEnrollments >= this.enrollment.maxParticipants) {
    return { canEnroll: false, reason: 'Training is full' };
  }
  
  // Check registration deadline
  if (new Date() > this.enrollment.registrationDeadline) {
    return { canEnroll: false, reason: 'Registration deadline passed' };
  }
  
  // Check status
  if (this.status !== 'registration_open') {
    return { canEnroll: false, reason: 'Registration not open' };
  }
  
  return { canEnroll: true };
};

// Static method to find available trainings
practicalTrainingSchema.statics.findAvailableTrainings = function(filters = {}) {
  const query = {
    status: 'registration_open',
    'enrollment.registrationDeadline': { $gt: new Date() },
    $expr: { $lt: ['$enrollment.currentEnrollments', '$enrollment.maxParticipants'] }
  };
  
  if (filters.category) query.category = filters.category;
  if (filters.level) query.level = filters.level;
  if (filters.location) query['location.type'] = filters.location;
  
  return this.find(query).populate('instructor.staffId', 'name email').sort({ 'schedule.startDate': 1 });
};

module.exports = mongoose.model('PracticalTraining', practicalTrainingSchema);
