const TrainingEnrollment = require('../models/TrainingEnrollment');
const User = require('../models/Register');

// Enroll user in a training module
exports.enrollInTraining = async (req, res) => {
  try {
    const {
      moduleId,
      moduleTitle,
      moduleLevel,
      paymentAmount,
      paymentMethod,
      userDetails,
      paymentId
    } = req.body;

    const userId = req.user.id;

    // Validate required fields
    if (!moduleId || !moduleTitle || !moduleLevel || !paymentAmount || !paymentMethod || !userDetails) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is already enrolled in this module
    const existingEnrollment = await TrainingEnrollment.findOne({
      userId,
      moduleId,
      isActive: true
    });

    if (existingEnrollment) {
      return res.status(409).json({
        success: false,
        message: 'User is already enrolled in this module'
      });
    }

    // Create new enrollment
    const enrollment = new TrainingEnrollment({
      userId,
      moduleId,
      moduleTitle,
      moduleLevel,
      paymentAmount,
      paymentMethod,
      paymentId: paymentId || `STRIPE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      paymentStatus: paymentMethod === 'stripe' ? 'completed' : 'completed', // Stripe payments are completed when we receive them
      userDetails: {
        name: userDetails.name || user.name,
        email: userDetails.email || user.email,
        phone: userDetails.phone || user.phone || '',
        experience: userDetails.experience || '',
        motivation: userDetails.motivation || ''
      },
      progress: {
        completedLessons: [],
        totalLessons: 0,
        progressPercentage: 0,
        lastAccessedDate: new Date()
      }
    });

    await enrollment.save();

    // Populate user details for response
    await enrollment.populate('userId', 'name email');

    res.status(201).json({
      success: true,
      message: 'Successfully enrolled in training module',
      enrollment: {
        id: enrollment._id,
        moduleId: enrollment.moduleId,
        moduleTitle: enrollment.moduleTitle,
        moduleLevel: enrollment.moduleLevel,
        paymentAmount: enrollment.paymentAmount,
        paymentMethod: enrollment.paymentMethod,
        paymentStatus: enrollment.paymentStatus,
        enrollmentDate: enrollment.enrollmentDate,
        progress: enrollment.progress
      }
    });

  } catch (error) {
    console.error('Training enrollment error:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'User is already enrolled in this module'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during enrollment'
    });
  }
};

// Get all enrollments for a user
exports.getUserEnrollments = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verify user can access this data (user themselves or admin)
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const enrollments = await TrainingEnrollment.find({ 
      userId, 
      isActive: true 
    }).sort({ enrollmentDate: -1 });

    res.json({
      success: true,
      enrollments: enrollments.map(enrollment => ({
        id: enrollment._id,
        moduleId: enrollment.moduleId,
        moduleTitle: enrollment.moduleTitle,
        moduleLevel: enrollment.moduleLevel,
        paymentAmount: enrollment.paymentAmount,
        paymentStatus: enrollment.paymentStatus,
        enrollmentDate: enrollment.enrollmentDate,
        progress: enrollment.progress,
        certificateIssued: enrollment.certificateIssued
      }))
    });

  } catch (error) {
    console.error('Get user enrollments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Check if user is enrolled in a specific module
exports.checkEnrollmentStatus = async (req, res) => {
  try {
    const { userId, moduleId } = req.params;
    
    // Verify user can access this data
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const enrollment = await TrainingEnrollment.isUserEnrolled(userId, parseInt(moduleId));

    res.json({
      success: true,
      isEnrolled: !!enrollment,
      enrollment: enrollment ? {
        id: enrollment._id,
        moduleId: enrollment.moduleId,
        moduleTitle: enrollment.moduleTitle,
        enrollmentDate: enrollment.enrollmentDate,
        progress: enrollment.progress
      } : null
    });

  } catch (error) {
    console.error('Check enrollment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update progress for an enrollment
exports.updateProgress = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { completedLessons, totalLessons } = req.body;

    const enrollment = await TrainingEnrollment.findById(enrollmentId);
    
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    // Verify user owns this enrollment
    if (enrollment.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await enrollment.updateProgress(completedLessons, totalLessons);

    res.json({
      success: true,
      message: 'Progress updated successfully',
      progress: enrollment.progress
    });

  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all enrollments (admin only)
exports.getAllEnrollments = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const enrollments = await TrainingEnrollment.find({ isActive: true })
      .populate('userId', 'name email')
      .sort({ enrollmentDate: -1 });

    res.json({
      success: true,
      enrollments: enrollments.map(enrollment => ({
        id: enrollment._id,
        user: {
          id: enrollment.userId._id,
          name: enrollment.userId.name,
          email: enrollment.userId.email
        },
        moduleId: enrollment.moduleId,
        moduleTitle: enrollment.moduleTitle,
        moduleLevel: enrollment.moduleLevel,
        paymentAmount: enrollment.paymentAmount,
        paymentStatus: enrollment.paymentStatus,
        enrollmentDate: enrollment.enrollmentDate,
        progress: enrollment.progress
      }))
    });

  } catch (error) {
    console.error('Get all enrollments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get enrollment statistics (admin only)
exports.getEnrollmentStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const totalEnrollments = await TrainingEnrollment.countDocuments({ isActive: true });
    const completedPayments = await TrainingEnrollment.countDocuments({ 
      isActive: true, 
      paymentStatus: 'completed' 
    });
    
    const moduleStats = await TrainingEnrollment.aggregate([
      { $match: { isActive: true } },
      { $group: { 
        _id: '$moduleId', 
        count: { $sum: 1 },
        totalRevenue: { $sum: '$paymentAmount' },
        moduleTitle: { $first: '$moduleTitle' }
      }},
      { $sort: { count: -1 } }
    ]);

    const totalRevenue = await TrainingEnrollment.aggregate([
      { $match: { isActive: true, paymentStatus: 'completed' } },
      { $group: { _id: null, total: { $sum: '$paymentAmount' } } }
    ]);

    res.json({
      success: true,
      stats: {
        totalEnrollments,
        completedPayments,
        totalRevenue: totalRevenue[0]?.total || 0,
        moduleStats
      }
    });

  } catch (error) {
    console.error('Get enrollment stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get enrollments for a specific module (admin only)
exports.getModuleEnrollments = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { moduleId } = req.params;
    const enrollments = await TrainingEnrollment.getModuleEnrollments(parseInt(moduleId));

    res.json({
      success: true,
      enrollments: enrollments.map(enrollment => ({
        id: enrollment._id,
        user: {
          id: enrollment.userId._id,
          name: enrollment.userId.name,
          email: enrollment.userId.email
        },
        paymentAmount: enrollment.paymentAmount,
        paymentStatus: enrollment.paymentStatus,
        enrollmentDate: enrollment.enrollmentDate,
        progress: enrollment.progress
      }))
    });

  } catch (error) {
    console.error('Get module enrollments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
