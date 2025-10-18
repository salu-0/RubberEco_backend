const express = require('express');
const router = express.Router();
const TappingRequest = require('../models/TappingRequest');
const ServiceRequestApplication = require('../models/ServiceRequestApplication');
const Staff = require('../models/Staff');
const { protect } = require('../middlewares/auth');

console.log('🔧 NEW Service Application routes loaded at', new Date().toISOString());

// Apply authentication to all routes
router.use(protect);

// Submit application for a service request - FIXED TO USE PROPER MODEL
router.post('/submit-application/:requestId', async (req, res) => {
  console.log('🚀 NEW APPLICATION ROUTE HIT!', new Date().toISOString());
  console.log('🚀 Request params:', req.params);
  console.log('🚀 Request body:', req.body);
  console.log('🚀 User:', { id: req.user?.id, email: req.user?.email, role: req.user?.role });
  
  try {
    const { requestId } = req.params;
    const staffId = req.user.id;
    
    // Get staff details - check both Staff and Register collections
    let staff = await Staff.findById(staffId);
    
    if (!staff) {
      const Register = require('../models/Register');
      const user = await Register.findById(staffId);
      
      if (user && ['tapper', 'trainer', 'supervisor', 'admin'].includes(user.role)) {
        staff = {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone || 'Not provided',
          role: user.role
        };
      }
    }
    
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found or not eligible for applications'
      });
    }
    
    // Check if tapping request exists
    const tappingRequest = await TappingRequest.findById(requestId);
    if (!tappingRequest) {
      return res.status(404).json({
        success: false,
        message: 'Tapping request not found'
      });
    }
    
    // Check if already applied using ServiceRequestApplication model
    const existingApplication = await ServiceRequestApplication.findOne({
      tappingRequestId: requestId,
      staffId: staffId
    });
    
    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this service request'
      });
    }
    
    // Create application using the proper ServiceRequestApplication model
    const applicationData = {
      tappingRequestId: requestId,
      staffId: staffId,
      staffName: staff.name,
      staffEmail: staff.email,
      staffPhone: staff.phone,
      staffRole: staff.role,
      availability: req.body.availability || {},
      experience: req.body.experience || {},
      location: req.body.location || {},
      proposedRate: req.body.proposedRate || {},
      coverLetter: req.body.coverLetter || 'I am interested in this opportunity.',
      suitabilityReasons: req.body.suitabilityReasons || [],
      references: req.body.references || [],
      status: 'under_review', // Changed from 'submitted' to 'under_review' when staff applies
      applicationSource: 'staff_dashboard'
    };
    
    const newApplication = new ServiceRequestApplication(applicationData);
    await newApplication.save();
    
    // Update the tapping request status to 'under_review' when first staff applies
    const existingApplicationsCount = await ServiceRequestApplication.countDocuments({
      tappingRequestId: requestId
    });
    
    if (existingApplicationsCount === 1) {
      // This is the first application, update tapping request status
      const TappingRequest = require('../models/TappingRequest');
      const tappingRequest = await TappingRequest.findById(requestId);
      if (tappingRequest) {
        tappingRequest.status = 'under_review';
        await tappingRequest.save();
        console.log('✅ Updated tapping request status to "under_review"');
      }
    }
    
    console.log('✅ Application saved successfully using ServiceRequestApplication model');
    
    res.json({
      success: true,
      message: 'Application submitted successfully and is now under review!',
      data: {
        applicationId: newApplication.applicationId,
        requestId: requestId,
        staffId: staffId,
        status: 'under_review',
        submittedAt: newApplication.submittedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Error submitting application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit application',
      error: error.message
    });
  }
});

// Approve/select an application for a tapping request and update counters
router.put('/applications/:applicationId/approve', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const application = await ServiceRequestApplication.findOne({ applicationId });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // Load tapping request
    const TappingRequest = require('../models/TappingRequest');
    const request = await TappingRequest.findById(application.tappingRequestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Tapping request not found' });
    }

    // Prevent double-counting same tapper
    const tapperId = String(application.staffId);
    if (!request.tappersAccepted.includes(tapperId)) {
      // Only increment if capacity available
      if (request.acceptedTappers < request.requiredTappers) {
        request.tappersAccepted.push(tapperId);
        request.acceptedTappers += 1;
        request.status = request.acceptedTappers === request.requiredTappers ? 'completed' : 'in_progress';
        await request.save();
      }
    }

    // Update application status to selected/accepted
    application.status = 'accepted';
    await application.save();

    return res.json({ success: true, message: 'Application approved and counters updated', data: { acceptedTappers: request.acceptedTappers, requiredTappers: request.requiredTappers } });
  } catch (err) {
    console.error('Approve application error:', err);
    return res.status(500).json({ success: false, message: 'Server error approving application', error: err.message });
  }
});

// Reject an application for a tapping request (farmer action)
router.put('/applications/:applicationId/reject', async (req, res) => {
  try {
    const { applicationId } = req.params;
    // Try by custom applicationId; fallback to Mongo _id
    let application = await ServiceRequestApplication.findOne({ applicationId });
    if (!application && applicationId.match(/^[0-9a-fA-F]{24}$/)) {
      application = await ServiceRequestApplication.findById(applicationId);
    }
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // Load tapping request to verify ownership
    const TappingRequest = require('../models/TappingRequest');
    const request = await TappingRequest.findById(application.tappingRequestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Tapping request not found' });
    }

    // Optional: enforce only farmer owner can reject
    const userId = req.user?.id?.toString();
    if (request.farmerId && userId && request.farmerId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Only the request owner can reject applications' });
    }

    // Do not allow rejecting already accepted applications via this route
    if (application.status === 'accepted') {
      return res.status(400).json({ success: false, message: 'Cannot reject an already accepted application' });
    }

    application.status = 'rejected';
    await application.save();

    return res.json({ success: true, message: 'Application rejected successfully', data: { status: application.status } });
  } catch (err) {
    console.error('Reject application error:', err);
    return res.status(500).json({ success: false, message: 'Server error rejecting application', error: err.message });
  }
});

// Get available service requests
router.get('/available', async (req, res) => {
  try {
    console.log('📋 Getting available requests for staff:', req.user.id);
    
    const availableRequests = await TappingRequest.find({
      status: { $in: ['submitted', 'under_review'] },
      'assignedTapper.tapperId': { $exists: false }
    }).sort({ submittedAt: -1 });
    
    // Get application counts for each request
    const requestIds = availableRequests.map(req => req._id);
    const applicationCounts = await ServiceRequestApplication.aggregate([
      { $match: { tappingRequestId: { $in: requestIds } } },
      { $group: { _id: '$tappingRequestId', count: { $sum: 1 } } }
    ]);
    
    const applicationCountMap = {};
    applicationCounts.forEach(item => {
      applicationCountMap[item._id.toString()] = item.count;
    });
    
    // Add application count to each request
    const requestsWithCounts = availableRequests.map(request => ({
      ...request.toObject(),
      applicationCount: applicationCountMap[request._id.toString()] || 0
    }));
    
    res.json({
      success: true,
      total: requestsWithCounts.length,
      data: requestsWithCounts
    });
    
  } catch (error) {
    console.error('Error fetching available requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available requests',
      error: error.message
    });
  }
});

// Get staff's applications
router.get('/my-applications', async (req, res) => {
  try {
    const staffId = req.user.id;
    
    // Use ServiceRequestApplication model to get applications
    const applications = await ServiceRequestApplication.find({ staffId })
      .populate('tappingRequestId', 'farmerName farmLocation farmerEstimatedTrees')
      .sort({ submittedAt: -1 });
    
    const myApplications = applications.map(app => ({
      ...app.toObject(),
      tappingRequest: app.tappingRequestId
    }));
    
    res.json({
      success: true,
      total: myApplications.length,
      data: myApplications
    });
    
  } catch (error) {
    console.error('Error fetching my applications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: error.message
    });
  }
});

module.exports = router;
