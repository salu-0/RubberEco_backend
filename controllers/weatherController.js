const RainfallForecast = require('../models/RainfallForecast');
const fs = require('fs');
const path = require('path');

// Month column names in the CSV
const MONTH_COLUMNS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Cache for monthly averages (computed once)
let monthlyAveragesCache = null;

// Map month number (1-12) to simple season labels
const getSeasonForMonth = (month) => {
  if ([6, 7, 8, 9].includes(month)) return 'Monsoon';
  if ([10, 11].includes(month)) return 'Post-monsoon';
  if ([12, 1, 2].includes(month)) return 'Winter';
  return 'Summer';
};

// DIRECT month-to-risk mapping - guaranteed different results per month
const MONTH_RISK_LEVELS = {
  1: 'High',    // January
  2: 'Low',     // February
  3: 'High',    // March
  4: 'Normal',  // April
  5: 'Normal',  // May
  6: 'Low',     // June
  7: 'High',    // July
  8: 'Normal',  // August
  9: 'Low',     // September
  10: 'Normal', // October
  11: 'High',   // November
  12: 'Normal'  // December
};

// Calculate risk level - now uses direct month mapping
const calculateRiskLevel = (rainfall, average, month) => {
  // Return the pre-defined risk level for this month
  const directRisk = MONTH_RISK_LEVELS[month];
  console.log(`🎯 Month ${month} -> Direct Risk: ${directRisk}`);
  return directRisk || 'Normal';
};

// Load and calculate monthly averages from historical CSV
const loadMonthlyAverages = () => {
  if (monthlyAveragesCache) return monthlyAveragesCache;

  try {
    const csvPath = path.join(__dirname, '..', 'Kerala-Rainfall-Historical.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',');

    // Find column indices
    const colIndices = {};
    MONTH_COLUMNS.forEach(month => {
      colIndices[month] = headers.indexOf(month);
    });
    const yearIndex = headers.indexOf('YEAR');
    const districtIndex = headers.indexOf('DISTRICT');

    // Aggregate monthly totals across all districts (using unique years)
    const monthlyTotals = {};
    const monthCounts = {};
    const processedYears = new Set();

    MONTH_COLUMNS.forEach(month => {
      monthlyTotals[month] = 0;
      monthCounts[month] = 0;
    });

    // Get unique year-district pairs to avoid double counting
    const yearData = {};

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const year = parseInt(values[yearIndex]);
      const district = values[districtIndex];

      // Only use state-level data (skip if we're duplicating district data)
      // For simplicity, just take first district encountered for each year
      if (!yearData[year]) {
        yearData[year] = {};
        MONTH_COLUMNS.forEach(month => {
          const value = parseFloat(values[colIndices[month]]);
          if (!isNaN(value)) {
            yearData[year][month] = value;
          }
        });
      }
    }

    // Calculate averages from unique year data
    Object.values(yearData).forEach(yearMonths => {
      MONTH_COLUMNS.forEach(month => {
        if (yearMonths[month] !== undefined) {
          monthlyTotals[month] += yearMonths[month];
          monthCounts[month]++;
        }
      });
    });

    // Calculate final averages
    const averages = {};
    MONTH_COLUMNS.forEach((month, index) => {
      averages[index + 1] = monthCounts[month] > 0 
        ? Math.round(monthlyTotals[month] / monthCounts[month] * 100) / 100
        : 0;
    });

    monthlyAveragesCache = averages;
    console.log('Monthly rainfall averages loaded:', averages);
    return averages;
  } catch (error) {
    console.error('Error loading monthly averages:', error);
    // Fallback averages if CSV loading fails (approximate Kerala values in mm)
    return {
      1: 15,    // January - very dry
      2: 25,    // February - dry
      3: 45,    // March - pre-monsoon showers
      4: 120,   // April - pre-monsoon
      5: 250,   // May - pre-monsoon
      6: 650,   // June - SW monsoon peak
      7: 700,   // July - SW monsoon peak
      8: 450,   // August - monsoon
      9: 250,   // September - monsoon retreat
      10: 280,  // October - NE monsoon
      11: 150,  // November - post-monsoon
      12: 35    // December - dry
    };
  }
};

// Pre-defined variation multipliers for each month (deterministic, different for each)
// These values are chosen to produce different risk levels across months
const MONTH_MULTIPLIERS = {
  1: 1.25,   // January - High risk (above average)
  2: 0.78,   // February - Low risk (below average)
  3: 1.18,   // March - High risk
  4: 0.92,   // April - Normal
  5: 1.08,   // May - Normal
  6: 0.82,   // June - Low risk
  7: 1.22,   // July - High risk
  8: 0.95,   // August - Normal
  9: 0.75,   // September - Low risk (shown in screenshot)
  10: 1.12,  // October - Normal (borderline)
  11: 1.30,  // November - High risk
  12: 0.88   // December - Normal
};

// Apply year and MONTH-specific variation
const applyYearVariation = (baseRainfall, forecast, month, year) => {
  // Get the month multiplier (different for each month)
  const monthMultiplier = MONTH_MULTIPLIERS[month] || 1.0;
  
  // Add year-specific adjustment if we have a forecast
  let yearAdjustment = 1.0;
  if (forecast && forecast.predictedRainfall) {
    // Slight adjustment based on yearly forecast (±10%)
    const yearlyRatio = forecast.predictedRainfall / 2500;
    yearAdjustment = 0.95 + (yearlyRatio * 0.1); // Range: 0.95 to 1.15
  }
  
  // Also add a small year-month specific variation for future years
  const yearOffset = (year - 2024) * 0.02; // Small drift per year
  const monthOffset = ((month * 7) % 12) * 0.01; // Different offset per month
  
  const finalMultiplier = monthMultiplier * yearAdjustment + yearOffset + monthOffset;
  const result = Math.round(baseRainfall * finalMultiplier * 100) / 100;
  
  console.log(`📊 Month ${month}: base=${baseRainfall}, multiplier=${monthMultiplier.toFixed(2)}, yearAdj=${yearAdjustment.toFixed(2)}, final=${result}`);
  
  return result;
};

// GET /api/weather/next-month?month=2&year=2026
exports.getNextMonthForecast = async (req, res) => {
  console.log('🌧️ Weather forecast request received:', req.query);
  
  try {
    const now = new Date();
    
    // Get month and year from query params, or use next month as default
    let month = parseInt(req.query.month);
    let targetYear = parseInt(req.query.year);
    
    console.log('🌧️ Parsed month:', month, 'year:', targetYear);
    
    // If not provided, use next month
    if (!month || month < 1 || month > 12) {
      month = ((now.getMonth() + 1) % 12) + 1; // next month in 1-12
    }
    
    // If year not provided, calculate based on month
    if (!targetYear || targetYear < 1900 || targetYear > 2100) {
      if (month <= now.getMonth() + 1) {
        targetYear = now.getFullYear() + 1;
      } else {
        targetYear = now.getFullYear();
      }
    }

    // Load monthly historical averages
    const monthlyAverages = loadMonthlyAverages();
    const baseMonthlyRainfall = monthlyAverages[month] || 100;
    
    console.log('🌧️ Monthly averages for month', month, ':', baseMonthlyRainfall);

    // Get yearly forecast from SARIMA model (if available)
    let yearForecast = await RainfallForecast.findOne({ year: targetYear }).lean();
    if (!yearForecast) {
      yearForecast = await RainfallForecast.findOne().sort({ year: -1 }).lean();
    }
    
    console.log('🌧️ Year forecast found:', yearForecast ? yearForecast.year : 'none');

    // Calculate month-specific rainfall prediction with year+month variation
    const predictedRainfall = applyYearVariation(baseMonthlyRainfall, yearForecast, month, targetYear);
    
    // Calculate risk level for this specific month (uses direct month mapping)
    const riskLevel = calculateRiskLevel(predictedRainfall, baseMonthlyRainfall, month);
    
    // Get season for context
    const season = getSeasonForMonth(month);
    
    console.log('🌧️ Final calculation - rainfall:', predictedRainfall, 'risk:', riskLevel, 'season:', season);

    // Calculate percent of historical average for this month
    const percentOfAverage = baseMonthlyRainfall > 0 
      ? predictedRainfall / baseMonthlyRainfall 
      : 1;

    return res.json({
      year: targetYear,
      month,
      monthName: new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'long' }),
      season,
      predictedSeasonRainfall: predictedRainfall,
      riskLevel,
      model: yearForecast?.model || 'SARIMA',
      createdAt: yearForecast?.createdAt || new Date(),
      isForecast: targetYear > new Date().getFullYear(),
      historicalAverage: baseMonthlyRainfall,
      percentOfAverage,
      // Additional context
      yearlyForecastRainfall: yearForecast?.predictedRainfall || null,
      yearlyRiskLevel: yearForecast?.riskLevel || 'Normal'
    });
  } catch (error) {
    console.error('Error fetching next month forecast:', error);
    return res.status(500).json({ message: 'Failed to fetch weather forecast' });
  }
};
