const mongoose = require('mongoose');
const NurseryPlant = require('../models/NurseryPlant');
const NurseryCenter = require('../models/NurseryCenter');
const { RUBBER_VARIETIES } = require('../constants/rubberVarieties');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rubbereco', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function redistributePlantsToTwoVarieties() {
  try {
    console.log('🔄 Redistributing plants to ensure each center has exactly 2 varieties...');
    
    // Get all nursery centers
    const centers = await NurseryCenter.find({ isActive: true });
    console.log(`📋 Found ${centers.length} nursery centers`);
    
    if (centers.length === 0) {
      console.log('❌ No nursery centers found. Please create nursery centers first.');
      return;
    }
    
    // Deactivate all existing plants
    console.log('🗑️  Deactivating all existing plants...');
    await NurseryPlant.updateMany({}, { $set: { isActive: false } });
    
    // Create new plants for each center with both varieties
    console.log('🌱 Creating plants with standardized varieties for each center...');
    
    for (let i = 0; i < centers.length; i++) {
      const center = centers[i];
      console.log(`\n🏢 Processing center ${i + 1}/${centers.length}: ${center.name}`);
      
      // Create plants for both varieties
      for (const variety of RUBBER_VARIETIES) {
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
      }
    }
    
    console.log('\n🎉 Redistribution completed successfully!');
    
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
    console.error('❌ Redistribution failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run redistribution
redistributePlantsToTwoVarieties();


