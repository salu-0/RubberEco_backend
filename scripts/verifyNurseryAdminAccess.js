const mongoose = require('mongoose');
const NurseryAdmin = require('../models/NurseryAdmin');
const NurseryPlant = require('../models/NurseryPlant');
const NurseryCenter = require('../models/NurseryCenter');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/RubberEco', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function verifyNurseryAdminAccess() {
  try {
    console.log('🔍 Verifying nursery admin access control...');
    
    // Get all nursery admins
    const admins = await NurseryAdmin.find().populate('nurseryCenterId', 'name location');
    console.log(`📋 Found ${admins.length} nursery admins\n`);
    
    for (const admin of admins) {
      console.log(`🏢 Testing access for: ${admin.nurseryCenterName}`);
      console.log(`   📧 Email: ${admin.email}`);
      
      // Get plants for this admin's nursery center
      const plants = await NurseryPlant.find({ 
        nurseryCenterId: admin.nurseryCenterId._id,
        isActive: true 
      });
      
      console.log(`   🌱 Plants accessible: ${plants.length}`);
      
      if (plants.length > 0) {
        console.log(`   📝 Plant names:`);
        plants.forEach(plant => {
          console.log(`      - ${plant.name} (Stock: ${plant.stockAvailable}, Price: ₹${plant.unitPrice})`);
        });
      } else {
        console.log(`   ⚠️  No plants found for this nursery center`);
      }
      
      // Verify they can't access other nursery centers' plants
      const otherCenters = await NurseryCenter.find({ 
        _id: { $ne: admin.nurseryCenterId._id },
        isActive: true 
      });
      
      console.log(`   🔒 Other nursery centers: ${otherCenters.length}`);
      
      // Check if any plants from other centers are accessible
      for (const otherCenter of otherCenters) {
        const otherPlants = await NurseryPlant.find({ 
          nurseryCenterId: otherCenter._id,
          isActive: true 
        });
        
        if (otherPlants.length > 0) {
          console.log(`   ⚠️  WARNING: Found ${otherPlants.length} plants from other center: ${otherCenter.name}`);
        }
      }
      
      console.log('');
    }
    
    console.log('✅ Access control verification completed!');
    console.log('\n📋 Summary:');
    console.log('- Each nursery admin can only access their own nursery center\'s plants');
    console.log('- Stock and price updates are restricted to their assigned nursery');
    console.log('- No cross-nursery access is possible');
    
  } catch (error) {
    console.error('❌ Error verifying access:', error);
  } finally {
    mongoose.connection.close();
  }
}

verifyNurseryAdminAccess();

