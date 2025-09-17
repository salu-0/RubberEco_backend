const mongoose = require('mongoose');
const NurseryPlant = require('../models/NurseryPlant');
const NurseryCenter = require('../models/NurseryCenter');
const { RUBBER_VARIETIES_POOL, getVarietiesForCenter } = require('../constants/rubberVarieties');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rubbereco', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function distributeVarietiesToCenters() {
  try {
    console.log('🔄 Distributing different varieties to each nursery center...');
    
    // Get all nursery centers
    const centers = await NurseryCenter.find({ isActive: true }).sort({ _id: 1 });
    console.log(`📋 Found ${centers.length} nursery centers`);
    
    if (centers.length === 0) {
      console.log('❌ No nursery centers found. Please create nursery centers first.');
      return;
    }
    
    // Deactivate all existing plants
    console.log('🗑️  Deactivating all existing plants...');
    await NurseryPlant.updateMany({}, { $set: { isActive: false } });
    
    // Distribute varieties to each center
    console.log('🌱 Creating plants with center-specific varieties...');
    
    for (let i = 0; i < centers.length; i++) {
      const center = centers[i];
      const centerVarieties = getVarietiesForCenter(i, centers.length);
      
      console.log(`\n🏢 Center ${i + 1}/${centers.length}: ${center.name}`);
      console.log(`   Assigned varieties: ${centerVarieties.map(v => v.name).join(', ')}`);
      
      // Create plants for this center's assigned varieties
      for (const variety of centerVarieties) {
        const plantData = {
          name: variety.name,
          variety: variety.name,
          clone: variety.name,
          description: variety.description,
          features: variety.characteristics.join(', '),
          unitPrice: 150 + (Math.random() * 50), // Vary price slightly
          stockAvailable: 50 + Math.floor(Math.random() * 100), // Vary stock
          minOrderQty: 1,
          nurseryCenterId: center._id,
          isActive: true
        };
        
        const plant = await NurseryPlant.create(plantData);
        console.log(`   ✅ Created ${variety.name} plant (ID: ${plant._id}) - Stock: ${plantData.stockAvailable}, Price: ₹${plantData.unitPrice}`);
      }
    }
    
    console.log('\n🎉 Variety distribution completed successfully!');
    
    // Show final summary
    console.log('\n📊 Final Summary:');
    for (let i = 0; i < centers.length; i++) {
      const center = centers[i];
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
      console.log(`     Total Stock: ${activePlants.reduce((sum, plant) => sum + (plant.stockAvailable || 0), 0)} units`);
    }
    
    // Show variety distribution across all centers
    console.log('\n🌱 Variety Distribution Summary:');
    const varietyUsage = new Map();
    for (const variety of RUBBER_VARIETIES_POOL) {
      const centersWithVariety = [];
      for (let i = 0; i < centers.length; i++) {
        const centerVarieties = getVarietiesForCenter(i, centers.length);
        if (centerVarieties.some(v => v.name === variety.name)) {
          centersWithVariety.push(centers[i].name);
        }
      }
      varietyUsage.set(variety.name, centersWithVariety);
    }
    
    for (const [varietyName, centersList] of varietyUsage) {
      console.log(`   ${varietyName}: ${centersList.length} center(s) - ${centersList.join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Distribution failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run distribution
distributeVarietiesToCenters();


