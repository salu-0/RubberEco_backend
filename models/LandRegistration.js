const mongoose = require('mongoose');

const LandRegistrationSchema = new mongoose.Schema({
  // Registration identification
  registrationId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Owner information
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Register',
    required: true
  },
  ownerName: {
    type: String,
    required: true,
    trim: true
  },
  fatherName: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
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
  address: {
    type: String,
    required: true,
    trim: true
  },
  
  // Land details
  landTitle: {
    type: String,
    required: false,
    trim: true,
    default: ''
  },
  landLocation: {
    type: String,
    required: true,
    trim: true
  },
  district: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    default: 'Kerala',
    trim: true
  },
  pincode: {
    type: String,
    required: true,
    trim: true
  },
  surveyNumber: {
    type: String,
    required: true,
    trim: true
  },
  subDivision: {
    type: String,
    trim: true
  },
  totalArea: {
    type: String,
    required: true,
    trim: true
  },
  landType: {
    type: String,
    required: true,
    enum: ['agricultural', 'residential', 'commercial', 'industrial'],
    default: 'agricultural'
  },
  topography: {
    type: String,
    required: true,
    enum: ['flat', 'hilly', 'sloped', 'mixed'],
    default: 'flat'
  },
  
  // Coordinates
  coordinates: {
    latitude: {
      type: Number,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180
    }
  },
  
  // Infrastructure
  roadAccess: {
    type: String,
    enum: ['yes', 'no', 'partial'],
    default: 'yes'
  },
  electricityAvailable: {
    type: String,
    enum: ['yes', 'no', 'partial'],
    default: 'yes'
  },
  nearestTown: {
    type: String,
    trim: true
  },
  distanceFromTown: {
    type: String,
    trim: true
  },
  
  // Rubber plantation details
  numberOfTrees: {
    type: Number,
    min: 0
  },
  treeAge: {
    type: String,
    trim: true
  },
  currentYield: {
    type: String,
    trim: true
  },
  plantingYear: {
    type: String,
    trim: true
  },
  treeVariety: {
    type: String,
    trim: true
  },
  
  // Legal documents
  documents: [{
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    uploadDate: {
      type: Date,
      default: Date.now
    },
    url: {
      type: String
    }
  }],
  
  // Additional information
  previousCrops: {
    type: String,
    trim: true
  },
  irrigationFacility: {
    type: String,
    enum: ['yes', 'no', 'partial'],
    default: 'no'
  },
  storageCapacity: {
    type: String,
    trim: true
  },
  additionalNotes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  // Status and verification
  status: {
    type: String,
    enum: ['pending_verification', 'verified', 'rejected', 'under_review'],
    default: 'pending_verification'
  },
  verificationDate: {
    type: Date
  },
  verificationComments: {
    type: String,
    trim: true
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Register'
  },
  
  // Tenancy availability
  isAvailableForTenancy: {
    type: Boolean,
    default: false
  },
  tenancyOfferings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TenancyOffering'
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
LandRegistrationSchema.index({ ownerId: 1 });
LandRegistrationSchema.index({ status: 1 });
LandRegistrationSchema.index({ district: 1 });
LandRegistrationSchema.index({ isAvailableForTenancy: 1 });
LandRegistrationSchema.index({ registrationId: 1 });
LandRegistrationSchema.index({ landLocation: 'text', landTitle: 'text' });

// Virtual for owner information
LandRegistrationSchema.virtual('ownerInfo', {
  ref: 'Register',
  localField: 'ownerId',
  foreignField: '_id',
  justOne: true
});

// Ensure virtual fields are serialized
LandRegistrationSchema.set('toJSON', { virtuals: true });
LandRegistrationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LandRegistration', LandRegistrationSchema);
