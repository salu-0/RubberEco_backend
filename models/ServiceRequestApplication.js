const mongoose = require('mongoose');

const serviceRequestApplicationSchema = new mongoose.Schema({
  // Application identification
  applicationId: {
    type: String,
    default: function() {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substr(2, 5);
      return `SRA-${timestamp}-${random}`.toUpperCase();
    }
  },

  // Reference to the tapping request
  tappingRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TappingRequest',
    required: true
  },

  // Staff member applying - can reference either Staff or Register model
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'staffModel',
    required: true
  },
  staffModel: {
    type: String,
    required: true,
    enum: ['Staff', 'Register'],
    default: 'Register'
  },
  staffName: {
    type: String,
    required: true
  },
  staffEmail: {
    type: String,
    required: true
  },
  staffPhone: {
    type: String,
    default: 'Not provided'
  },
  staffRole: {
    type: String,
    required: true
  },

  // Application details - all flexible
  availability: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Staff qualifications for this request (flexible structure)
  experience: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Location and logistics (flexible structure)
  location: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Proposed service details (flexible structure)
  proposedRate: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Application message
  coverLetter: {
    type: String,
    required: true,
    maxlength: 1000
  },
  
  // Why they're suitable for this request
  suitabilityReasons: [{
    type: String,
    maxlength: 200
  }],
  
  // References (optional)
  references: [{
    name: String,
    phone: String,
    email: String,
    relationship: String,
    yearsKnown: Number
  }],
  
  // Application status
  status: {
    type: String,
    enum: ['submitted', 'under_review', 'shortlisted', 'negotiating', 'agreed', 'accepted', 'selected', 'in_progress', 'completed', 'rejected', 'withdrawn'],
    default: 'submitted'
  },

  // Negotiation details
  negotiation: {
    // Initial proposal from staff
    initialProposal: {
      proposedRate: {
        type: Number,
        required: false // Made optional for new applications
      },
      proposedTreeCount: {
        type: Number,
        required: false // Made optional for new applications
      },
      proposedTiming: {
        startDate: String,
        endDate: String,
        preferredTimeSlots: [String],
        workingDays: [String],
        estimatedDuration: String
      },
      notes: String,
      proposedAt: {
        type: Date,
        default: Date.now
      }
    },
    // Current active proposal
    currentProposal: {
      proposedRate: Number,
      proposedTreeCount: Number,
      proposedTiming: {
        startDate: String,
        endDate: String,
        preferredTimeSlots: [String],
        workingDays: [String],
        estimatedDuration: String
      },
      notes: String,
      proposedBy: {
        type: String,
        enum: ['staff', 'farmer'],
        required: false // Made optional for new applications
      },
      proposedAt: {
        type: Date,
        default: Date.now
      }
    },
    // Negotiation history
    history: [{
      proposedRate: Number,
      proposedTreeCount: Number,
      proposedTiming: {
        startDate: String,
        endDate: String,
        preferredTimeSlots: [String],
        workingDays: [String],
        estimatedDuration: String
      },
      notes: String,
      proposedBy: {
        type: String,
        enum: ['staff', 'farmer'],
        required: false // Made optional for new applications
      },
      proposedAt: {
        type: Date,
        default: Date.now
      },
      status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'countered'],
        default: 'pending'
      }
    }],
    // Final agreement
    finalAgreement: {
      agreedRate: Number,
      agreedTreeCount: Number,
      agreedTiming: {
        startDate: String,
        endDate: String,
        preferredTimeSlots: [String],
        workingDays: [String],
        estimatedDuration: String
      },
      agreedAt: Date,
      agreedBy: {
        staff: Boolean,
        farmer: Boolean
      }
    }
  },
  
  // Admin review
  adminReview: {
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Register'
    },
    reviewedAt: Date,
    reviewNotes: String,
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    strengths: [String],
    concerns: [String]
  },
  
  // Selection details (if selected)
  selectionDetails: {
    selectedAt: Date,
    selectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Register'
    },
    finalRate: {
      rateType: String,
      amount: Number
    },
    startDate: Date,
    estimatedDuration: String,
    specialInstructions: String
  },
  
  // Communication history
  communications: [{
    type: {
      type: String,
      enum: ['admin_message', 'staff_message', 'system_notification']
    },
    message: String,
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Register'
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    isRead: {
      type: Boolean,
      default: false
    }
  }],
  
  // Timestamps
  submittedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Metadata
  applicationSource: {
    type: String,
    enum: ['staff_dashboard', 'mobile_app', 'notification', 'direct_invite'],
    default: 'staff_dashboard'
  },
  
  // Priority score (calculated by system)
  priorityScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
serviceRequestApplicationSchema.index({ tappingRequestId: 1, staffId: 1 }, { unique: true }); // Prevent duplicate applications
serviceRequestApplicationSchema.index({ tappingRequestId: 1, status: 1 });
serviceRequestApplicationSchema.index({ staffId: 1, status: 1 });
serviceRequestApplicationSchema.index({ status: 1, submittedAt: -1 });
serviceRequestApplicationSchema.index({ priorityScore: -1 });
serviceRequestApplicationSchema.index({ 'location.distanceFromFarm': 1 });

// Generate unique application ID before saving
serviceRequestApplicationSchema.pre('save', function(next) {
  if (!this.applicationId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    this.applicationId = `SRA-${timestamp}-${random}`.toUpperCase();
  }
  this.updatedAt = new Date();
  next();
});

// Calculate priority score based on various factors
serviceRequestApplicationSchema.methods.calculatePriorityScore = function() {
  let score = 50; // Default base score

  try {
    // Experience factor (0-30 points)
    const yearsExp = this.experience?.yearsOfExperience ||
                     (typeof this.experience === 'string' ? 2 : 2);
    score += Math.min(yearsExp * 3, 30);

    // Distance factor (0-25 points) - closer is better
    const distance = this.location?.distanceFromFarm || 20;
    const maxDistance = 50; // km
    const distanceScore = Math.max(0, 25 - (distance / maxDistance) * 25);
    score += distanceScore;

    // Rate competitiveness (0-20 points) - lower rate gets higher score
    const avgRate = 60; // Assume average market rate
    const proposedAmount = this.proposedRate?.amount ||
                          (typeof this.proposedRate === 'number' ? this.proposedRate : avgRate);
    if (proposedAmount <= avgRate * 0.8) score += 20;
    else if (proposedAmount <= avgRate * 0.9) score += 15;
    else if (proposedAmount <= avgRate) score += 10;
    else if (proposedAmount <= avgRate * 1.1) score += 5;

    // Application quality (0-10 points)
    if (this.coverLetter && this.coverLetter.length > 100) score += 5;
    if (this.suitabilityReasons && this.suitabilityReasons.length > 0) score += 3;
    if (this.references && this.references.length > 0) score += 2;

  } catch (error) {
    console.log('Error calculating priority score:', error.message);
    score = 50; // Default score if calculation fails
  }

  this.priorityScore = Math.round(Math.min(score, 100));
  return this.priorityScore;
};

// Static method to get applications for a specific request
serviceRequestApplicationSchema.statics.getApplicationsForRequest = function(requestId, status = null) {
  const query = { tappingRequestId: requestId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('staffId', 'name email phone role department location')
    .sort({ priorityScore: -1, submittedAt: 1 });
};

// Static method to get staff's applications
serviceRequestApplicationSchema.statics.getStaffApplications = function(staffId, status = null) {
  const query = { staffId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('tappingRequestId')
    .sort({ submittedAt: -1 });
};

// Instance method to withdraw application
serviceRequestApplicationSchema.methods.withdraw = function() {
  this.status = 'withdrawn';
  this.updatedAt = new Date();
  return this.save();
};

// Instance method to select this application
serviceRequestApplicationSchema.methods.select = function(adminId, finalRate, startDate, instructions = '') {
  this.status = 'selected';
  this.selectionDetails = {
    selectedAt: new Date(),
    selectedBy: adminId,
    finalRate,
    startDate,
    specialInstructions: instructions
  };
  this.updatedAt = new Date();
  return this.save();
};

// Instance method to submit initial proposal
serviceRequestApplicationSchema.methods.submitInitialProposal = function(proposedRate, proposedTreeCount, proposedTiming = {}, notes = '') {
  this.negotiation.initialProposal = {
    proposedRate,
    proposedTreeCount,
    proposedTiming,
    notes,
    proposedAt: new Date()
  };
  this.negotiation.currentProposal = {
    proposedRate,
    proposedTreeCount,
    proposedTiming,
    notes,
    proposedBy: 'staff',
    proposedAt: new Date()
  };
  this.negotiation.history.push({
    proposedRate,
    proposedTreeCount,
    proposedTiming,
    notes,
    proposedBy: 'staff',
    proposedAt: new Date(),
    status: 'pending'
  });
  this.status = 'negotiating';
  this.updatedAt = new Date();
  return this.save();
};

// Instance method to submit counter proposal
serviceRequestApplicationSchema.methods.submitCounterProposal = function(proposedRate, proposedTreeCount, proposedTiming = {}, notes = '', proposedBy) {
  // Mark previous proposal as countered
  if (this.negotiation.history.length > 0) {
    this.negotiation.history[this.negotiation.history.length - 1].status = 'countered';
  }
  
  // Add new proposal to history
  this.negotiation.history.push({
    proposedRate,
    proposedTreeCount,
    proposedTiming,
    notes,
    proposedBy,
    proposedAt: new Date(),
    status: 'pending'
  });
  
  // Update current proposal
  this.negotiation.currentProposal = {
    proposedRate,
    proposedTreeCount,
    proposedTiming,
    notes,
    proposedBy,
    proposedAt: new Date()
  };
  
  this.updatedAt = new Date();
  return this.save();
};

// Instance method to accept proposal
serviceRequestApplicationSchema.methods.acceptProposal = function(acceptedBy) {
  const currentProposal = this.negotiation.currentProposal;
  
  // Mark current proposal as accepted
  if (this.negotiation.history.length > 0) {
    this.negotiation.history[this.negotiation.history.length - 1].status = 'accepted';
  }
  
  // Update final agreement
  this.negotiation.finalAgreement = {
    agreedRate: currentProposal.proposedRate,
    agreedTreeCount: currentProposal.proposedTreeCount,
    agreedTiming: currentProposal.proposedTiming,
    agreedAt: new Date(),
    agreedBy: {
      staff: acceptedBy === 'staff',
      farmer: acceptedBy === 'farmer'
    }
  };
  
  this.status = 'accepted';
  this.updatedAt = new Date();
  return this.save();
};

// Instance method to reject proposal
serviceRequestApplicationSchema.methods.rejectProposal = function(rejectedBy) {
  // Mark current proposal as rejected
  if (this.negotiation.history.length > 0) {
    this.negotiation.history[this.negotiation.history.length - 1].status = 'rejected';
  }
  
  this.updatedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('ServiceRequestApplication', serviceRequestApplicationSchema);
