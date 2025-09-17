const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  // Request identification
  requestId: {
    type: String,
    unique: true
  },
  
  // User information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  
  // Service details
  serviceType: {
    type: String,
    enum: ['fertilizer', 'rain_guard'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  
  // Farm information
  farmLocation: {
    type: String,
    required: true
  },
  farmSize: {
    type: String,
    required: true
  },
  numberOfTrees: {
    type: String,
    required: true
  },
  
  // Service specific details
  lastFertilizerDate: {
    type: String
  },
  fertilizerType: {
    type: String,
    enum: ['organic', 'chemical', 'bio-fertilizer'],
    default: 'organic'
  },
  rainGuardType: {
    type: String,
    enum: ['temporary', 'permanent', 'seasonal'],
    default: 'temporary'
  },
  
  // Scheduling and pricing
  urgency: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },
  preferredDate: {
    type: String,
    required: true
  },
  ratePerTree: {
    type: String,
    required: true
  },
  
  // Additional information
  specialRequirements: {
    type: String,
    default: ''
  },
  
  // Contact details
  contactPhone: {
    type: String,
    required: true
  },
  contactEmail: {
    type: String,
    required: true
  },
  
  // Documents
  documents: [{
    name: String,
    url: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Request status and workflow
  status: {
    type: String,
    enum: ['submitted', 'under_review', 'negotiation', 'accepted', 'approved', 'assigned', 'in_progress', 'completed', 'rejected', 'cancelled'],
    default: 'submitted'
  },
  
  // Assigned service provider
  assignedProvider: {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: String,
    contact: String,
    rating: Number,
    experience: String,
    assignedDate: Date
  },
  
  // Field worker who handles the request
  reviewedBy: {
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    workerName: String,
    reviewDate: Date,
    reviewNotes: String
  },
  
  // Timestamps
  submittedDate: {
    type: Date,
    default: Date.now
  },
  approvedDate: {
    type: Date
  },
  completedDate: {
    type: Date
  },
  
  // Estimated cost
  estimatedCost: {
    type: Number
  },
  finalCost: {
    type: Number
  },
  
  // Feedback and rating
  farmerFeedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    feedbackDate: Date
  },
  
  // Notification tracking
  notifications: [{
    type: {
      type: String,
      enum: ['submitted', 'approved', 'assigned', 'completed', 'rejected']
    },
    sentDate: {
      type: Date,
      default: Date.now
    },
    emailSent: {
      type: Boolean,
      default: false
    }
  }]
}, {
  timestamps: true
});

// Generate unique request ID
serviceRequestSchema.pre('save', async function(next) {
  if (!this.requestId) {
    const prefix = this.serviceType === 'fertilizer' ? 'FR' : 'RG';
    const count = await this.constructor.countDocuments({
      serviceType: this.serviceType
    });
    this.requestId = `${prefix}${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

// Index for efficient queries
serviceRequestSchema.index({ userId: 1, status: 1 });
serviceRequestSchema.index({ requestId: 1 });
serviceRequestSchema.index({ status: 1, submittedDate: -1 });

// Negotiation fields
serviceRequestSchema.add({
  negotiation: {
    // last proposal by staff
    staffProposal: {
      numberOfTrees: { type: String },
      ratePerTree: { type: String },
      preferredDate: { type: String },
      notes: { type: String, default: '' },
      proposedAt: { type: Date }
    },
    // last counter by farmer
    farmerCounter: {
      numberOfTrees: { type: String },
      ratePerTree: { type: String },
      preferredDate: { type: String },
      notes: { type: String, default: '' },
      proposedAt: { type: Date }
    },
    // audit
    history: [{
      by: { type: String, enum: ['staff', 'farmer'] },
      numberOfTrees: String,
      ratePerTree: String,
      preferredDate: String,
      notes: String,
      at: { type: Date, default: Date.now }
    }],
    // who needs to respond next
    awaiting: { type: String, enum: ['farmer', 'staff', 'none'], default: 'none' }
  }
});

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
