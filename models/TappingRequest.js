const mongoose = require('mongoose');

// Ensure Register model is loaded
require('./Register');

const tappingRequestSchema = new mongoose.Schema({
  // Request identification
  requestId: {
    type: String,
    required: true,
    unique: true
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
  
  // Farm details
  farmLocation: {
    type: String,
    required: true
  },
  farmSize: {
    type: String,
    required: true
  },
  // Tree count negotiation workflow
  farmerEstimatedTrees: {
    type: Number,
    required: true
  },
  tapperProposedTrees: {
    type: Number,
    default: null
  },
  farmerCounterProposal: {
    type: Number,
    default: null
  },
  tapperCounterProposal: {
    type: Number,
    default: null
  },
  finalAgreedTrees: {
    type: Number,
    default: null
  },
  treeCountStatus: {
    type: String,
    enum: [
      'farmer_submitted',           // Farmer created request
      'tapper_proposed',           // Tapper proposed different count
      'farmer_counter_proposed',   // Farmer made counter proposal
      'tapper_counter_proposed',   // Tapper made counter proposal
      'both_agreed',              // Both agreed on same count
      'negotiating'               // Active negotiation
    ],
    default: 'farmer_submitted'
  },
  negotiationHistory: [{
    proposedBy: {
      type: String,
      enum: ['farmer', 'tapper']
    },
    proposedCount: Number,
    notes: String,
    proposedAt: {
      type: Date,
      default: Date.now
    }
  }],
  treeCountNotes: {
    farmerNotes: String,
    tapperNotes: String,
    agreementDate: Date
  },
  soilType: {
    type: String
  },
  
  // Tapping details
  tappingType: {
    type: String,
    required: true,
    enum: ['daily', 'alternate_day', 'weekly', 'slaughter', 'custom']
  },
  startDate: {
    type: Date,
    required: true
  },
  duration: {
    type: String,
    required: false
  },
  preferredTime: {
    type: String,
    required: true,
    enum: ['early_morning', 'morning', 'afternoon', 'evening']
  },
  
  // Request details
  urgency: {
    type: String,
    required: true,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },
  budgetRange: {
    type: String
  },
  budgetPerTree: {
    type: Number,
    min: 0
  },
  specialRequirements: {
    type: String
  },
  contactPreference: {
    type: String,
    required: true,
    enum: ['phone', 'whatsapp', 'email', 'visit']
  },
  
  // Documents
  documents: [{
    name: String,
    url: String,
    type: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Request status
  status: {
    type: String,
    required: true,
    enum: ['submitted', 'under_review', 'negotiating', 'assigned', 'tapper_inspecting', 'tree_count_pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'rejected'],
    default: 'submitted'
  },
  
  // Assignment details
  assignedTapper: {
    tapperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff'
    },
    tapperName: String,
    tapperPhone: String,
    tapperEmail: String,
    assignedAt: Date,
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Register'
    }
  },
  
  // Service details
  serviceDetails: {
    estimatedCost: String,
    actualCost: String,
    startedAt: Date,
    completedAt: Date,
    notes: String
  },
  
  // Admin notes and actions
  adminNotes: [{
    note: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Register'
    },
    addedAt: {
      type: Date,
      default: Date.now
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
  
  // Notification tracking
  notificationSent: {
    type: Boolean,
    default: false
  },
  emailNotificationSent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  strict: true // Only allow fields defined in schema
});

// Indexes for better query performance
tappingRequestSchema.index({ farmerId: 1 });
tappingRequestSchema.index({ status: 1 });
tappingRequestSchema.index({ submittedAt: -1 });
tappingRequestSchema.index({ requestId: 1 });
tappingRequestSchema.index({ 'assignedTapper.tapperId': 1 });

// Pre-save middleware to update the updatedAt field
tappingRequestSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Generate request ID using atomic counter to avoid duplicates (before validation)
tappingRequestSchema.pre('validate', async function(next) {
  try {
    if (this.isNew && !this.requestId) {
      const db = this.constructor.db;
      const counters = db.collection('counters');
      const result = await counters.findOneAndUpdate(
        { _id: 'tapping_request' },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' }
      );
      const seq = result.value?.seq || 1;
      this.requestId = `TR${String(seq).padStart(6, '0')}`;
      console.log('✅ Generated requestId (atomic):', this.requestId);
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Virtual for formatted submission date
tappingRequestSchema.virtual('formattedSubmittedAt').get(function() {
  if (!this.submittedAt) return 'N/A';
  return this.submittedAt.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Virtual for days since submission
tappingRequestSchema.virtual('daysSinceSubmission').get(function() {
  if (!this.submittedAt) return 0;
  const now = new Date();
  const diffTime = Math.abs(now - this.submittedAt);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Method to check if request is overdue
tappingRequestSchema.methods.isOverdue = function() {
  if (!this.submittedAt) return false;
  const now = new Date();
  const daysSince = Math.ceil((now - this.submittedAt) / (1000 * 60 * 60 * 24));
  
  // Consider high priority requests overdue after 1 day, normal after 3 days
  if (this.urgency === 'high' && daysSince > 1) return true;
  if (this.urgency === 'normal' && daysSince > 3) return true;
  if (this.urgency === 'low' && daysSince > 7) return true;
  
  return false;
};

// Method to get status color
tappingRequestSchema.methods.getStatusColor = function() {
  const colors = {
    submitted: 'blue',
    under_review: 'yellow',
    negotiating: 'orange',
    assigned: 'purple',
    tapper_inspecting: 'orange',
    tree_count_pending: 'amber',
    in_progress: 'orange',
    completed: 'green',
    cancelled: 'gray',
    rejected: 'red'
  };
  return colors[this.status] || 'gray';
};

// Method for tapper to propose tree count
tappingRequestSchema.methods.tapperProposeTreeCount = function(proposedCount, notes) {
  // Add to negotiation history
  this.negotiationHistory.push({
    proposedBy: 'tapper',
    proposedCount: proposedCount,
    notes: notes
  });

  this.tapperProposedTrees = proposedCount;
  this.treeCountNotes.tapperNotes = notes;

  if (proposedCount === this.farmerEstimatedTrees) {
    // Both agree - auto approve
    this.finalAgreedTrees = proposedCount;
    this.treeCountStatus = 'both_agreed';
    this.treeCountNotes.agreementDate = new Date();
    this.status = 'accepted';
  } else {
    // Counts differ - start negotiation
    this.treeCountStatus = 'tapper_proposed';
    this.status = 'tree_count_pending';
  }

  return this.save();
};

// Method for farmer to counter-propose tree count
tappingRequestSchema.methods.farmerCounterPropose = function(proposedCount, notes) {
  // Add to negotiation history
  this.negotiationHistory.push({
    proposedBy: 'farmer',
    proposedCount: proposedCount,
    notes: notes
  });

  this.farmerCounterProposal = proposedCount;
  this.treeCountNotes.farmerNotes = notes;

  // Check if farmer's counter matches tapper's latest proposal
  const latestTapperProposal = this.tapperCounterProposal || this.tapperProposedTrees;

  if (proposedCount === latestTapperProposal) {
    // Both agree - finalize
    this.finalAgreedTrees = proposedCount;
    this.treeCountStatus = 'both_agreed';
    this.treeCountNotes.agreementDate = new Date();
    this.status = 'accepted';
  } else {
    // Continue negotiation
    this.treeCountStatus = 'farmer_counter_proposed';
    this.status = 'tree_count_pending';
  }

  return this.save();
};

// Method for tapper to counter-propose tree count
tappingRequestSchema.methods.tapperCounterPropose = function(proposedCount, notes) {
  // Add to negotiation history
  this.negotiationHistory.push({
    proposedBy: 'tapper',
    proposedCount: proposedCount,
    notes: notes
  });

  this.tapperCounterProposal = proposedCount;
  this.treeCountNotes.tapperNotes = notes;

  // Check if tapper's counter matches farmer's latest proposal
  const latestFarmerProposal = this.farmerCounterProposal || this.farmerEstimatedTrees;

  if (proposedCount === latestFarmerProposal) {
    // Both agree - finalize
    this.finalAgreedTrees = proposedCount;
    this.treeCountStatus = 'both_agreed';
    this.treeCountNotes.agreementDate = new Date();
    this.status = 'accepted';
  } else {
    // Continue negotiation
    this.treeCountStatus = 'tapper_counter_proposed';
    this.status = 'tree_count_pending';
  }

  return this.save();
};

// Method to accept the other party's proposal
tappingRequestSchema.methods.acceptProposal = function(acceptedBy, notes) {
  let agreedCount;

  if (acceptedBy === 'farmer') {
    // Farmer accepts tapper's latest proposal
    agreedCount = this.tapperCounterProposal || this.tapperProposedTrees;
    this.treeCountNotes.farmerNotes = notes;
  } else if (acceptedBy === 'tapper') {
    // Tapper accepts farmer's latest proposal
    agreedCount = this.farmerCounterProposal || this.farmerEstimatedTrees;
    this.treeCountNotes.tapperNotes = notes;
  }

  if (agreedCount) {
    this.finalAgreedTrees = agreedCount;
    this.treeCountStatus = 'both_agreed';
    this.treeCountNotes.agreementDate = new Date();
    this.status = 'accepted';

    // Add acceptance to history
    this.negotiationHistory.push({
      proposedBy: acceptedBy,
      proposedCount: agreedCount,
      notes: `Accepted proposal: ${notes || 'No additional notes'}`
    });
  }

  return this.save();
};

// Method to check if user can view this request (role-based access)
tappingRequestSchema.methods.canUserView = function(userRole) {
  // Only tapper staff can see tapping requests
  const allowedRoles = ['tapper', 'admin', 'supervisor'];
  return allowedRoles.includes(userRole);
};

// Static method to get requests by farmer
tappingRequestSchema.statics.getByFarmer = function(farmerId) {
  return this.find({ farmerId }).sort({ submittedAt: -1 });
};

// Static method to get pending requests for admin
tappingRequestSchema.statics.getPendingRequests = function() {
  return this.find({ 
    status: { $in: ['submitted', 'under_review'] } 
  }).sort({ urgency: -1, submittedAt: 1 });
};

// Static method to get requests by status
tappingRequestSchema.statics.getByStatus = function(status) {
  return this.find({ status }).sort({ submittedAt: -1 });
};

// Ensure virtual fields are serialized
tappingRequestSchema.set('toJSON', { virtuals: true });
tappingRequestSchema.set('toObject', { virtuals: true });

const TappingRequest = mongoose.model('TappingRequest', tappingRequestSchema, 'tapping_request');

module.exports = TappingRequest;
