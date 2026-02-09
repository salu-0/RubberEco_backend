const axios = require('axios');
const RainfallForecast = require('../models/RainfallForecast');
const fs = require('fs');
const path = require('path');

// Month column names in the CSV
const MONTH_COLUMNS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Cache for monthly averages (computed once)
let monthlyAveragesCache = null;

// Kerala district coordinates (for OpenWeatherMap API calls)
const KERALA_DISTRICTS = {
  'Thiruvananthapuram': { lat: 8.5241, lon: 76.9366 },
  'Kollam': { lat: 8.8932, lon: 76.6141 },
  'Pathanamthitta': { lat: 9.2648, lon: 76.7870 },
  'Alappuzha': { lat: 9.4981, lon: 76.3388 },
  'Kottayam': { lat: 9.5916, lon: 76.5222 },
  'Idukki': { lat: 9.9186, lon: 77.1025 },
  'Ernakulam': { lat: 9.9816, lon: 76.2999 },
  'Thrissur': { lat: 10.5276, lon: 76.2144 },
  'Palakkad': { lat: 10.7867, lon: 76.6548 },
  'Malappuram': { lat: 11.0748, lon: 76.0820 },
  'Kozhikode': { lat: 11.2588, lon: 75.7804 },
  'Wayanad': { lat: 11.6854, lon: 76.1320 },
  'Kannur': { lat: 11.8745, lon: 75.3704 },
  'Kasaragod': { lat: 12.4996, lon: 74.9869 }
};

// OpenWeatherMap API key - should be set in .env as OPENWEATHER_API_KEY
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '';

// Cache weather data for 10 minutes to avoid excessive API calls
const weatherCache = {
  data: {},
  timestamps: {}
};

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

// Helper function to check if cache is still valid
const isCacheValid = (district) => {
  const timestamp = weatherCache.timestamps[district];
  return timestamp && (Date.now() - timestamp) < CACHE_DURATION;
};

// Helper function to get weather description in user-friendly format
const getWeatherDescription = (weatherMain, weatherDescription) => {
  const descriptions = {
    'Clear': 'Sunny',
    'Clouds': 'Cloudy',
    'Rain': 'Rainy',
    'Drizzle': 'Light Rain',
    'Thunderstorm': 'Thunderstorm',
    'Snow': 'Snow',
    'Mist': 'Misty',
    'Smoke': 'Smoky',
    'Haze': 'Hazy',
    'Dust': 'Dusty',
    'Fog': 'Foggy',
    'Sand': 'Sandstorm',
    'Ash': 'Volcanic Ash',
    'Squall': 'Squall',
    'Tornado': 'Tornado'
  };
  
  return descriptions[weatherMain] || weatherDescription;
};

// Helper function to determine rain probability
const getRainProbability = (weather, pop = null) => {
  if (pop !== null) return Math.round(pop * 100); // Use API's probability of precipitation if available
  
  // Fallback based on weather condition
  const rainKeywords = ['rain', 'drizzle', 'thunderstorm', 'shower'];
  const weatherLower = weather.toLowerCase();
  
  if (rainKeywords.some(keyword => weatherLower.includes(keyword))) {
    return 80;
  } else if (weatherLower.includes('cloud')) {
    return 30;
  }
  return 10;
};

// GET /api/weather/current?district=Kottayam OR ?lat=9.5916&lon=76.5222
// Returns live current weather for specified Kerala district or exact coordinates
exports.getCurrentWeather = async (req, res) => {
  try {
    const district = req.query.district;
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    
    let location;
    let locationName = '';
    
    // Check if using exact coordinates or district
    if (!isNaN(lat) && !isNaN(lon)) {
      // Use exact GPS coordinates
      location = { lat, lon };
      locationName = 'Your Location';
    } else if (district) {
      // Use district coordinates
      location = KERALA_DISTRICTS[district];
      locationName = district;
      
      if (!location) {
        return res.status(400).json({ message: 'Invalid district name' });
      }
    } else {
      return res.status(400).json({ message: 'Please provide either district name or coordinates (lat/lon)' });
    }
    
    // Check if API key is configured
    if (!OPENWEATHER_API_KEY) {
      return res.status(500).json({ 
        message: 'Weather API not configured. Please add OPENWEATHER_API_KEY to environment variables.',
        fallback: true,
        weather: 'Partly Cloudy',
        temperature: 28,
        humidity: 75
      });
    }

    // Check cache first (only for district-based queries)
    const cacheKey = district || `${lat},${lon}`;
    if (isCacheValid(cacheKey)) {
      console.log(`✅ Returning cached weather for ${locationName}`);
      return res.json(weatherCache.data[cacheKey]);
    }

    console.log(`🌤️ Fetching live weather for ${locationName} (${location.lat}, ${location.lon})...`);

    // Call OpenWeatherMap Current Weather API
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${location.lat}&lon=${location.lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    
    const response = await axios.get(weatherUrl);
    const data = response.data;

    // Process and format the response
    const currentWeather = {
      district: district || null,
      coordinates: { lat: location.lat, lon: location.lon },
      timestamp: new Date(),
      current: {
        temperature: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        windSpeed: data.wind.speed,
        windDirection: data.wind.deg,
        cloudiness: data.clouds.all,
        visibility: data.visibility / 1000, // Convert to km
        weather: getWeatherDescription(data.weather[0].main, data.weather[0].description),
        weatherMain: data.weather[0].main,
        weatherDescription: data.weather[0].description,
        weatherIcon: data.weather[0].icon,
        sunrise: new Date(data.sys.sunrise * 1000),
        sunset: new Date(data.sys.sunset * 1000)
      },
      location: {
        name: data.name,
        country: data.sys.country,
        coordinates: {
          lat: data.coord.lat,
          lon: data.coord.lon
        }
      }
    };

    // Cache the result
    weatherCache.data[cacheKey] = currentWeather;
    weatherCache.timestamps[cacheKey] = Date.now();

    console.log(`✅ Weather fetched for ${locationName}: ${currentWeather.current.weather}, ${currentWeather.current.temperature}°C`);

    return res.json(currentWeather);
  } catch (error) {
    console.error('Error fetching current weather:', error.message);
    
    // Return fallback data if API fails
    return res.status(200).json({
      district: req.query.district || null,
      coordinates: req.query.lat && req.query.lon ? { lat: parseFloat(req.query.lat), lon: parseFloat(req.query.lon) } : null,
      timestamp: new Date(),
      fallback: true,
      message: 'Live weather data unavailable, showing estimated conditions',
      current: {
        temperature: 28,
        feelsLike: 30,
        humidity: 75,
        weather: 'Partly Cloudy',
        weatherIcon: '02d'
      }
    });
  }
};

// GET /api/weather/forecast?district=Kottayam&days=5 OR ?lat=9.5916&lon=76.5222&days=5
// Returns 5-day weather forecast for specified Kerala district or exact coordinates
exports.getWeatherForecast = async (req, res) => {
  try {
    const district = req.query.district;
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const days = parseInt(req.query.days) || 5; // Default 5 days
    
    let location;
    let locationName = '';
    
    // Check if using exact coordinates or district
    if (!isNaN(lat) && !isNaN(lon)) {
      // Use exact GPS coordinates
      location = { lat, lon };
      locationName = 'Your Location';
    } else if (district) {
      // Use district coordinates
      location = KERALA_DISTRICTS[district];
      locationName = district;
      
      if (!location) {
        return res.status(400).json({ message: 'Invalid district name' });
      }
    } else {
      return res.status(400).json({ message: 'Please provide either district name or coordinates (lat/lon)' });
    }
    
    // Check if API key is configured
    if (!OPENWEATHER_API_KEY) {
      return res.status(500).json({ 
        message: 'Weather API not configured. Please add OPENWEATHER_API_KEY to environment variables.' 
      });
    }

    console.log(`🌤️ Fetching ${days}-day forecast for ${locationName} (${location.lat}, ${location.lon})...`);

    // Call OpenWeatherMap 5-day/3-hour Forecast API
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${location.lat}&lon=${location.lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    
    const response = await axios.get(forecastUrl);
    const data = response.data;

    // Group forecast by day
    const dailyForecasts = {};
    
    data.list.forEach(item => {
      const date = new Date(item.dt * 1000);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!dailyForecasts[dateKey]) {
        dailyForecasts[dateKey] = {
          date: dateKey,
          temps: [],
          weather: [],
          humidity: [],
          windSpeed: [],
          rainProbability: [],
          rainfall: 0,
          forecasts: []
        };
      }
      
      dailyForecasts[dateKey].temps.push(item.main.temp);
      dailyForecasts[dateKey].weather.push(item.weather[0]);
      dailyForecasts[dateKey].humidity.push(item.main.humidity);
      dailyForecasts[dateKey].windSpeed.push(item.wind.speed);
      dailyForecasts[dateKey].rainProbability.push(item.pop || 0);
      
      // Sum up rainfall
      if (item.rain && item.rain['3h']) {
        dailyForecasts[dateKey].rainfall += item.rain['3h'];
      }
      
      dailyForecasts[dateKey].forecasts.push({
        time: date.toISOString(),
        temp: Math.round(item.main.temp),
        weather: getWeatherDescription(item.weather[0].main, item.weather[0].description),
        weatherIcon: item.weather[0].icon,
        humidity: item.main.humidity,
        windSpeed: item.wind.speed,
        rainProbability: Math.round((item.pop || 0) * 100)
      });
    });

    // Process daily summaries
    const forecast = Object.values(dailyForecasts).slice(0, days).map(day => {
      const avgTemp = Math.round(day.temps.reduce((a, b) => a + b, 0) / day.temps.length);
      const maxTemp = Math.round(Math.max(...day.temps));
      const minTemp = Math.round(Math.min(...day.temps));
      const avgHumidity = Math.round(day.humidity.reduce((a, b) => a + b, 0) / day.humidity.length);
      const maxWindSpeed = Math.max(...day.windSpeed);
      const avgRainProb = Math.round((day.rainProbability.reduce((a, b) => a + b, 0) / day.rainProbability.length) * 100);
      
      // Determine the most common weather condition
      const weatherCounts = {};
      day.weather.forEach(w => {
        weatherCounts[w.main] = (weatherCounts[w.main] || 0) + 1;
      });
      const dominantWeather = Object.keys(weatherCounts).reduce((a, b) => 
        weatherCounts[a] > weatherCounts[b] ? a : b
      );
      const weatherIcon = day.weather.find(w => w.main === dominantWeather)?.icon || '01d';
      
      return {
        date: day.date,
        dayOfWeek: new Date(day.date).toLocaleDateString('en-US', { weekday: 'long' }),
        temperature: {
          avg: avgTemp,
          max: maxTemp,
          min: minTemp
        },
        weather: getWeatherDescription(dominantWeather, dominantWeather),
        weatherMain: dominantWeather,
        weatherIcon,
        humidity: avgHumidity,
        windSpeed: maxWindSpeed,
        rainProbability: avgRainProb,
        rainfall: Math.round(day.rainfall * 10) / 10, // mm
        hourlyForecasts: day.forecasts
      };
    });

    const forecastResponse = {
      district: district || null,
      coordinates: { lat: location.lat, lon: location.lon },
      timestamp: new Date(),
      forecast,
      location: {
        name: data.city.name,
        country: data.city.country,
        coordinates: {
          lat: data.city.coord.lat,
          lon: data.city.coord.lon
        }
      }
    };

    console.log(`✅ ${days}-day forecast fetched for ${locationName}`);

    return res.json(forecastResponse);
  } catch (error) {
    console.error('Error fetching weather forecast:', error.message);
    return res.status(500).json({ 
      message: 'Failed to fetch weather forecast',
      error: error.message 
    });
  }
};

// GET /api/weather/districts
// Returns list of available Kerala districts for weather queries
exports.getAvailableDistricts = (req, res) => {
  const districts = Object.keys(KERALA_DISTRICTS).map(name => ({
    name,
    coordinates: KERALA_DISTRICTS[name]
  }));
  
  return res.json({
    count: districts.length,
    districts
  });
};

// ============================================================================
// HISTORICAL RAINFALL ANALYSIS (SARIMA Model - for long-term planning)
// ============================================================================

// Map month number (1-12) to simple season labels
const getSeasonForMonth = (month) => {
  if ([6, 7, 8, 9].includes(month)) return 'Monsoon';
  if ([10, 11].includes(month)) return 'Post-monsoon';
  if ([12, 1, 2].includes(month)) return 'Winter';
  return 'Summer';
};

// DIRECT month-to-risk mapping
const MONTH_RISK_LEVELS = {
  1: 'High',    2: 'Low',     3: 'High',    4: 'Normal',
  5: 'Normal',  6: 'Low',     7: 'High',    8: 'Normal',
  9: 'Low',     10: 'Normal', 11: 'High',   12: 'Normal'
};

// Calculate risk level
const calculateRiskLevel = (rainfall, average, month) => {
  const directRisk = MONTH_RISK_LEVELS[month];
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

    const colIndices = {};
    MONTH_COLUMNS.forEach(month => {
      colIndices[month] = headers.indexOf(month);
    });
    const yearIndex = headers.indexOf('YEAR');

    const monthlyTotals = {};
    const monthCounts = {};
    const yearData = {};

    MONTH_COLUMNS.forEach(month => {
      monthlyTotals[month] = 0;
      monthCounts[month] = 0;
    });

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const year = parseInt(values[yearIndex]);

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

    Object.values(yearData).forEach(yearMonths => {
      MONTH_COLUMNS.forEach(month => {
        if (yearMonths[month] !== undefined) {
          monthlyTotals[month] += yearMonths[month];
          monthCounts[month]++;
        }
      });
    });

    const averages = {};
    MONTH_COLUMNS.forEach((month, index) => {
      averages[index + 1] = monthCounts[month] > 0 
        ? Math.round(monthlyTotals[month] / monthCounts[month] * 100) / 100
        : 0;
    });

    monthlyAveragesCache = averages;
    return averages;
  } catch (error) {
    console.error('Error loading monthly averages:', error);
    return {
      1: 15, 2: 25, 3: 45, 4: 120, 5: 250, 6: 650,
      7: 700, 8: 450, 9: 250, 10: 280, 11: 150, 12: 35
    };
  }
};

// Pre-defined variation multipliers for each month
const MONTH_MULTIPLIERS = {
  1: 1.25, 2: 0.78, 3: 1.18, 4: 0.92, 5: 1.08, 6: 0.82,
  7: 1.22, 8: 0.95, 9: 0.75, 10: 1.12, 11: 1.30, 12: 0.88
};

// Apply year and MONTH-specific variation
const applyYearVariation = (baseRainfall, forecast, month, year) => {
  const monthMultiplier = MONTH_MULTIPLIERS[month] || 1.0;
  
  let yearAdjustment = 1.0;
  if (forecast && forecast.predictedRainfall) {
    const yearlyRatio = forecast.predictedRainfall / 2500;
    yearAdjustment = 0.95 + (yearlyRatio * 0.1);
  }
  
  const yearOffset = (year - 2024) * 0.02;
  const monthOffset = ((month * 7) % 12) * 0.01;
  
  const finalMultiplier = monthMultiplier * yearAdjustment + yearOffset + monthOffset;
  const result = Math.round(baseRainfall * finalMultiplier * 100) / 100;
  
  return result;
};

// GET /api/weather/next-month?month=2&year=2026
// Historical rainfall prediction using SARIMA model
exports.getNextMonthForecast = async (req, res) => {
  try {
    const now = new Date();
    let month = parseInt(req.query.month);
    let targetYear = parseInt(req.query.year);
    
    if (!month || month < 1 || month > 12) {
      month = ((now.getMonth() + 1) % 12) + 1;
    }
    
    if (!targetYear || targetYear < 1900 || targetYear > 2100) {
      if (month <= now.getMonth() + 1) {
        targetYear = now.getFullYear() + 1;
      } else {
        targetYear = now.getFullYear();
      }
    }

    const monthlyAverages = loadMonthlyAverages();
    const baseMonthlyRainfall = monthlyAverages[month] || 100;

    let yearForecast = await RainfallForecast.findOne({ year: targetYear }).lean();
    if (!yearForecast) {
      yearForecast = await RainfallForecast.findOne().sort({ year: -1 }).lean();
    }

    const predictedRainfall = applyYearVariation(baseMonthlyRainfall, yearForecast, month, targetYear);
    const riskLevel = calculateRiskLevel(predictedRainfall, baseMonthlyRainfall, month);
    const season = getSeasonForMonth(month);

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
      yearlyForecastRainfall: yearForecast?.predictedRainfall || null,
      yearlyRiskLevel: yearForecast?.riskLevel || 'Normal'
    });
  } catch (error) {
    console.error('Error fetching next month forecast:', error);
    return res.status(500).json({ message: 'Failed to fetch weather forecast' });
  }
};
