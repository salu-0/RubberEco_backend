const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const TappingRequest = require('../models/TappingRequest');
const TappingSchedule = require('../models/TappingSchedule');
const Staff = require('../models/Staff');

async function createScheduleFromRequest() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Find the tapping request
    const tappingRequestId = '688cde035587f9435c6739bd';
    const tappingRequest = await TappingRequest.findById(tappingRequestId);
    
    if (!tappingRequest) {
      console.error('❌ Tapping request not found');
      return;
    }

    console.log('📋 Found tapping request:', tappingRequest.requestId);

    // Check if schedule already exists
    const existingSchedule = await TappingSchedule.findOne({ tappingRequestId });
    if (existingSchedule) {
      console.log('⚠️ Schedule already exists:', existingSchedule.scheduleId);

      // Update the existing schedule with complete tapper information
      if (tappingRequest.assignedTapper?.tapperId) {
        const tapperInfo = await Staff.findById(tappingRequest.assignedTapper.tapperId);
        if (tapperInfo) {
          existingSchedule.tapperPhone = tapperInfo.phone;
          existingSchedule.tapperEmail = tapperInfo.email;
          await existingSchedule.save();
          console.log('✅ Updated existing schedule with tapper phone:', tapperInfo.phone);
        }
      }
      return;
    }

    // Get complete tapper information
    let tapperInfo = null;
    if (tappingRequest.assignedTapper?.tapperId) {
      tapperInfo = await Staff.findById(tappingRequest.assignedTapper.tapperId);
      console.log('👤 Found tapper info:', tapperInfo?.name, tapperInfo?.phone);
    }

    // Generate schedule ID
    const scheduleCount = await TappingSchedule.countDocuments();
    const scheduleId = `SCH${String(scheduleCount + 1).padStart(6, '0')}`;

    // Calculate dates
    const startDate = new Date(tappingRequest.startDate);
    const duration = parseInt(tappingRequest.duration);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + duration);

    // Calculate basic progress (simplified)
    const today = new Date();
    const daysPassed = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    const progressPercentage = Math.min(Math.round((daysPassed / duration) * 100), 100);

    // Create the schedule document with minimal required fields
    const tappingSchedule = new TappingSchedule({
      scheduleId: scheduleId,
      requestId: tappingRequest.requestId, // Add this required field
      tappingRequestId: tappingRequestId,
      farmerId: tappingRequest.farmerId,
      farmerName: tappingRequest.farmerName,
      farmerEmail: tappingRequest.farmerEmail,
      farmerPhone: tappingRequest.farmerPhone,
      tapperId: tappingRequest.assignedTapper?.tapperId,
      tapperName: tappingRequest.assignedTapper?.tapperName,
      tapperPhone: tapperInfo?.phone || 'N/A', // Use actual phone from staff collection
      tapperEmail: tapperInfo?.email || '',
      farmLocation: tappingRequest.farmLocation,
      farmSize: tappingRequest.farmSize,
      numberOfTrees: tappingRequest.numberOfTrees,
      tappingType: tappingRequest.tappingType,
      startDate: startDate,
      endDate: endDate,
      duration: duration,
      preferredTime: tappingRequest.preferredTime,
      status: 'active',
      progressPercentage: progressPercentage,
      completedDays: Math.max(0, daysPassed),
      totalScheduledDays: duration,
      missedDays: 0,
      budgetRange: tappingRequest.budgetRange,
      estimatedCost: parseFloat(tappingRequest.budgetRange) || 0,
      actualCost: 0,
      adminNotes: [{
        note: 'Schedule created from accepted tapping request',
        addedAt: new Date(),
        priority: 'normal'
      }],
      dailyRecords: [], // Start with empty daily records to avoid validation issues
      modifications: []
    });

    const savedSchedule = await tappingSchedule.save();
    console.log('✅ Tapping schedule created successfully:', savedSchedule.scheduleId);
    console.log('📊 Progress:', savedSchedule.progressPercentage + '%');
    console.log('👤 Farmer:', savedSchedule.farmerName);
    console.log('🔨 Tapper:', savedSchedule.tapperName);

  } catch (error) {
    console.error('❌ Error creating schedule:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
createScheduleFromRequest();
