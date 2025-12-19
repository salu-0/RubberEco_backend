const RainfallForecast = require('../models/RainfallForecast');

// Map month number (1-12) to simple season labels
const getSeasonForMonth = (month) => {
  if ([6, 7, 8, 9].includes(month)) return 'Monsoon';
  if ([10, 11].includes(month)) return 'Post-monsoon';
  if ([12, 1, 2].includes(month)) return 'Winter';
  return 'Summer';
};

// GET /api/weather/next-month
exports.getNextMonthForecast = async (req, res) => {
  try {
    const now = new Date();
    const targetYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    const month = ((now.getMonth() + 1) % 12) + 1; // next month in 1-12

    // Get district-wise forecasts for target year
    let districtForecasts = await RainfallForecast.find({ 
      year: targetYear,
      season: 'Monsoon'
    }).lean();

    // If no forecasts for target year, get latest available year
    if (!districtForecasts || districtForecasts.length === 0) {
      const latestYearDoc = await RainfallForecast.findOne()
        .sort({ year: -1 })
        .lean();
      
      if (latestYearDoc) {
        districtForecasts = await RainfallForecast.find({
          year: latestYearDoc.year,
          season: 'Monsoon'
        }).lean();
      }
    }

    if (!districtForecasts || districtForecasts.length === 0) {
      return res.status(404).json({
        message: 'No rainfall forecast data found in the database. Please run: npm run import-kerala-rainfall'
      });
    }

    const season = getSeasonForMonth(month);
    const forecastYear = districtForecasts[0].year;

    // Calculate Kerala state average (sum of all districts)
    const keralaTotalRainfall = districtForecasts.reduce(
      (sum, doc) => sum + (doc.predictedRainfall || 0), 
      0
    );

    // Compute historical average (Kerala state level)
    const historicalDocs = await RainfallForecast.find({ 
      isForecast: { $ne: true },
      season: 'Monsoon'
    }).lean();

    // Group by year and sum districts to get Kerala total per year
    const keralaYearlyTotals = {};
    historicalDocs.forEach(doc => {
      if (!keralaYearlyTotals[doc.year]) {
        keralaYearlyTotals[doc.year] = 0;
      }
      keralaYearlyTotals[doc.year] += doc.predictedRainfall || 0;
    });

    const historicalYears = Object.keys(keralaYearlyTotals).map(Number);
    const historicalTotals = Object.values(keralaYearlyTotals);
    const historicalAverage = historicalTotals.length 
      ? historicalTotals.reduce((a, b) => a + b, 0) / historicalTotals.length 
      : null;

    const percentOfAverage = historicalAverage
      ? keralaTotalRainfall / historicalAverage
      : null;

    // Build time series for chart (Kerala state totals per year)
    const allYears = [...new Set(historicalDocs.map(d => d.year))].sort();
    const series = [];
    
    for (const year of allYears) {
      const yearDocs = await RainfallForecast.find({ year, season: 'Monsoon' }).lean();
      const yearTotal = yearDocs.reduce((sum, doc) => sum + (doc.predictedRainfall || 0), 0);
      const avgRisk = yearDocs.length > 0 
        ? yearDocs[0].riskLevel // Use first district's risk as proxy
        : 'Normal';
      const isForecast = yearDocs.length > 0 ? !!yearDocs[0].isForecast : false;
      
      series.push({
        year,
        rainfall: yearTotal,
        riskLevel: avgRisk,
        isForecast
      });
    }

    // Add forecast years if not in series
    const forecastYearDocs = await RainfallForecast.find({ 
      year: forecastYear, 
      season: 'Monsoon' 
    }).lean();
    if (forecastYearDocs.length > 0 && !series.find(s => s.year === forecastYear)) {
      const forecastTotal = forecastYearDocs.reduce(
        (sum, doc) => sum + (doc.predictedRainfall || 0), 
        0
      );
      series.push({
        year: forecastYear,
        rainfall: forecastTotal,
        riskLevel: forecastYearDocs[0].riskLevel,
        isForecast: true
      });
    }

    series.sort((a, b) => a.year - b.year);

    return res.json({
      year: forecastYear,
      month,
      monthName: new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'long' }),
      season,
      predictedSeasonRainfall: keralaTotalRainfall,
      riskLevel: districtForecasts[0].riskLevel, // Use first district as proxy
      model: districtForecasts[0].model || 'SARIMA',
      createdAt: districtForecasts[0].createdAt,
      isForecast: !!districtForecasts[0].isForecast,
      historicalAverage,
      percentOfAverage,
      series,
      districts: districtForecasts.map(doc => ({
        district: doc.district,
        predictedRainfall: doc.predictedRainfall,
        riskLevel: doc.riskLevel
      }))
    });
  } catch (error) {
    console.error('Error fetching next month forecast:', error);
    return res.status(500).json({ message: 'Failed to fetch weather forecast' });
  }
};

// GET /api/weather/forecast?month=6&district=Kottayam&year=2026
exports.getDistrictForecast = async (req, res) => {
  try {
    const { month, district, year } = req.query;
    
    // Validate inputs
    const monthNum = parseInt(month, 10);
    const targetYear = year ? parseInt(year, 10) : null;
    
    if (!monthNum || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ message: 'Invalid month. Must be 1-12' });
    }
    
    if (!district) {
      return res.status(400).json({ message: 'District is required' });
    }

    const season = getSeasonForMonth(monthNum);
    const monthName = new Date(2000, monthNum - 1, 1).toLocaleString('en-US', { month: 'long' });

    // Determine target year
    let forecastYear = targetYear;
    if (!forecastYear) {
      const now = new Date();
      forecastYear = now.getMonth() === 11 && monthNum === 1 
        ? now.getFullYear() + 1 
        : now.getFullYear();
    }

    // Get forecast for specific district, year, and month
    let forecast = await RainfallForecast.findOne({
      year: forecastYear,
      district: district,
      month: monthNum
    }).lean();

    // If no forecast for target year/month, get latest available year for this district and month
    if (!forecast) {
      const latestYearDoc = await RainfallForecast.findOne({
        district: district,
        month: monthNum
      })
        .sort({ year: -1 })
        .lean();
      
      if (latestYearDoc) {
        forecast = latestYearDoc;
        forecastYear = latestYearDoc.year;
      }
    }

    if (!forecast) {
      return res.status(404).json({
        message: `No rainfall forecast found for ${district} in ${monthName}. Please run: npm run import-kerala-rainfall`
      });
    }

    // Calculate historical average for this specific district and month
    const historicalDocs = await RainfallForecast.find({
      district: district,
      month: monthNum,
      isForecast: { $ne: true }
    }).lean();

    const historicalAverage = historicalDocs.length
      ? historicalDocs.reduce((sum, doc) => sum + (doc.predictedRainfall || 0), 0) / historicalDocs.length
      : null;

    const percentOfAverage = historicalAverage
      ? forecast.predictedRainfall / historicalAverage
      : null;

    // Recalculate risk level based on this district's own average (more accurate)
    let calculatedRiskLevel = forecast.riskLevel;
    if (historicalAverage) {
      if (forecast.predictedRainfall > historicalAverage * 1.1) {
        calculatedRiskLevel = 'High';
      } else if (forecast.predictedRainfall < historicalAverage * 0.9) {
        calculatedRiskLevel = 'Low';
      } else {
        calculatedRiskLevel = 'Normal';
      }
    }

    // Build time series for this district and month
    const allYears = [...new Set(historicalDocs.map(d => d.year))].sort();
    const series = [];
    
    for (const year of allYears) {
      const yearDoc = await RainfallForecast.findOne({
        year,
        district: district,
        month: monthNum
      }).lean();
      
      if (yearDoc) {
        series.push({
          year,
          rainfall: yearDoc.predictedRainfall,
          riskLevel: yearDoc.riskLevel,
          isForecast: !!yearDoc.isForecast
        });
      }
    }

    // Add forecast year if not in series
    if (forecast && !series.find(s => s.year === forecastYear)) {
      series.push({
        year: forecastYear,
        rainfall: forecast.predictedRainfall,
        riskLevel: calculatedRiskLevel,
        isForecast: true
      });
    }

    series.sort((a, b) => a.year - b.year);

    // Get all districts' forecasts for the selected month and year (for map display)
    const allDistrictsForecasts = await RainfallForecast.find({
      year: forecastYear,
      month: monthNum
    }).lean();

    // If no forecasts for target year, use latest available year
    let districtsForMap = allDistrictsForecasts;
    if (!districtsForMap || districtsForMap.length === 0) {
      const latestYear = await RainfallForecast.findOne({ month: monthNum })
        .sort({ year: -1 })
        .lean();
      
      if (latestYear) {
        districtsForMap = await RainfallForecast.find({
          year: latestYear.year,
          month: monthNum
        }).lean();
      }
    }

    // For map colours, we want relative wet/dry across districts for THIS month,
    // even though the underlying model only has state‑level anomalies.
    // So we derive a "relativeRiskLevel" by ranking districts by rainfall.
    let mapRiskByDistrict = {};
    if (districtsForMap && districtsForMap.length > 0) {
      const sorted = [...districtsForMap].sort(
        (a, b) => (b.predictedRainfall || 0) - (a.predictedRainfall || 0)
      );

      const n = sorted.length;
      const highCount = Math.max(3, Math.round(n * 0.3)); // top ~30% as High
      const lowCount = Math.max(3, Math.round(n * 0.3));  // bottom ~30% as Low

      sorted.forEach((doc, idx) => {
        let level = 'Normal';
        if (idx < highCount) {
          level = 'High';
        } else if (idx >= n - lowCount) {
          level = 'Low';
        }
        mapRiskByDistrict[doc.district] = level;
      });
    }

    return res.json({
      year: forecastYear,
      month: monthNum,
      monthName: forecast.monthName || monthName,
      season: forecast.season || season,
      district: forecast.district,
      predictedRainfall: forecast.predictedRainfall,
      riskLevel: calculatedRiskLevel, // Use recalculated risk based on district's own monthly average
      model: forecast.model || 'SARIMA',
      createdAt: forecast.createdAt,
      isForecast: !!forecast.isForecast,
      historicalAverage,
      percentOfAverage,
      series,
      allDistricts: districtsForMap.map(doc => ({
        district: doc.district,
        predictedRainfall: doc.predictedRainfall,
        // Use relative risk for the map so different districts can have
        // different colours even when the state‑level anomaly is the same.
        riskLevel: mapRiskByDistrict[doc.district] || doc.riskLevel,
        monthName: doc.monthName
      }))
    });
  } catch (error) {
    console.error('Error fetching district forecast:', error);
    return res.status(500).json({ message: 'Failed to fetch weather forecast' });
  }
};


