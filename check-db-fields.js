const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const TappingRequest = require('./models/TappingRequest');

const checkFields = async () => {
  try {
    console.log('🔍 Checking TappingRequest fields in database...\n');
    
    // Get the latest request
    const latestRequest = await TappingRequest.findOne().sort({ createdAt: -1 });
    
    if (!latestRequest) {
      console.log('❌ No requests found in database');
      return;
    }
    
    console.log('📋 Latest request fields:');
    console.log('   _id:', latestRequest._id);
    console.log('   requestId:', latestRequest.requestId);
    console.log('   farmerName:', latestRequest.farmerName);
    console.log('   farmLocation:', latestRequest.farmLocation);
    console.log('   numberOfTrees (old field):', latestRequest.numberOfTrees);
    console.log('   farmerEstimatedTrees (new field):', latestRequest.farmerEstimatedTrees);
    console.log('   tapperVerifiedTrees:', latestRequest.tapperVerifiedTrees);
    console.log('   finalAgreedTrees:', latestRequest.finalAgreedTrees);
    console.log('   treeCountStatus:', latestRequest.treeCountStatus);
    console.log('   status:', latestRequest.status);
    
    console.log('\n🔧 Full document:');
    console.log(JSON.stringify(latestRequest.toObject(), null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    mongoose.connection.close();
  }
};

checkFields();
