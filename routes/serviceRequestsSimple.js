const express = require('express');
const router = express.Router();
const ServiceRequest = require('../models/ServiceRequest');

// @desc    Get all service requests (no auth for testing)
// @route   GET /api/service-requests/all
// @access  Public (for testing)
router.get('/all', async (req, res) => {
  try {
    const { status, serviceType, page = 1, limit = 10 } = req.query;
    
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (serviceType && serviceType !== 'all') {
      query.serviceType = serviceType;
    }

    const serviceRequests = await ServiceRequest.find(query)
      .populate('userId', 'name email phone')
      .sort({ submittedDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ServiceRequest.countDocuments(query);

    res.json({
      success: true,
      data: serviceRequests,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Error fetching service requests:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching service requests'
    });
  }
});

// @desc    Create a new service request (no auth for testing)
// @route   POST /api/service-requests
// @access  Public (for testing)
router.post('/', async (req, res) => {
  try {
    const {
      serviceType,
      farmLocation,
      farmSize,
      numberOfTrees,
      lastFertilizerDate,
      fertilizerType,
      rainGuardType,
      urgency,
      preferredDate,
      ratePerTree,
      specialRequirements,
      contactPhone,
      contactEmail,
      documents
    } = req.body;

    // For testing, use dummy user data
    const serviceRequest = new ServiceRequest({
      userId: '507f1f77bcf86cd799439011', // Dummy ObjectId
      farmerName: '',
      farmerEmail: contactEmail || '',
      serviceType,
      title: serviceType === 'fertilizer' ? 'Fertilizer Application Service' : 'Rain Guard Installation',
      farmLocation,
      farmSize,
      numberOfTrees,
      lastFertilizerDate,
      fertilizerType,
      rainGuardType,
      urgency,
      preferredDate,
      ratePerTree,
      specialRequirements,
      contactPhone,
      contactEmail,
      documents: documents || []
    });

    await serviceRequest.save();

    res.status(201).json({
      success: true,
      message: 'Service request submitted successfully',
      data: serviceRequest
    });

  } catch (error) {
    console.error('Error creating service request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating service request',
      error: error.message
    });
  }
});

// @desc    Update service request status (no auth for testing)
// @route   PUT /api/service-requests/:id/status
// @access  Public (for testing)
router.put('/:id/status', async (req, res) => {
  try {
    const { status, reviewNotes, estimatedCost } = req.body;

    const serviceRequest = await ServiceRequest.findById(req.params.id);
    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found'
      });
    }

    // Update status and review information
    serviceRequest.status = status;
    serviceRequest.reviewedBy = {
      workerId: '507f1f77bcf86cd799439012', // Dummy ObjectId
      workerName: 'Test Field Worker',
      reviewDate: new Date(),
      reviewNotes: reviewNotes || ''
    };

    if (estimatedCost) {
      serviceRequest.estimatedCost = estimatedCost;
    }

    if (status === 'approved') {
      serviceRequest.approvedDate = new Date();
    }

    await serviceRequest.save();

    res.json({
      success: true,
      message: `Service request ${status} successfully`,
      data: serviceRequest
    });

  } catch (error) {
    console.error('Error updating service request status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating service request status'
    });
  }
});

module.exports = router;
