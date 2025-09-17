const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import models
const TappingRequest = require('../models/TappingRequest');
const TappingSchedule = require('../models/TappingSchedule');



// POST /api/tapping-schedules/create-simple - Simple route for creating schedules
router.post('/create-simple', async (req, res) => {
  try {
    console.log('📅 SIMPLE CREATE: Creating new tapping schedule:', req.body);

    const { tappingRequestId, notes } = req.body;

    if (!tappingRequestId) {
      return res.status(400).json({
        success: false,
        message: 'Tapping request ID is required'
      });
    }

    // Find the tapping request
    const tappingRequest = await TappingRequest.findById(tappingRequestId);

    if (!tappingRequest) {
      return res.status(404).json({
        success: false,
        message: 'Tapping request not found'
      });
    }

    // Check if request is assigned and accepted
    if (tappingRequest.status !== 'accepted' && tappingRequest.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'Tapping request must be accepted before creating schedule'
      });
    }

    // Check if schedule already exists
    const existingSchedule = await TappingSchedule.findOne({ tappingRequestId });
    if (existingSchedule) {
      return res.status(400).json({
        success: false,
        message: 'Schedule already exists for this request',
        data: existingSchedule
      });
    }

    // Generate schedule ID
    const scheduleCount = await TappingSchedule.countDocuments();
    const scheduleId = `SCH${String(scheduleCount + 1).padStart(6, '0')}`;

    // Calculate dates
    const startDate = new Date(tappingRequest.startDate);
    const duration = parseInt(tappingRequest.duration);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + duration);

    // Create the schedule document
    const tappingSchedule = new TappingSchedule({
      scheduleId: scheduleId,
      tappingRequestId: tappingRequestId,
      farmerId: tappingRequest.farmerId,
      farmerName: tappingRequest.farmerName,
      farmerEmail: tappingRequest.farmerEmail,
      farmerPhone: tappingRequest.farmerPhone,
      tapperId: tappingRequest.assignedTapper?.tapperId,
      tapperName: tappingRequest.assignedTapper?.tapperName,
      tapperPhone: tappingRequest.assignedTapper?.tapperPhone,
      farmLocation: tappingRequest.farmLocation,
      farmSize: tappingRequest.farmSize,
      numberOfTrees: tappingRequest.numberOfTrees,
      tappingType: tappingRequest.tappingType,
      startDate: startDate,
      endDate: endDate,
      duration: duration,
      preferredTime: tappingRequest.preferredTime,
      status: tappingRequest.status === 'in_progress' ? 'active' : 'scheduled',
      budgetRange: tappingRequest.budgetRange,
      estimatedCost: parseFloat(tappingRequest.budgetRange) || 0,
      progressPercentage: 0,
      completedDays: 0,
      totalScheduledDays: duration,
      adminNotes: notes ? [{
        note: notes,
        addedAt: new Date(),
        priority: 'normal'
      }] : [],
      dailyRecords: []
    });

    const savedSchedule = await tappingSchedule.save();

    console.log('✅ Tapping schedule created successfully:', savedSchedule.scheduleId);

    res.status(201).json({
      success: true,
      message: 'Tapping schedule created successfully',
      data: savedSchedule
    });

  } catch (error) {
    console.error('❌ Error creating tapping schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create tapping schedule',
      error: error.message
    });
  }
});

// POST /api/tapping-schedules - Create a new tapping schedule from accepted request
router.post('/', async (req, res) => {
  try {
    console.log('📅 NEW ROUTE: Creating new tapping schedule:', req.body);
    console.log('📅 NEW ROUTE: Request body keys:', Object.keys(req.body));

    // Support both old and new parameter formats for compatibility
    const { tappingRequestId, requestId, farmerId, tapperId, notes } = req.body;
    const actualRequestId = tappingRequestId || requestId;

    if (!actualRequestId) {
      return res.status(400).json({
        success: false,
        message: 'Tapping request ID is required'
      });
    }

    // Find the tapping request
    const tappingRequest = await TappingRequest.findById(actualRequestId);

    if (!tappingRequest) {
      return res.status(404).json({
        success: false,
        message: 'Tapping request not found'
      });
    }

    // Check if request is assigned and accepted
    if (tappingRequest.status !== 'accepted' && tappingRequest.status !== 'assigned') {
      return res.status(400).json({
        success: false,
        message: 'Tapping request must be accepted before creating schedule'
      });
    }

    // Check if schedule already exists
    const existingSchedule = await TappingSchedule.findOne({ tappingRequestId: actualRequestId });
    if (existingSchedule) {
      return res.status(400).json({
        success: false,
        message: 'Schedule already exists for this request'
      });
    }

    // Calculate schedule details
    const startDate = new Date(tappingRequest.startDate);
    const duration = parseInt(tappingRequest.duration);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + duration);

    // Generate daily records based on tapping type
    const dailyRecords = generateDailyRecords(
      startDate,
      endDate,
      tappingRequest.tappingType,
      tappingRequest.preferredTime
    );

    // Create new tapping schedule
    const tappingSchedule = new TappingSchedule({
      tappingRequestId: tappingRequest._id,
      requestId: tappingRequest.requestId,
      farmerId: tappingRequest.farmerId,
      farmerName: tappingRequest.farmerName,
      farmerEmail: tappingRequest.farmerEmail,
      farmerPhone: tappingRequest.farmerPhone,
      tapperId: tappingRequest.assignedTapper.tapperId,
      tapperName: tappingRequest.assignedTapper.tapperName,
      tapperPhone: tappingRequest.assignedTapper.tapperPhone,
      tapperEmail: tappingRequest.assignedTapper.tapperEmail,
      farmLocation: tappingRequest.farmLocation,
      farmSize: tappingRequest.farmSize,
      numberOfTrees: tappingRequest.numberOfTrees,
      tappingType: tappingRequest.tappingType,
      startDate: startDate,
      endDate: endDate,
      duration: duration,
      preferredTime: tappingRequest.preferredTime,
      status: 'scheduled',
      totalScheduledDays: dailyRecords.length,
      dailyRecords: dailyRecords,
      budgetRange: tappingRequest.budgetRange,
      estimatedCost: parseFloat(tappingRequest.budgetRange) || 0,
      adminNotes: notes ? [{
        note: notes,
        addedAt: new Date(),
        priority: 'normal'
      }] : []
    });

    const savedSchedule = await tappingSchedule.save();

    // Update tapping request status to in_progress
    await TappingRequest.findByIdAndUpdate(actualRequestId, {
      status: 'in_progress',
      'serviceDetails.startedAt': new Date()
    });

    console.log('✅ Tapping schedule created successfully:', savedSchedule.scheduleId);

    res.status(201).json({
      success: true,
      message: 'Tapping schedule created successfully',
      data: savedSchedule
    });

  } catch (error) {
    console.error('❌ Error creating tapping schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create tapping schedule',
      error: error.message
    });
  }
});

// Helper function to generate daily records
function generateDailyRecords(startDate, endDate, tappingType, preferredTime) {
  const records = [];
  const current = new Date(startDate);

  // Convert preferred time to scheduled time
  const timeMap = {
    'early_morning': '05:00',
    'morning': '08:00',
    'afternoon': '14:00',
    'evening': '17:00'
  };

  const scheduledTime = timeMap[preferredTime] || '08:00';

  while (current <= endDate) {
    let shouldInclude = false;

    switch (tappingType) {
      case 'daily':
        shouldInclude = true;
        break;
      case 'alternate_day':
        const daysDiff = Math.floor((current - startDate) / (1000 * 60 * 60 * 24));
        shouldInclude = daysDiff % 2 === 0;
        break;
      case 'weekly':
        shouldInclude = current.getDay() === startDate.getDay();
        break;
      default:
        shouldInclude = true;
    }

    if (shouldInclude) {
      records.push({
        date: new Date(current),
        scheduledTime: scheduledTime,
        status: 'scheduled',
        treesCompleted: 0,
        latexCollected: 0,
        quality: 'good',
        notes: '',
        weather: 'sunny',
        tapperNotes: '',
        farmerFeedback: ''
      });
    }

    current.setDate(current.getDate() + 1);
  }

  return records;
}

// GET /api/tapping-schedules - Get all tapping schedules (admin)
router.get('/', async (req, res) => {
  try {
    console.log('📅 Fetching all tapping schedules');

    const { status, farmerId, tapperId, page = 1, limit = 10 } = req.query;

    // Build query
    let query = {};
    if (status) query.status = status;
    if (farmerId) query.farmerId = farmerId;
    if (tapperId) query.tapperId = tapperId;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get schedules with pagination
    const schedules = await TappingSchedule.find(query)
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TappingSchedule.countDocuments(query);

    console.log(`📅 Retrieved ${schedules.length} tapping schedules`);

    res.status(200).json({
      success: true,
      data: schedules,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: schedules.length,
        totalRecords: total
      }
    });

  } catch (error) {
    console.error('❌ Error fetching tapping schedules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tapping schedules',
      error: error.message
    });
  }
});

// GET /api/tapping-schedules/farmer/:farmerId - Get schedules for specific farmer
router.get('/farmer/:farmerId', async (req, res) => {
  try {
    const { farmerId } = req.params;
    console.log('📅 Fetching tapping schedules for farmer:', farmerId);

    const scheduledRequests = await TappingRequest.find({
      farmerId: farmerId,
      status: { $in: ['accepted', 'assigned', 'in_progress', 'completed'] },
      assignedTapper: { $exists: true }
    })
    .sort({ startDate: -1 });

    const schedules = scheduledRequests.map(request => ({
      scheduleId: `SCH-${request._id}`,
      requestId: request.requestId,
      tapperId: request.assignedTapper.tapperId,
      tapperName: request.assignedTapper.tapperName,
      tapperPhone: request.assignedTapper.tapperPhone,
      farmLocation: request.farmLocation,
      farmSize: request.farmSize,
      numberOfTrees: request.numberOfTrees,
      startDate: request.startDate,
      duration: request.duration,
      tappingType: request.tappingType,
      preferredTime: request.preferredTime,
      status: request.status,
      assignedAt: request.assignedTapper.assignedAt,
      budgetRange: request.budgetRange,
      urgency: request.urgency,
      scheduleDetails: request.scheduleDetails || {}
    }));

    console.log(`📋 Retrieved ${schedules.length} schedules for farmer:`, farmerId);

    res.status(200).json({
      success: true,
      data: schedules,
      count: schedules.length
    });

  } catch (error) {
    console.error('❌ Error fetching farmer schedules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch farmer schedules',
      error: error.message
    });
  }
});

// PUT /api/tapping-schedules/:scheduleId/status - Update schedule status
router.put('/:scheduleId/status', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { status, notes } = req.body;

    console.log(`🔄 Updating schedule ${scheduleId} status to:`, status);

    // Extract request ID from schedule ID (format: SCH-requestId)
    const requestId = scheduleId.replace('SCH-', '');

    const updatedRequest = await TappingRequest.findByIdAndUpdate(
      requestId,
      {
        $set: {
          status: status,
          'scheduleDetails.status': status,
          'scheduleDetails.notes': notes || `Status updated to ${status}`,
          'scheduleDetails.updatedAt': new Date(),
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    if (!updatedRequest) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    console.log('✅ Schedule status updated successfully');

    res.status(200).json({
      success: true,
      message: 'Schedule status updated successfully',
      data: {
        scheduleId,
        status,
        updatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Error updating schedule status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update schedule status',
      error: error.message
    });
  }
});

// POST /api/tapping-schedules/:scheduleId/daily-record - Add daily tapping record
router.post('/:scheduleId/daily-record', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const {
      date,
      actualStartTime,
      actualEndTime,
      treesCompleted,
      latexCollected,
      quality,
      notes,
      weather,
      tapperNotes,
      farmerFeedback,
      images
    } = req.body;

    const schedule = await TappingSchedule.findOne({ scheduleId });
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Find the daily record for the specified date
    const recordDate = new Date(date);
    const recordIndex = schedule.dailyRecords.findIndex(record =>
      record.date.toDateString() === recordDate.toDateString()
    );

    if (recordIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'No scheduled record found for this date'
      });
    }

    // Update the daily record
    schedule.dailyRecords[recordIndex] = {
      ...schedule.dailyRecords[recordIndex],
      actualStartTime: actualStartTime ? new Date(actualStartTime) : undefined,
      actualEndTime: actualEndTime ? new Date(actualEndTime) : undefined,
      status: 'completed',
      treesCompleted: treesCompleted || 0,
      latexCollected: latexCollected || 0,
      quality: quality || 'good',
      notes: notes || '',
      weather: weather || 'sunny',
      tapperNotes: tapperNotes || '',
      farmerFeedback: farmerFeedback || '',
      images: images || [],
      completedAt: new Date()
    };

    // Update progress
    await schedule.updateProgress();

    res.status(200).json({
      success: true,
      message: 'Daily record updated successfully',
      data: schedule
    });

  } catch (error) {
    console.error('❌ Error updating daily record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update daily record',
      error: error.message
    });
  }
});

// PUT /api/tapping-schedules/:scheduleId/status - Update schedule status
router.put('/:scheduleId/status', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { status, reason, notes } = req.body;

    const schedule = await TappingSchedule.findOne({ scheduleId });
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    const oldStatus = schedule.status;
    schedule.status = status;

    // Add modification record
    schedule.modifications.push({
      modificationType: 'status',
      oldValue: oldStatus,
      newValue: status,
      reason: reason || '',
      notes: notes || ''
    });

    await schedule.save();

    res.status(200).json({
      success: true,
      message: 'Schedule status updated successfully',
      data: schedule
    });

  } catch (error) {
    console.error('❌ Error updating schedule status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update schedule status',
      error: error.message
    });
  }
});

// GET /api/tapping-schedules/stats - Get schedule statistics
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 Fetching tapping schedule statistics');

    const totalSchedules = await TappingSchedule.countDocuments();
    const activeSchedules = await TappingSchedule.countDocuments({ status: 'active' });
    const completedSchedules = await TappingSchedule.countDocuments({ status: 'completed' });
    const scheduledSchedules = await TappingSchedule.countDocuments({ status: 'scheduled' });

    // Calculate average progress
    const allSchedules = await TappingSchedule.find({}, 'progressPercentage');
    const avgProgress = allSchedules.length > 0
      ? allSchedules.reduce((sum, s) => sum + s.progressPercentage, 0) / allSchedules.length
      : 0;

    res.status(200).json({
      success: true,
      data: {
        total: totalSchedules,
        active: activeSchedules,
        completed: completedSchedules,
        scheduled: scheduledSchedules,
        averageProgress: Math.round(avgProgress)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching schedule stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch schedule statistics',
      error: error.message
    });
  }
});

module.exports = router;
