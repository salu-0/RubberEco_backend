const mongoose = require('mongoose');
const ServiceRequestApplication = require('../models/ServiceRequestApplication');
require('dotenv').config();

async function updateApplicationStatus() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rubbereco');
    console.log('✅ Connected to MongoDB');

    // Find all applications with 'submitted' status
    const submittedApplications = await ServiceRequestApplication.find({ status: 'submitted' });
    console.log(`📋 Found ${submittedApplications.length} applications with 'submitted' status`);

    if (submittedApplications.length === 0) {
      console.log('✅ No applications need to be updated');
      return;
    }

    // Update all submitted applications to 'under_review'
    const result = await ServiceRequestApplication.updateMany(
      { status: 'submitted' },
      { 
        status: 'under_review',
        updatedAt: new Date()
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} applications from 'submitted' to 'under_review' status`);

    // Verify the update
    const updatedApplications = await ServiceRequestApplication.find({ status: 'under_review' });
    console.log(`📋 Total applications with 'under_review' status: ${updatedApplications.length}`);

    console.log('✅ Status update completed successfully');

  } catch (error) {
    console.error('❌ Error updating application status:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the script
updateApplicationStatus();
