const User = require('../models/User');
const Register = require('../models/Register');

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    // Fetch all users from Register collection, excluding passwords
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    
    // Format users for frontend
    const formattedUsers = users.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      provider: 'email', // Since these are from MongoDB
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`,
      created_at: user.createdAt,
      last_sign_in: user.updatedAt, // Using updatedAt as proxy for last activity
      email_verified: user.isVerified || true, // Default to true if not set
      isVerified: user.isVerified || true
    }));

    res.json({
      success: true,
      users: formattedUsers,
      total: formattedUsers.length
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const formattedUser = {
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      location: user.location,
      bio: user.bio,
      profileImage: user.profileImage,
      provider: 'email',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`,
      created_at: user.createdAt,
      last_sign_in: user.updatedAt,
      email_verified: user.isVerified || true,
      isVerified: user.isVerified || true
    };

    res.json({
      success: true,
      user: formattedUser
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  console.log('🚀🚀🚀 UPDATE USER FUNCTION CALLED 🚀🚀🚀');
  console.log('Request method:', req.method);
  console.log('Request URL:', req.originalUrl);
  console.log('Request headers:', req.headers);
  console.log('Request body keys:', Object.keys(req.body));
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('Phone value:', req.body.phone);
  console.log('Location value:', req.body.location);
  console.log('Bio value:', req.body.bio);
  try {
    console.log('🔄 Update user request received');
    console.log('User ID:', req.params.id);
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const { id } = req.params;
    const { name, email, role, isVerified, phone, location, bio, profileImage } = req.body;

    // Validate user ID format (MongoDB ObjectId or UUID)
    const isValidMongoId = id && id.match(/^[0-9a-fA-F]{24}$/);
    const isValidUUID = id && id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i);

    if (!id || (!isValidMongoId && !isValidUUID)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      });
    }

    console.log('📝 Updating user with data:', {
      name, email, role, isVerified, phone, location, bio,
      profileImage: profileImage ? 'Present' : 'Not present'
    });

    // Find and update user - handle both MongoDB ObjectId and UUID formats
    console.log('🔍 Attempting to find and update user with ID:', id);
    let user;
    try {
      // Try to find user by _id first (MongoDB ObjectId)
      if (isValidMongoId) {
        user = await User.findByIdAndUpdate(
          id,
          {
            name,
            email,
            role,
            isVerified,
            phone: phone || '',
            location: location || '',
            bio: bio || '',
            profileImage: profileImage || '',
            updatedAt: new Date()
          },
          { new: true, runValidators: true }
        ).select('-password');
      } else if (isValidUUID) {
        // For UUID format, we need to search by a different field or handle differently
        // Since the User model uses MongoDB ObjectId, we'll need to find by another field
        // For now, let's try to find by email or another unique identifier
        console.log('⚠️ UUID format detected, but User model expects MongoDB ObjectId');
        return res.status(400).json({
          success: false,
          message: 'User ID format not supported for this operation. Please use MongoDB ObjectId format.'
        });
      }

      console.log('✅ MongoDB operation completed');
    } catch (mongoError) {
      console.error('❌ MongoDB error:', mongoError);
      throw mongoError;
    }

    console.log('✅ User updated successfully:', user ? 'Found' : 'Not found');

    if (!user) {
      console.log('❌ User not found with ID:', id);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const formattedUser = {
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      location: user.location,
      bio: user.bio,
      profileImage: user.profileImage,
      provider: 'email',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`,
      created_at: user.createdAt,
      last_sign_in: user.updatedAt,
      email_verified: user.isVerified || true,
      isVerified: user.isVerified || true
    };

    res.json({
      success: true,
      message: 'User updated successfully',
      user: formattedUser
    });
  } catch (error) {
    console.error('❌ Error updating user:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);

    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Update user profile (for user self-updates)
exports.updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, location, bio, profileImage } = req.body;

    // Find and update user profile
    const user = await User.findByIdAndUpdate(
      id,
      {
        name,
        email,
        phone,
        location,
        bio,
        profileImage,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const formattedUser = {
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      location: user.location,
      bio: user.bio,
      profileImage: user.profileImage,
      provider: 'email',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`,
      created_at: user.createdAt,
      last_sign_in: user.updatedAt,
      email_verified: user.isVerified || true,
      isVerified: user.isVerified || true
    };

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: formattedUser
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

// Get users by role
exports.getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    console.log(`📊 Fetching users with role: ${role} from Register collection`);

    // Query Register collection for users with the specified role
    const users = await Register.find({ role }).select('-password').sort({ createdAt: -1 });
    console.log(`📊 Found ${users.length} users with role ${role}`);

    const formattedUsers = users.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      location: user.location,
      bio: user.bio,
      role: user.role,
      provider: 'email',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`,
      created_at: user.createdAt,
      last_sign_in: user.updatedAt,
      email_verified: user.isVerified,
      isVerified: user.isVerified,
      // Include broker-specific details if available
      brokerDetails: user.brokerDetails || null,
      // Include broker profile with OCR validation status
      brokerProfile: user.brokerProfile || null,
      // Include verification data if available
      verification: user.verification || null
    }));

    console.log(`📊 Formatted ${formattedUsers.length} users for response`);
    console.log('📊 Sample broker data being returned:', formattedUsers[0] ? {
      name: formattedUsers[0].name,
      brokerProfile: formattedUsers[0].brokerProfile,
      verification: formattedUsers[0].verification
    } : 'No users found');

    res.json({
      success: true,
      users: formattedUsers,
      total: formattedUsers.length,
      role: role
    });
  } catch (error) {
    console.error('❌ Error fetching users by role:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users by role',
      error: error.message
    });
  }
};

// Get user statistics
exports.getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent users (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    res.json({
      success: true,
      stats: {
        total: totalUsers,
        verified: verifiedUsers,
        recent: recentUsers,
        byRole: usersByRole.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user statistics',
      error: error.message
    });
  }
};

// Get statistics from Register collection
exports.getRegisterStats = async (req, res) => {
  try {
    console.log('📊 Fetching statistics from Register collection...');

    // Get total counts by role
    const roleStats = await Register.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get total users
    const totalUsers = await Register.countDocuments();

    // Get verified users
    const verifiedUsers = await Register.countDocuments({ isVerified: true });

    // Get active users
    const activeUsers = await Register.countDocuments({ isActive: true });

    // Get recent registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentRegistrations = await Register.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Format role statistics
    const roleBreakdown = roleStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    // Get specific counts for dashboard
    const farmers = roleBreakdown.farmer || 0;
    const brokers = roleBreakdown.broker || 0;
    const staff = roleBreakdown.staff || 0;
    const tappers = roleBreakdown.tapper || 0;
    const admins = roleBreakdown.admin || 0;

    console.log('📊 Register collection stats:', {
      total: totalUsers,
      farmers,
      brokers,
      staff,
      tappers,
      admins,
      verified: verifiedUsers,
      active: activeUsers,
      recent: recentRegistrations
    });

    res.json({
      success: true,
      stats: {
        total: totalUsers,
        verified: verifiedUsers,
        active: activeUsers,
        recent: recentRegistrations,
        byRole: roleBreakdown,
        breakdown: {
          farmers,
          brokers,
          staff,
          tappers,
          admins
        }
      }
    });

  } catch (error) {
    console.error('Error getting Register stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting Register statistics',
      error: error.message
    });
  }
};

// Get recent registrations from Register collection
exports.getRecentRegistrations = async (req, res) => {
  try {
    console.log('📅 Fetching recent registrations from Register collection...');

    // Get recent registrations (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentUsers = await Register.find({
      createdAt: { $gte: sevenDaysAgo }
    })
    .select('name email role createdAt isVerified')
    .sort({ createdAt: -1 })
    .limit(10);

    console.log(`📅 Found ${recentUsers.length} recent registrations`);

    // Format for frontend
    const formattedUsers = recentUsers.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.createdAt,
      isVerified: user.isVerified
    }));

    res.json({
      success: true,
      users: formattedUsers,
      total: formattedUsers.length
    });

  } catch (error) {
    console.error('Error getting recent registrations:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting recent registrations',
      error: error.message
    });
  }
};
