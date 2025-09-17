const mongoose = require('mongoose');

const TreeLotSchema = new mongoose.Schema({
  lotId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Register',
    required: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
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
  numberOfTrees: {
    type: Number,
    required: true,
    min: 1
  },
  approximateYield: {
    type: String,
    required: true,
    trim: true
  },
  minimumPrice: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  images: [{
    type: String,
    trim: true
  }],
  biddingStartDate: {
    type: Date,
    default: Date.now
  },
  biddingEndDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(value) {
        // Handle both save() and findOneAndUpdate()/update() contexts
        if (this instanceof mongoose.Query) {
          const update = this.getUpdate ? this.getUpdate() : {};
          const start = (update && (update.biddingStartDate || (update.$set && update.$set.biddingStartDate))) || null;
          // If start date isn't part of the update, assume existing start is valid and skip check
          if (!start) return true;
          return new Date(value) > new Date(start);
        }
        return value > this.biddingStartDate;
      },
      message: 'Bidding end date must be after start date'
    }
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'closed', 'cancelled', 'sold'],
    default: 'active'
  },
  treeAge: {
    type: Number,
    min: 0
  },
  tappingSchedule: {
    type: String,
    trim: true
  },
  accessibility: {
    roadAccess: {
      type: Boolean,
      default: true
    },
    truckAccess: {
      type: Boolean,
      default: true
    },
    description: {
      type: String,
      trim: true
    }
  },
  soilType: {
    type: String,
    trim: true
  },
  rainfall: {
    type: String,
    trim: true
  },
  previousYield: [{
    year: Number,
    yield: String,
    notes: String
  }],
  certifications: [{
    type: String,
    trim: true
  }],
  additionalInfo: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  viewCount: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
TreeLotSchema.index({ status: 1, biddingEndDate: 1 });
TreeLotSchema.index({ farmerId: 1 });
TreeLotSchema.index({ location: 'text', description: 'text' });
TreeLotSchema.index({ minimumPrice: 1 });
TreeLotSchema.index({ numberOfTrees: 1 });
TreeLotSchema.index({ createdAt: -1 });

// Virtual for farmer information
TreeLotSchema.virtual('farmerInfo', {
  ref: 'Register',
  localField: 'farmerId',
  foreignField: '_id',
  justOne: true
});

// Virtual for current highest bid
TreeLotSchema.virtual('currentHighestBid').get(function() {
  // This will be populated by the application logic
  return this._currentHighestBid || this.minimumPrice;
});

// Virtual for bid count
TreeLotSchema.virtual('bidCount').get(function() {
  // This will be populated by the application logic
  return this._bidCount || 0;
});

// Virtual for days remaining
TreeLotSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const endDate = new Date(this.biddingEndDate);
  const diffTime = endDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

// Virtual for bidding status
TreeLotSchema.virtual('biddingStatus').get(function() {
  const now = new Date();
  const startDate = new Date(this.biddingStartDate);
  const endDate = new Date(this.biddingEndDate);
  
  if (now < startDate) return 'upcoming';
  if (now > endDate) return 'ended';
  return 'active';
});

// Pre-save middleware
TreeLotSchema.pre('save', function(next) {
  // Ensure bidding end date is in the future for new lots
  if (this.isNew && this.biddingEndDate <= new Date()) {
    const error = new Error('Bidding end date must be in the future');
    return next(error);
  }
  
  // Auto-generate lot ID if not provided
  if (this.isNew && !this.lotId) {
    // This should be handled by the application logic to ensure uniqueness
    this.lotId = `RT${Date.now()}`;
  }
  
  next();
});

// Instance methods
TreeLotSchema.methods.isActive = function() {
  const now = new Date();
  return this.status === 'active' && 
         now >= this.biddingStartDate && 
         now <= this.biddingEndDate;
};

TreeLotSchema.methods.canBid = function() {
  return this.isActive() && this.status === 'active';
};

TreeLotSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

// Static methods
TreeLotSchema.statics.findActive = function() {
  return this.find({
    status: 'active',
    biddingEndDate: { $gt: new Date() }
  });
};

TreeLotSchema.statics.findByFarmer = function(farmerId) {
  return this.find({ farmerId });
};

TreeLotSchema.statics.findByLocation = function(location) {
  return this.find({
    location: { $regex: location, $options: 'i' },
    status: 'active',
    biddingEndDate: { $gt: new Date() }
  });
};

// Ensure virtual fields are serialized
TreeLotSchema.set('toJSON', { virtuals: true });
TreeLotSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('TreeLot', TreeLotSchema);
