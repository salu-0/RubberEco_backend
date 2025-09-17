const mongoose = require('mongoose');
const NurseryPlant = require('../models/NurseryPlant');
const NurseryCenter = require('../models/NurseryCenter');
const { RUBBER_VARIETIES } = require('../constants/rubberVarieties');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rubbereco', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function ensureTwoVarietiesPerCenter() {
  try {
    console.log('🔄 Ensuring each nursery center has exactly 2 standardized varieties...');
    
    // Get all nursery centers
    const centers = await NurseryCenter.find({ isActive: true });
    console.log(`📋 Found ${centers.length} nursery centers`);
    
    if (centers.length === 0) {
      console.log('❌ No nursery centers found. Please create nursery centers first.');
      return;
    }
    
    for (const center of centers) {
      console.log(`\n🏢 Processing center: ${center.name}`);
      
      // Get existing plants for this center
      const existingPlants = await NurseryPlant.find({ 
        nurseryCenterId: center._id,
        isActive: true 
      });
      
      console.log(`   Found ${existingPlants.length} existing plants`);
      
      // Check which varieties are missing
      const existingVarieties = new Set();
      existingPlants.forEach(plant => {
        const variety = plant.variety || plant.clone || plant.name;
        if (variety) {
          existingVarieties.add(variety.toLowerCase().trim());
        }
      });
      
      console.log(`   Existing varieties: ${Array.from(existingVarieties).join(', ')}`);
      
      // Create missing varieties
      for (const variety of RUBBER_VARIETIES) {
        const varietyExists = existingVarieties.has(variety.name.toLowerCase());
        
        if (!varietyExists) {
          console.log(`   ➕ Creating missing variety: ${variety.name}`);
          
          const plantData = {
            name: variety.name,
            variety: variety.name,
            clone: variety.name,
            description: variety.description,
            features: variety.characteristics.join(', '),
            unitPrice: 150, // Default price
            stockAvailable: 100, // Default stock
            minOrderQty: 1,
            nurseryCenterId: center._id,
            isActive: true
          };
          
          const plant = await NurseryPlant.create(plantData);
          console.log(`   ✅ Created ${variety.name} plant (ID: ${plant._id})`);
        } else {
          console.log(`   ✅ Variety ${variety.name} already exists`);
        }
      }
      
      // Remove any extra varieties (keep only the 2 standardized ones)
      const standardizedVarietyNames = RUBBER_VARIETIES.map(v => v.name.toLowerCase());
      const plantsToDeactivate = existingPlants.filter(plant => {
        const variety = plant.variety || plant.clone || plant.name;
        return variety && !standardizedVarietyNames.includes(variety.toLowerCase());
      });
      
      if (plantsToDeactivate.length > 0) {
        console.log(`   🗑️  Deactivating ${plantsToDeactivate.length} non-standard varieties`);
        const plantIds = plantsToDeactivate.map(plant => plant._id);
        await NurseryPlant.updateMany(
          { _id: { $in: plantIds } },
          { $set: { isActive: false } }
        );
      }
    }
    
    console.log('\n🎉 Two varieties per center enforcement completed!');
    
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
      console.log(`     Varieties: ${Array.from(varieties).join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Enforcement failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run enforcement
ensureTwoVarietiesPerCenter();


