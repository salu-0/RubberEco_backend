const mongoose = require('mongoose');

const BidSchema = new mongoose.Schema({
  lotId: {
    type: String,
    required: true,
    trim: true
  },
  bidderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Register',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  comment: {
    type: String,
    trim: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['active', 'withdrawn', 'cancelled', 'rejected', 'won', 'lost', 'expired'],
    default: 'active'
  },
  bidType: {
    type: String,
    enum: ['initial', 'counter', 'final'],
    default: 'initial'
  },
  isWinning: {
    type: Boolean,
    default: false
  },
  rank: {
    type: Number,
    min: 1
  },
  bidHistory: [{
    amount: {
      type: Number,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    comment: {
      type: String,
      trim: true
    }
  }],
  notifications: {
    outbidNotified: {
      type: Boolean,
      default: false
    },
    winningNotified: {
      type: Boolean,
      default: false
    },
    resultNotified: {
      type: Boolean,
      default: false
    }
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    deviceInfo: String
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
BidSchema.index({ lotId: 1, bidderId: 1 }, { unique: true }); // One bid per user per lot
BidSchema.index({ lotId: 1, amount: -1 }); // For finding highest bids
BidSchema.index({ bidderId: 1, createdAt: -1 }); // For user's bid history
BidSchema.index({ status: 1 });
BidSchema.index({ createdAt: -1 });

// Virtual for bid age
BidSchema.virtual('bidAge').get(function() {
  const now = new Date();
  const bidTime = new Date(this.createdAt);
  const diffTime = now - bidTime;
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return 'Just now';
});

// Virtual for formatted amount
BidSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(this.amount);
});

// Pre-save middleware
BidSchema.pre('save', async function(next) {
  try {
    // If this is a new bid or amount is being updated
    if (this.isNew || this.isModified('amount')) {
      // Add to bid history
      if (this.isModified('amount') && !this.isNew) {
        this.bidHistory.push({
          amount: this.amount,
          timestamp: new Date(),
          comment: this.comment
        });
      }
      
      // Validate bid amount against tree lot minimum price
      const TreeLot = mongoose.model('TreeLot');
      const treeLot = await TreeLot.findOne({ lotId: this.lotId });
      
      if (!treeLot) {
        return next(new Error('Tree lot not found'));
      }
      
      if (this.amount < treeLot.minimumPrice) {
        return next(new Error(`Bid amount must be at least ₹${treeLot.minimumPrice.toLocaleString()}`));
      }
      
      // Check if bidding is still active
      if (!treeLot.canBid()) {
        return next(new Error('Bidding is not active for this lot'));
      }
      
      // Find current highest bid (excluding this bid if it's an update)
      const query = { 
        lotId: this.lotId, 
        status: 'active'
      };
      
      if (!this.isNew) {
        query._id = { $ne: this._id };
      }
      
      const currentHighestBid = await this.constructor.findOne(query).sort({ amount: -1 });
      
      // Validate bid amount against current highest bid
      if (currentHighestBid && this.amount <= currentHighestBid.amount) {
        const minimumBid = currentHighestBid.amount + 1000;
        return next(new Error(`Bid amount must be higher than current highest bid. Minimum: ₹${minimumBid.toLocaleString()}`));
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Post-save middleware to update bid rankings
BidSchema.post('save', async function(doc) {
  try {
    await updateBidRankings(doc.lotId);
  } catch (error) {
    console.error('Error updating bid rankings:', error);
  }
});

// Instance methods
BidSchema.methods.withdraw = function() {
  this.status = 'withdrawn';
  return this.save();
};

BidSchema.methods.isActive = function() {
  return this.status === 'active';
};

BidSchema.methods.canModify = async function() {
  const TreeLot = mongoose.model('TreeLot');
  const treeLot = await TreeLot.findOne({ lotId: this.lotId });
  return treeLot && treeLot.canBid() && this.isActive();
};

BidSchema.methods.updateAmount = async function(newAmount, comment) {
  if (!(await this.canModify())) {
    throw new Error('Cannot modify this bid');
  }
  
  this.amount = newAmount;
  if (comment) this.comment = comment;
  
  return this.save();
};

// Static methods
BidSchema.statics.findByLot = function(lotId) {
  return this.find({ lotId, status: 'active' }).sort({ amount: -1 });
};

BidSchema.statics.findByBidder = function(bidderId) {
  return this.find({ bidderId }).sort({ createdAt: -1 });
};

BidSchema.statics.findHighestBid = function(lotId) {
  return this.findOne({ lotId, status: 'active' }).sort({ amount: -1 });
};

BidSchema.statics.getBidHistory = function(lotId) {
  return this.find({ lotId })
    .populate('bidderId', 'name')
    .sort({ amount: -1 });
};

BidSchema.statics.getBidderStats = async function(bidderId) {
  const stats = await this.aggregate([
    { $match: { bidderId: mongoose.Types.ObjectId(bidderId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' }
      }
    }
  ]);
  
  return stats.reduce((acc, stat) => {
    acc[stat._id] = {
      count: stat.count,
      totalAmount: stat.totalAmount,
      avgAmount: stat.avgAmount
    };
    return acc;
  }, {});
};

// Helper function to update bid rankings
async function updateBidRankings(lotId) {
  const Bid = mongoose.model('Bid');
  const bids = await Bid.find({ lotId, status: 'active' }).sort({ amount: -1 });
  
  // Update rankings and winning status
  for (let i = 0; i < bids.length; i++) {
    const bid = bids[i];
    bid.rank = i + 1;
    bid.isWinning = i === 0;
    
    // Save without triggering middleware
    await Bid.updateOne(
      { _id: bid._id },
      { 
        rank: bid.rank, 
        isWinning: bid.isWinning 
      }
    );
  }
}

// Method to finalize bidding for a lot
BidSchema.statics.finalizeBidding = async function(lotId) {
  const bids = await this.find({ lotId, status: 'active' }).sort({ amount: -1 });
  
  if (bids.length === 0) return null;
  
  // Mark winner
  const winningBid = bids[0];
  winningBid.status = 'won';
  await winningBid.save();
  
  // Mark losers
  for (let i = 1; i < bids.length; i++) {
    bids[i].status = 'lost';
    await bids[i].save();
  }
  
  return winningBid;
};

// Ensure virtual fields are serialized
BidSchema.set('toJSON', { virtuals: true });
BidSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Bid', BidSchema);
