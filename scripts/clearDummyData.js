const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const LandRegistration = require('../models/LandRegistration');
const TenancyOffering = require('../models/TenancyOffering');
const ServiceRequest = require('../models/ServiceRequest');
const User = require('../models/User');
const TappingRequest = require('../models/TappingRequest');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/RubberEco', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Clear dummy data
const clearDummyData = async () => {
  try {
    console.log('🧹 Starting dummy data cleanup...');

    // List of dummy land titles to remove
    const dummyLandTitles = [
      'Green Valley Plantation',
      'Riverside Farm',
      'Highland Estate'
    ];

    // Find and remove dummy land registrations
    const dummyLands = await LandRegistration.find({
      landTitle: { $in: dummyLandTitles }
    });

    console.log(`📋 Found ${dummyLands.length} dummy land registrations to remove:`);
    dummyLands.forEach(land => {
      console.log(`  - ${land.landTitle} (ID: ${land._id})`);
    });

    // Remove dummy land registrations
    const landDeleteResult = await LandRegistration.deleteMany({
      landTitle: { $in: dummyLandTitles }
    });
    console.log(`🗑️ Removed ${landDeleteResult.deletedCount} dummy land registrations`);

    // Find and remove dummy tenancy offerings
    const dummyOfferings = await TenancyOffering.find({
      landTitle: { $in: dummyLandTitles }
    });

    console.log(`📋 Found ${dummyOfferings.length} dummy tenancy offerings to remove:`);
    dummyOfferings.forEach(offering => {
      console.log(`  - ${offering.landTitle} (ID: ${offering._id})`);
    });

    // Remove dummy tenancy offerings
    const offeringDeleteResult = await TenancyOffering.deleteMany({
      landTitle: { $in: dummyLandTitles }
    });
    console.log(`🗑️ Removed ${offeringDeleteResult.deletedCount} dummy tenancy offerings`);

    // Also remove any registrations with specific dummy IDs if they exist
    const dummyIds = ['LR001', 'LR002', 'LR003', 'LO001', 'LO002', 'LO003'];
    
    const idBasedLandDeleteResult = await LandRegistration.deleteMany({
      registrationId: { $in: dummyIds }
    });
    console.log(`🗑️ Removed ${idBasedLandDeleteResult.deletedCount} lands with dummy IDs`);

    const idBasedOfferingDeleteResult = await TenancyOffering.deleteMany({
      offeringId: { $in: dummyIds }
    });
    console.log(`🗑️ Removed ${idBasedOfferingDeleteResult.deletedCount} offerings with dummy IDs`);

    // Remove dummy service requests
    const dummyServiceRequests = await ServiceRequest.find({
      $or: [
        { farmLocation: 'Kottayam, Kerala' },
        { farmSize: '2 hectares' },
        { numberOfTrees: '150' },
        { ratePerTree: '50' },
        { 'assignedProvider.name': 'Green Fertilizer Services' },
        { farmerName: 'Test Farmer' },
        { farmerEmail: 'test@example.com' }
      ]
    });

    console.log(`📋 Found ${dummyServiceRequests.length} dummy service requests to remove:`);
    dummyServiceRequests.forEach(request => {
      console.log(`  - ${request.title} (ID: ${request._id})`);
    });

    const serviceRequestDeleteResult = await ServiceRequest.deleteMany({
      $or: [
        { farmLocation: 'Kottayam, Kerala' },
        { farmSize: '2 hectares' },
        { numberOfTrees: '150' },
        { ratePerTree: '50' },
        { 'assignedProvider.name': 'Green Fertilizer Services' },
        { farmerName: 'Test Farmer' },
        { farmerEmail: 'test@example.com' }
      ]
    });
    console.log(`🗑️ Removed ${serviceRequestDeleteResult.deletedCount} dummy service requests`);

    // Remove dummy users (test farmers, etc.)
    const dummyUsers = await User.find({
      $or: [
        { email: { $regex: /test.*@example\.com/i } },
        { email: { $regex: /dummy.*@example\.com/i } },
        { name: 'Test Farmer' },
        { name: 'Rajesh Kumar' },
        { name: 'Priya Nair' },
        { name: 'Suresh Menon' },
        { phone: '+91 98765 43210' },
        { phone: '+91 98765 43211' },
        { phone: '+91 98765 43212' }
      ]
    });

    console.log(`📋 Found ${dummyUsers.length} dummy users to remove:`);
    dummyUsers.forEach(user => {
      console.log(`  - ${user.name} (${user.email})`);
    });

    const userDeleteResult = await User.deleteMany({
      $or: [
        { email: { $regex: /test.*@example\.com/i } },
        { email: { $regex: /dummy.*@example\.com/i } },
        { name: 'Test Farmer' },
        { name: 'Rajesh Kumar' },
        { name: 'Priya Nair' },
        { name: 'Suresh Menon' },
        { phone: '+91 98765 43210' },
        { phone: '+91 98765 43211' },
        { phone: '+91 98765 43212' }
      ]
    });
    console.log(`🗑️ Removed ${userDeleteResult.deletedCount} dummy users`);

    // Remove dummy tapping requests
    const dummyTappingRequests = await TappingRequest.find({
      $or: [
        { farmLocation: 'Test Farm Location' },
        { farmLocation: 'Kottayam Block A' },
        { farmLocation: 'Kottayam Block B' },
        { farmLocation: 'Kottayam Block C' },
        { farmerName: 'Test Farmer' },
        { farmerEmail: { $regex: /test.*@example\.com/i } },
        { farmSize: '10 acres' },
        { numberOfTrees: 500 }
      ]
    });

    console.log(`📋 Found ${dummyTappingRequests.length} dummy tapping requests to remove:`);
    dummyTappingRequests.forEach(request => {
      console.log(`  - ${request.farmerName} - ${request.farmLocation}`);
    });

    const tappingRequestDeleteResult = await TappingRequest.deleteMany({
      $or: [
        { farmLocation: 'Test Farm Location' },
        { farmLocation: 'Kottayam Block A' },
        { farmLocation: 'Kottayam Block B' },
        { farmLocation: 'Kottayam Block C' },
        { farmerName: 'Test Farmer' },
        { farmerEmail: { $regex: /test.*@example\.com/i } },
        { farmSize: '10 acres' },
        { numberOfTrees: 500 }
      ]
    });
    console.log(`🗑️ Removed ${tappingRequestDeleteResult.deletedCount} dummy tapping requests`);

    console.log('✅ Dummy data cleanup completed!');
    
    // Show remaining data count
    const remainingLands = await LandRegistration.countDocuments();
    const remainingOfferings = await TenancyOffering.countDocuments();
    const remainingServiceRequests = await ServiceRequest.countDocuments();
    const remainingUsers = await User.countDocuments();
    const remainingTappingRequests = await TappingRequest.countDocuments();

    console.log(`📊 Remaining data:`);
    console.log(`  - Land Registrations: ${remainingLands}`);
    console.log(`  - Tenancy Offerings: ${remainingOfferings}`);
    console.log(`  - Service Requests: ${remainingServiceRequests}`);
    console.log(`  - Users: ${remainingUsers}`);
    console.log(`  - Tapping Requests: ${remainingTappingRequests}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
};

// Main execution
const main = async () => {
  await connectDB();
  await clearDummyData();
  
  console.log('🏁 Script completed. Closing database connection...');
  await mongoose.connection.close();
  process.exit(0);
};

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { clearDummyData };
