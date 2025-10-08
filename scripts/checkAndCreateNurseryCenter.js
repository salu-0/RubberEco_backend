const mongoose = require('mongoose');
const NurseryCenter = require('../models/NurseryCenter');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rubbereco', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function checkAndCreateNurseryCenter() {
  try {
    console.log('🔄 Checking for nursery centers...');
    
    // Check if any nursery centers exist
    const centers = await NurseryCenter.find();
    console.log(`📋 Found ${centers.length} nursery centers`);
    
    if (centers.length === 0) {
      console.log('🏢 Creating default nursery center...');
      
      // Create a default nursery center
      const defaultCenter = new NurseryCenter({
        name: 'Green Valley Nursery',
        location: 'Kerala, India',
        contact: '+91-9876543210',
        email: 'info@greenvalleynursery.com',
        specialty: 'Rubber Plant Varieties',
        isActive: true
      });
      
      await defaultCenter.save();
      console.log('✅ Default nursery center created:', defaultCenter.name);
    } else {
      console.log('✅ Nursery centers already exist');
      centers.forEach(center => {
        console.log(`   - ${center.name} (${center.location})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkAndCreateNurseryCenter();

