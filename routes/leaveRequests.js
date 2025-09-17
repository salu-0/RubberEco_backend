const express = require('express');
const router = express.Router();
const LeaveRequest = require('../models/LeaveRequest');
const Staff = require('../models/Staff');
const { protect, adminOnly } = require('../middlewares/auth');
const {
  sendAdminNotificationEmail,
  sendLeaveApprovalEmail,
  sendLeaveRejectionEmail,
  sendFarmerStaffLeaveNotification
} = require('../utils/emailService');

// Apply middleware to all routes
router.use(protect);

// GET /api/leave-requests - Get all leave requests (admin only)
router.get('/', adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;

    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const leaveRequests = await LeaveRequest.find(query)
      .sort({ submittedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const totalCount = await LeaveRequest.countDocuments(query);

    console.log(`✅ Found ${totalCount} total leave requests`);

    res.json({
      success: true,
      data: leaveRequests,
      total: totalCount,
      page: parseInt(page),
      totalPages: Math.ceil(totalCount / limit)
    });

  } catch (error) {
    console.error('❌ Error fetching all leave requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave requests',
      error: error.message
    });
  }
});

// POST /api/leave-requests - Submit a new leave request
router.post('/', async (req, res) => {
  try {
    console.log('📝 New leave request submission started');
    console.log('👤 User from token:', req.user);
    console.log('📋 Request body:', req.body);

    const staffId = req.user.id;
    console.log('🆔 Staff ID:', staffId);

    const {
      leaveType,
      startDate,
      endDate,
      reason,
      urgency,
      contactDuringLeave,
      workHandover,
      documents
    } = req.body;

    // Validate required fields
    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: leaveType, startDate, endDate, reason'
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Start date cannot be after end date'
      });
    }

    if (start < today && urgency !== 'emergency') {
      return res.status(400).json({
        success: false,
        message: 'Start date cannot be in the past unless it\'s an emergency'
      });
    }

    // Get staff details
    console.log('🔍 Looking for staff with ID:', staffId);
    const staff = await Staff.findById(staffId);
    console.log('👤 Staff found:', staff ? `${staff.name} (${staff.email})` : 'Not found');

    if (!staff) {
      console.log('❌ Staff member not found in database');
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Create leave request
    console.log('📝 Creating leave request object...');
    const leaveRequestData = {
      staffId,
      staffName: staff.name,
      staffEmail: staff.email,
      staffRole: staff.role,
      leaveType,
      startDate: start,
      endDate: end,
      reason,
      urgency: urgency || 'normal',
      contactDuringLeave: contactDuringLeave || {},
      workHandover: workHandover || {},
      documents: documents || []
    };

    console.log('📋 Leave request data:', leaveRequestData);

    console.log('🏗️ Creating LeaveRequest instance...');
    const leaveRequest = new LeaveRequest(leaveRequestData);
    console.log('✅ LeaveRequest instance created successfully');

    console.log('💾 Saving leave request to database...');
    await leaveRequest.save();
    console.log('✅ Leave request saved successfully with ID:', leaveRequest._id);
    console.log('✅ Leave request saved:', leaveRequest.requestId);

    // Send admin notification
    try {
      const notificationData = {
        type: 'leave_request',
        title: 'New Leave Request Submitted',
        message: `${staff.name} (${staff.role}) has submitted a ${leaveType} leave request for ${leaveRequest.totalDays} day(s)`,
        data: {
          requestId: leaveRequest.requestId,
          staffName: staff.name,
          staffRole: staff.role,
          staffEmail: staff.email,
          staffDepartment: staff.department || 'General',
          leaveType,
          startDate: leaveRequest.formattedStartDate,
          endDate: leaveRequest.formattedEndDate,
          totalDays: leaveRequest.totalDays,
          reason,
          urgency,
          contactDuringLeave,
          submittedAt: leaveRequest.formattedSubmittedAt
        }
      };

      const emailResult = await sendAdminNotificationEmail(notificationData);
      if (emailResult.success) {
        console.log('✅ Admin notification sent for leave request:', leaveRequest.requestId);
      } else {
        console.log('⚠️ Failed to send admin notification:', emailResult.message);
      }
    } catch (notificationError) {
      console.error('❌ Error sending admin notification:', notificationError);
    }

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully',
      data: {
        requestId: leaveRequest.requestId,
        status: leaveRequest.status,
        totalDays: leaveRequest.totalDays,
        submittedAt: leaveRequest.submittedAt
      }
    });

  } catch (error) {
    console.error('❌ Error creating leave request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit leave request',
      error: error.message
    });
  }
});

// GET /api/leave-requests/my-requests - Get staff's own leave requests
router.get('/my-requests', async (req, res) => {
  try {
    const staffId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    console.log(`📋 Fetching leave requests for staff ${staffId}`);

    const leaveRequests = await LeaveRequest.getStaffLeaveRequests(staffId, status);

    // Pagination
    const skip = (page - 1) * limit;
    const paginatedRequests = leaveRequests.slice(skip, skip + parseInt(limit));

    console.log(`✅ Found ${leaveRequests.length} leave requests for staff`);

    res.json({
      success: true,
      data: paginatedRequests,
      total: leaveRequests.length,
      page: parseInt(page),
      totalPages: Math.ceil(leaveRequests.length / limit)
    });

  } catch (error) {
    console.error('❌ Error fetching staff leave requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave requests',
      error: error.message
    });
  }
});

// GET /api/leave-requests/:id - Get specific leave request details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const staffId = req.user.id;

    const leaveRequest = await LeaveRequest.findById(id);
    
    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Check if staff can access this request (own request or admin)
    if (leaveRequest.staffId.toString() !== staffId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: leaveRequest
    });

  } catch (error) {
    console.error('❌ Error fetching leave request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave request',
      error: error.message
    });
  }
});

// PUT /api/leave-requests/:id/cancel - Cancel a pending leave request
router.put('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const staffId = req.user.id;

    const leaveRequest = await LeaveRequest.findById(id);
    
    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Check if staff owns this request
    if (leaveRequest.staffId.toString() !== staffId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Can only cancel pending requests
    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Can only cancel pending leave requests'
      });
    }

    leaveRequest.status = 'cancelled';
    leaveRequest.updatedAt = new Date();
    await leaveRequest.save();

    console.log('✅ Leave request cancelled:', leaveRequest.requestId);

    res.json({
      success: true,
      message: 'Leave request cancelled successfully',
      data: leaveRequest
    });

  } catch (error) {
    console.error('❌ Error cancelling leave request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel leave request',
      error: error.message
    });
  }
});

// ADMIN ROUTES
// GET /api/leave-requests/admin/all - Get all leave requests (admin only)
router.get('/admin/all', adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    console.log('📋 Admin fetching all leave requests');

    const leaveRequests = await LeaveRequest.getAllLeaveRequests(status, page, limit);
    const totalCount = await LeaveRequest.countDocuments(status && status !== 'all' ? { status } : {});

    console.log(`✅ Found ${totalCount} total leave requests`);

    res.json({
      success: true,
      data: leaveRequests,
      total: totalCount,
      page: parseInt(page),
      totalPages: Math.ceil(totalCount / limit)
    });

  } catch (error) {
    console.error('❌ Error fetching all leave requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave requests',
      error: error.message
    });
  }
});

// GET /api/leave-requests/admin/pending/count - Get count of pending leave requests
router.get('/admin/pending/count', adminOnly, async (req, res) => {
  try {
    const count = await LeaveRequest.countDocuments({ status: 'pending' });

    res.json({
      success: true,
      count: count
    });

  } catch (error) {
    console.error('❌ Error fetching pending leave requests count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending count',
      error: error.message
    });
  }
});

// POST /api/leave-requests/admin/:id/approve - Approve leave request (admin only)
router.post('/admin/:id/approve', adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const adminName = req.user.name || 'Admin';

    const leaveRequest = await LeaveRequest.findById(id);

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Can only approve pending leave requests'
      });
    }

    await leaveRequest.approve(adminName, comments);
    console.log('✅ Leave request approved:', leaveRequest.requestId);

    // Get staff details for email notification
    const staff = await Staff.findById(leaveRequest.staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Send approval email to staff
    try {
      const emailResult = await sendLeaveApprovalEmail(
        {
          name: staff.name,
          email: staff.email
        },
        leaveRequest,
        {
          name: adminName
        }
      );

      if (emailResult.success) {
        console.log('✅ Leave approval email sent to staff');
      } else {
        console.log('⚠️ Failed to send approval email to staff:', emailResult.message);
      }
    } catch (emailError) {
      console.error('❌ Error sending approval email to staff:', emailError);
    }

    // Send notifications to assigned farmers
    try {
      const activeFarmers = staff.getActiveFarmers();
      console.log(`📧 Sending leave notifications to ${activeFarmers.length} assigned farmers`);

      for (const farmerAssignment of activeFarmers) {
        try {
          const farmerEmailResult = await sendFarmerStaffLeaveNotification(
            {
              farmerName: farmerAssignment.farmerName,
              farmerEmail: farmerAssignment.farmerEmail,
              assignmentType: farmerAssignment.assignmentType
            },
            {
              name: staff.name,
              role: staff.role
            },
            leaveRequest
          );

          if (farmerEmailResult.success) {
            console.log(`✅ Farmer notification sent to: ${farmerAssignment.farmerEmail}`);
          } else {
            console.log(`⚠️ Failed to send farmer notification to ${farmerAssignment.farmerEmail}:`, farmerEmailResult.message);
          }
        } catch (farmerEmailError) {
          console.error(`❌ Error sending farmer notification to ${farmerAssignment.farmerEmail}:`, farmerEmailError);
        }
      }
    } catch (farmerNotificationError) {
      console.error('❌ Error processing farmer notifications:', farmerNotificationError);
    }

    res.json({
      success: true,
      message: 'Leave request approved successfully',
      data: leaveRequest
    });

  } catch (error) {
    console.error('❌ Error approving leave request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve leave request',
      error: error.message
    });
  }
});

// PUT /api/leave-requests/:id/status - Update leave request status (admin only)
router.put('/:id/status', adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminComments, reviewedBy } = req.body;
    const adminName = reviewedBy || req.user.name || 'Admin';

    const leaveRequest = await LeaveRequest.findById(id);

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Can only update pending leave requests'
      });
    }

    if (status === 'approved') {
      await leaveRequest.approve(adminName, adminComments);
      console.log('✅ Leave request approved:', leaveRequest.requestId);
    } else if (status === 'rejected') {
      await leaveRequest.reject(adminName, adminComments);
      console.log('✅ Leave request rejected:', leaveRequest.requestId);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "approved" or "rejected"'
      });
    }

    // Get staff details for email notification
    const staff = await Staff.findById(leaveRequest.staffId);
    if (staff) {
      try {
        if (status === 'approved') {
          const emailResult = await sendLeaveApprovalEmail(
            { name: staff.name, email: staff.email },
            leaveRequest,
            { name: adminName }
          );
          if (emailResult.success) {
            console.log('✅ Leave approval email sent to staff');
          }
        } else if (status === 'rejected') {
          const emailResult = await sendLeaveRejectionEmail(
            { name: staff.name, email: staff.email },
            leaveRequest,
            { name: adminName }
          );
          if (emailResult.success) {
            console.log('✅ Leave rejection email sent to staff');
          }
        }
      } catch (emailError) {
        console.error('❌ Error sending email notification:', emailError);
      }
    }

    res.json({
      success: true,
      message: `Leave request ${status} successfully`,
      data: leaveRequest
    });

  } catch (error) {
    console.error('❌ Error updating leave request status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update leave request status',
      error: error.message
    });
  }
});

// POST /api/leave-requests/admin/:id/reject - Reject leave request (admin only)
router.post('/admin/:id/reject', adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const adminName = req.user.name || 'Admin';

    const leaveRequest = await LeaveRequest.findById(id);

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Can only reject pending leave requests'
      });
    }

    await leaveRequest.reject(adminName, comments);
    console.log('✅ Leave request rejected:', leaveRequest.requestId);

    // Get staff details for email notification
    const staff = await Staff.findById(leaveRequest.staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Send rejection email to staff
    try {
      const emailResult = await sendLeaveRejectionEmail(
        {
          name: staff.name,
          email: staff.email
        },
        leaveRequest,
        {
          name: adminName
        }
      );

      if (emailResult.success) {
        console.log('✅ Leave rejection email sent to staff');
      } else {
        console.log('⚠️ Failed to send rejection email to staff:', emailResult.message);
      }
    } catch (emailError) {
      console.error('❌ Error sending rejection email to staff:', emailError);
    }

    res.json({
      success: true,
      message: 'Leave request rejected successfully',
      data: leaveRequest
    });

  } catch (error) {
    console.error('❌ Error rejecting leave request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject leave request',
      error: error.message
    });
  }
});

module.exports = router;
