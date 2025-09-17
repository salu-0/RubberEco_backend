const TappingRequest = require('../models/TappingRequest');
const Register = require('../models/Register');
const Staff = require('../models/Staff');

// Get all tapping requests (role-based access)
exports.getAllTappingRequests = async (req, res) => {
  try {
    const userRole = req.user?.role;
    
    // Only allow tapper staff, admin, and supervisors to view tapping requests
    if (!['tapper', 'admin', 'supervisor'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only tapper staff can view tapping requests.'
      });
    }

    const requests = await TappingRequest.find()
      .populate('farmerId', 'name email phone')
      .populate('assignedTapper.tapperId', 'name email phone')
      .sort({ submittedAt: -1 });

    res.json({
      success: true,
      data: requests,
      count: requests.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching tapping requests',
      error: error.message
    });
  }
};

// Get tapping requests by status (role-based access)
exports.getTappingRequestsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const userRole = req.user?.role;
    
    // Only allow tapper staff, admin, and supervisors
    if (!['tapper', 'admin', 'supervisor'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only tapper staff can view tapping requests.'
      });
    }

    const requests = await TappingRequest.find({ status })
      .populate('farmerId', 'name email phone')
      .populate('assignedTapper.tapperId', 'name email phone')
      .sort({ submittedAt: -1 });

    res.json({
      success: true,
      data: requests,
      count: requests.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching tapping requests by status',
      error: error.message
    });
  }
};

// Tapper proposes tree count
exports.tapperProposeTreeCount = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { proposedTreeCount, notes } = req.body;
    const userRole = req.user?.role;

    // Only tappers can propose tree count
    if (userRole !== 'tapper') {
      return res.status(403).json({
        success: false,
        message: 'Only tappers can propose tree count'
      });
    }

    const request = await TappingRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Tapping request not found'
      });
    }

    // Check if request is assigned to this tapper
    if (request.assignedTapper.tapperId?.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only propose for requests assigned to you'
      });
    }

    await request.tapperProposeTreeCount(proposedTreeCount, notes);

    res.json({
      success: true,
      message: proposedTreeCount === request.farmerEstimatedTrees
        ? 'Tree count matches farmer estimate - automatically approved!'
        : 'Tree count proposal sent to farmer for review',
      data: request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error proposing tree count',
      error: error.message
    });
  }
};

// Farmer makes counter-proposal
exports.farmerCounterPropose = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { proposedTreeCount, notes } = req.body;

    const request = await TappingRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Tapping request not found'
      });
    }

    // Check if request belongs to this farmer
    if (request.farmerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only make proposals for your own requests'
      });
    }

    await request.farmerCounterPropose(proposedTreeCount, notes);

    const latestTapperProposal = request.tapperCounterProposal || request.tapperProposedTrees;

    res.json({
      success: true,
      message: proposedTreeCount === latestTapperProposal
        ? 'Your counter-proposal matches tapper\'s proposal - automatically approved!'
        : 'Counter-proposal sent to tapper for review',
      data: request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error making counter-proposal',
      error: error.message
    });
  }
};

// Tapper makes counter-proposal
exports.tapperCounterPropose = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { proposedTreeCount, notes } = req.body;
    const userRole = req.user?.role;

    // Only tappers can make counter-proposals
    if (userRole !== 'tapper') {
      return res.status(403).json({
        success: false,
        message: 'Only tappers can make counter-proposals'
      });
    }

    const request = await TappingRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Tapping request not found'
      });
    }

    // Check if request is assigned to this tapper
    if (request.assignedTapper.tapperId?.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only make counter-proposals for requests assigned to you'
      });
    }

    await request.tapperCounterPropose(proposedTreeCount, notes);

    const latestFarmerProposal = request.farmerCounterProposal || request.farmerEstimatedTrees;

    res.json({
      success: true,
      message: proposedTreeCount === latestFarmerProposal
        ? 'Your counter-proposal matches farmer\'s proposal - automatically approved!'
        : 'Counter-proposal sent to farmer for review',
      data: request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error making counter-proposal',
      error: error.message
    });
  }
};

// Accept the other party's proposal
exports.acceptProposal = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { notes } = req.body;
    const userRole = req.user?.role;

    const request = await TappingRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Tapping request not found'
      });
    }

    let acceptedBy;

    // Determine who is accepting
    if (userRole === 'farmer' && request.farmerId.toString() === req.user.id) {
      acceptedBy = 'farmer';
    } else if (userRole === 'tapper' && request.assignedTapper.tapperId?.toString() === req.user.id) {
      acceptedBy = 'tapper';
    } else {
      return res.status(403).json({
        success: false,
        message: 'You can only accept proposals for your own requests'
      });
    }

    await request.acceptProposal(acceptedBy, notes);

    res.json({
      success: true,
      message: 'Proposal accepted! Tree count finalized.',
      data: request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error accepting proposal',
      error: error.message
    });
  }
};

// Get requests pending tree count approval
exports.getPendingTreeCountRequests = async (req, res) => {
  try {
    const userRole = req.user?.role;
    
    // Only allow tapper staff, admin, and supervisors
    if (!['tapper', 'admin', 'supervisor'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only tapper staff can view tapping requests.'
      });
    }

    const requests = await TappingRequest.find({ 
      status: 'tree_count_pending',
      treeCountStatus: 'tapper_verified'
    })
      .populate('farmerId', 'name email phone')
      .populate('assignedTapper.tapperId', 'name email phone')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      data: requests,
      count: requests.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching pending tree count requests',
      error: error.message
    });
  }
};

// Get farmer's own requests (farmers can see their own requests)
exports.getFarmerRequests = async (req, res) => {
  try {
    console.log('🔍 getFarmerRequests called for user:', req.user.id);
    const farmerId = req.user.id;

    // First try without populate to avoid reference errors
    const requests = await TappingRequest.find({ farmerId })
      .sort({ submittedAt: -1 });

    console.log('✅ Found', requests.length, 'requests for farmer:', farmerId);

    // Get application counts for each request
    const requestIds = requests.map(req => req._id);
    const applicationCounts = await require('../models/ServiceRequestApplication').aggregate([
      { $match: { tappingRequestId: { $in: requestIds } } },
      { $group: { _id: '$tappingRequestId', count: { $sum: 1 } } }
    ]);
    
    const applicationCountMap = {};
    applicationCounts.forEach(item => {
      applicationCountMap[item._id.toString()] = item.count;
    });

    // Add application count to each request
    const requestsWithCounts = requests.map(request => ({
      ...request.toObject(),
      applicationCount: applicationCountMap[request._id.toString()] || 0
    }));

    res.json({
      success: true,
      data: requestsWithCounts,
      count: requestsWithCounts.length
    });
  } catch (error) {
    console.error('❌ Error in getFarmerRequests:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching your tapping requests',
      error: error.message
    });
  }
};

// Create new tapping request
exports.createTappingRequest = async (req, res) => {
  try {
    const farmerId = req.user.id;
    const farmer = await Register.findById(farmerId);
    
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    const requestData = {
      ...req.body,
      farmerId,
      farmerName: farmer.name,
      farmerEmail: farmer.email,
      farmerPhone: farmer.phone,
      farmerEstimatedTrees: req.body.numberOfTrees || req.body.farmerEstimatedTrees
    };

    const tappingRequest = new TappingRequest(requestData);
    await tappingRequest.save();

    res.status(201).json({
      success: true,
      message: 'Tapping request submitted successfully',
      data: tappingRequest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating tapping request',
      error: error.message
    });
  }
};
