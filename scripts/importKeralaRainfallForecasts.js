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

// Month names mapping
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Read Kerala historical rainfall CSV with monthly data
const loadKeralaHistoricalData = () => {
  const csvPath = path.join(__dirname, '..', 'Kerala-Rainfall-Historical.csv');
  const raw = fs.readFileSync(csvPath, 'utf8');
  
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const dataLines = lines.slice(1); // Skip header
  
  const records = [];
  
  // CSV columns: SUBDIVISION,YEAR,JAN,FEB,MAR,APR,MAY,JUN,JUL,AUG,SEP,OCT,NOV,DEC,ANNUAL,JF,MAM,JJAS,OND
  // Index:        0           1    2   3   4   5   6   7   8   9   10  11  12  13  14     15 16  17   18
  
  for (const line of dataLines) {
    const parts = line.split(',');
    if (parts.length < 19) continue;
    
    const year = parseInt(parts[1], 10);
    if (Number.isNaN(year)) continue;
    
    // Read monthly data (JAN=2, FEB=3, ..., DEC=13)
    const monthlyData = {};
    for (let month = 1; month <= 12; month++) {
      const monthIndex = month + 1; // JAN is at index 2
      const rainfall = parseFloat(parts[monthIndex]);
      if (!Number.isNaN(rainfall)) {
        monthlyData[month] = rainfall;
      }
    }
    
    if (Object.keys(monthlyData).length > 0) {
      records.push({ year, monthlyData });
    }
  }
  
  return records;
};

// Compute historical average for a specific month
const computeMonthlyHistoricalAverage = (records, month) => {
  const monthValues = records
    .map(r => r.monthlyData[month])
    .filter(val => val !== undefined && !Number.isNaN(val));
  
  if (!monthValues.length) return 0;
  const sum = monthValues.reduce((acc, val) => acc + val, 0);
  return sum / monthValues.length;
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
    // Drop old indexes if they exist
    try {
      const indexes = await RainfallForecast.collection.indexes();
      const oldIndexes = indexes.filter(idx => 
        idx.name === 'year_1_season_1' || 
        idx.name === 'year_1_district_1_season_1' ||
        (idx.key && idx.key.year === 1 && idx.key.season === 1 && !idx.key.month)
      );
      
      for (const oldIndex of oldIndexes) {
        try {
          await RainfallForecast.collection.dropIndex(oldIndex.name);
          console.log(`🗑️  Dropped old index: ${oldIndex.name}`);
        } catch (err) {
          // Index might not exist, that's okay
        }
      }
    } catch (err) {
      // Index might not exist, that's okay
      if (err.code !== 27 && err.codeName !== 'IndexNotFound' && !err.message.includes('index not found')) {
        console.log('⚠️  Could not drop old indexes (may not exist):', err.message);
      }
    }

    // Clear all old data (optional - comment out if you want to keep old data)
    const deleteResult = await RainfallForecast.deleteMany({});
    console.log(`🗑️  Cleared ${deleteResult.deletedCount} old forecast documents`);

    // Ensure the new index exists (year_1_district_1_month_1)
    try {
      await RainfallForecast.collection.createIndex({ year: 1, district: 1, month: 1 }, { unique: true });
      console.log('✅ Created new index (year_1_district_1_month_1)');
    } catch (err) {
      console.log('⚠️  Index may already exist:', err.message);
    }

    console.log('🌧️  Loading Kerala historical rainfall data...');
    const records = loadKeralaHistoricalData();
    
    if (!records.length) {
      console.error('No data found in Kerala-Rainfall-Historical.csv');
      return;
    }
    
    const districtRatios = calculateDistrictRatios();
    console.log(`📊 District ratios calculated for ${Object.keys(districtRatios).length} districts`);
    
    // Calculate each district's historical average per month (from historical records only)
    const historicalRecords = records.filter(r => !r.isForecast);
    const districtMonthlyAverages = {}; // { district: { 1: avg, 2: avg, ... } }
    
    for (const [district, ratio] of Object.entries(districtRatios)) {
      districtMonthlyAverages[district] = {};
      for (let month = 1; month <= 12; month++) {
        const keralaMonthlyAvg = computeMonthlyHistoricalAverage(historicalRecords, month);
        const districtMonthlyAvg = keralaMonthlyAvg * ratio;
        districtMonthlyAverages[district][month] = districtMonthlyAvg;
      }
      console.log(`   ${district}: Monthly averages calculated`);
    }
    
    // Generate forecasts for future years (2023-2026) using average of last 5 years per month
    const lastHistoricalYear = Math.max(...historicalRecords.map(r => r.year));
    const recentYears = historicalRecords.filter(r => r.year > lastHistoricalYear - 5);
    
    const futureYears = [2023, 2024, 2025, 2026];
    const forecastRecords = [];
    
    futureYears.forEach(year => {
      if (year > lastHistoricalYear) {
        const forecastMonthlyData = {};
        for (let month = 1; month <= 12; month++) {
          const recentAvg = computeMonthlyHistoricalAverage(recentYears, month);
          forecastMonthlyData[month] = recentAvg;
        }
        forecastRecords.push({ year, monthlyData: forecastMonthlyData, isForecast: true });
      }
    });
    
    const allRecords = [...records, ...forecastRecords];
    const bulkOps = [];
    
    // Process each year and month
    for (const record of allRecords) {
      const isForecast = record.isForecast || false;
      
      // Process each month (1-12)
      for (let month = 1; month <= 12; month++) {
        const keralaMonthlyRainfall = record.monthlyData[month];
        if (keralaMonthlyRainfall === undefined || Number.isNaN(keralaMonthlyRainfall)) continue;
        
        // Determine season based on month
        let season = 'Summer';
        if ([6, 7, 8, 9].includes(month)) season = 'Monsoon';
        else if ([10, 11].includes(month)) season = 'Post-monsoon';
        else if ([12, 1, 2].includes(month)) season = 'Winter';
        
        // Split Kerala monthly rainfall across districts using ratios
        for (const [district, ratio] of Object.entries(districtRatios)) {
          const districtMonthlyRainfall = keralaMonthlyRainfall * ratio;
          const roundedRainfall = Number(districtMonthlyRainfall.toFixed(2));
          
          // Use district's own monthly historical average for risk classification
          const districtMonthlyAvg = districtMonthlyAverages[district][month];
          const riskLevel = classifyRisk(districtMonthlyRainfall, districtMonthlyAvg);
          
          const doc = {
            year: record.year,
            district,
            month,
            monthName: MONTH_NAMES[month - 1],
            season,
            predictedRainfall: roundedRainfall,
            riskLevel,
            model: 'SARIMA',
            isForecast,
            createdAt: new Date()
          };
          
          bulkOps.push({
            updateOne: {
              filter: { year: record.year, district, month },
              update: { $set: doc },
              upsert: true
            }
          });
        }
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

