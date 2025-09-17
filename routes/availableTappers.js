const express = require('express');
const router = express.Router();
const Staff = require('../models/Staff');
const TappingRequest = require('../models/TappingRequest');

// Get available tappers (registered users with role 'tapper' who are not currently assigned)
router.get('/', async (req, res) => {
  try {
    console.log('🔍 Fetching available tappers...');
    
    // Get all staff tappers
    const tappers = await Staff.find({
      role: 'tapper',
      status: 'active' // Only active staff members
    }).select('name email phone location experience rating profileImage createdAt');

    console.log(`📋 Found ${tappers.length} staff tappers`);

    // Get currently assigned tapper IDs from active tapping requests
    const activeTappingRequests = await TappingRequest.find({
      status: { $in: ['assigned', 'in_progress'] },
      'assignedTapper.tapperId': { $exists: true, $ne: null }
    }).select('assignedTapper.tapperId');

    const assignedTapperIds = activeTappingRequests
      .map(req => req.assignedTapper?.tapperId?.toString())
      .filter(Boolean);
    console.log(`🔒 Found ${assignedTapperIds.length} assigned tappers:`, assignedTapperIds);

    // Filter out assigned tappers
    const availableTappers = tappers.filter(tapper => 
      !assignedTapperIds.includes(tapper._id.toString())
    );

    console.log(`✅ ${availableTappers.length} tappers available for assignment`);

    // Format the response with additional info
    const formattedTappers = availableTappers.map(tapper => ({
      id: tapper._id,
      name: tapper.name,
      email: tapper.email,
      phone: tapper.phone,
      location: tapper.location || 'Location not specified',
      experience: tapper.experience || 'Experience not specified',
      rating: tapper.rating || 4.0,
      profileImage: tapper.profileImage,
      joinedDate: tapper.createdAt,
      status: 'available'
    }));

    res.json({
      success: true,
      tappers: formattedTappers,
      count: formattedTappers.length
    });
  } catch (error) {
    console.error('❌ Error fetching available tappers:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching available tappers', 
      error: error.message 
    });
  }
});

module.exports = router;
