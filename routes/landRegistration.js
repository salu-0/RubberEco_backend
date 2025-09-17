const express = require('express');
const router = express.Router();
const LandRegistration = require('../models/LandRegistration');
const { protect, adminOnly } = require('../middlewares/auth');
const { sendAdminNotificationEmail } = require('../utils/emailService');



// @route   POST /api/land-registration
// @desc    Register new land
// @access  Private (Farmers only)
router.post('/', protect, async (req, res) => {
  try {
    console.log('🏞️ POST route hit! Creating new land registration');
    console.log('🏞️ Request body:', req.body);
    console.log('🏞️ User from auth:', req.user);

    const {
      ownerName,
      fatherName,
      phoneNumber,
      email,
      address,
      landTitle,
      landLocation,
      district,
      state,
      pincode,
      surveyNumber,
      subDivision,
      totalArea,
      landType,
      topography,
      latitude,
      longitude,
      roadAccess,
      electricityAvailable,
      nearestTown,
      distanceFromTown,
      numberOfTrees,
      treeAge,
      currentYield,
      plantingYear,
      treeVariety,
      documents,
      previousCrops,
      irrigationFacility,
      storageCapacity,
      additionalNotes
    } = req.body;

    // Validate required fields (landTitle is now optional)
    if (!ownerName || !landLocation || !district || !totalArea || !surveyNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: Owner Name, Land Location, District, Total Area, and Survey Number'
      });
    }

    // Generate collision-resistant registration ID (timestamp + random)
    const makeRegistrationId = () => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
      return `LR${y}${m}${d}${hh}${mm}${ss}-${rand}`;
    };
    let registrationId = makeRegistrationId();

    // Generate default land title if not provided
    const finalLandTitle = landTitle && landTitle.trim()
      ? landTitle.trim()
      : `Land at ${landLocation}`;

    // Create land registration
    const landRegistration = new LandRegistration({
      registrationId,
      ownerId: req.user.id,
      ownerName,
      fatherName,
      phoneNumber,
      email,
      address,
      landTitle: finalLandTitle,
      landLocation,
      district,
      state: state || 'Kerala',
      pincode,
      surveyNumber,
      subDivision,
      totalArea,
      landType: landType || 'agricultural',
      topography: topography || 'flat',
      coordinates: {
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined
      },
      roadAccess: roadAccess || 'yes',
      electricityAvailable: electricityAvailable || 'yes',
      nearestTown,
      distanceFromTown,
      numberOfTrees: numberOfTrees ? parseInt(numberOfTrees) : undefined,
      treeAge,
      currentYield,
      plantingYear,
      treeVariety,
      documents: documents || [],
      previousCrops,
      irrigationFacility: irrigationFacility || 'no',
      storageCapacity,
      additionalNotes,
      status: 'pending_verification'
    });

    await landRegistration.save();

    // Send notification to admin
    try {
      await sendAdminNotificationEmail({
        type: 'land_registration',
        title: 'New Land Registration',
        message: `${ownerName} has registered a new land: ${landTitle} in ${district}`,
        data: {
          registrationId,
          ownerName,
          landTitle,
          landLocation,
          district,
          totalArea,
          submittedAt: new Date().toISOString()
        }
      });
    } catch (emailError) {
      console.error('❌ Failed to send admin notification email:', emailError);
      // Don't fail the registration if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Land registration submitted successfully! It will be reviewed by our team.',
      data: landRegistration
    });

  } catch (error) {
    console.error('❌ Error creating land registration:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while registering land',
      error: error.message
    });
  }
});

// @route   GET /api/land-registration/my-lands
// @desc    Get user's registered lands
// @access  Private
router.get('/my-lands', protect, async (req, res) => {
  try {
    const lands = await LandRegistration.find({ ownerId: req.user.id })
      .sort({ createdAt: -1 })
      .populate('ownerInfo', 'name email');

    res.status(200).json({
      success: true,
      count: lands.length,
      data: lands
    });

  } catch (error) {
    console.error('❌ Error fetching user lands:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching lands',
      error: error.message
    });
  }
});

// @route   GET /api/land-registration
// @desc    Get all land registrations (Admin only)
// @access  Private (Admin only)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { status, district, page = 1, limit = 10 } = req.query;

    // Build query
    let query = {};
    if (status) query.status = status;
    if (district) query.district = district;

    const lands = await LandRegistration.find(query)
      .populate('ownerInfo', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await LandRegistration.countDocuments(query);

    res.status(200).json({
      success: true,
      count: lands.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: lands
    });

  } catch (error) {
    console.error('❌ Error fetching land registrations:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching land registrations',
      error: error.message
    });
  }
});

// @route   PUT /api/land-registration/:id/verify
// @desc    Verify land registration (Admin only)
// @access  Private (Admin only)
router.put('/:id/verify', protect, adminOnly, async (req, res) => {
  try {
    const { status, comments } = req.body;

    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either verified or rejected'
      });
    }

    const land = await LandRegistration.findByIdAndUpdate(
      req.params.id,
      {
        status,
        verificationDate: new Date(),
        verificationComments: comments,
        verifiedBy: req.user.id
      },
      { new: true }
    ).populate('ownerInfo', 'name email');

    if (!land) {
      return res.status(404).json({
        success: false,
        message: 'Land registration not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `Land registration ${status} successfully`,
      data: land
    });

  } catch (error) {
    console.error('❌ Error verifying land registration:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying land registration',
      error: error.message
    });
  }
});

// @route   GET /api/land-registration/:id
// @desc    Get specific land registration
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const land = await LandRegistration.findById(req.params.id)
      .populate('ownerInfo', 'name email phone')
      .populate('tenancyOfferings');

    if (!land) {
      return res.status(404).json({
        success: false,
        message: 'Land registration not found'
      });
    }

    // Check if user is owner or admin
    if (land.ownerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: land
    });

  } catch (error) {
    console.error('❌ Error fetching land registration:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching land registration',
      error: error.message
    });
  }
});

module.exports = router;
