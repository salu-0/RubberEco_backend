const mongoose = require('mongoose');
const NurseryCenter = require('../models/NurseryCenter');
const NurseryPlant = require('../models/NurseryPlant');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/RubberEco', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function fixPlantDistribution() {
  try {
    console.log('🔄 Fixing plant distribution to ensure proper nursery center association...');
    
    // Get all nursery centers
    const centers = await NurseryCenter.find({ isActive: true }).sort({ _id: 1 });
    console.log(`📋 Found ${centers.length} nursery centers`);
    
    // Get all plants
    const allPlants = await NurseryPlant.find({ isActive: true });
    console.log(`🌱 Found ${allPlants.length} plants`);
    
    // Clear all existing plant associations
    console.log('🗑️  Clearing existing plant associations...');
    await NurseryPlant.updateMany({}, { $unset: { nurseryCenterId: 1 } });
    
    // Distribute plants evenly across centers (2 plants per center)
    const plantsPerCenter = Math.ceil(allPlants.length / centers.length);
    console.log(`📊 Distributing ${plantsPerCenter} plants per center`);
    
    let plantIndex = 0;
    
    for (let i = 0; i < centers.length; i++) {
      const center = centers[i];
      console.log(`\n🏢 Assigning plants to: ${center.name}`);
      
      // Assign plants to this center
      const plantsToAssign = allPlants.slice(plantIndex, plantIndex + plantsPerCenter);
      
      for (const plant of plantsToAssign) {
        await NurseryPlant.findByIdAndUpdate(plant._id, {
          nurseryCenterId: center._id
        });
        console.log(`   ✅ Assigned: ${plant.name} (Stock: ${plant.stockAvailable}, Price: ₹${plant.unitPrice})`);
      }
      
      plantIndex += plantsPerCenter;
    }
    
    // Verify the distribution
    console.log('\n🔍 Verifying plant distribution...');
    for (const center of centers) {
      const centerPlants = await NurseryPlant.find({ 
        nurseryCenterId: center._id,
        isActive: true 
      });
      console.log(`   ${center.name}: ${centerPlants.length} plants`);
    }
    
    console.log('\n✅ Plant distribution completed successfully!');
    console.log('🎉 Each nursery admin can now only manage their own plants!');
    
  } catch (error) {
    console.error('❌ Error fixing plant distribution:', error);
  } finally {
    mongoose.connection.close();
  }
}

fixPlantDistribution();

