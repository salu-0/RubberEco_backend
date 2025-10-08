const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const NurseryAdmin = require('../models/NurseryAdmin');
const NurseryCenter = require('../models/NurseryCenter');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/RubberEco', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function createAllNurseryAdmins() {
  try {
    console.log('🔄 Creating nursery admin users for all centers...');
    
    // Get all nursery centers
    const centers = await NurseryCenter.find({ isActive: true });
    console.log(`📋 Found ${centers.length} nursery centers`);
    
    if (centers.length === 0) {
      console.log('❌ No nursery centers found. Please create nursery centers first.');
      return;
    }
    
    // Clear existing nursery admins
    console.log('🗑️  Clearing existing nursery admins...');
    await NurseryAdmin.deleteMany({});
    
    // Create admin for each center
    for (let i = 0; i < centers.length; i++) {
      const center = centers[i];
      console.log(`\n🏢 Creating admin for: ${center.name}`);
      
      // Create email based on center name
      const email = `${center.email}`;
      const password = `nursery@${i + 1}`;
      
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Create nursery admin
      const nurseryAdmin = new NurseryAdmin({
        name: `${center.name} Administrator`,
        email: email,
        password: hashedPassword,
        phone: center.contact || '+91-9876543210',
        nurseryCenterId: center._id,
        nurseryCenterName: center.name,
        location: center.location,
        isActive: true,
        isVerified: true,
        permissions: {
          managePlants: true,
          manageStock: true,
          managePricing: true,
          manageShipments: true,
          managePayments: true,
          viewReports: true
        }
      });
      
      await nurseryAdmin.save();
      
      console.log(`✅ Admin created for ${center.name}`);
      console.log(`   📧 Email: ${email}`);
      console.log(`   🔑 Password: ${password}`);
    }
    
    console.log('\n🎉 All nursery admins created successfully!');
    console.log('\n📋 Login Credentials Summary:');
    
    // Display all created admins
    const admins = await NurseryAdmin.find().populate('nurseryCenterId', 'name location');
    admins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.nurseryCenterName}`);
      console.log(`   📧 Email: ${admin.email}`);
      console.log(`   🔑 Password: nursery@${index + 1}`);
      console.log(`   📍 Location: ${admin.location}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error creating nursery admins:', error);
  } finally {
    mongoose.connection.close();
  }
}

createAllNurseryAdmins();

