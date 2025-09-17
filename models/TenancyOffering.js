const mongoose = require('mongoose');

const TenancyOfferingSchema = new mongoose.Schema({
  // Offering identification
  offeringId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Land and owner information
  landId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandRegistration',
    required: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Register',
    required: true
  },
  
  // Tenancy terms
  leaseDuration: {
    minimumDuration: {
      type: Number,
      required: true,
      min: 1
    },
    maximumDuration: {
      type: Number,
      required: true,
      min: 1
    },
    unit: {
      type: String,
      enum: ['months', 'years'],
      default: 'years'
    }
  },
  
  // Financial terms
  tenancyRate: {
    type: Number,
    required: true,
    min: 0
  },
  rateType: {
    type: String,
    required: true,
    enum: ['per_hectare_per_year', 'per_hectare_per_month', 'per_tree_per_year', 'per_tree_per_month', 'lump_sum']
  },
  paymentTerms: {
    type: String,
    required: true,
    enum: ['monthly', 'quarterly', 'half_yearly', 'annual', 'advance']
  },
  securityDeposit: {
    type: Number,
    min: 0
  },
  
  // Allowed activities and restrictions
  allowedActivities: [{
    type: String,
    enum: ['rubber_tapping', 'latex_collection', 'tree_maintenance', 'fertilizer_application', 'pest_control', 'harvesting']
  }],
  restrictions: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  // Responsibilities
  maintenanceResponsibility: {
    type: String,
    required: true,
    enum: ['owner', 'tenant', 'shared']
  },
  infrastructureProvided: [{
    type: String,
    enum: ['storage_facility', 'processing_equipment', 'transportation', 'accommodation', 'tools_equipment', 'electricity', 'water_supply']
  }],
  
  // Availability and preferences
  availableFrom: {
    type: Date,
    required: true
  },
  availableUntil: {
    type: Date
  },
  preferredTenantType: {
    type: String,
    enum: ['individual', 'company', 'cooperative', 'any'],
    default: 'any'
  },
  minimumExperience: {
    type: String,
    trim: true
  },
  
  // Contract terms
  renewalOption: {
    type: String,
    enum: ['automatic', 'negotiable', 'no_renewal'],
    default: 'negotiable'
  },
  terminationClause: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  additionalTerms: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  
  // Contact information
  contactMethod: {
    type: String,
    enum: ['phone', 'email', 'both'],
    default: 'phone'
  },
  bestTimeToContact: {
    type: String,
    enum: ['morning', 'afternoon', 'evening', 'anytime'],
    default: 'morning'
  },
  showContactDetails: {
    type: Boolean,
    default: true
  },
  
  // Status and metrics
  status: {
    type: String,
    enum: ['available', 'under_negotiation', 'leased', 'expired', 'withdrawn'],
    default: 'available'
  },
  views: {
    type: Number,
    default: 0
  },
  inquiries: {
    type: Number,
    default: 0
  },
  applications: [{
    applicantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Register'
    },
    applicationDate: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'withdrawn'],
      default: 'pending'
    },
    message: {
      type: String,
      trim: true
    }
  }],
  
  // Current tenant (if leased)
  currentTenant: {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Register'
    },
    leaseStartDate: {
      type: Date
    },
    leaseEndDate: {
      type: Date
    },
    contractDetails: {
      type: String,
      trim: true
    }
  },
  
  // Featured and priority
  featured: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  // Notifications sent
  notificationsSent: [{
    type: {
      type: String,
      enum: ['admin', 'tappers', 'brokers', 'workers']
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    recipients: [{
      recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Register'
      },
      status: {
        type: String,
        enum: ['sent', 'delivered', 'read', 'failed'],
        default: 'sent'
      }
    }]
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
TenancyOfferingSchema.index({ landId: 1 });
TenancyOfferingSchema.index({ ownerId: 1 });
TenancyOfferingSchema.index({ status: 1 });
TenancyOfferingSchema.index({ availableFrom: 1 });
TenancyOfferingSchema.index({ tenancyRate: 1 });
TenancyOfferingSchema.index({ 'leaseDuration.minimumDuration': 1 });
TenancyOfferingSchema.index({ featured: 1, priority: 1 });
TenancyOfferingSchema.index({ createdAt: -1 });

// Virtual for land information
TenancyOfferingSchema.virtual('landInfo', {
  ref: 'LandRegistration',
  localField: 'landId',
  foreignField: '_id',
  justOne: true
});

// Virtual for owner information
TenancyOfferingSchema.virtual('ownerInfo', {
  ref: 'Register',
  localField: 'ownerId',
  foreignField: '_id',
  justOne: true
});

// Ensure virtual fields are serialized
TenancyOfferingSchema.set('toJSON', { virtuals: true });
TenancyOfferingSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('TenancyOffering', TenancyOfferingSchema);
