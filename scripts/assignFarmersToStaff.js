require('dotenv').config();
const mongoose = require('mongoose');
const Staff = require('../models/Staff');
const User = require('../models/Register');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

const assignFarmersToStaff = async () => {
  try {
    await connectDB();

    // Get all staff members
    const staffMembers = await Staff.find({ status: 'active' });
    console.log(`📋 Found ${staffMembers.length} active staff members`);

    // Get all farmers (users with role 'farmer')
    const farmers = await User.find({ role: 'farmer' });
    console.log(`👨‍🌾 Found ${farmers.length} farmers`);

    if (farmers.length === 0) {
      console.log('⚠️ No farmers found. Creating sample farmers...');
      
      // Create sample farmers (empty for production)
      const sampleFarmers = [
      ];

      for (const farmerData of sampleFarmers) {
        const farmer = new User(farmerData);
        await farmer.save();
        console.log(`✅ Created farmer: ${farmerData.name}`);
      }

      // Refresh farmers list
      const newFarmers = await User.find({ role: 'farmer' });
      console.log(`👨‍🌾 Now have ${newFarmers.length} farmers`);
    }

    // Assign farmers to staff members
    const updatedFarmers = await User.find({ role: 'farmer' });
    
    for (let i = 0; i < staffMembers.length && i < updatedFarmers.length; i++) {
      const staff = staffMembers[i];
      const farmer = updatedFarmers[i];

      // Assign farmer to staff
      await staff.assignFarmer({
        farmerId: farmer._id,
        farmerName: farmer.name,
        farmerEmail: farmer.email,
        farmerPhone: farmer.phone
      }, 'tapping');

      console.log(`✅ Assigned farmer ${farmer.name} to staff ${staff.name}`);
    }

    console.log('🎉 Farmer assignments completed!');
    
  } catch (error) {
    console.error('❌ Error assigning farmers to staff:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database connection closed');
  }
};

assignFarmersToStaff();
