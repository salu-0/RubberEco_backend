const mongoose = require('mongoose');
const NurseryPlant = require('../models/NurseryPlant');
const NurseryCenter = require('../models/NurseryCenter');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rubbereco', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function enforceVarietyLimit() {
  try {
    console.log('🔄 Enforcing 2-variety limit per nursery center...');
    
    // Get all nursery centers
    const centers = await NurseryCenter.find({ isActive: true });
    console.log(`📋 Found ${centers.length} nursery centers`);
    
    for (const center of centers) {
      console.log(`\n🏢 Processing center: ${center.name}`);
      
      // Get all plants for this center
      const plants = await NurseryPlant.find({ 
        nurseryCenterId: center._id,
        isActive: true 
      });
      
      console.log(`   Found ${plants.length} plants`);
      
      if (plants.length === 0) {
        console.log('   ✅ No plants to process');
        continue;
      }
      
      // Group plants by variety
      const varietyMap = new Map();
      plants.forEach(plant => {
        const variety = plant.variety || plant.clone || plant.name;
        if (variety) {
          const normalizedVariety = variety.toLowerCase().trim();
          if (!varietyMap.has(normalizedVariety)) {
            varietyMap.set(normalizedVariety, []);
          }
          varietyMap.get(normalizedVariety).push(plant);
        }
      });
      
      const varieties = Array.from(varietyMap.keys());
      console.log(`   Found ${varieties.length} unique varieties: ${varieties.join(', ')}`);
      
      if (varieties.length <= 2) {
        console.log('   ✅ Within variety limit');
        continue;
      }
      
      // If more than 2 varieties, keep the first 2 and deactivate the rest
      console.log(`   ⚠️  Exceeds 2-variety limit. Keeping first 2 varieties.`);
      
      const varietiesToKeep = varieties.slice(0, 2);
      const varietiesToRemove = varieties.slice(2);
      
      console.log(`   Keeping: ${varietiesToKeep.join(', ')}`);
      console.log(`   Removing: ${varietiesToRemove.join(', ')}`);
      
      // Deactivate plants from excess varieties
      for (const varietyToRemove of varietiesToRemove) {
        const plantsToDeactivate = varietyMap.get(varietyToRemove);
        const plantIds = plantsToDeactivate.map(plant => plant._id);
        
        const result = await NurseryPlant.updateMany(
          { _id: { $in: plantIds } },
          { $set: { isActive: false } }
        );
        
        console.log(`   Deactivated ${result.modifiedCount} plants from variety: ${varietyToRemove}`);
      }
    }
    
    console.log('\n🎉 Variety limit enforcement completed!');
    
    // Show final summary
    console.log('\n📊 Final Summary:');
    for (const center of centers) {
      const activePlants = await NurseryPlant.find({ 
        nurseryCenterId: center._id,
        isActive: true 
      });
      
      const varieties = new Set();
      activePlants.forEach(plant => {
        const variety = plant.variety || plant.clone || plant.name;
        if (variety) {
          varieties.add(variety);
        }
      });
      
      console.log(`   ${center.name}: ${varieties.size}/2 varieties (${activePlants.length} plants)`);
    }
    
  } catch (error) {
    console.error('❌ Enforcement failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run enforcement
enforceVarietyLimit();


