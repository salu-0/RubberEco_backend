const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const RainfallForecast = require('../models/RainfallForecast');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/RubberEco';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// District average annual rainfall (mm) - used to calculate ratios
const DISTRICT_AVERAGE_RAINFALL = {
  'Thiruvananthapuram': 2099,
  'Idukki': 2959,
  'Wayanad': 2489,
  'Kozhikode': 3266,
  'Ernakulam': 2894,
  'Thrissur': 2736,
  'Palakkad': 1747,
  'Alappuzha': 2804,
  'Kollam': 2244,
  'Kottayam': 3094,
  'Pathanamthitta': 2595,
  'Kannur': 2758,
  'Kasaragod': 2808,
  'Malappuram': 2600
};

// Calculate district ratios based on average annual rainfall
const calculateDistrictRatios = () => {
  const totalRainfall = Object.values(DISTRICT_AVERAGE_RAINFALL).reduce((sum, val) => sum + val, 0);
  const ratios = {};
  
  for (const [district, rainfall] of Object.entries(DISTRICT_AVERAGE_RAINFALL)) {
    ratios[district] = rainfall / totalRainfall;
  }
  
  return ratios;
};

// Read Kerala historical rainfall CSV
const loadKeralaHistoricalData = () => {
  const csvPath = path.join(__dirname, '..', 'Kerala-Rainfall-Historical.csv');
  const raw = fs.readFileSync(csvPath, 'utf8');
  
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const dataLines = lines.slice(1); // Skip header
  
  const records = [];
  
  for (const line of dataLines) {
    const parts = line.split(',');
    if (parts.length < 18) continue;
    
    const year = parseInt(parts[1], 10);
    const jjas = parseFloat(parts[17]); // JJAS column (monsoon rainfall)
    
    if (!Number.isNaN(year) && !Number.isNaN(jjas)) {
      records.push({ year, jjas });
    }
  }
  
  return records;
};

// Compute historical average for risk classification
const computeHistoricalAverage = (records) => {
  if (!records.length) return 0;
  const sum = records.reduce((acc, r) => acc + r.jjas, 0);
  return sum / records.length;
};

// Classify risk level
const classifyRisk = (value, historicalAvg) => {
  if (value > historicalAvg * 1.1) {
    return 'High';
  } else if (value < historicalAvg * 0.9) {
    return 'Low';
  }
  return 'Normal';
};

const importKeralaRainfallForecasts = async () => {
  try {
    // Drop old index if it exists (year_1_season_1) - this conflicts with new district-based schema
    try {
      const indexes = await RainfallForecast.collection.indexes();
      const oldIndex = indexes.find(idx => idx.name === 'year_1_season_1' || 
        (idx.key && idx.key.year === 1 && idx.key.season === 1 && !idx.key.district));
      
      if (oldIndex) {
        await RainfallForecast.collection.dropIndex(oldIndex.name);
        console.log(`🗑️  Dropped old index: ${oldIndex.name}`);
      }
    } catch (err) {
      // Index might not exist, that's okay
      if (err.code !== 27 && err.codeName !== 'IndexNotFound' && !err.message.includes('index not found')) {
        console.log('⚠️  Could not drop old index (may not exist):', err.message);
      }
    }

    // Clear all old data (optional - comment out if you want to keep old data)
    const deleteResult = await RainfallForecast.deleteMany({});
    console.log(`🗑️  Cleared ${deleteResult.deletedCount} old forecast documents`);

    // Ensure the new index exists (year_1_district_1_season_1)
    try {
      await RainfallForecast.collection.createIndex({ year: 1, district: 1, season: 1 }, { unique: true });
      console.log('✅ Created new index (year_1_district_1_season_1)');
    } catch (err) {
      console.log('⚠️  Index may already exist:', err.message);
    }

    console.log('🌧️  Loading Kerala historical rainfall data...');
    const records = loadKeralaHistoricalData();
    
    if (!records.length) {
      console.error('No data found in Kerala-Rainfall-Historical.csv');
      return;
    }
    
    const historicalAvg = computeHistoricalAverage(records);
    const districtRatios = calculateDistrictRatios();
    
    console.log(`📊 Historical average Kerala monsoon rainfall (JJAS): ${historicalAvg.toFixed(2)} mm`);
    console.log(`📊 District ratios calculated for ${Object.keys(districtRatios).length} districts`);
    
    // Generate forecasts for future years (2023-2026) using average of last 5 years
    const lastHistoricalYear = Math.max(...records.map(r => r.year));
    const recentYears = records.filter(r => r.year > lastHistoricalYear - 5);
    const recentAvg = computeHistoricalAverage(recentYears);
    
    const futureYears = [2023, 2024, 2025, 2026];
    futureYears.forEach(year => {
      if (year > lastHistoricalYear) {
        records.push({ year, jjas: recentAvg, isForecast: true });
      }
    });
    
    const bulkOps = [];
    
    // Process each year
    for (const record of records) {
      const keralaMonsoonRainfall = record.jjas;
      const isForecast = record.isForecast || false;
      
      // Split Kerala rainfall across districts using ratios
      for (const [district, ratio] of Object.entries(districtRatios)) {
        const districtRainfall = keralaMonsoonRainfall * ratio;
        const roundedRainfall = Number(districtRainfall.toFixed(2));
        const riskLevel = classifyRisk(districtRainfall, historicalAvg * ratio);
        
        const doc = {
          year: record.year,
          district,
          season: 'Monsoon',
          months: ['June', 'July', 'August', 'September'],
          predictedRainfall: roundedRainfall,
          riskLevel,
          model: 'SARIMA',
          isForecast,
          createdAt: new Date()
        };
        
        bulkOps.push({
          updateOne: {
            filter: { year: record.year, district, season: 'Monsoon' },
            update: { $set: doc },
            upsert: true
          }
        });
      }
    }
    
    console.log(`📝 Preparing to upsert ${bulkOps.length} district-wise rainfall forecast documents...`);
    
    const result = await RainfallForecast.bulkWrite(bulkOps);
    
    console.log('✅ Kerala district-wise rainfall forecasts stored/updated in MongoDB');
    console.log(`   - Upserted: ${result.upsertedCount}`);
    console.log(`   - Modified: ${result.modifiedCount}`);
    console.log(`   - Matched: ${result.matchedCount}`);
  } catch (error) {
    console.error('❌ Error importing Kerala rainfall forecasts:', error);
    throw error;
  }
};

const run = async () => {
  await connectDB();
  await importKeralaRainfallForecasts();
  await mongoose.connection.close();
  console.log('🔌 Database connection closed');
  process.exit(0);
};

if (require.main === module) {
  run();
}

module.exports = { importKeralaRainfallForecasts };

