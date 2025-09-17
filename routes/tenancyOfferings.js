const express = require('express');
const router = express.Router();
const TenancyOffering = require('../models/TenancyOffering');
const LandRegistration = require('../models/LandRegistration');
const Register = require('../models/Register');
const { protect, adminOnly } = require('../middlewares/auth');
const { sendAdminNotificationEmail } = require('../utils/emailService');



// @route   POST /api/tenancy-offerings
// @desc    Create new tenancy offering
// @access  Private (Land owners only)
router.post('/', protect, async (req, res) => {
  try {
    console.log('🏞️ Creating new tenancy offering:', req.body);

    const {
      selectedLandId,
      minimumDuration,
      maximumDuration,
      tenancyRate,
      rateType,
      paymentTerms,
      securityDeposit,
      allowedActivities,
      restrictions,
      maintenanceResponsibility,
      infrastructureProvided,
      availableFrom,
      availableUntil,
      preferredTenantType,
      minimumExperience,
      renewalOption,
      terminationClause,
      additionalTerms,
      contactMethod,
      bestTimeToContact,
      showContactDetails
    } = req.body;

    // Validate required fields
    if (!selectedLandId || !minimumDuration || !maximumDuration || !tenancyRate || !rateType || !paymentTerms || !availableFrom) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Verify land ownership and status
    const land = await LandRegistration.findById(selectedLandId);
    if (!land) {
      return res.status(404).json({
        success: false,
        message: 'Land not found'
      });
    }

    if (land.ownerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only create offerings for your own land'
      });
    }

    if (land.status !== 'verified') {
      return res.status(400).json({
        success: false,
        message: 'Land must be verified before creating tenancy offering'
      });
    }

    // Generate offering ID
    const offeringCount = await TenancyOffering.countDocuments();
    const offeringId = `TO${String(offeringCount + 1).padStart(3, '0')}`;

    // Create tenancy offering
    const tenancyOffering = new TenancyOffering({
      offeringId,
      landId: selectedLandId,
      ownerId: req.user.id,
      leaseDuration: {
        minimumDuration: parseInt(minimumDuration),
        maximumDuration: parseInt(maximumDuration),
        unit: 'years'
      },
      tenancyRate: parseFloat(tenancyRate),
      rateType,
      paymentTerms,
      securityDeposit: securityDeposit ? parseFloat(securityDeposit) : 0,
      allowedActivities: allowedActivities || ['rubber_tapping'],
      restrictions,
      maintenanceResponsibility: maintenanceResponsibility || 'tenant',
      infrastructureProvided: infrastructureProvided || [],
      availableFrom: new Date(availableFrom),
      availableUntil: availableUntil ? new Date(availableUntil) : undefined,
      preferredTenantType: preferredTenantType || 'any',
      minimumExperience,
      renewalOption: renewalOption || 'negotiable',
      terminationClause,
      additionalTerms,
      contactMethod: contactMethod || 'phone',
      bestTimeToContact: bestTimeToContact || 'morning',
      showContactDetails: showContactDetails !== false,
      status: 'available'
    });

    await tenancyOffering.save();

    // Update land availability status
    await LandRegistration.findByIdAndUpdate(selectedLandId, {
      isAvailableForTenancy: true,
      $push: { tenancyOfferings: tenancyOffering._id }
    });

    // Send notifications to admin, tappers, brokers, and workers
    await sendNotificationsForNewOffering(tenancyOffering, land, req.user);

    res.status(201).json({
      success: true,
      message: 'Tenancy offering created successfully! Notifications sent to potential tenants.',
      data: tenancyOffering
    });

  } catch (error) {
    console.error('❌ Error creating tenancy offering:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating tenancy offering',
      error: error.message
    });
  }
});

// Function to send notifications for new offering
async function sendNotificationsForNewOffering(offering, land, owner) {
  try {
    // Send notification to admin
    await sendAdminNotificationEmail({
      type: 'tenancy_offering',
      title: 'New Tenancy Offering Available',
      message: `${owner.name} has offered ${land.landTitle} for rubber tapping tenancy`,
      data: {
        offeringId: offering.offeringId,
        landTitle: land.landTitle,
        landLocation: land.landLocation,
        ownerName: owner.name,
        tenancyRate: offering.tenancyRate,
        rateType: offering.rateType,
        availableFrom: offering.availableFrom,
        submittedAt: new Date().toISOString()
      }
    });

    // Get all registered tappers, brokers, and workers
    const potentialTenants = await Register.find({
      role: { $in: ['staff', 'broker'] },
      isActive: true
    });

    // Record notifications sent
    const notificationRecords = [];
    
    // Group by role for notification tracking
    const roleGroups = {
      admin: ['admin'],
      tappers: potentialTenants.filter(user => user.role === 'staff'),
      brokers: potentialTenants.filter(user => user.role === 'broker'),
      workers: potentialTenants.filter(user => user.role === 'staff')
    };

    for (const [roleType, users] of Object.entries(roleGroups)) {
      if (users.length > 0) {
        notificationRecords.push({
          type: roleType,
          sentAt: new Date(),
          recipients: users.map(user => ({
            recipientId: user._id,
            status: 'sent'
          }))
        });
      }
    }

    // Update offering with notification records
    await TenancyOffering.findByIdAndUpdate(offering._id, {
      $push: { notificationsSent: { $each: notificationRecords } }
    });

    console.log(`✅ Notifications sent for offering ${offering.offeringId} to ${potentialTenants.length} potential tenants`);

  } catch (error) {
    console.error('❌ Error sending notifications for new offering:', error);
    // Don't fail the offering creation if notifications fail
  }
}

// @route   GET /api/tenancy-offerings
// @desc    Get all available tenancy offerings
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { 
      status = 'available',
      district,
      minRate,
      maxRate,
      rateType,
      minDuration,
      maxDuration,
      page = 1,
      limit = 10,
      sortBy = 'newest'
    } = req.query;

    // Build query
    let query = { status };
    
    if (district) {
      // Need to join with LandRegistration to filter by district
      const landIds = await LandRegistration.find({ district }).distinct('_id');
      query.landId = { $in: landIds };
    }
    
    if (minRate || maxRate) {
      query.tenancyRate = {};
      if (minRate) query.tenancyRate.$gte = parseFloat(minRate);
      if (maxRate) query.tenancyRate.$lte = parseFloat(maxRate);
    }
    
    if (rateType) query.rateType = rateType;
    
    if (minDuration) query['leaseDuration.minimumDuration'] = { $gte: parseInt(minDuration) };
    if (maxDuration) query['leaseDuration.maximumDuration'] = { $lte: parseInt(maxDuration) };

    // Sort options
    let sortOptions = {};
    switch (sortBy) {
      case 'newest':
        sortOptions = { createdAt: -1 };
        break;
      case 'oldest':
        sortOptions = { createdAt: 1 };
        break;
      case 'price_low':
        sortOptions = { tenancyRate: 1 };
        break;
      case 'price_high':
        sortOptions = { tenancyRate: -1 };
        break;
      case 'duration':
        sortOptions = { 'leaseDuration.minimumDuration': 1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    const offerings = await TenancyOffering.find(query)
      .populate('landInfo', 'landTitle landLocation district totalArea numberOfTrees')
      .populate('ownerInfo', 'name email phone')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await TenancyOffering.countDocuments(query);

    res.status(200).json({
      success: true,
      count: offerings.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: offerings
    });

  } catch (error) {
    console.error('❌ Error fetching tenancy offerings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tenancy offerings',
      error: error.message
    });
  }
});

// @route   GET /api/tenancy-offerings/my-offerings
// @desc    Get user's tenancy offerings
// @access  Private
router.get('/my-offerings', protect, async (req, res) => {
  try {
    const offerings = await TenancyOffering.find({ ownerId: req.user.id })
      .populate('landInfo', 'landTitle landLocation district totalArea')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: offerings.length,
      data: offerings
    });

  } catch (error) {
    console.error('❌ Error fetching user offerings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching offerings',
      error: error.message
    });
  }
});

// @route   PUT /api/tenancy-offerings/:id/status
// @desc    Update tenancy offering status (when leased/bought)
// @access  Private
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { status, tenantId, leaseStartDate, leaseEndDate, contractDetails } = req.body;

    if (!['available', 'under_negotiation', 'leased', 'expired', 'withdrawn'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const offering = await TenancyOffering.findById(req.params.id);
    if (!offering) {
      return res.status(404).json({
        success: false,
        message: 'Tenancy offering not found'
      });
    }

    // Check if user is owner or admin
    if (offering.ownerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update offering status
    const updateData = { status };

    // If status is leased, update tenant information
    if (status === 'leased' && tenantId) {
      updateData.currentTenant = {
        tenantId,
        leaseStartDate: leaseStartDate ? new Date(leaseStartDate) : new Date(),
        leaseEndDate: leaseEndDate ? new Date(leaseEndDate) : undefined,
        contractDetails
      };

      // Update land availability
      await LandRegistration.findByIdAndUpdate(offering.landId, {
        isAvailableForTenancy: false
      });
    } else if (status === 'available') {
      // If status changed back to available, clear tenant info and update land
      updateData.currentTenant = undefined;
      await LandRegistration.findByIdAndUpdate(offering.landId, {
        isAvailableForTenancy: true
      });
    }

    const updatedOffering = await TenancyOffering.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('landInfo', 'landTitle landLocation')
     .populate('ownerInfo', 'name email');

    res.status(200).json({
      success: true,
      message: `Tenancy offering status updated to ${status}`,
      data: updatedOffering
    });

  } catch (error) {
    console.error('❌ Error updating tenancy offering status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating tenancy offering status',
      error: error.message
    });
  }
});

// @route   POST /api/tenancy-offerings/:id/apply
// @desc    Apply for tenancy offering
// @access  Private
router.post('/:id/apply', protect, async (req, res) => {
  try {
    const { message } = req.body;

    const offering = await TenancyOffering.findById(req.params.id);
    if (!offering) {
      return res.status(404).json({
        success: false,
        message: 'Tenancy offering not found'
      });
    }

    if (offering.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'This tenancy offering is no longer available'
      });
    }

    // Check if user already applied
    const existingApplication = offering.applications.find(
      app => app.applicantId.toString() === req.user.id
    );

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this tenancy'
      });
    }

    // Add application
    offering.applications.push({
      applicantId: req.user.id,
      applicationDate: new Date(),
      status: 'pending',
      message: message || ''
    });

    // Increment inquiries count
    offering.inquiries += 1;

    await offering.save();

    res.status(200).json({
      success: true,
      message: 'Application submitted successfully',
      data: offering
    });

  } catch (error) {
    console.error('❌ Error applying for tenancy:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while applying for tenancy',
      error: error.message
    });
  }
});

module.exports = router;
