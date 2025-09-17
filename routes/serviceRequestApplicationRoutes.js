const express = require('express');
const router = express.Router();
const ServiceRequestApplication = require('../models/ServiceRequestApplication');
const TappingRequest = require('../models/TappingRequest');
const Staff = require('../models/Staff');
const { protect, adminOnly } = require('../middlewares/auth');
const { sendAdminNotificationEmail } = require('../utils/emailService');

console.log('🔧 ServiceRequestApplication routes loaded at', new Date().toISOString());

// Test route to verify router is working (before auth middleware)
router.get('/test', (req, res) => {
  console.log('🧪 Test route hit!');
  res.json({ success: true, message: 'Service application routes are working!' });
});

// Test route to check request status (before auth middleware)
router.get('/check-request/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    console.log('🔍 Checking request status for:', requestId);
    
    // Allow request lookup by Mongo _id or friendly requestId
    let tappingRequest = null;
    try {
      tappingRequest = await TappingRequest.findById(requestId);
    } catch (_) {}
    if (!tappingRequest) {
      tappingRequest = await TappingRequest.findOne({ requestId: requestId });
    }
    if (!tappingRequest) {
      return res.json({ 
        success: false, 
        message: 'Request not found',
        requestId: requestId
      });
    }
    
    res.json({
      success: true,
      data: {
        requestId: tappingRequest.requestId,
        status: tappingRequest.status,
        farmerName: tappingRequest.farmerName,
        farmLocation: tappingRequest.farmLocation,
        submittedAt: tappingRequest.submittedAt
      }
    });
  } catch (error) {
    console.error('Error checking request:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking request',
      error: error.message
    });
  }
});

// Simple application submission endpoint (before auth middleware for testing)
router.post('/simple-apply/:requestId', async (req, res) => {
  console.log('🚀 SIMPLE APPLY ROUTE HIT!');
  try {
    const { requestId } = req.params;
    console.log('Request ID:', requestId);
    console.log('Request body:', req.body);

    // Simple success response for testing
    res.json({
      success: true,
      message: 'Application submitted successfully (test mode)',
      data: {
        applicationId: `TEST-${Date.now()}`,
        requestId: requestId,
        status: 'submitted'
      }
    });
  } catch (error) {
    console.error('Simple apply error:', error);
    res.status(500).json({
      success: false,
      message: 'Simple apply failed',
      error: error.message
    });
  }
});

// Staff routes (protected)
router.use(protect);

// Test endpoint to check route registration
router.get('/test-status', (req, res) => {
  console.log('🧪 TEST STATUS ENDPOINT HIT!');
  res.json({ success: true, message: 'Test status endpoint working!' });
});

// Update application status (for staff to start/complete tasks)
router.put('/update-status/:applicationId', async (req, res) => {
  console.log('🎯 STATUS UPDATE ENDPOINT HIT!', req.params, req.body);
  try {
    const { applicationId } = req.params;
    const { status, notes } = req.body;
    const staffId = req.user._id || req.user.id;
    
    console.log(`🔄 Updating application ${applicationId} status to:`, status);
    console.log('🔍 User info:', { userId: staffId, userRole: req.user.role });
    
    const application = await ServiceRequestApplication.findOne({ applicationId });
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    
    console.log('🔍 Application found:', { 
      applicationId: application.applicationId, 
      staffId: application.staffId.toString(), 
      currentUserId: staffId.toString(),
      match: application.staffId.toString() === staffId.toString()
    });
    
    // Verify the staff member owns this application
    if (application.staffId.toString() !== staffId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own applications.'
      });
    }
    
    // Validate status transition
    const validTransitions = {
      'accepted': ['in_progress'],
      'agreed': ['in_progress'],
      'selected': ['in_progress'],
      'in_progress': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': []
    };
    
    if (!validTransitions[application.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${application.status} to ${status}`
      });
    }
    
    // Update status
    application.status = status;
    application.updatedAt = new Date();
    
    // Add communication record if notes provided
    if (notes) {
      application.communications.push({
        type: 'staff_message',
        message: `Status updated to ${status}. ${notes}`,
        sentBy: staffId,
        sentAt: new Date(),
        isRead: false
      });
    }
    
    await application.save();
    
    // If starting task, also update the tapping request status
    if (status === 'in_progress') {
      const TappingRequest = require('../models/TappingRequest');
      await TappingRequest.findByIdAndUpdate(
        application.tappingRequestId,
        { 
          status: 'in_progress',
          updatedAt: new Date()
        }
      );
    }
    
    // If completing task, update tapping request to completed
    if (status === 'completed') {
      const TappingRequest = require('../models/TappingRequest');
      await TappingRequest.findByIdAndUpdate(
        application.tappingRequestId,
        { 
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date()
        }
      );
    }
    
    console.log('✅ Application status updated successfully');
    
    res.json({
      success: true,
      message: `Application status updated to ${status}`,
      data: {
        applicationId: application.applicationId,
        status: application.status,
        updatedAt: application.updatedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating application status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update application status',
      error: error.message
    });
  }
});

// Get available service requests for staff to apply
router.get('/available-requests', async (req, res) => {
  try {
    console.log('🌐 GET /api/service-applications/available-requests - ' + new Date().toISOString());
    console.log('📋 Fetching available service requests for staff');
    console.log('📋 Query params:', req.query);
    console.log('📋 User from auth:', req.user ? { id: req.user._id, name: req.user.name } : 'No user');

    const { location, maxDistance = 50, staffRole } = req.query;
    
    // Find requests that are submitted or under_review and not yet assigned
    console.log('🔍 Searching for available requests...');
    const availableRequests = await TappingRequest.find({
      status: { $in: ['submitted', 'under_review', 'negotiating'] },
      'assignedTapper.tapperId': { $exists: false }
    }).sort({ urgency: -1, submittedAt: 1 });

    console.log(`🔍 Found ${availableRequests.length} requests from database`);
    
    // Filter by location if specified
    let filteredRequests = availableRequests;
    if (location) {
      filteredRequests = availableRequests.filter(request => 
        request.farmLocation.toLowerCase().includes(location.toLowerCase())
      );
      console.log(`🔍 Filtered to ${filteredRequests.length} requests by location: ${location}`);
    }

    // Filter by max distance if specified
    if (maxDistance && maxDistance !== '50') {
      // For now, just return all requests since distance calculation would require coordinates
      console.log(`🔍 Distance filtering not implemented yet, returning all ${filteredRequests.length} requests`);
    }

    console.log(`✅ Returning ${filteredRequests.length} available requests`);
    res.json({
      success: true,
      data: filteredRequests
    });

  } catch (error) {
    console.error('❌ Error fetching available requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available requests',
      error: error.message
    });
  }
});

// Apply for a service request
router.post('/apply/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const staffId = req.user._id || req.user.id;
    const { proposedRate, proposedTreeCount, notes } = req.body;
    
    console.log(`🚀 Staff ${staffId} applying for request ${requestId}`);
    console.log('📋 Application details:', { proposedRate, proposedTreeCount, notes });
    
    // Get the tapping request details first
    const tappingRequest = await TappingRequest.findOne({ requestId: requestId });
    if (!tappingRequest) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found'
      });
    }
    
    // Check if staff has already applied for this request
    const existingApplication = await ServiceRequestApplication.findOne({
      tappingRequestId: tappingRequest._id,
      staffId: staffId
    });
    
    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this request'
      });
    }
    
    // Create new application
    const application = new ServiceRequestApplication({
      tappingRequestId: tappingRequest._id, // Use the MongoDB ObjectId
      staffId: staffId,
      staffName: req.user.name || 'Unknown Staff',
      staffEmail: req.user.email || 'unknown@example.com',
      staffPhone: req.user.phone || 'Unknown',
      staffRole: req.user.role || 'field_worker',
      proposedRate: {
        amount: proposedRate || 5,
        currency: 'INR',
        perTree: true
      },
      coverLetter: notes || 'I am interested in this tapping request and can provide quality service.',
      suitabilityReasons: [
        'Experienced in rubber tapping',
        'Available for the required duration',
        'Located near the farm area'
      ],
      experience: {
        yearsOfExperience: 2,
        previousWork: 'Rubber plantation tapping',
        skills: ['Tree tapping', 'Latex collection', 'Equipment handling']
      },
      location: {
        address: 'Near farm area',
        distanceFromFarm: 10,
        coordinates: [0, 0]
      },
      availability: {
        startDate: new Date(),
        duration: '3 months',
        workingHours: '6 AM - 2 PM'
      },
      status: 'under_review' // Changed from 'submitted' to 'under_review' when staff applies
    });
    
    await application.save();
    
    // Update the tapping request status to 'under_review' when first staff applies
    const existingApplicationsCount = await ServiceRequestApplication.countDocuments({
      tappingRequestId: tappingRequest._id
    });
    
    if (existingApplicationsCount === 1) {
      // This is the first application, update tapping request status
      tappingRequest.status = 'under_review';
      await tappingRequest.save();
      console.log('✅ Updated tapping request status to "under_review"');
    }
    
    console.log('✅ Application created successfully:', application.applicationId);
    
    res.json({
      success: true,
      message: 'Application submitted successfully and is now under review',
      data: {
        applicationId: application.applicationId,
        status: application.status,
        submittedAt: application.submittedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Error creating application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create application',
      error: error.message
    });
  }
});

// Get user's applications
router.get('/my-applications', async (req, res) => {
  try {
    const staffId = req.user._id || req.user.id;
    console.log(`📋 Fetching applications for staff ${staffId}`);
    
    const applications = await ServiceRequestApplication.find({ staffId })
      .populate('tappingRequestId')
      .sort({ submittedAt: -1 });
    
    console.log(`✅ Found ${applications.length} applications for staff`);
    
    res.json({
      success: true,
      data: applications
    });
    
  } catch (error) {
    console.error('❌ Error fetching user applications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: error.message
    });
  }
});

// Get assigned tasks for staff
router.get('/assigned-tasks', async (req, res) => {
  try {
    const staffId = req.user._id || req.user.id;
    console.log(`📋 Fetching assigned tasks for staff ${staffId}`);
    
    // Find applications that are accepted/agreed and assigned to this staff
    const assignedTasks = await ServiceRequestApplication.find({ 
      staffId,
      status: { $in: ['accepted', 'agreed', 'assigned', 'in_progress', 'completed'] }
    })
      .populate('tappingRequestId')
      .sort({ updatedAt: -1 });
    
    console.log(`✅ Found ${assignedTasks.length} assigned tasks for staff`);
    
    res.json({
      success: true,
      data: assignedTasks
    });
    
  } catch (error) {
    console.error('❌ Error fetching assigned tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assigned tasks',
      error: error.message
    });
  }
});

// Get assigned workers for a farmer
router.get('/farmer/assigned-workers/:email', async (req, res) => {
  try {
    const { email } = req.params;
    console.log(`👨‍🌾 Fetching assigned workers for farmer ${email}`);
    
    // Find tapping requests for this farmer
    const tappingRequests = await TappingRequest.find({ 
      farmerEmail: email,
      status: { $in: ['accepted', 'assigned', 'in_progress', 'completed'] }
    });
    
    console.log(`🔍 Found ${tappingRequests.length} tapping requests for farmer`);
    
    // Get assigned workers from service request applications
    const assignedWorkers = [];
    
    for (const request of tappingRequests) {
      const applications = await ServiceRequestApplication.find({
        tappingRequestId: request._id,
        status: { $in: ['accepted', 'agreed', 'assigned', 'in_progress', 'completed'] }
      }).populate('staffId', 'name email phone role');
      
      for (const app of applications) {
        assignedWorkers.push({
          id: app._id,
          name: app.staffName,
          email: app.staffEmail,
          phone: app.staffPhone,
          role: app.staffRole,
          serviceType: 'Tapping',
          requestId: request.requestId,
          status: app.status,
          assignedAt: app.updatedAt,
          farmLocation: request.farmLocation
        });
      }
    }
    
    console.log(`✅ Found ${assignedWorkers.length} assigned workers for farmer`);
    
    res.json({
      success: true,
      workers: assignedWorkers
    });
    
  } catch (error) {
    console.error('❌ Error fetching assigned workers for farmer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assigned workers',
      error: error.message
    });
  }
});

// Withdraw application
router.put('/withdraw/:applicationId', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const staffId = req.user._id || req.user.id;
    
    console.log(`❌ Staff ${staffId} withdrawing application ${applicationId}`);
    
    // Find by friendly applicationId or fallback to Mongo _id for robustness
    let application = await ServiceRequestApplication.findOne({ applicationId: applicationId });
    if (!application) {
      try {
        application = await ServiceRequestApplication.findById(applicationId);
      } catch (_) {}
    }
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Ensure only the applicant staff can submit the initial proposal
    if (application.staffId.toString() !== staffId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the applicant staff can submit the initial proposal'
      });
    }
    
    if (application.status !== 'submitted' && application.status !== 'under_review') {
      return res.status(400).json({
        success: false,
        message: 'Can only withdraw submitted or under review applications'
      });
    }
    
    application.status = 'withdrawn';
    application.updatedAt = new Date();
    await application.save();
    
    console.log('✅ Application withdrawn successfully');
    
    res.json({
      success: true,
      message: 'Application withdrawn successfully',
      data: {
        applicationId: application.applicationId,
        status: application.status
      }
    });
    
  } catch (error) {
    console.error('❌ Error withdrawing application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to withdraw application',
      error: error.message
    });
  }
});

// Get applications for a specific request (farmer view)
router.get('/farmer/request/:requestId/applications', async (req, res) => {
  try {
    const { requestId } = req.params;
    const farmerId = (req.user._id || req.user.id || '').toString();
    const userRole = req.user.role;
    const userEmail = req.user.email;
    
    console.log(`👨‍🌾 Farmer ${farmerId} fetching applications for request ${requestId}`);
    
    // Verify the farmer owns this request (with relaxed checks and admin override)
    const tappingRequest = await TappingRequest.findById(requestId);
    if (!tappingRequest) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    const ownsById = tappingRequest.farmerId && tappingRequest.farmerId.toString() === farmerId;
    const ownsByEmail = tappingRequest.farmerEmail && userEmail && tappingRequest.farmerEmail === userEmail;
    const isAdmin = userRole === 'admin';
    if (!ownsById && !ownsByEmail && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the request owner or admin can view applications.'
      });
    }
    
    const applications = await ServiceRequestApplication.find({ tappingRequestId: requestId })
      .populate('staffId', 'name email phone')
      .sort({ submittedAt: 1 });
    
    console.log(`✅ Found ${applications.length} applications for request`);
    
    res.json({
      success: true,
      data: applications
    });
    
  } catch (err) {
    console.error('Error fetching farmer-visible applications:', err);
    return res.status(500).json({ success: false, message: 'Failed to load applications' });
  }
});

// Staff and Farmer accessible routes (negotiation, proposals, etc.)

// Submit initial proposal for negotiation
router.post('/:applicationId/propose', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { proposedRate, proposedTreeCount, proposedTiming, notes } = req.body;
    const staffId = req.user._id || req.user.id;
    
    console.log(`💰 Staff ${staffId} submitting proposal for application ${applicationId}`);
    
    const application = await ServiceRequestApplication.findOne({
      applicationId: applicationId,
      staffId: staffId
    });
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    
    if (application.status !== 'submitted' && application.status !== 'under_review') {
      return res.status(400).json({
        success: false,
        message: 'Can only submit proposal for submitted or under review applications'
      });
    }
    
    await application.submitInitialProposal(proposedRate, proposedTreeCount, proposedTiming, notes);
    
    // Update the tapping request status to 'negotiating' when first proposal is submitted
    const TappingRequest = require('../models/TappingRequest');
    const tappingRequest = await TappingRequest.findById(application.tappingRequestId);
    if (tappingRequest && tappingRequest.status === 'under_review') {
      tappingRequest.status = 'negotiating';
      await tappingRequest.save();
      console.log('✅ Updated tapping request status to "negotiating"');
    }
    
    console.log('✅ Initial proposal submitted successfully');
    
    res.json({
      success: true,
      message: 'Initial proposal submitted successfully',
      data: {
        applicationId: application.applicationId,
        status: application.status,
        negotiation: application.negotiation
      }
    });
    
  } catch (error) {
    console.error('❌ Error submitting proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit proposal',
      error: error.message
    });
  }
});

// Submit counter proposal
router.post('/:applicationId/counter-propose', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { proposedRate, proposedTreeCount, proposedTiming, notes, proposedBy } = req.body;
    const userId = req.user._id || req.user.id;
    
    console.log(`🔄 ${proposedBy} ${userId} submitting counter proposal for application ${applicationId}`);
    
    // Find by friendly applicationId or fallback to Mongo _id for robustness
    let application = await ServiceRequestApplication.findOne({ applicationId: applicationId });
    if (!application) {
      try {
        application = await ServiceRequestApplication.findById(applicationId);
      } catch (_) {}
    }
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    
    if (application.status !== 'negotiating') {
      return res.status(400).json({
        success: false,
        message: 'Can only submit counter proposals for negotiating applications'
      });
    }
    
    // Verify user has permission to propose
    if (proposedBy === 'staff' && application.staffId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the applicant staff can submit staff proposals'
      });
    }
    
    if (proposedBy === 'farmer') {
      // Check if user is the farmer who created the request
      const TappingRequest = require('../models/TappingRequest');
      const tappingRequest = await TappingRequest.findById(application.tappingRequestId);
      if (!tappingRequest) {
        return res.status(404).json({ success: false, message: 'Related tapping request not found' });
      }

      // Use ObjectId comparison to avoid string/ObjectId mismatches
      const mongoose = require('mongoose');
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const isFarmer = tappingRequest.farmerId.equals(userObjectId);
      if (!isFarmer) {
        return res.status(403).json({
          success: false,
          message: 'Only the farmer can submit farmer proposals'
        });
      }
    }
    
    await application.submitCounterProposal(proposedRate, proposedTreeCount, proposedTiming, notes, proposedBy);
    
    console.log('✅ Counter proposal submitted successfully');
    
    res.json({
      success: true,
      message: 'Counter proposal submitted successfully',
      data: {
        applicationId: application.applicationId,
        status: application.status,
        negotiation: application.negotiation
      }
    });
    
  } catch (error) {
    console.error('❌ Error submitting counter proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit counter proposal',
      error: error.message
    });
  }
});

// Accept proposal
router.post('/:applicationId/accept', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { acceptedBy } = req.body;
    const userId = req.user._id || req.user.id;
    const userEmail = (req.user.email || '').toLowerCase();
    
    console.log(`✅ ${acceptedBy} ${userId} accepting proposal for application ${applicationId}`);
    
    // Find by friendly applicationId or fallback to Mongo _id for robustness
    let application = await ServiceRequestApplication.findOne({ applicationId: applicationId });
    if (!application) {
      try {
        application = await ServiceRequestApplication.findById(applicationId);
      } catch (_) {}
    }
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    
    if (application.status !== 'negotiating') {
      return res.status(400).json({
        success: false,
        message: 'Can only accept proposals for negotiating applications'
      });
    }
    
    // Verify user has permission to accept
    if (acceptedBy === 'staff') {
      // Use ObjectId comparison to avoid string/ObjectId mismatches
      const mongoose = require('mongoose');
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const isStaff = application.staffId.equals(userObjectId);
      
      console.log('🔍 Staff authorization check:', {
        applicationStaffId: application.staffId.toString(),
        userId: userId,
        userObjectId: userObjectId.toString(),
        isStaff: isStaff
      });
      
      if (!isStaff) {
        return res.status(403).json({
          success: false,
          message: 'Only the applicant staff can accept as staff'
        });
      }
    }
    
    if (acceptedBy === 'farmer') {
      // Check if user is the farmer who created the request
      const TappingRequest = require('../models/TappingRequest');
      const tappingRequest = await TappingRequest.findById(application.tappingRequestId);
      if (!tappingRequest) {
        return res.status(404).json({ success: false, message: 'Linked tapping request not found' });
      }

      const farmerIdMatch = tappingRequest.farmerId && tappingRequest.farmerId.toString() === userId;
      const farmerEmailMatch = (tappingRequest.farmerEmail || '').toLowerCase() === userEmail;

      console.log('🔎 Farmer verification:', {
        userId,
        userEmail,
        requestFarmerId: tappingRequest.farmerId?.toString?.(),
        requestFarmerEmail: tappingRequest.farmerEmail,
        farmerIdMatch,
        farmerEmailMatch
      });

      if (!farmerIdMatch && !farmerEmailMatch) {
        return res.status(403).json({
          success: false,
          message: 'Only the farmer can accept as farmer'
        });
      }
    }
    
    await application.acceptProposal(acceptedBy);
    
    // Update the associated TappingRequest status to 'accepted' when proposal is accepted
    const TappingRequest = require('../models/TappingRequest');
    const tappingRequest = await TappingRequest.findById(application.tappingRequestId);
    if (tappingRequest && tappingRequest.status === 'negotiating') {
      tappingRequest.status = 'accepted';
      await tappingRequest.save();
      console.log('✅ Updated tapping request status to "accepted"');
    }
    
    console.log('✅ Proposal accepted successfully');
    
    res.json({
      success: true,
      message: 'Proposal accepted successfully',
      data: {
        applicationId: application.applicationId,
        status: application.status,
        negotiation: application.negotiation
      }
    });
    
  } catch (error) {
    console.error('❌ Error accepting proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept proposal',
      error: error.message
    });
  }
});

// Reject proposal
router.post('/:applicationId/reject', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { rejectedBy } = req.body;
    const userId = req.user._id || req.user.id;
    
    console.log(`❌ ${rejectedBy} ${userId} rejecting proposal for application ${applicationId}`);
    
    // Find by friendly applicationId or fallback to Mongo _id for robustness
    let application = await ServiceRequestApplication.findOne({ applicationId: applicationId });
    if (!application) {
      try {
        application = await ServiceRequestApplication.findById(applicationId);
      } catch (_) {}
    }
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    
    if (application.status !== 'negotiating') {
      return res.status(400).json({
        success: false,
        message: 'Can only reject proposals for negotiating applications'
      });
    }
    
    // Verify user has permission to reject
    if (rejectedBy === 'staff') {
      // Use ObjectId comparison to avoid string/ObjectId mismatches
      const mongoose = require('mongoose');
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const isStaff = application.staffId.equals(userObjectId);
      
      if (!isStaff) {
        return res.status(403).json({
          success: false,
          message: 'Only the applicant staff can reject as staff'
        });
      }
    }
    
    if (rejectedBy === 'farmer') {
      // Check if user is the farmer who created the request
      const TappingRequest = require('../models/TappingRequest');
      const tappingRequest = await TappingRequest.findById(application.tappingRequestId);
      if (!tappingRequest) {
        return res.status(404).json({ success: false, message: 'Related tapping request not found' });
      }

      // Use ObjectId comparison for farmer
      const mongoose = require('mongoose');
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const isFarmer = tappingRequest.farmerId.equals(userObjectId);
      
      if (!isFarmer) {
        return res.status(403).json({
          success: false,
          message: 'Only the farmer can reject as farmer'
        });
      }
    }
    
    await application.rejectProposal(rejectedBy);
    
    console.log('✅ Proposal rejected successfully');
    
    res.json({
      success: true,
      message: 'Proposal rejected successfully',
      data: {
        applicationId: application.applicationId,
        status: application.status,
        negotiation: application.negotiation
      }
    });
    
  } catch (error) {
    console.error('❌ Error rejecting proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject proposal',
      error: error.message
    });
  }
});

// Get negotiation details
router.get('/:applicationId/negotiation', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const userId = req.user._id || req.user.id;
    
    console.log(`🔍 User ${userId} fetching negotiation details for application ${applicationId}`);
    
    // Find by friendly applicationId or fallback to Mongo _id for robustness
    let application = await ServiceRequestApplication.findOne({ applicationId: applicationId })
      .populate('tappingRequestId', 'farmerId farmerName farmLocation farmSize farmerEstimatedTrees budgetPerTree');
    if (!application) {
      try {
        application = await ServiceRequestApplication.findById(applicationId)
          .populate('tappingRequestId', 'farmerId farmerName farmLocation farmSize farmerEstimatedTrees budgetPerTree');
      } catch (_) {}
    }
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    
    // Check if user has permission to view this negotiation
    console.log('🔍 Authorization check:');
    console.log('🔍 User ID:', userId);
    console.log('🔍 Application staffId (raw):', application.staffId);
    console.log('🔍 Application tappingRequestId.farmerId:', application.tappingRequestId?.farmerId);
    
    // Convert userId to ObjectId for comparison since it comes as a string from the token
    const mongoose = require('mongoose');
    const userIdObjectId = new mongoose.Types.ObjectId(userId);
    
    const isStaff = application.staffId.equals(userIdObjectId);
    const isFarmer = application.tappingRequestId.farmerId.equals(userIdObjectId);
    
    console.log('🔍 Staff ID comparison:', application.staffId.toString(), '===', userIdObjectId.toString(), '=', isStaff);
    console.log('🔍 Farmer ID comparison:', application.tappingRequestId.farmerId.toString(), '===', userIdObjectId.toString(), '=', isFarmer);
    
    if (!isStaff && !isFarmer) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You must be either the staff applicant or the farmer who created this request.'
      });
    }
    
    // Get staff details for response
    let staffDetails = null;
    try {
      if (application.staffModel === 'Staff') {
        const Staff = require('../models/Staff');
        staffDetails = await Staff.findById(application.staffId).select('name email phone');
      } else {
        const Register = require('../models/Register');
        staffDetails = await Register.findById(application.staffId).select('name email phone');
      }
    } catch (staffError) {
      console.log('⚠️ Could not load staff details:', staffError.message);
    }

    // Safely serialize the response to avoid virtual field errors
    // Ensure phone is available: prefer application snapshot (as requested), then live staff data
    const staffPhone = application.staffPhone || (staffDetails && staffDetails.phone) || 'Not provided';
    const responseData = {
      applicationId: application.applicationId,
      status: application.status,
      negotiation: application.negotiation,
      tappingRequest: {
        _id: application.tappingRequestId._id,
        farmerId: application.tappingRequestId.farmerId,
        farmerName: application.tappingRequestId.farmerName,
        farmLocation: application.tappingRequestId.farmLocation,
        farmSize: application.tappingRequestId.farmSize,
        numberOfTrees: application.tappingRequestId.farmerEstimatedTrees,
        budgetPerTree: application.tappingRequestId.budgetPerTree,
        status: application.tappingRequestId.status,
        submittedAt: application.tappingRequestId.submittedAt
      },
      staff: staffDetails
        ? { ...staffDetails.toObject ? staffDetails.toObject() : staffDetails, phone: staffPhone }
        : { _id: application.staffId, name: application.staffName, email: application.staffEmail, phone: staffPhone }
    };

    res.json({
      success: true,
      data: responseData
    });
    
  } catch (error) {
    console.error('❌ Error fetching negotiation details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch negotiation details',
      error: error.message
    });
  }
});

// Admin routes
router.use(adminOnly);

// Get all applications for a specific request
router.get('/request/:requestId/applications', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, sortBy = 'priorityScore', sortOrder = 'desc' } = req.query;
    
    console.log(`📋 Admin fetching applications for request ${requestId}`);
    
    const applications = await ServiceRequestApplication.getApplicationsForRequest(requestId, status);
    
    // Sort applications
    const sortMultiplier = sortOrder === 'desc' ? -1 : 1;
    applications.sort((a, b) => {
      if (sortBy === 'priorityScore') {
        return (b.priorityScore - a.priorityScore) * sortMultiplier;
      } else if (sortBy === 'submittedAt') {
        return (new Date(b.submittedAt) - new Date(a.submittedAt)) * sortMultiplier;
      } else if (sortBy === 'distance') {
        return (a.location.distanceFromFarm - b.location.distanceFromFarm) * sortMultiplier;
      }
      return 0;
    });
    
    console.log(`✅ Found ${applications.length} applications for request`);
    
    res.json({
      success: true,
      data: applications,
      total: applications.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching request applications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: error.message
    });
  }
});

// Select staff for a request
router.post('/select/:applicationId', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const adminId = req.user._id || req.user.id;
    const { finalRate, startDate, specialInstructions } = req.body;
    
    console.log(`👤 Admin ${adminId} selecting application ${applicationId}`);
    
    const application = await ServiceRequestApplication.findOne({ applicationId })
      .populate('tappingRequestId')
      .populate('staffId');
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    
    // Select this application
    await application.select(adminId, finalRate, startDate, specialInstructions);
    
    // Update the tapping request with assigned staff
    const tappingRequest = application.tappingRequestId;
    tappingRequest.assignedTapper = {
      tapperId: application.staffId._id,
      tapperName: application.staffName,
      tapperPhone: application.staffPhone,
      tapperEmail: application.staffEmail,
      assignedAt: new Date(),
      assignedBy: adminId
    };
    tappingRequest.status = 'assigned';
    await tappingRequest.save();
    
    // Reject other applications for this request
    await ServiceRequestApplication.updateMany(
      { 
        tappingRequestId: application.tappingRequestId._id,
        _id: { $ne: application._id },
        status: { $in: ['submitted', 'under_review', 'shortlisted'] }
      },
      { 
        status: 'rejected',
        'adminReview.reviewedBy': adminId,
        'adminReview.reviewedAt': new Date(),
        'adminReview.reviewNotes': 'Another candidate was selected for this position',
        updatedAt: new Date()
      }
    );
    
    console.log('✅ Application selected and others rejected');
    
    res.json({
      success: true,
      message: 'Application selected successfully',
      data: {
        applicationId: application.applicationId,
        status: application.status,
        selectionDetails: application.selectionDetails
      }
    });
    
  } catch (error) {
    console.error('❌ Error selecting application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to select application',
      error: error.message
    });
  }
});

module.exports = router;
