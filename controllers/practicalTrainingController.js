const PracticalTraining = require('../models/PracticalTraining');
const Staff = require('../models/Staff');
const Register = require('../models/Register');
const { generateUniqueId } = require('../utils/helpers');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { createEmailTransporter } = require('../utils/emailService');

// Create a new practical training session
exports.createPracticalTraining = async (req, res) => {
  try {
    console.log('🎯 Creating new practical training session');
    
    const {
      title,
      description,
      category,
      level,
      instructor,
      schedule,
      location,
      curriculum,
      prerequisites,
      enrollment,
      resources,
      weatherRequirements
    } = req.body;

    // Generate unique session ID
    const sessionId = `PT-${generateUniqueId()}`;

    // Verify instructor exists
    const instructorStaff = await Staff.findById(instructor.staffId);
    if (!instructorStaff) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found'
      });
    }

    const practicalTraining = new PracticalTraining({
      sessionId,
      title,
      description,
      category,
      level,
      instructor: {
        staffId: instructor.staffId,
        name: instructorStaff.name,
        specialization: instructor.specialization,
        experience: instructor.experience
      },
      schedule,
      location,
      curriculum,
      prerequisites,
      enrollment,
      resources,
      weatherRequirements,
      status: 'draft',
      createdBy: req.user.id
    });

    await practicalTraining.save();

    console.log('✅ Practical training session created:', sessionId);

    res.status(201).json({
      success: true,
      message: 'Practical training session created successfully',
      data: practicalTraining
    });

  } catch (error) {
    console.error('❌ Error creating practical training:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create practical training session',
      error: error.message
    });
  }
};

// Get all practical training sessions
exports.getAllPracticalTrainings = async (req, res) => {
  try {
    console.log('📋 Fetching all practical training sessions');
    
    const {
      status,
      category,
      level,
      location,
      instructor,
      page = 1,
      limit = 10,
      sortBy = 'schedule.startDate',
      sortOrder = 'asc'
    } = req.query;

    // Build filter query
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (level) filter.level = level;
    if (location) filter['location.type'] = location;
    if (instructor) filter['instructor.staffId'] = instructor;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const trainings = await PracticalTraining.find(filter)
      .populate('instructor.staffId', 'name email phone')
      .populate('participants.userId', 'name email phone')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PracticalTraining.countDocuments(filter);

    console.log(`📊 Found ${trainings.length} practical training sessions`);

    res.json({
      success: true,
      data: trainings,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_items: total,
        items_per_page: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching practical trainings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch practical training sessions',
      error: error.message
    });
  }
};

// Create Razorpay order for practical training payment
exports.createPracticalTrainingOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const training = await PracticalTraining.findById(id);
    if (!training) {
      return res.status(404).json({ success: false, message: 'Practical training session not found' });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ success: false, message: 'Razorpay keys not configured' });
    }

    // Ensure user is enrolled with pending payment
    const participant = training.participants.find(p => p.userId.toString() === userId.toString());
    if (!participant) {
      return res.status(400).json({ success: false, message: 'User is not enrolled in this training' });
    }

    if (participant.paymentStatus === 'completed') {
      return res.status(400).json({ success: false, message: 'Payment already completed' });
    }

    const amountInPaise = Math.max(1, Math.round(Number(training.enrollment.fee || 0) * 100));

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const shortId = String(id).slice(-6);
    const shortUser = String(userId).slice(-6);
    let receipt = `pt-${shortId}-${shortUser}-${Date.now().toString(36)}`;
    if (receipt.length > 40) {
      receipt = receipt.slice(0, 40);
    }

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      notes: { trainingId: String(id), title: String(training.title).slice(0, 40), userId: String(userId) }
    });

    return res.json({ success: true, data: { orderId: order.id, amount: order.amount, currency: order.currency, key: process.env.RAZORPAY_KEY_ID } });
  } catch (error) {
    console.error('❌ Error creating Razorpay order (PT):', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create payment order' });
  }
};

// Verify Razorpay payment and mark participant as paid
exports.verifyPracticalTrainingPayment = async (req, res) => {
  try {
    const { id } = req.params; // training id
    const userId = req.user.id;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ success: false, message: 'Razorpay not configured' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Signature verification failed' });
    }

    const training = await PracticalTraining.findById(id);
    if (!training) {
      return res.status(404).json({ success: false, message: 'Practical training session not found' });
    }

    const participant = training.participants.find(p => p.userId.toString() === userId.toString());
    if (!participant) {
      return res.status(400).json({ success: false, message: 'User is not enrolled in this training' });
    }

    participant.paymentStatus = 'completed';
    training.markModified('participants');
    await training.save();

    // Send confirmation email (best-effort)
    try {
      if (participant.email && process.env.EMAIL_USER && (process.env.EMAIL_PASS || process.env.GOOGLE_REFRESH_TOKEN)) {
        const transporter = createEmailTransporter();
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb;">
            <div style="background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
              <div style="background: linear-gradient(135deg,#16a34a,#15803d); color: #fff; padding: 20px 24px;">
                <h2 style="margin:0">Payment Confirmed</h2>
                <p style="margin:6px 0 0 0; opacity:.9">Practical Training: ${training.title}</p>
              </div>
              <div style="padding: 24px; color:#111827;">
                <p>Hi ${participant.name || 'Participant'},</p>
                <p>Your payment for the practical training session has been received successfully. You are fully enrolled.</p>
                <p style="color:#6b7280; font-size:14px;">Order: ${razorpay_order_id} · Payment: ${razorpay_payment_id}</p>
              </div>
            </div>
          </div>
        `;
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: participant.email,
          subject: 'RubberEco - Practical Training Payment Confirmed',
          html
        });
      }
    } catch (mailErr) {
      console.error('⚠️ Payment email send failed:', mailErr.message);
    }

    return res.json({ success: true, message: 'Payment verified and enrollment confirmed' });
  } catch (error) {
    console.error('❌ Error verifying Razorpay payment (PT):', error);
    return res.status(500).json({ success: false, message: error.message || 'Payment verification failed' });
  }
};

// Get available practical training sessions for enrollment
exports.getAvailableTrainings = async (req, res) => {
  try {
    console.log('🔍 Fetching available practical training sessions');
    
    const { category, level, location } = req.query;
    
    const filters = {};
    if (category) filters.category = category;
    if (level) filters.level = level;
    if (location) filters.location = location;

    const availableTrainings = await PracticalTraining.findAvailableTrainings(filters);

    console.log(`✅ Found ${availableTrainings.length} available training sessions`);

    res.json({
      success: true,
      data: availableTrainings,
      message: `Found ${availableTrainings.length} available training sessions`
    });

  } catch (error) {
    console.error('❌ Error fetching available trainings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available training sessions',
      error: error.message
    });
  }
};

// Get practical training session by ID
exports.getPracticalTrainingById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Fetching practical training session:', id);

    // Handle both MongoDB ObjectId and simple string IDs
    let training;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      // Valid MongoDB ObjectId format
      training = await PracticalTraining.findById(id)
        .populate('instructor.staffId', 'name email phone specialization')
        .populate('participants.userId', 'name email phone')
        .populate('createdBy', 'name email');
    } else {
      // Simple string ID - find by _id field as string
      training = await PracticalTraining.findOne({ _id: id })
        .populate('instructor.staffId', 'name email phone specialization')
        .populate('participants.userId', 'name email phone')
        .populate('createdBy', 'name email');
    }

    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Practical training session not found'
      });
    }

    console.log('✅ Found practical training session:', training.title);

    res.json({
      success: true,
      data: training
    });

  } catch (error) {
    console.error('❌ Error fetching practical training:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch practical training session',
      error: error.message
    });
  }
};

// Enroll user in practical training
exports.enrollInPracticalTraining = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    console.log('📝 Enrolling user in practical training:', { trainingId: id, userId });

    // Handle both MongoDB ObjectId and simple string IDs
    let training;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      // Valid MongoDB ObjectId format
      training = await PracticalTraining.findById(id);
    } else {
      // Simple string ID - find by _id field as string
      training = await PracticalTraining.findOne({ _id: id });
    }
    
    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Practical training session not found'
      });
    }

    // Check if user can enroll
    const enrollmentCheck = training.canUserEnroll(userId);
    if (!enrollmentCheck.canEnroll) {
      return res.status(400).json({
        success: false,
        message: enrollmentCheck.reason
      });
    }

    // Get user details
    const user = await Register.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add participant
    training.participants.push({
      userId: userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      enrollmentDate: new Date(),
      paymentStatus: 'pending',
      status: 'enrolled'
    });

    // Update enrollment count
    training.enrollment.currentEnrollments += 1;
    training.updatedBy = req.user.id;

    await training.save();

    console.log('✅ User enrolled successfully in practical training');

    // Best-effort enrollment confirmation email
    try {
      const participant = training.participants.find(p => p.userId.toString() === userId.toString());
      if (participant && participant.email && process.env.EMAIL_USER && (process.env.EMAIL_PASS || process.env.GOOGLE_REFRESH_TOKEN)) {
        const transporter = createEmailTransporter();
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb;">
            <div style="background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
              <div style="background: linear-gradient(135deg,#22c55e,#16a34a); color: #fff; padding: 20px 24px;">
                <h2 style="margin:0">Enrollment Confirmed</h2>
                <p style="margin:6px 0 0 0; opacity:.9">Practical Training: ${training.title}</p>
              </div>
              <div style="padding: 24px; color:#111827;">
                <p>Hi ${participant.name || 'Participant'},</p>
                <p>You have been enrolled in the practical training session. ${training.enrollment.fee > 0 ? 'Please complete the payment to confirm your seat.' : 'No payment is required.'}</p>
              </div>
            </div>
          </div>
        `;
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: participant.email,
          subject: 'RubberEco - Practical Training Enrollment Confirmed',
          html
        });
      }
    } catch (mailErr) {
      console.error('⚠️ Enrollment email send failed:', mailErr.message);
    }

    res.json({
      success: true,
      message: 'Successfully enrolled in practical training session',
      data: {
        sessionId: training.sessionId,
        title: training.title,
        enrollmentDate: new Date(),
        paymentRequired: training.enrollment.fee > 0
      }
    });

  } catch (error) {
    console.error('❌ Error enrolling in practical training:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enroll in practical training session',
      error: error.message
    });
  }
};

// Update practical training session
exports.updatePracticalTraining = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📝 Updating practical training session:', id);

    const training = await PracticalTraining.findById(id);
    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Practical training session not found'
      });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        training[key] = req.body[key];
      }
    });

    training.updatedBy = req.user.id;
    training.updatedAt = new Date();

    await training.save();

    console.log('✅ Practical training session updated successfully');

    res.json({
      success: true,
      message: 'Practical training session updated successfully',
      data: training
    });

  } catch (error) {
    console.error('❌ Error updating practical training:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update practical training session',
      error: error.message
    });
  }
};

// Update training status
exports.updateTrainingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    console.log('🔄 Updating training status:', { id, status });

    const training = await PracticalTraining.findById(id);
    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Practical training session not found'
      });
    }

    const oldStatus = training.status;
    training.status = status;
    training.updatedBy = req.user.id;

    // Add status change to admin notes if reason provided
    if (reason) {
      training.adminNotes.push({
        note: `Status changed from ${oldStatus} to ${status}. Reason: ${reason}`,
        addedBy: req.user.id,
        priority: 'normal'
      });
    }

    await training.save();

    console.log('✅ Training status updated successfully');

    res.json({
      success: true,
      message: `Training status updated to ${status}`,
      data: {
        sessionId: training.sessionId,
        oldStatus,
        newStatus: status
      }
    });

  } catch (error) {
    console.error('❌ Error updating training status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update training status',
      error: error.message
    });
  }
};

// Get user's practical training enrollments
exports.getUserPracticalTrainings = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('👤 Fetching user practical training enrollments:', userId);

    const trainings = await PracticalTraining.find({
      'participants.userId': userId
    }).populate('instructor.staffId', 'name email');

    // Filter to get only user's enrollment data
    const userTrainings = trainings.map(training => {
      const userParticipation = training.participants.find(
        p => p.userId.toString() === userId
      );
      
      return {
        ...training.toObject(),
        userEnrollment: userParticipation
      };
    });

    console.log(`✅ Found ${userTrainings.length} practical training enrollments`);

    res.json({
      success: true,
      data: userTrainings
    });

  } catch (error) {
    console.error('❌ Error fetching user practical trainings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user practical training enrollments',
      error: error.message
    });
  }
};

// Remove a user's enrollment from a specific training (self or admin)
exports.removeUserEnrollment = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const requesterId = req.user.id;

    if (requesterId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    const training = await PracticalTraining.findById(id);
    if (!training) {
      return res.status(404).json({ success: false, message: 'Practical training session not found' });
    }

    const beforeCount = training.participants.length;
    training.participants = training.participants.filter(p => p.userId.toString() !== userId);
    const removed = beforeCount - training.participants.length;
    if (removed > 0 && training.enrollment.currentEnrollments > 0) {
      training.enrollment.currentEnrollments -= removed;
    }
    training.updatedBy = requesterId;
    await training.save();

    return res.json({ success: true, message: 'Enrollment removed', removed });
  } catch (error) {
    console.error('❌ Error removing user enrollment:', error);
    res.status(500).json({ success: false, message: 'Failed to remove enrollment', error: error.message });
  }
};

// Remove a user's enrollments from all trainings (admin only)
exports.removeUserFromAllTrainings = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await PracticalTraining.updateMany(
      { 'participants.userId': userId },
      {
        $pull: { participants: { userId } },
        $inc: { 'enrollment.currentEnrollments': -1 }
      }
    );

    res.json({ success: true, message: 'User removed from trainings', result });
  } catch (error) {
    console.error('❌ Error removing user from all trainings:', error);
    res.status(500).json({ success: false, message: 'Failed to remove user enrollments', error: error.message });
  }
};

// Self: remove authenticated user from all trainings
exports.removeSelfFromAllTrainings = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await PracticalTraining.updateMany(
      { 'participants.userId': userId },
      {
        $pull: { participants: { userId } },
        $inc: { 'enrollment.currentEnrollments': -1 }
      }
    );

    res.json({ success: true, message: 'Your enrollments cleared', result });
  } catch (error) {
    console.error('❌ Error clearing self enrollments:', error);
    res.status(500).json({ success: false, message: 'Failed to clear your enrollments', error: error.message });
  }
};

// Clear all participants from a training (admin only, for testing)
exports.clearTrainingParticipants = async (req, res) => {
  try {
    const { id } = req.params;
    const training = await PracticalTraining.findById(id);
    if (!training) {
      return res.status(404).json({ success: false, message: 'Practical training session not found' });
    }
    training.participants = [];
    training.enrollment.currentEnrollments = 0;
    training.updatedBy = req.user.id;
    await training.save();
    res.json({ success: true, message: 'All enrollments cleared' });
  } catch (error) {
    console.error('❌ Error clearing participants:', error);
    res.status(500).json({ success: false, message: 'Failed to clear participants', error: error.message });
  }
};

// Record attendance for a training session
exports.recordAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionNumber, attendanceData } = req.body;

    console.log('📋 Recording attendance for training session:', { id, sessionNumber });

    const training = await PracticalTraining.findById(id);
    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Practical training session not found'
      });
    }

    // Update attendance for each participant
    attendanceData.forEach(attendance => {
      const participant = training.participants.find(
        p => p.userId.toString() === attendance.userId
      );
      
      if (participant) {
        participant.attendance.push({
          sessionNumber,
          date: new Date(),
          status: attendance.status,
          arrivalTime: attendance.arrivalTime,
          departureTime: attendance.departureTime,
          notes: attendance.notes
        });
      }
    });

    await training.save();

    console.log('✅ Attendance recorded successfully');

    res.json({
      success: true,
      message: 'Attendance recorded successfully'
    });

  } catch (error) {
    console.error('❌ Error recording attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record attendance',
      error: error.message
    });
  }
};

// Create Razorpay order for a practical training enrollment
exports.createPracticalRazorpayOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const training = await PracticalTraining.findById(id);
    if (!training) {
      return res.status(404).json({ success: false, message: 'Practical training session not found' });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ success: false, message: 'Razorpay keys not configured' });
    }

    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const amountPaise = Math.max(1, Math.round(training.enrollment.fee * 100));
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `ptrain-${training._id}-${Date.now()}`,
      notes: { trainingId: String(training._id), title: training.title }
    });

    res.json({ success: true, data: { orderId: order.id, amount: order.amount, currency: order.currency, key: process.env.RAZORPAY_KEY_ID } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Verify Razorpay payment and record enrollment into training_enrolled
exports.verifyPracticalRazorpayPayment = async (req, res) => {
  try {
    const TrainingEnrollment = require('../models/TrainingEnrollment');
    const { id } = req.params; // practical training id
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user.id;

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ success: false, message: 'Razorpay not configured' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Signature verification failed' });
    }

    const training = await PracticalTraining.findById(id);
    if (!training) {
      return res.status(404).json({ success: false, message: 'Practical training session not found' });
    }

    // Update (or add) participant payment status
    const existing = training.participants.find(p => p.userId.toString() === userId.toString());
    if (existing) {
      existing.paymentStatus = 'completed';
      existing.status = 'active';
    } else {
      // If not present (edge case), add
      const user = await Register.findById(userId);
      training.participants.push({
        userId,
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        enrollmentDate: new Date(),
        paymentStatus: 'completed',
        status: 'active'
      });
      training.enrollment.currentEnrollments += 1;
    }
    training.updatedBy = userId;
    await training.save();

    // Create TrainingEnrollment record in training_enrolled (use numeric moduleId derived from ObjectId)
    const moduleIdNumeric = parseInt(training._id.toString().slice(0, 8), 16);

    // Avoid duplicate due to unique index (userId + moduleId)
    const existingEnrollment = await TrainingEnrollment.findOne({ userId, moduleId: moduleIdNumeric });
    if (!existingEnrollment) {
      await TrainingEnrollment.create({
        userId,
        moduleId: moduleIdNumeric,
        moduleTitle: training.title,
        moduleLevel: training.level,
        paymentAmount: training.enrollment.fee,
        paymentMethod: 'razorpay',
        paymentStatus: 'completed',
        paymentId: razorpay_payment_id,
        userDetails: {
          name: training.participants.find(p => p.userId.toString() === userId.toString())?.name || '',
          email: training.participants.find(p => p.userId.toString() === userId.toString())?.email || '',
          phone: training.participants.find(p => p.userId.toString() === userId.toString())?.phone || '',
          experience: '',
          motivation: ''
        },
        progress: { completedLessons: [], totalLessons: 0, progressPercentage: 0, lastAccessedDate: new Date() }
      });
    }

    res.json({ success: true, message: 'Payment verified and enrollment recorded' });
  } catch (error) {
    console.error('❌ Practical verify payment error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};
