const express = require('express');
const router = express.Router();
const TreeLot = require('../models/TreeLot');
const Bid = require('../models/Bid');
const { protect, authorize } = require('../middlewares/auth');

// @route   GET /api/tree-lots
// @desc    Get all active tree lots for bidding
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { 
      search, 
      minPrice, 
      maxPrice, 
      location, 
      minTrees, 
      sortBy = 'newest',
      page = 1,
      limit = 10 
    } = req.query;

    // Build query
    let query = { status: 'active', biddingEndDate: { $gt: new Date() } };

    // Search filter
    if (search) {
      query.$or = [
        { 'farmerInfo.name': { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { lotId: { $regex: search, $options: 'i' } }
      ];
    }

    // Price filters
    if (minPrice) query.minimumPrice = { ...query.minimumPrice, $gte: parseInt(minPrice) };
    if (maxPrice) query.minimumPrice = { ...query.minimumPrice, $lte: parseInt(maxPrice) };

    // Location filter
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    // Trees count filter
    if (minTrees) {
      query.numberOfTrees = { $gte: parseInt(minTrees) };
    }

    // Sorting
    let sortOptions = {};
    switch (sortBy) {
      case 'newest':
        sortOptions = { createdAt: -1 };
        break;
      case 'oldest':
        sortOptions = { createdAt: 1 };
        break;
      case 'priceHigh':
        sortOptions = { minimumPrice: -1 };
        break;
      case 'priceLow':
        sortOptions = { minimumPrice: 1 };
        break;
      case 'trees':
        sortOptions = { numberOfTrees: -1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    // Pagination
    const skip = (page - 1) * limit;

    const treeLots = await TreeLot.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('farmerId', 'name email phone')
      .lean();

    // Get current highest bid for each lot
    const lotsWithBids = await Promise.all(
      treeLots.map(async (lot) => {
        const highestBid = await Bid.findOne({ 
          lotId: lot.lotId, 
          status: 'active' 
        }).sort({ amount: -1 });

        const bidCount = await Bid.countDocuments({ 
          lotId: lot.lotId, 
          status: 'active' 
        });

        return {
          ...lot,
          currentHighestBid: highestBid ? highestBid.amount : lot.minimumPrice,
          bidCount
        };
      })
    );

    const total = await TreeLot.countDocuments(query);

    res.json({
      success: true,
      data: lotsWithBids,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Error fetching tree lots:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tree lots'
    });
  }
});

// @route   GET /api/tree-lots/farmer
// @desc    Get farmer's own tree lots
// @access  Private (Farmer only)
router.get('/farmer', protect, async (req, res) => {
  try {
    const treeLots = await TreeLot.find({ farmerId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    // Get bid information for each lot
    const lotsWithBids = await Promise.all(
      treeLots.map(async (lot) => {
        const highestBid = await Bid.findOne({ 
          lotId: lot.lotId, 
          status: 'active' 
        }).sort({ amount: -1 });

        const bidCount = await Bid.countDocuments({ 
          lotId: lot.lotId, 
          status: 'active' 
        });

        return {
          ...lot,
          currentHighestBid: highestBid ? highestBid.amount : lot.minimumPrice,
          bidCount
        };
      })
    );

    res.json({
      success: true,
      data: lotsWithBids
    });

  } catch (error) {
    console.error('Error fetching farmer tree lots:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tree lots'
    });
  }
});

// @route   GET /api/tree-lots/:id
// @desc    Get single tree lot details
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    // Support either Mongo _id or human lotId like RT002
    const treeLot = (id && id.length === 24)
      ? await TreeLot.findById(id)
          .populate('farmerId', 'name email phone')
          .lean()
      : await TreeLot.findOne({ lotId: id })
      .populate('farmerId', 'name email phone')
      .lean();

    if (!treeLot) {
      return res.status(404).json({
        success: false,
        message: 'Tree lot not found'
      });
    }

    // Get bidding history
    const effectiveLotId = treeLot.lotId || (treeLot._id && treeLot._id.toString());
    const bids = await Bid.find({ 
      lotId: effectiveLotId, 
      status: 'active' 
    })
    .sort({ amount: -1 })
    .populate('bidderId', 'name')
    .lean();

    // Get current highest bid
    const currentHighestBid = bids.length > 0 ? bids[0].amount : treeLot.minimumPrice;

    res.json({
      success: true,
      data: {
        ...treeLot,
        currentHighestBid,
        bidCount: bids.length,
        bids: bids.map(bid => ({
          id: bid._id,
          amount: bid.amount,
          bidderName: bid.bidderId?.name || 'Unknown Bidder',
          timestamp: bid.createdAt,
          isWinning: bid.amount === currentHighestBid
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching tree lot details:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tree lot details'
    });
  }
});

// @route   GET /api/tree-lots/:id/bidders
// @desc    Get bidder details for a lot (only owner farmer or admin)
// @access  Private
router.get('/:id/bidders', protect, async (req, res) => {
  try {
    const id = req.params.id;
    const treeLot = (id && id.length === 24)
      ? await TreeLot.findById(id).lean()
      : await TreeLot.findOne({ lotId: id }).lean();

    if (!treeLot) {
      return res.status(404).json({
        success: false,
        message: 'Tree lot not found'
      });
    }

    // Only the owner farmer or an admin can view bidder identities
    const isOwner = treeLot.farmerId && treeLot.farmerId.toString() === req.user.id?.toString();
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view bidder details for this lot'
      });
    }

    const effectiveLotId = treeLot.lotId || (treeLot._id && treeLot._id.toString());
    const bids = await Bid.find({
      lotId: effectiveLotId,
      status: 'active'
    })
      .sort({ amount: -1 })
      .populate('bidderId', 'name email phone')
      .lean();

    const response = bids.map((bid, index) => ({
      id: bid._id,
      amount: bid.amount,
      timestamp: bid.createdAt,
      rank: index + 1,
      bidder: {
        id: bid.bidderId?._id,
        name: bid.bidderId?.name || 'Unnamed',
        email: bid.bidderId?.email || '',
        phone: bid.bidderId?.phone || ''
      }
    }));

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Error fetching bidder details:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching bidder details'
    });
  }
});

// @route   POST /api/tree-lots
// @desc    Create new tree lot (Farmer only)
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    console.log('🌳 Creating new tree lot...');
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
    
    const {
      location,
      numberOfTrees,
      approximateYield,
      minimumPrice,
      description,
      images,
      biddingEndDate,
      treeAge,
      tappingSchedule,
      accessibility,
      additionalInfo,
      soilType,
      rainfall,
      certifications,
      tags
    } = req.body;

    // Validate required fields
    if (!location || !numberOfTrees || !approximateYield || !minimumPrice || !biddingEndDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Generate lot ID
    const lotCount = await TreeLot.countDocuments();
    const lotId = `RT${String(lotCount + 1).padStart(3, '0')}`;

    // Build the tree lot object with only defined fields
    const treeLotData = {
      lotId,
      farmerId: req.user.id,
      location,
      numberOfTrees: parseInt(numberOfTrees),
      approximateYield,
      minimumPrice: parseInt(minimumPrice),
      description: description || '',
      images: images || [],
      biddingEndDate: new Date(biddingEndDate),
      status: 'active'
    };

    // Add additional fields only if they have values
    if (treeAge && treeAge.toString().trim()) {
      treeLotData.treeAge = parseInt(treeAge);
    }
    if (tappingSchedule && tappingSchedule.trim()) {
      treeLotData.tappingSchedule = tappingSchedule.trim();
    }
    if (additionalInfo && additionalInfo.trim()) {
      treeLotData.additionalInfo = additionalInfo.trim();
    }
    if (soilType && soilType.trim()) {
      treeLotData.soilType = soilType.trim();
    }
    if (rainfall && rainfall.trim()) {
      treeLotData.rainfall = rainfall.trim();
    }
    if (certifications && certifications.length > 0) {
      treeLotData.certifications = certifications;
    }
    if (tags && tags.length > 0) {
      treeLotData.tags = tags;
    }
    
    // Always include accessibility object
    if (accessibility) {
      treeLotData.accessibility = {
        roadAccess: accessibility.roadAccess !== undefined ? accessibility.roadAccess : true,
        truckAccess: accessibility.truckAccess !== undefined ? accessibility.truckAccess : true,
        description: accessibility.description || ''
      };
    } else {
      treeLotData.accessibility = {
        roadAccess: true,
        truckAccess: true,
        description: ''
      };
    }

    console.log('💾 Final tree lot data to save:', JSON.stringify(treeLotData, null, 2));
    
    const treeLot = new TreeLot(treeLotData);

    await treeLot.save();
    
    console.log('✅ Tree lot saved successfully with ID:', treeLot._id);

    res.status(201).json({
      success: true,
      message: 'Tree lot created successfully',
      data: treeLot
    });

  } catch (error) {
    console.error('Error creating tree lot:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating tree lot'
    });
  }
});

// @route   PUT /api/tree-lots/:id
// @desc    Update tree lot (Farmer only)
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const treeLot = await TreeLot.findById(req.params.id);

    if (!treeLot) {
      return res.status(404).json({
        success: false,
        message: 'Tree lot not found'
      });
    }

    // Check if user is the owner
    if (treeLot.farmerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this tree lot'
      });
    }

    // Check if there are active bids
    const activeBids = await Bid.countDocuments({ 
      lotId: req.params.id, 
      status: 'active' 
    });

    if (activeBids > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update tree lot with active bids'
      });
    }

    // Filter out undefined values but keep null values for clearing fields
    const updateData = Object.fromEntries(
      Object.entries(req.body).filter(([_, value]) => value !== undefined)
    );

    const updatedTreeLot = await TreeLot.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Tree lot updated successfully',
      data: updatedTreeLot
    });

  } catch (error) {
    console.error('Error updating tree lot:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating tree lot'
    });
  }
});

// @route   DELETE /api/tree-lots/:id
// @desc    Delete tree lot (Farmer only)
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const treeLot = await TreeLot.findById(req.params.id);

    if (!treeLot) {
      return res.status(404).json({
        success: false,
        message: 'Tree lot not found'
      });
    }

    // Check if user is the owner
    if (treeLot.farmerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this tree lot'
      });
    }

    // Check if there are active bids
    const activeBids = await Bid.countDocuments({ 
      lotId: req.params.id, 
      status: 'active' 
    });

    if (activeBids > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete tree lot with active bids'
      });
    }

    await TreeLot.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Tree lot deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting tree lot:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting tree lot'
    });
  }
});

module.exports = router;
