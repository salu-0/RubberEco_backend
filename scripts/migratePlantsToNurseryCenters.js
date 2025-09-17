const mongoose = require('mongoose');
const NurseryPlant = require('../models/NurseryPlant');
const NurseryCenter = require('../models/NurseryCenter');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rubbereco', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function migratePlantsToNurseryCenters() {
  try {
    console.log('🔄 Starting migration of plants to nursery centers...');
    
    // Get all nursery centers
    const centers = await NurseryCenter.find({ isActive: true });
    if (centers.length === 0) {
      console.log('❌ No nursery centers found. Please create nursery centers first.');
      return;
    }
    
    console.log(`📋 Found ${centers.length} nursery centers`);
    
    // Get all plants without nursery center
    const plantsWithoutCenter = await NurseryPlant.find({ 
      $or: [
        { nurseryCenterId: { $exists: false } },
        { nurseryCenterId: null }
      ]
    });
    
    console.log(`🌱 Found ${plantsWithoutCenter.length} plants without nursery center`);
    
    if (plantsWithoutCenter.length === 0) {
      console.log('✅ All plants already have nursery center associations');
      return;
    }
    
    // Distribute plants across centers to respect 2-variety limit
    console.log(`🏢 Distributing plants across ${centers.length} centers with 2-variety limit`);
    
    let centerIndex = 0;
    let plantsPerCenter = Math.ceil(plantsWithoutCenter.length / centers.length);
    
    for (let i = 0; i < plantsWithoutCenter.length; i += plantsPerCenter) {
      const center = centers[centerIndex % centers.length];
      const plantsBatch = plantsWithoutCenter.slice(i, i + plantsPerCenter);
      
      console.log(`   Assigning ${plantsBatch.length} plants to ${center.name}`);
      
      const plantIds = plantsBatch.map(plant => plant._id);
      await NurseryPlant.updateMany(
        { _id: { $in: plantIds } },
        { $set: { nurseryCenterId: center._id } }
      );
      
      centerIndex++;
    }
    
    console.log('✅ Plants distributed across nursery centers');
    console.log('🎉 Migration completed successfully!');
    console.log('\n⚠️  Note: Run enforceVarietyLimit.js to ensure 2-variety limit per center');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run migration
migratePlantsToNurseryCenters();
