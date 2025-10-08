const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const NurseryAdmin = require('../models/NurseryAdmin');
const NurseryCenter = require('../models/NurseryCenter');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/RubberEco', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function createNurseryAdmin() {
  try {
    console.log('🔄 Creating nursery admin user...');
    
    // Get the first nursery center
    const nurseryCenter = await NurseryCenter.findOne({ isActive: true });
    
    if (!nurseryCenter) {
      console.log('❌ No nursery center found. Please create a nursery center first.');
      return;
    }
    
    console.log(`📋 Using nursery center: ${nurseryCenter.name}`);
    
    // Check if nursery admin already exists
    const existingAdmin = await NurseryAdmin.findOne({ email: 'nursery@example.com' });
    if (existingAdmin) {
      console.log('✅ Nursery admin already exists with email: nursery@example.com');
      return;
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('nursery@47', salt);
    
    // Create nursery admin
    const nurseryAdmin = new NurseryAdmin({
      name: 'Nursery Administrator',
      email: 'nursery@example.com',
      password: hashedPassword,
      phone: '+91-9876543210',
      nurseryCenterId: nurseryCenter._id,
      nurseryCenterName: nurseryCenter.name,
      location: nurseryCenter.location || 'Default Location',
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
    
    console.log('✅ Nursery admin created successfully!');
    console.log('📧 Email: nursery@example.com');
    console.log('🔑 Password: nursery@47');
    console.log(`🏢 Nursery Center: ${nurseryCenter.name}`);
    console.log('🎉 You can now login to the nursery admin dashboard!');
    
  } catch (error) {
    console.error('❌ Error creating nursery admin:', error);
  } finally {
    mongoose.connection.close();
  }
}

createNurseryAdmin();
