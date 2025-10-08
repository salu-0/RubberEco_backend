const express = require('express');
const router = express.Router();
const Bid = require('../models/Bid');
const TreeLot = require('../models/TreeLot');
const BidAlert = require('../models/BidAlert');
const { protect, authorize } = require('../middlewares/auth');
const { sendOutbidNotificationEmail } = require('../utils/emailService');

// @route   POST /api/bids
// @desc    Place a new bid
// @access  Private (Broker only)
router.post('/', protect, async (req, res) => {
  try {
    const { lotId, amount, comment } = req.body;

    // Validate required fields
    if (!lotId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Lot ID and bid amount are required'
      });
    }

    // Check if tree lot exists and is active
    const treeLot = await TreeLot.findOne({ lotId: lotId });
    if (!treeLot) {
      return res.status(404).json({
        success: false,
        message: 'Tree lot not found'
      });
    }

    if (treeLot.status !== 'active' || new Date() > treeLot.biddingEndDate) {
      return res.status(400).json({
        success: false,
        message: 'Bidding is closed for this lot'
      });
    }

    // Check if bid amount is valid
    const currentHighestBid = await Bid.findOne({ 
      lotId, 
      status: 'active' 
    }).sort({ amount: -1 });

    const minimumBidAmount = currentHighestBid 
      ? currentHighestBid.amount + 1000 
      : treeLot.minimumPrice;

    if (amount < minimumBidAmount) {
      return res.status(400).json({
        success: false,
        message: `Bid amount must be at least ₹${minimumBidAmount.toLocaleString()}`
      });
    }

    // Check if user already has an active bid on this lot
    const existingBid = await Bid.findOne({
      lotId,
      bidderId: req.user.id,
      status: 'active'
    });

    if (existingBid) {
      // Update existing bid
      const beforeSaveHighest = await Bid.findOne({ lotId, status: 'active' }).sort({ amount: -1 });

      existingBid.amount = amount;
      existingBid.comment = comment || '';
      existingBid.updatedAt = new Date();
      await existingBid.save();

      // If this update becomes highest, notify previous highest bidder
      const afterSaveHighest = await Bid.findOne({ lotId, status: 'active' }).sort({ amount: -1 });
      if (afterSaveHighest && beforeSaveHighest && String(afterSaveHighest._id) !== String(beforeSaveHighest._id)) {
        if (String(beforeSaveHighest.bidderId) !== String(req.user.id)) {
          sendOutbidNotificationEmail({
            lotId,
            previousBidderId: beforeSaveHighest.bidderId,
            previousAmount: beforeSaveHighest.amount,
            newAmount: afterSaveHighest.amount
          });
        }
      }

      res.json({
        success: true,
        message: 'Bid updated successfully',
        data: existingBid
      });
    } else {
      // Create new bid
      const newBid = new Bid({
        lotId,
        bidderId: req.user.id,
        amount: parseInt(amount),
        comment: comment || '',
        status: 'active'
      });

      const beforeSaveHighest = await Bid.findOne({ lotId, status: 'active' }).sort({ amount: -1 });

      await newBid.save();

      // If this new bid becomes highest, notify previous highest bidder
      const afterSaveHighest = await Bid.findOne({ lotId, status: 'active' }).sort({ amount: -1 });
      if (afterSaveHighest && beforeSaveHighest && String(afterSaveHighest._id) !== String(beforeSaveHighest._id)) {
        if (String(beforeSaveHighest.bidderId) !== String(req.user.id)) {
          sendOutbidNotificationEmail({
            lotId,
            previousBidderId: beforeSaveHighest.bidderId,
            previousAmount: beforeSaveHighest.amount,
            newAmount: afterSaveHighest.amount
          });
        }
      }

      res.status(201).json({
        success: true,
        message: 'Bid placed successfully',
        data: newBid
      });
    }

  } catch (error) {
    console.error('Error placing bid:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while placing bid'
    });
  }
});

// @route   GET /api/bids/my-bids
// @desc    Get broker's bids
// @access  Private (Broker only)
router.get('/my-bids', protect, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    let query = { bidderId: req.user.id };
    
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const bids = await Bid.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Bid.countDocuments(query);

    // Process bids to include lot information and current status
    const processedBids = await Promise.all(
      bids.map(async (bid) => {
        // Fetch the tree lot data using the string lotId
        const treeLot = await TreeLot.findOne({ lotId: bid.lotId })
          .populate('farmerId', 'name email phone firstName');
        
        if (!treeLot) {
          // Skip this bid if tree lot not found
          return null;
        }
        
        // Debug logging
        console.log(`Debug - Lot ${bid.lotId}:`, {
          farmerId: treeLot.farmerId,
          farmerName: treeLot.farmerId?.name,
          farmerFirstName: treeLot.farmerId?.firstName,
          location: treeLot.location,
          numberOfTrees: treeLot.numberOfTrees,
          approximateYield: treeLot.approximateYield
        });
        
        // Get current highest bid
        const currentHighestBid = await Bid.findOne({
          lotId: treeLot.lotId,
          status: 'active'
        }).sort({ amount: -1 });

        // Determine bid status
        let bidStatus = 'active';
        if (new Date() > treeLot.biddingEndDate) {
          if (currentHighestBid && currentHighestBid.bidderId.toString() === req.user.id) {
            bidStatus = 'won';
          } else {
            bidStatus = 'lost';
          }
        } else if (currentHighestBid && currentHighestBid.bidderId.toString() !== req.user.id) {
          bidStatus = 'outbid';
        } else if (currentHighestBid && currentHighestBid.bidderId.toString() === req.user.id) {
          bidStatus = 'winning';
        }

        return {
          id: bid._id,
          lotId: treeLot.lotId || treeLot._id,
          lotInfo: {
            farmerName: treeLot.farmerId?.name || treeLot.farmerId?.firstName || 'Unknown',
            farmerEmail: treeLot.farmerId?.email || '',
            farmerPhone: treeLot.farmerId?.phone || '',
            location: treeLot.location || 'N/A',
            numberOfTrees: treeLot.numberOfTrees || 0,
            approximateYield: treeLot.approximateYield || 'N/A',
            image: treeLot.images?.[0] || null
          },
          myBidAmount: bid.amount || 0,
          currentHighestBid: currentHighestBid ? (currentHighestBid.amount || 0) : (treeLot.minimumPrice || 0),
          minimumPrice: treeLot.minimumPrice || 0,
          status: bidStatus,
          bidTime: bid.createdAt || new Date(),
          biddingEndDate: treeLot.biddingEndDate || new Date(),
          comment: bid.comment
        };
      })
    );

    // Filter out null results
    const validBids = processedBids.filter(bid => bid !== null);

    res.json({
      success: true,
      data: validBids,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Error fetching my bids:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching bids'
    });
  }
});

// @route   GET /api/bids/history
// @desc    Get broker's bid history
// @access  Private (Broker only)
router.get('/history', protect, async (req, res) => {
  try {
    const { 
      status, 
      dateRange, 
      minAmount, 
      maxAmount, 
      sortBy = 'newest',
      page = 1, 
      limit = 10 
    } = req.query;

    let query = { bidderId: req.user.id };
    
    if (status && status !== 'all') {
      query.status = status;
    }

    // Add lotId filter if provided
    if (req.query.lotId) {
      query.lotId = req.query.lotId;
    }

    // Add amount filters
    if (minAmount) {
      query.amount = { ...query.amount, $gte: parseFloat(minAmount) };
    }
    if (maxAmount) {
      query.amount = { ...query.amount, $lte: parseFloat(maxAmount) };
    }

    // Add date range filter
    if (dateRange) {
      const [startDate, endDate] = dateRange.split(',');
      if (startDate && endDate) {
        query.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
    }

    const skip = (page - 1) * limit;

    // Determine sort order
    let sortOrder = { createdAt: -1 };
    switch (sortBy) {
      case 'oldest':
        sortOrder = { createdAt: 1 };
        break;
      case 'amount':
        sortOrder = { amount: -1 };
        break;
      case 'status':
        sortOrder = { status: 1, createdAt: -1 };
        break;
      default:
        sortOrder = { createdAt: -1 };
    }

    const bids = await Bid.find(query)
      .sort(sortOrder)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Bid.countDocuments(query);

    // Process bids to include lot information and current status
    const processedBids = await Promise.all(
      bids.map(async (bid) => {
        // Fetch the tree lot data using the string lotId
        const treeLot = await TreeLot.findOne({ lotId: bid.lotId })
          .populate('farmerId', 'name email phone firstName');
        
        if (!treeLot) {
          // Skip this bid if tree lot not found
          return null;
        }
        
        // Debug logging
        console.log(`Debug - Lot ${bid.lotId}:`, {
          farmerId: treeLot.farmerId,
          farmerName: treeLot.farmerId?.name,
          farmerFirstName: treeLot.farmerId?.firstName,
          location: treeLot.location,
          numberOfTrees: treeLot.numberOfTrees,
          approximateYield: treeLot.approximateYield
        });
        
        // Get current highest bid
        const currentHighestBid = await Bid.findOne({
          lotId: treeLot.lotId,
          status: 'active'
        }).sort({ amount: -1 });

        // Determine bid status
        let bidStatus = 'active';
        if (new Date() > treeLot.biddingEndDate) {
          if (currentHighestBid && currentHighestBid.bidderId.toString() === req.user.id) {
            bidStatus = 'won';
          } else {
            bidStatus = 'lost';
          }
        } else if (currentHighestBid && currentHighestBid.bidderId.toString() !== req.user.id) {
          bidStatus = 'outbid';
        } else if (currentHighestBid && currentHighestBid.bidderId.toString() === req.user.id) {
          bidStatus = 'winning';
        }

        return {
          id: bid._id,
          lotId: treeLot.lotId || treeLot._id,
          lotInfo: {
            farmerName: treeLot.farmerId?.name || treeLot.farmerId?.firstName || 'Unknown',
            farmerEmail: treeLot.farmerId?.email || '',
            farmerPhone: treeLot.farmerId?.phone || '',
            location: treeLot.location || 'N/A',
            numberOfTrees: treeLot.numberOfTrees || 0,
            approximateYield: treeLot.approximateYield || 'N/A',
            image: treeLot.images?.[0] || null
          },
          bidAmount: bid.amount || 0,
          finalAmount: currentHighestBid ? (currentHighestBid.amount || 0) : (treeLot.minimumPrice || 0),
          minimumPrice: treeLot.minimumPrice || 0,
          status: bidStatus,
          bidTime: bid.createdAt || new Date(),
          biddingEndDate: treeLot.biddingEndDate || new Date(),
          resultDate: treeLot.biddingEndDate || new Date(),
          totalBids: await Bid.countDocuments({ lotId: treeLot.lotId }),
          myRank: bid.rank || 0,
          comment: bid.comment,
          winnerBid: currentHighestBid ? (currentHighestBid.amount || 0) : (treeLot.minimumPrice || 0)
        };
      })
    );

    // Filter out null results
    const validBids = processedBids.filter(bid => bid !== null);

    res.json({
      success: true,
      data: validBids,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Error fetching bid history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching bid history'
    });
  }
});

// @route   POST /api/bids/:lotId/alerts
// @desc    Create an alert for a broker to be notified 1 day before bidding ends
// @access  Private (Broker only)
router.post('/:lotId/alerts', protect, async (req, res) => {
  try {
    const { lotId } = req.params;

    // Validate lot exists
    const treeLot = await TreeLot.findOne({ lotId });
    if (!treeLot) {
      return res.status(404).json({ success: false, message: 'Tree lot not found' });
    }

    // Upsert alert so duplicate clicks are idempotent
    const alert = await BidAlert.findOneAndUpdate(
      { lotId, bidderId: req.user.id, type: 'ending_soon' },
      { $setOnInsert: { notified: false } },
      { new: true, upsert: true }
    );

    return res.status(201).json({ success: true, data: alert });
  } catch (error) {
    console.error('Error creating bid alert:', error);
    res.status(500).json({ success: false, message: 'Server error while creating alert' });
  }
});

// @route   PUT /api/bids/:id
// @desc    Update a bid
// @access  Private (Broker only)
router.put('/:id', protect, async (req, res) => {
  try {
    const { amount, comment } = req.body;

    const bid = await Bid.findById(req.params.id);

    if (!bid) {
      return res.status(404).json({
        success: false,
        message: 'Bid not found'
      });
    }

    // Check if user owns the bid
    if (bid.bidderId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this bid'
      });
    }

    // Check if bidding is still active
    const treeLot = await TreeLot.findOne({ lotId: bid.lotId });
    if (new Date() > treeLot.biddingEndDate) {
      return res.status(400).json({
        success: false,
        message: 'Bidding period has ended'
      });
    }

    // Validate new bid amount
    if (amount) {
      const currentHighestBid = await Bid.findOne({ 
        lotId: bid.lotId, 
        status: 'active',
        _id: { $ne: bid._id }
      }).sort({ amount: -1 });

      const minimumBidAmount = currentHighestBid 
        ? currentHighestBid.amount + 1000 
        : treeLot.minimumPrice;

      if (amount < minimumBidAmount) {
        return res.status(400).json({
          success: false,
          message: `Bid amount must be at least ₹${minimumBidAmount.toLocaleString()}`
        });
      }

      const beforeSaveHighest = await Bid.findOne({ lotId: bid.lotId, status: 'active' }).sort({ amount: -1 });

      bid.amount = amount;
    }

    if (comment !== undefined) {
      bid.comment = comment;
    }

    bid.updatedAt = new Date();
    await bid.save();

    // After update, if this bid became highest, notify previous highest bidder
    const afterSaveHighest = await Bid.findOne({ lotId: bid.lotId, status: 'active' }).sort({ amount: -1 });
    if (afterSaveHighest && afterSaveHighest._id.equals(bid._id)) {
      // Find previous highest excluding this bid
      const previousHighest = await Bid.findOne({ lotId: bid.lotId, status: 'active', _id: { $ne: bid._id } }).sort({ amount: -1 });
      if (previousHighest && String(previousHighest.bidderId) !== String(req.user.id)) {
        sendOutbidNotificationEmail({
          lotId: bid.lotId,
          previousBidderId: previousHighest.bidderId,
          previousAmount: previousHighest.amount,
          newAmount: bid.amount
        });
      }
    }

    res.json({
      success: true,
      message: 'Bid updated successfully',
      data: bid
    });

  } catch (error) {
    console.error('Error updating bid:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating bid'
    });
  }
});

// @route   DELETE /api/bids/:id
// @desc    Cancel/withdraw a bid
// @access  Private (Broker only)
router.delete('/:id', protect, async (req, res) => {
  try {
    const bid = await Bid.findById(req.params.id);

    if (!bid) {
      return res.status(404).json({
        success: false,
        message: 'Bid not found'
      });
    }

    // Check if user owns the bid
    if (bid.bidderId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this bid'
      });
    }

    // Check if bidding is still active
    const treeLot = await TreeLot.findOne({ lotId: bid.lotId });
    if (new Date() > treeLot.biddingEndDate) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel bid after bidding period has ended'
      });
    }

    bid.status = 'cancelled';
    bid.updatedAt = new Date();
    await bid.save();

    res.json({
      success: true,
      message: 'Bid cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling bid:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling bid'
    });
  }
});

// @route   GET /api/bids/debug/:lotId
// @desc    Debug bid data for a specific lot
// @access  Private
router.get('/debug/:lotId', protect, async (req, res) => {
  try {
    const { lotId } = req.params;
    
    console.log(`Debugging lotId: ${lotId}`);
    
    // First check if any tree lot exists with this lotId
    const allTreeLots = await TreeLot.find({ lotId });
    console.log(`Found ${allTreeLots.length} tree lots with lotId: ${lotId}`);
    console.log('All tree lots:', allTreeLots);
    
    // Get the tree lot
    const treeLot = await TreeLot.findOne({ lotId })
      .populate('farmerId', 'name email phone firstName');
    
    console.log('TreeLot found:', treeLot);
    
    // Check if farmer exists separately
    if (treeLot && treeLot.farmerId) {
      const Register = require('../models/Register');
      const farmer = await Register.findById(treeLot.farmerId);
      console.log('Farmer found:', farmer);
    }
    
    if (!treeLot) {
      return res.json({
        success: false,
        message: 'Tree lot not found',
        lotId
      });
    }
    
    // Get bids for this lot
    const bids = await Bid.find({ lotId, status: 'active' }).sort({ amount: -1 });
    console.log('Bids found:', bids);
    
    // Get current highest bid
    const currentHighestBid = await Bid.findOne({
      lotId: treeLot.lotId,
      status: 'active'
    }).sort({ amount: -1 });
    
    console.log('Current highest bid:', currentHighestBid);
    
    res.json({
      success: true,
      data: {
        lotId,
        treeLot: {
          _id: treeLot._id,
          lotId: treeLot.lotId,
          farmerId: treeLot.farmerId,
          farmerName: treeLot.farmerId?.name,
          farmerFirstName: treeLot.farmerId?.firstName,
          location: treeLot.location,
          numberOfTrees: treeLot.numberOfTrees,
          approximateYield: treeLot.approximateYield,
          minimumPrice: treeLot.minimumPrice,
          biddingEndDate: treeLot.biddingEndDate,
          status: treeLot.status
        },
        bids: bids.map(bid => ({
          _id: bid._id,
          lotId: bid.lotId,
          bidderId: bid.bidderId,
          amount: bid.amount,
          status: bid.status,
          createdAt: bid.createdAt
        })),
        currentHighestBid: currentHighestBid ? {
          _id: currentHighestBid._id,
          amount: currentHighestBid.amount,
          bidderId: currentHighestBid.bidderId
        } : null
      }
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug error',
      error: error.message
    });
  }
});

module.exports = router;
