const express = require('express');
const router = express.Router();
const ServiceRequest = require('../models/ServiceRequest');
const User = require('../models/User');
const { protect } = require('../middlewares/auth');
const { sendServiceRequestEmail } = require('../utils/emailService');

// @desc    Create a new service request
// @route   POST /api/service-requests
// @access  Private (Farmer)
router.post('/', protect, async (req, res) => {
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

    // Get user information
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create service request
    const serviceRequest = new ServiceRequest({
      userId: req.user.id,
      farmerName: user.name,
      farmerEmail: user.email,
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

    // Add notification record
    serviceRequest.notifications.push({
      type: 'submitted',
      emailSent: false
    });
    await serviceRequest.save();

    // Send confirmation email to farmer
    try {
      await sendServiceRequestEmail({
        type: 'submitted',
        farmerEmail: user.email,
        farmerName: user.name,
        requestId: serviceRequest.requestId,
        serviceType: serviceRequest.title,
        submittedDate: serviceRequest.submittedDate
      });

      // Update notification as sent
      serviceRequest.notifications[serviceRequest.notifications.length - 1].emailSent = true;
      await serviceRequest.save();
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the request creation if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Service request submitted successfully',
      data: serviceRequest
    });

  } catch (error) {
    console.error('Error creating service request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating service request'
    });
  }
});

// @desc    Get user's service requests
// @route   GET /api/service-requests/my-requests
// @access  Private (Farmer)
router.get('/my-requests', protect, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { userId: req.user.id };
    if (status && status !== 'all') {
      query.status = status;
    }

    const serviceRequests = await ServiceRequest.find(query)
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

// @desc    Get all service requests (for field workers/admin)
// @route   GET /api/service-requests/all
// @access  Private (Field Worker/Admin)
router.get('/all', protect, async (req, res) => {
  try {
    // Check if user is field worker or admin
    const user = await User.findById(req.user.id);
    if (!user || !['field_worker', 'admin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Field worker or admin role required.'
      });
    }

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
    console.error('Error fetching all service requests:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching service requests'
    });
  }
});

// @desc    Get single service request
// @route   GET /api/service-requests/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const serviceRequest = await ServiceRequest.findById(req.params.id)
      .populate('userId', 'name email phone')
      .populate('assignedProvider.providerId', 'name email phone')
      .populate('reviewedBy.workerId', 'name email');

    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found'
      });
    }

    // Check access permissions
    const user = await User.findById(req.user.id);
    const isOwner = serviceRequest.userId.toString() === req.user.id;
    const isFieldWorker = ['field_worker', 'admin'].includes(user.role);
    
    if (!isOwner && !isFieldWorker) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: serviceRequest
    });

  } catch (error) {
    console.error('Error fetching service request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching service request'
    });
  }
});

// @desc    Update service request status (approve/reject)
// @route   PUT /api/service-requests/:id/status
// @access  Private (Field Worker/Admin)
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { status, reviewNotes, estimatedCost } = req.body;

    // Check if user is field worker or admin
    const user = await User.findById(req.user.id);
    if (!user || !['field_worker', 'admin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Field worker or admin role required.'
      });
    }

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
      workerId: req.user.id,
      workerName: user.name,
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

    // Add notification record
    serviceRequest.notifications.push({
      type: status,
      emailSent: false
    });
    await serviceRequest.save();

    // Send email notification to farmer
    try {
      await sendServiceRequestEmail({
        type: status,
        farmerEmail: serviceRequest.farmerEmail,
        farmerName: serviceRequest.farmerName,
        requestId: serviceRequest.requestId,
        serviceType: serviceRequest.title,
        reviewNotes: reviewNotes,
        estimatedCost: estimatedCost,
        reviewerName: user.name,
        reviewDate: new Date()
      });

      // Update notification as sent
      serviceRequest.notifications[serviceRequest.notifications.length - 1].emailSent = true;
      await serviceRequest.save();
    } catch (emailError) {
      console.error('Failed to send status update email:', emailError);
      // Don't fail the status update if email fails
    }

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

// @desc    Assign service provider to request
// @route   PUT /api/service-requests/:id/assign
// @access  Private (Field Worker/Admin)
router.put('/:id/assign', protect, async (req, res) => {
  try {
    const { providerId, providerName, providerContact, providerRating, providerExperience } = req.body;

    // Check if user is field worker or admin
    const user = await User.findById(req.user.id);
    if (!user || !['field_worker', 'admin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Field worker or admin role required.'
      });
    }

    const serviceRequest = await ServiceRequest.findById(req.params.id);
    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found'
      });
    }

    // Update assigned provider
    serviceRequest.assignedProvider = {
      providerId,
      name: providerName,
      contact: providerContact,
      rating: providerRating,
      experience: providerExperience,
      assignedDate: new Date()
    };
    serviceRequest.status = 'assigned';

    await serviceRequest.save();

    // Add notification record
    serviceRequest.notifications.push({
      type: 'assigned',
      emailSent: false
    });
    await serviceRequest.save();

    // Send email notification to farmer
    try {
      await sendServiceRequestEmail({
        type: 'assigned',
        farmerEmail: serviceRequest.farmerEmail,
        farmerName: serviceRequest.farmerName,
        requestId: serviceRequest.requestId,
        serviceType: serviceRequest.title,
        providerName: providerName,
        providerContact: providerContact,
        assignedDate: new Date()
      });

      // Update notification as sent
      serviceRequest.notifications[serviceRequest.notifications.length - 1].emailSent = true;
      await serviceRequest.save();
    } catch (emailError) {
      console.error('Failed to send assignment email:', emailError);
    }

    res.json({
      success: true,
      message: 'Service provider assigned successfully',
      data: serviceRequest
    });

  } catch (error) {
    console.error('Error assigning service provider:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while assigning service provider'
    });
  }
});

// ===== Negotiation Flow =====

// 1) Staff proposes negotiation: move to negotiation, set staffProposal, awaiting farmer
// @route   PUT /api/service-requests/:id/negotiate/propose
// @access  Private (Field Worker)
router.put('/:id/negotiate/propose', protect, async (req, res) => {
  try {
    const { numberOfTrees, ratePerTree, preferredDate, notes } = req.body;
    const user = await User.findById(req.user.id);
    if (!user || !['field_worker', 'admin'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Only staff/admin can propose negotiation' });
    }

    const sr = await ServiceRequest.findById(req.params.id);
    if (!sr) return res.status(404).json({ success: false, message: 'Service request not found' });

    sr.status = 'negotiation';
    sr.negotiation = sr.negotiation || {};
    sr.negotiation.staffProposal = {
      numberOfTrees,
      ratePerTree,
      preferredDate,
      notes: notes || '',
      proposedAt: new Date()
    };
    sr.negotiation.history = sr.negotiation.history || [];
    sr.negotiation.history.push({ by: 'staff', numberOfTrees, ratePerTree, preferredDate, notes });
    sr.negotiation.awaiting = 'farmer';

    await sr.save();

    return res.json({ success: true, message: 'Negotiation proposed to farmer', data: sr });
  } catch (err) {
    console.error('Negotiation propose error:', err);
    return res.status(500).json({ success: false, message: 'Server error during negotiation proposal' });
  }
});

// 2) Farmer counters: update farmerCounter, awaiting staff
// @route   PUT /api/service-requests/:id/negotiate/counter
// @access  Private (Farmer)
router.put('/:id/negotiate/counter', protect, async (req, res) => {
  try {
    const { numberOfTrees, ratePerTree, preferredDate, notes } = req.body;
    const sr = await ServiceRequest.findById(req.params.id);
    if (!sr) return res.status(404).json({ success: false, message: 'Service request not found' });

    // Only owner (farmer) can counter
    if (sr.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the request owner can counter' });
    }

    sr.status = 'negotiation';
    sr.negotiation = sr.negotiation || {};
    sr.negotiation.farmerCounter = {
      numberOfTrees,
      ratePerTree,
      preferredDate,
      notes: notes || '',
      proposedAt: new Date()
    };
    sr.negotiation.history = sr.negotiation.history || [];
    sr.negotiation.history.push({ by: 'farmer', numberOfTrees, ratePerTree, preferredDate, notes });
    sr.negotiation.awaiting = 'staff';

    await sr.save();

    return res.json({ success: true, message: 'Counter proposal submitted', data: sr });
  } catch (err) {
    console.error('Negotiation counter error:', err);
    return res.status(500).json({ success: false, message: 'Server error during counter proposal' });
  }
});

// 3) Accept final terms: apply negotiated values to main fields, set status to accepted, awaiting none
//    Either side can call this once both agree
// @route   PUT /api/service-requests/:id/negotiate/accept
// @access  Private (Farmer or Staff)
router.put('/:id/negotiate/accept', protect, async (req, res) => {
  try {
    const sr = await ServiceRequest.findById(req.params.id);
    if (!sr) return res.status(404).json({ success: false, message: 'Service request not found' });

    // Basic authorization: owner farmer or staff/admin
    const user = await User.findById(req.user.id);
    const isFarmer = sr.userId.toString() === req.user.id;
    const isStaff = !!user && ['field_worker', 'admin'].includes(user.role);
    if (!isFarmer && !isStaff) {
      return res.status(403).json({ success: false, message: 'Not authorized to accept negotiation' });
    }

    // Decide which proposal to apply (prefer latest in history)
    const last = (sr.negotiation?.history || []).slice(-1)[0];
    const terms = last || sr.negotiation?.staffProposal || sr.negotiation?.farmerCounter;
    if (!terms) {
      return res.status(400).json({ success: false, message: 'No negotiated terms to accept' });
    }

    if (terms.numberOfTrees) sr.numberOfTrees = terms.numberOfTrees;
    if (terms.ratePerTree) sr.ratePerTree = terms.ratePerTree;
    if (terms.preferredDate) sr.preferredDate = terms.preferredDate;

    sr.status = 'accepted';
    if (!sr.notifications) sr.notifications = [];
    sr.notifications.push({ type: 'approved', emailSent: false });
    sr.negotiation.awaiting = 'none';

    await sr.save();

    return res.json({ success: true, message: 'Negotiation accepted', data: sr });
  } catch (err) {
    console.error('Negotiation accept error:', err);
    return res.status(500).json({ success: false, message: 'Server error during accept' });
  }
});

// 4) Reject negotiation and revert to submitted/under_review as needed
// @route   PUT /api/service-requests/:id/negotiate/reject
// @access  Private (Farmer or Staff)
router.put('/:id/negotiate/reject', protect, async (req, res) => {
  try {
    const { reason, targetStatus = 'under_review' } = req.body;
    const sr = await ServiceRequest.findById(req.params.id);
    if (!sr) return res.status(404).json({ success: false, message: 'Service request not found' });

    const user = await User.findById(req.user.id);
    const isFarmer = sr.userId.toString() === req.user.id;
    const isStaff = !!user && ['field_worker', 'admin'].includes(user.role);
    if (!isFarmer && !isStaff) {
      return res.status(403).json({ success: false, message: 'Not authorized to reject negotiation' });
    }

    sr.status = targetStatus; // e.g., back to under_review
    sr.negotiation = {
      ...(sr.negotiation || {}),
      awaiting: 'none',
      history: [ ...(sr.negotiation?.history || []), { by: isStaff ? 'staff' : 'farmer', notes: `rejected: ${reason || ''}`, at: new Date() } ]
    };

    await sr.save();

    return res.json({ success: true, message: 'Negotiation rejected', data: sr });
  } catch (err) {
    console.error('Negotiation reject error:', err);
    return res.status(500).json({ success: false, message: 'Server error during reject' });
  }
});

module.exports = router;
