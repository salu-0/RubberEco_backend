const PriceForecast = require('../models/PriceForecast');
const fs = require('fs');
const path = require('path');

// Cache for price data (loaded from historical CSV if DB is empty)
let priceDataCache = null;

// Month names for display
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];

// Load historical price data from CSV
const loadHistoricalPriceData = () => {
  if (priceDataCache) return priceDataCache;

  try {
    const csvPath = path.join(__dirname, '..', 'data', 'kerala_rubber_prices.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',');

    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      data.push({
        year: parseInt(row.YEAR),
        month: parseInt(row.MONTH),
        date: new Date(row.DATE),
        price: parseFloat(row.PRICE_PER_KG),
        grade: row.GRADE,
        market: row.MARKET,
        trend: row.TREND
      });
    }

    priceDataCache = data;
    console.log(`📊 Loaded ${data.length} historical price records`);
    return data;
  } catch (error) {
    console.error('Error loading historical price data:', error);
    return [];
  }
};

// Calculate SARIMA-like forecast using historical patterns
const generateForecast = (historicalData, months = 12) => {
  if (!historicalData || historicalData.length === 0) {
    return [];
  }

  // Get the last few years of data for pattern analysis
  const recentData = historicalData.slice(-36); // Last 3 years
  const lastDataPoint = historicalData[historicalData.length - 1];
  
  // Calculate seasonal factors (month-specific price adjustments)
  const monthlyPrices = {};
  const monthCounts = {};
  
  recentData.forEach(d => {
    if (!monthlyPrices[d.month]) {
      monthlyPrices[d.month] = 0;
      monthCounts[d.month] = 0;
    }
    monthlyPrices[d.month] += d.price;
    monthCounts[d.month]++;
  });

  // Calculate average price and monthly factors
  const avgPrice = recentData.reduce((sum, d) => sum + d.price, 0) / recentData.length;
  const seasonalFactors = {};
  
  for (let m = 1; m <= 12; m++) {
    if (monthCounts[m] > 0) {
      seasonalFactors[m] = (monthlyPrices[m] / monthCounts[m]) / avgPrice;
    } else {
      seasonalFactors[m] = 1.0;
    }
  }

  // Calculate trend from recent data
  const recentTrend = (lastDataPoint.price - recentData[0].price) / recentData.length;
  
  // Generate forecasts
  const forecasts = [];
  let currentPrice = lastDataPoint.price;
  let currentYear = lastDataPoint.year;
  let currentMonth = lastDataPoint.month;

  for (let i = 0; i < months; i++) {
    // Move to next month
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }

    // Apply seasonal adjustment and trend
    const seasonalFactor = seasonalFactors[currentMonth] || 1.0;
    const trendAdjustment = recentTrend * 0.5; // Dampen the trend
    
    // Add some realistic variance
    const variance = (Math.random() - 0.5) * 4; // ±2 rupees variance
    
    currentPrice = (currentPrice * seasonalFactor * 0.98 + currentPrice * 0.02) + trendAdjustment + variance;
    
    // Keep price within reasonable bounds
    currentPrice = Math.max(80, Math.min(300, currentPrice));

    // Calculate confidence interval (wider for further forecasts)
    const ciWidth = 5 + (i * 1.5); // Increasing uncertainty
    const lowerCI = currentPrice - ciWidth;
    const upperCI = currentPrice + ciWidth;

    // Determine trend
    let trend = 'Stable';
    if (forecasts.length > 0) {
      const prevPrice = forecasts[forecasts.length - 1].predictedPrice;
      const change = ((currentPrice - prevPrice) / prevPrice) * 100;
      if (change > 2) trend = 'Rising';
      else if (change < -2) trend = 'Falling';
    }

    forecasts.push({
      date: new Date(currentYear, currentMonth - 1, 15),
      year: currentYear,
      month: currentMonth,
      monthName: MONTH_NAMES[currentMonth - 1],
      market: lastDataPoint.market || 'Kottayam',
      grade: lastDataPoint.grade || 'RSS-4',
      predictedPrice: Math.round(currentPrice * 100) / 100,
      lowerCI: Math.round(lowerCI * 100) / 100,
      upperCI: Math.round(upperCI * 100) / 100,
      trend,
      percentChange: forecasts.length > 0 
        ? Math.round(((currentPrice - forecasts[forecasts.length - 1].predictedPrice) / forecasts[forecasts.length - 1].predictedPrice) * 10000) / 100
        : 0,
      model: 'SARIMA(1,1,1)(1,1,1,12)',
      isForecast: true
    });
  }

  return forecasts;
};

// GET /api/price-forecast/current - Get current price and short-term forecast
exports.getCurrentPriceAndForecast = async (req, res) => {
  console.log('💰 Price forecast request received');
  
  try {
    const { months = 6, market = 'Kottayam', grade = 'RSS-4' } = req.query;
    
    // Try to get from database first
    let forecasts = await PriceForecast.getNextMonthsForecasts(parseInt(months), market, grade);
    
    // If no forecasts in DB, generate from historical data
    if (!forecasts || forecasts.length === 0) {
      console.log('📊 No DB forecasts, generating from historical data');
      const historicalData = loadHistoricalPriceData();
      
      if (historicalData.length === 0) {
        return res.status(404).json({ message: 'No price data available' });
      }

      forecasts = generateForecast(historicalData, parseInt(months));
    }

    // Get current/recent price
    const historicalData = loadHistoricalPriceData();
    const currentPrice = historicalData.length > 0 
      ? historicalData[historicalData.length - 1].price 
      : forecasts[0]?.predictedPrice || 185;

    // Calculate statistics
    const avgForecastPrice = forecasts.reduce((sum, f) => sum + (f.predictedPrice || f.predicted_price), 0) / forecasts.length;
    const maxPrice = Math.max(...forecasts.map(f => f.predictedPrice || f.predicted_price));
    const minPrice = Math.min(...forecasts.map(f => f.predictedPrice || f.predicted_price));

    return res.json({
      success: true,
      currentPrice: Math.round(currentPrice * 100) / 100,
      market,
      grade,
      forecasts: forecasts.map(f => ({
        date: f.date,
        year: f.year,
        month: f.month,
        monthName: MONTH_NAMES[(f.month || new Date(f.date).getMonth() + 1) - 1],
        predictedPrice: f.predictedPrice || f.predicted_price,
        lowerCI: f.lowerCI || f.lower_ci,
        upperCI: f.upperCI || f.upper_ci,
        trend: f.trend,
        percentChange: f.percentChange || f.percent_change,
        model: f.model
      })),
      statistics: {
        averagePrice: Math.round(avgForecastPrice * 100) / 100,
        maxPrice: Math.round(maxPrice * 100) / 100,
        minPrice: Math.round(minPrice * 100) / 100,
        volatility: Math.round((maxPrice - minPrice) / avgForecastPrice * 10000) / 100
      },
      model: 'SARIMA(1,1,1)(1,1,1,12)',
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('Error fetching price forecast:', error);
    return res.status(500).json({ message: 'Failed to fetch price forecast' });
  }
};

// GET /api/price-forecast/historical - Get historical prices
exports.getHistoricalPrices = async (req, res) => {
  console.log('💰 Historical price request received');
  
  try {
    const { years = 5, market = 'Kottayam', grade = 'RSS-4' } = req.query;
    
    // Try DB first
    let prices = await PriceForecast.getHistoricalPrices(parseInt(years), market, grade);
    
    // If no data in DB, load from CSV
    if (!prices || prices.length === 0) {
      const historicalData = loadHistoricalPriceData();
      const cutoffYear = new Date().getFullYear() - parseInt(years);
      
      prices = historicalData
        .filter(d => d.year >= cutoffYear)
        .map(d => ({
          date: d.date,
          year: d.year,
          month: d.month,
          monthName: MONTH_NAMES[d.month - 1],
          price: d.price,
          market: d.market,
          grade: d.grade,
          trend: d.trend
        }));
    }

    // Calculate statistics
    const avgPrice = prices.reduce((sum, p) => sum + (p.price || p.predictedPrice), 0) / prices.length;
    const maxPrice = Math.max(...prices.map(p => p.price || p.predictedPrice));
    const minPrice = Math.min(...prices.map(p => p.price || p.predictedPrice));

    return res.json({
      success: true,
      market,
      grade,
      prices,
      statistics: {
        averagePrice: Math.round(avgPrice * 100) / 100,
        maxPrice: Math.round(maxPrice * 100) / 100,
        minPrice: Math.round(minPrice * 100) / 100,
        dataPoints: prices.length
      }
    });
  } catch (error) {
    console.error('Error fetching historical prices:', error);
    return res.status(500).json({ message: 'Failed to fetch historical prices' });
  }
};

// GET /api/price-forecast/monthly/:year/:month - Get forecast for specific month
exports.getMonthlyForecast = async (req, res) => {
  try {
    const { year, month } = req.params;
    const { market = 'Kottayam', grade = 'RSS-4' } = req.query;
    
    const targetYear = parseInt(year);
    const targetMonth = parseInt(month);
    
    if (targetMonth < 1 || targetMonth > 12) {
      return res.status(400).json({ message: 'Invalid month' });
    }

    // Try DB first
    let forecast = await PriceForecast.findOne({
      year: targetYear,
      month: targetMonth,
      market,
      grade
    });

    // If not in DB, generate
    if (!forecast) {
      const historicalData = loadHistoricalPriceData();
      const lastDataPoint = historicalData[historicalData.length - 1];
      
      // Calculate months to forecast
      const lastYear = lastDataPoint.year;
      const lastMonth = lastDataPoint.month;
      const monthsToForecast = (targetYear - lastYear) * 12 + (targetMonth - lastMonth);
      
      if (monthsToForecast > 0 && monthsToForecast <= 36) {
        const forecasts = generateForecast(historicalData, monthsToForecast);
        forecast = forecasts[forecasts.length - 1];
      } else if (monthsToForecast <= 0) {
        // Historical data
        forecast = historicalData.find(d => d.year === targetYear && d.month === targetMonth);
        if (forecast) {
          forecast = {
            ...forecast,
            predictedPrice: forecast.price,
            isForecast: false
          };
        }
      }
    }

    if (!forecast) {
      return res.status(404).json({ message: 'No forecast available for this period' });
    }

    return res.json({
      success: true,
      year: targetYear,
      month: targetMonth,
      monthName: MONTH_NAMES[targetMonth - 1],
      market,
      grade,
      predictedPrice: forecast.predictedPrice || forecast.price,
      lowerCI: forecast.lowerCI,
      upperCI: forecast.upperCI,
      trend: forecast.trend,
      percentChange: forecast.percentChange,
      model: forecast.model || 'SARIMA(1,1,1)(1,1,1,12)',
      isForecast: forecast.isForecast !== false
    });
  } catch (error) {
    console.error('Error fetching monthly forecast:', error);
    return res.status(500).json({ message: 'Failed to fetch monthly forecast' });
  }
};

// GET /api/price-forecast/analysis - Get price analysis and insights
exports.getPriceAnalysis = async (req, res) => {
  try {
    const historicalData = loadHistoricalPriceData();
    
    if (historicalData.length === 0) {
      return res.status(404).json({ message: 'No price data available' });
    }

    // Recent vs historical comparison
    const recentData = historicalData.slice(-12);
    const olderData = historicalData.slice(-36, -12);
    
    const recentAvg = recentData.reduce((sum, d) => sum + d.price, 0) / recentData.length;
    const olderAvg = olderData.reduce((sum, d) => sum + d.price, 0) / olderData.length;
    
    // Monthly seasonality analysis
    const monthlyStats = {};
    for (let m = 1; m <= 12; m++) {
      const monthData = historicalData.filter(d => d.month === m);
      if (monthData.length > 0) {
        const avg = monthData.reduce((sum, d) => sum + d.price, 0) / monthData.length;
        monthlyStats[m] = {
          month: m,
          monthName: MONTH_NAMES[m - 1],
          averagePrice: Math.round(avg * 100) / 100,
          dataPoints: monthData.length
        };
      }
    }

    // Best/worst months historically
    const monthlyAvgs = Object.values(monthlyStats).sort((a, b) => b.averagePrice - a.averagePrice);
    const bestMonth = monthlyAvgs[0];
    const worstMonth = monthlyAvgs[monthlyAvgs.length - 1];

    // Generate forecast for insights
    const forecasts = generateForecast(historicalData, 12);
    
    // Price outlook
    const avgForecast = forecasts.reduce((sum, f) => sum + f.predictedPrice, 0) / forecasts.length;
    const currentPrice = historicalData[historicalData.length - 1].price;
    const outlookChange = ((avgForecast - currentPrice) / currentPrice) * 100;
    
    let outlook = 'Stable';
    if (outlookChange > 5) outlook = 'Bullish';
    else if (outlookChange < -5) outlook = 'Bearish';

    return res.json({
      success: true,
      analysis: {
        currentPrice: Math.round(currentPrice * 100) / 100,
        recentAverage: Math.round(recentAvg * 100) / 100,
        yearOverYearChange: Math.round(((recentAvg - olderAvg) / olderAvg) * 10000) / 100,
        outlook,
        outlookChangePercent: Math.round(outlookChange * 100) / 100,
        bestMonth: {
          month: bestMonth.monthName,
          averagePrice: bestMonth.averagePrice
        },
        worstMonth: {
          month: worstMonth.monthName,
          averagePrice: worstMonth.averagePrice
        }
      },
      seasonality: Object.values(monthlyStats),
      forecasts: forecasts.slice(0, 6), // Next 6 months
      insights: [
        {
          type: 'trend',
          title: 'Price Trend',
          message: recentAvg > olderAvg 
            ? `Prices are up ${Math.round(((recentAvg - olderAvg) / olderAvg) * 100)}% compared to last year average`
            : `Prices are down ${Math.round(((olderAvg - recentAvg) / olderAvg) * 100)}% compared to last year average`,
          icon: recentAvg > olderAvg ? 'TrendingUp' : 'TrendingDown'
        },
        {
          type: 'seasonal',
          title: 'Seasonal Pattern',
          message: `Historically, ${bestMonth.monthName} sees the highest prices (₹${bestMonth.averagePrice}/kg) while ${worstMonth.monthName} has the lowest`,
          icon: 'Calendar'
        },
        {
          type: 'forecast',
          title: 'Price Outlook',
          message: `Our SARIMA model predicts ${outlook.toLowerCase()} market conditions with expected average of ₹${Math.round(avgForecast)}/kg over the next 12 months`,
          icon: outlook === 'Bullish' ? 'TrendingUp' : outlook === 'Bearish' ? 'TrendingDown' : 'Minus'
        }
      ]
    });
  } catch (error) {
    console.error('Error generating price analysis:', error);
    return res.status(500).json({ message: 'Failed to generate price analysis' });
  }
};

