const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const Attendance = require('../models/Attendance');

// Mark attendance for a specific task
router.post('/mark', protect, async (req, res) => {
  try {
    console.log('🎯 MARK ATTENDANCE ENDPOINT HIT!', req.params, req.body);
    
    const { taskId, taskName, attendanceType, timestamp, location, notes } = req.body;
    const userId = req.user.id;
    
    console.log('🔍 User info:', {
      userId: req.user.id,
      userRole: req.user.role
    });

    // Check if attendance already marked for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingAttendance = await Attendance.findOne({
      userId: userId,
      taskId: taskId,
      date: {
        $gte: today,
        $lt: tomorrow
      }
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already marked for this task today'
      });
    }

    // Create new attendance record
    const attendance = new Attendance({
      userId: userId,
      taskId: taskId,
      taskName: taskName,
      attendanceType: attendanceType || 'present',
      date: new Date(timestamp || Date.now()),
      location: location || 'field',
      notes: notes || '',
      markedAt: new Date()
    });

    await attendance.save();

    console.log('✅ Attendance marked successfully:', {
      userId: userId,
      taskId: taskId,
      taskName: taskName
    });

    res.json({
      success: true,
      message: 'Attendance marked successfully',
      data: attendance
    });

  } catch (error) {
    console.error('❌ Error marking attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark attendance',
      error: error.message
    });
  }
});

// Mark attendance for multiple tasks
router.post('/mark-all', protect, async (req, res) => {
  try {
    console.log('🎯 MARK ALL ATTENDANCE ENDPOINT HIT!', req.params, req.body);
    console.log('🔍 Request body details:', {
      taskIds: req.body.taskIds,
      taskIdsType: typeof req.body.taskIds,
      taskIdsLength: Array.isArray(req.body.taskIds) ? req.body.taskIds.length : 'not array',
      timestamp: req.body.timestamp,
      location: req.body.location,
      notes: req.body.notes,
      attendanceType: req.body.attendanceType
    });
    
    const { taskIds, timestamp, location, notes, attendanceType } = req.body;
    const userId = req.user.id;
    
    console.log('🔍 User info:', {
      userId: req.user.id,
      userRole: req.user.role,
      taskIds: taskIds
    });

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No task IDs provided'
      });
    }

    // Check existing attendance for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingAttendance = await Attendance.find({
      userId: userId,
      taskId: { $in: taskIds },
      date: {
        $gte: today,
        $lt: tomorrow
      }
    });

    const existingTaskIds = existingAttendance.map(att => att.taskId);
    const newTaskIds = taskIds.filter(id => !existingTaskIds.includes(id));

    if (newTaskIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already marked for all tasks today'
      });
    }

    // Create attendance records for new tasks
    const attendanceRecords = newTaskIds.map(taskId => ({
      userId: userId,
      taskId: taskId,
      taskName: `Task ${taskId}`,
      attendanceType: attendanceType || 'present',
      date: new Date(timestamp || Date.now()),
      location: location || 'field',
      notes: notes || '',
      markedAt: new Date()
    }));

    const savedAttendance = await Attendance.insertMany(attendanceRecords);

    console.log('✅ Attendance marked for multiple tasks:', {
      userId: userId,
      newRecords: savedAttendance.length,
      existingRecords: existingTaskIds.length
    });

    res.json({
      success: true,
      message: `Attendance marked for ${savedAttendance.length} tasks`,
      data: {
        newRecords: savedAttendance.length,
        existingRecords: existingTaskIds.length,
        totalTasks: taskIds.length
      }
    });

  } catch (error) {
    console.error('❌ Error marking attendance for multiple tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark attendance for multiple tasks',
      error: error.message
    });
  }
});

// Get attendance records for a user
router.get('/records', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, taskId } = req.query;

    let query = { userId: userId };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (taskId) {
      query.taskId = taskId;
    }

    const attendanceRecords = await Attendance.find(query)
      .sort({ date: -1, markedAt: -1 });

    res.json({
      success: true,
      data: attendanceRecords
    });

  } catch (error) {
    console.error('❌ Error fetching attendance records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance records',
      error: error.message
    });
  }
});

// Get attendance summary for a user
router.get('/summary', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    let query = { userId: userId };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const summary = await Attendance.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$attendanceType',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalRecords = await Attendance.countDocuments(query);
    const presentCount = summary.find(s => s._id === 'present')?.count || 0;
    const absentCount = summary.find(s => s._id === 'absent')?.count || 0;

    res.json({
      success: true,
      data: {
        totalRecords,
        presentCount,
        absentCount,
        attendanceRate: totalRecords > 0 ? (presentCount / totalRecords * 100).toFixed(2) : 0
      }
    });

  } catch (error) {
    console.error('❌ Error fetching attendance summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance summary',
      error: error.message
    });
  }
});

// Get all attendance records (for admin/farmer viewing)
router.get('/all', protect, async (req, res) => {
  try {
    const { startDate, endDate, userId, taskId } = req.query;
    const currentUserId = req.user.id;
    const userRole = req.user.role;

    let query = {};

    // If not admin, only show own records
    if (userRole !== 'admin') {
      query.userId = currentUserId;
    } else if (userId) {
      // Admin can view specific user's records
      query.userId = userId;
    }

    if (taskId) {
      query.taskId = taskId;
    }

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const attendanceRecords = await Attendance.find(query)
      .populate('userId', 'name email')
      .sort({ date: -1, markedAt: -1 });

    res.json({
      success: true,
      data: attendanceRecords
    });

  } catch (error) {
    console.error('❌ Error fetching all attendance records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance records',
      error: error.message
    });
  }
});

module.exports = router;
