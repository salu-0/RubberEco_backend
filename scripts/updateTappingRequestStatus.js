const mongoose = require('mongoose');
const TappingRequest = require('../models/TappingRequest');
const ServiceRequestApplication = require('../models/ServiceRequestApplication');
require('dotenv').config();

async function updateTappingRequestStatus() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rubbereco');
    console.log('✅ Connected to MongoDB');

    // Find all tapping requests with 'submitted' status
    const submittedRequests = await TappingRequest.find({ status: 'submitted' });
    console.log(`📋 Found ${submittedRequests.length} tapping requests with 'submitted' status`);

    let updatedCount = 0;

    for (const request of submittedRequests) {
      // Check if this request has any applications
      const applicationCount = await ServiceRequestApplication.countDocuments({
        tappingRequestId: request._id
      });

      if (applicationCount > 0) {
        // This request has applications, update its status to 'under_review'
        request.status = 'under_review';
        await request.save();
        updatedCount++;
        console.log(`✅ Updated request ${request.requestId} to 'under_review' (has ${applicationCount} applications)`);
      }
    }

    console.log(`✅ Updated ${updatedCount} tapping requests from 'submitted' to 'under_review' status`);

    // Verify the update
    const underReviewRequests = await TappingRequest.find({ status: 'under_review' });
    console.log(`📋 Total tapping requests with 'under_review' status: ${underReviewRequests.length}`);

    console.log('✅ Tapping request status update completed successfully');

  } catch (error) {
    console.error('❌ Error updating tapping request status:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the script
updateTappingRequestStatus();
