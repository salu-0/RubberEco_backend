const mongoose = require('mongoose');
const TappingRequest = require('../models/TappingRequest');
const Register = require('../models/Register');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/RubberEco');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Create sample tapping requests
const createSampleTappingRequests = async () => {
  try {
    console.log('🔍 Creating sample tapping requests...');

    // First, find or create a farmer user
    let farmer = await Register.findOne({ role: 'farmer' });
    if (!farmer) {
      console.log('📝 Creating sample farmer...');
      farmer = new Register({
        name: 'Rajesh Kumar',
        email: 'rajesh@example.com',
        phone: '9876543210',
        role: 'farmer',
        status: 'active',
        location: 'Kottayam, Kerala'
      });
      await farmer.save();
      console.log('✅ Created farmer:', farmer.name);
    }

    // Create sample tapping requests
    const sampleRequests = [
      {
        requestId: 'TR-2024-001',
        farmerId: farmer._id,
        farmerName: 'Rajesh Kumar',
        farmerEmail: 'rajesh@example.com',
        farmerPhone: '+91 98765 43210',
        farmLocation: 'Kottayam, Kerala',
        farmSize: '5 acres',
        farmerEstimatedTrees: 250,
        tappingType: 'daily',
        startDate: new Date('2024-12-20'),
        preferredTime: 'early_morning',
        urgency: 'high',
        budgetPerTree: 3,
        specialRequirements: 'Experience with old trees required',
        contactPreference: 'phone',
        status: 'submitted'
      },
      {
        requestId: 'TR-2024-002',
        farmerId: farmer._id,
        farmerName: 'Priya Nair',
        farmerEmail: 'priya@example.com',
        farmerPhone: '+91 87654 32109',
        farmLocation: 'Thrissur, Kerala',
        farmSize: '3 acres',
        farmerEstimatedTrees: 150,
        tappingType: 'alternate_day',
        startDate: new Date('2024-12-25'),
        preferredTime: 'morning',
        urgency: 'normal',
        budgetPerTree: 2.5,
        specialRequirements: 'Organic farming practices preferred',
        contactPreference: 'whatsapp',
        status: 'submitted'
      },
      {
        requestId: 'TR-2024-003',
        farmerId: farmer._id,
        farmerName: 'Suresh Menon',
        farmerEmail: 'suresh@example.com',
        farmerPhone: '+91 76543 21098',
        farmLocation: 'Palakkad, Kerala',
        farmSize: '7 acres',
        farmerEstimatedTrees: 350,
        tappingType: 'weekly',
        startDate: new Date('2024-12-30'),
        preferredTime: 'afternoon',
        urgency: 'low',
        budgetPerTree: 2,
        specialRequirements: 'Weekend work preferred',
        contactPreference: 'email',
        status: 'under_review'
      }
    ];

    // Clear existing sample requests
    await TappingRequest.deleteMany({ 
      requestId: { $in: ['TR-2024-001', 'TR-2024-002', 'TR-2024-003'] } 
    });
    console.log('🧹 Cleared existing sample requests');

    // Create new requests
    const createdRequests = await TappingRequest.insertMany(sampleRequests);
    console.log(`✅ Created ${createdRequests.length} sample tapping requests:`);
    
    createdRequests.forEach(req => {
      console.log(`   - ${req.requestId}: ${req.farmerName} (${req.farmLocation}) - ${req.urgency} urgency`);
    });

    console.log('\n🎉 Sample data created successfully!');
    console.log('📋 You can now see these requests in the Staff Dashboard');

  } catch (error) {
    console.error('❌ Error creating sample requests:', error);
  }
};

// Main execution
const main = async () => {
  await connectDB();
  await createSampleTappingRequests();
  await mongoose.connection.close();
  console.log('🔌 Database connection closed');
};

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createSampleTappingRequests };
