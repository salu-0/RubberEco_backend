const Staff = require('../models/Staff');
const User = require('../models/User');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { sendStaffWelcomeEmail } = require('../utils/emailService');

// Generate password based on name and first two digits of phone number
const generateStaffPassword = (name, phone) => {
  // Extract first name and remove spaces/special characters
  const firstName = name.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');

  // Extract first two digits from phone number
  const phoneDigits = phone.replace(/[^0-9]/g, '').substring(0, 2);

  // Create password: firstname + first2digits + "eco"
  const password = `${firstName}${phoneDigits}eco`;

  return password;
};

// Get all staff members
const getAllStaff = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      role = '', 
      status = '', 
      location = '',
      department = ''
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role && role !== 'all') filter.role = role;
    if (status && status !== 'all') filter.status = status;
    if (location) filter.location = { $regex: location, $options: 'i' };
    if (department) filter.department = { $regex: department, $options: 'i' };

    const skip = (page - 1) * limit;
    
    const staff = await Staff.find(filter)
      .populate('created_by', 'name email')
      .populate('updated_by', 'name email')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Staff.countDocuments(filter);
    
    res.json({
      success: true,
      data: staff,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_items: total,
        items_per_page: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get all staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff members',
      error: error.message
    });
  }
};

// Get staff member by ID
const getStaffById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID'
      });
    }

    const staff = await Staff.findById(id)
      .populate('created_by', 'name email')
      .populate('updated_by', 'name email');

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    res.json({
      success: true,
      data: staff
    });
  } catch (error) {
    console.error('Get staff by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff member',
      error: error.message
    });
  }
};

// Create new staff member
const createStaff = async (req, res) => {
  console.log('🚀 createStaff function called!');
  console.log('📝 Creating new staff member...');
  console.log('Request body:', req.body);

  try {
    const {
      name,
      email,
      phone,
      role,
      department,
      location,
      avatar,
      salary,
      address,
      emergency_contact,
      skills,
      notes
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !role || !department || !location) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, email, phone, role, department, location'
      });
    }

    // Check if email already exists
    const existingStaff = await Staff.findOne({ email: email.toLowerCase() });
    if (existingStaff) {
      return res.status(400).json({
        success: false,
        message: 'Staff member with this email already exists'
      });
    }

    // Generate password based on name and phone number
    const generatedPassword = generateStaffPassword(name, phone);
    console.log(`🔑 Generated password for ${name}: ${generatedPassword}`);
    console.log(`🔍 Password generation details:`);
    console.log(`- Name: "${name}"`);
    console.log(`- Phone: "${phone}"`);
    console.log(`- Generated password: "${generatedPassword}"`);
    console.log(`- Password length: ${generatedPassword.length}`);

    // Hash the password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(generatedPassword, saltRounds);
    console.log(`🔒 Password hashed successfully`);
    console.log(`🔍 Hashed password length: ${hashedPassword.length}`);

    // Get or create a default admin user for created_by if no authenticated user
    let createdByUser = null;
    if (req.user) {
      createdByUser = req.user.id;
    } else {
      // Find or create a default admin user
      let adminUser = await User.findOne({ email: 'admin@gmail.com' });
      if (!adminUser) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('admin@47', 12);
        adminUser = new User({
          name: 'System Administrator',
          email: 'admin@gmail.com',
          password: hashedPassword,
          role: 'admin',
          isVerified: true
        });
        await adminUser.save();
        console.log('✅ Created default admin user for staff creation');
      }
      createdByUser = adminUser._id;
    }

    // Create new staff member
    const newStaff = new Staff({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone.trim(),
      role,
      department: department.trim(),
      location: location.trim(),
      avatar: avatar || '',
      salary: salary || 0,
      address: address || {},
      emergency_contact: emergency_contact || {},
      skills: skills || [],
      notes: notes || '',
      created_by: createdByUser,
      updated_by: createdByUser,
      last_active: new Date()
    });

    const savedStaff = await newStaff.save();

    // Populate the created_by field for response
    await savedStaff.populate('created_by', 'name email');

    // Send welcome email to the new staff member with password
    try {
      console.log(`📧 Sending welcome email with credentials to new staff member: ${savedStaff.email}`);
      console.log(`🔍 Email parameters:`);
      console.log(`- Staff email: ${savedStaff.email}`);
      console.log(`- Generated password: "${generatedPassword}"`);
      console.log(`- Password exists: ${!!generatedPassword}`);
      console.log(`- Admin data:`, savedStaff.created_by);

      const emailResult = await sendStaffWelcomeEmail(savedStaff, savedStaff.created_by, generatedPassword);

      if (emailResult.success) {
        console.log(`✅ Welcome email with credentials sent successfully to ${savedStaff.email}`);
      } else {
        console.log(`⚠️ Welcome email failed for ${savedStaff.email}: ${emailResult.message}`);
      }
    } catch (emailError) {
      console.error(`❌ Error sending welcome email to ${savedStaff.email}:`, emailError.message);
      // Don't fail the staff creation if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      data: savedStaff
    });
  } catch (error) {
    console.error('❌ Create staff error:', error);
    console.error('Error stack:', error.stack);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Staff member with this email already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create staff member',
      error: error.message
    });
  }
};

// Update staff profile (staff can update their own profile)
const updateStaffProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log('🔄 Staff profile update request received');
    console.log('🔍 Staff ID:', id);
    console.log('🔍 User ID from token:', req.user?.id);
    console.log('🔍 Update data keys:', Object.keys(updateData));

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID'
      });
    }

    // Check if the user is trying to update their own profile
    if (req.user && req.user.id !== id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own profile'
      });
    }

    // Find the staff member
    const staff = await Staff.findById(id);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Only allow updating certain fields for profile updates
    const allowedFields = ['name', 'phone', 'location', 'avatar'];
    const filteredUpdateData = {};
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredUpdateData[field] = updateData[field];
      }
    }

    // Add updated_by field
    filteredUpdateData.updated_by = req.user ? req.user.id : null;

    console.log('🔍 Filtered update data:', filteredUpdateData);

    const updatedStaff = await Staff.findByIdAndUpdate(
      id,
      filteredUpdateData,
      { new: true, runValidators: true }
    ).populate('created_by updated_by', 'name email');

    if (!updatedStaff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    console.log('✅ Staff profile updated successfully');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedStaff
    });
  } catch (error) {
    console.error('Update staff profile error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists for another staff member'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

// Update staff member (admin only)
const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log('🔄 Staff update request received');
    console.log('🔍 Staff ID:', id);
    console.log('🔍 Update data keys:', Object.keys(updateData));

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID'
      });
    }

    // Handle image upload specifically
    if (updateData.avatar && updateData.avatar.startsWith('data:image/')) {
      console.log('🖼️ Image upload detected in update request');
      console.log(`🔍 Image size: ${Math.round(updateData.avatar.length / 1024)}KB`);
    }

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.created_by;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // Add updated_by field
    updateData.updated_by = req.user ? req.user.id : null;

    const updatedStaff = await Staff.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('created_by updated_by', 'name email');

    if (!updatedStaff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    res.json({
      success: true,
      message: 'Staff member updated successfully',
      data: updatedStaff
    });
  } catch (error) {
    console.error('Update staff error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists for another staff member'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update staff member',
      error: error.message
    });
  }
};

// Delete staff member
const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID'
      });
    }

    const deletedStaff = await Staff.findByIdAndDelete(id);

    if (!deletedStaff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    res.json({
      success: true,
      message: 'Staff member deleted successfully',
      data: deletedStaff
    });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete staff member',
      error: error.message
    });
  }
};

// Get staff statistics
const getStaffStats = async (req, res) => {
  try {
    const totalStaff = await Staff.countDocuments();
    const activeStaff = await Staff.countDocuments({ status: 'active' });
    const inactiveStaff = await Staff.countDocuments({ status: 'inactive' });
    
    // Get role distribution
    const roleStats = await Staff.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get department distribution
    const departmentStats = await Staff.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get location distribution
    const locationStats = await Staff.aggregate([
      { $group: { _id: '$location', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Calculate average performance rating
    const performanceStats = await Staff.aggregate([
      { $group: { 
        _id: null, 
        avgRating: { $avg: '$performance_rating' },
        avgCompletionRate: { 
          $avg: { 
            $cond: [
              { $eq: ['$tasks_assigned', 0] },
              0,
              { $multiply: [{ $divide: ['$tasks_completed', '$tasks_assigned'] }, 100] }
            ]
          }
        }
      }}
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          total_staff: totalStaff,
          active_staff: activeStaff,
          inactive_staff: inactiveStaff,
          avg_rating: performanceStats[0]?.avgRating || 0,
          avg_completion_rate: performanceStats[0]?.avgCompletionRate || 0
        },
        role_distribution: roleStats,
        department_distribution: departmentStats,
        location_distribution: locationStats
      }
    });
  } catch (error) {
    console.error('Get staff stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff statistics',
      error: error.message
    });
  }
};

// Change staff password
const changeStaffPassword = async (req, res) => {
  try {
    console.log('🔄 Password change request received');
    console.log('🔍 Request params:', req.params);
    console.log('🔍 Request body:', req.body);
    console.log('🔍 Request headers:', req.headers);

    const { id } = req.params;
    const { newPassword } = req.body;

    // Validate input
    if (!newPassword) {
      console.log('❌ Missing new password field');
      return res.status(400).json({
        success: false,
        message: 'New password is required'
      });
    }

    if (newPassword.length < 6) {
      console.log('❌ Password too short:', newPassword.length);
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    console.log('🔍 Validating staff ID:', id);
    console.log('🔍 Is valid ObjectId:', mongoose.Types.ObjectId.isValid(id));

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('❌ Invalid staff ID format');
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID'
      });
    }

    // Find staff member
    const staff = await Staff.findById(id);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    staff.password = hashedNewPassword;
    staff.updated_by = req.user ? req.user.id : null;

    console.log(`🔄 Updating password for staff: ${staff.name} (${staff.email})`);
    console.log(`🔍 Staff ID: ${staff._id}`);
    console.log(`🔍 New password hash length: ${hashedNewPassword.length}`);

    const savedStaff = await staff.save();

    console.log(`✅ Password changed successfully for staff: ${staff.name} (${staff.email})`);
    console.log(`🔍 Database save result - Modified count: ${savedStaff.modifiedCount || 'N/A'}`);
    console.log(`🔍 Updated timestamp: ${savedStaff.updatedAt}`);

    // Verify the password was actually updated by fetching the staff again
    const verifyStaff = await Staff.findById(id).select('+password');
    const isNewPasswordSet = await bcrypt.compare(newPassword, verifyStaff.password);
    console.log(`🔍 Password verification - New password correctly set: ${isNewPasswordSet}`);

    res.json({
      success: true,
      message: 'Password changed successfully',
      verified: isNewPasswordSet
    });

  } catch (error) {
    console.error('Change staff password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
};

// Utility: Reset staff password (for troubleshooting)
exports.resetStaffPassword = async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ success: false, message: 'Email and newPassword required' });
  }
  try {
    const staff = await Staff.findOne({ email: email.toLowerCase() });
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    staff.password = hashedPassword;
    await staff.save();
    return res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error resetting password', error: err.message });
  }
};


module.exports = {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  updateStaffProfile,
  deleteStaff,
  getStaffStats,
  changeStaffPassword,
  resetStaffPassword: exports.resetStaffPassword
};
