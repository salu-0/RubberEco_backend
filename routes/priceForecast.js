const express = require('express');
const router = express.Router();

const priceForecastController = require('../controllers/priceForecastController');
const { protect } = require('../middlewares/auth');

// Public routes (no auth required for basic price info)

// Get current price and short-term forecast
// GET /api/price-forecast/current?months=6&market=Kottayam&grade=RSS-4
router.get('/current', priceForecastController.getCurrentPriceAndForecast);

// Get historical prices
// GET /api/price-forecast/historical?years=5&market=Kottayam&grade=RSS-4
router.get('/historical', priceForecastController.getHistoricalPrices);

// Get forecast for specific month
// GET /api/price-forecast/monthly/2025/6?market=Kottayam&grade=RSS-4
router.get('/monthly/:year/:month', priceForecastController.getMonthlyForecast);

// Get price analysis and insights
// GET /api/price-forecast/analysis
router.get('/analysis', priceForecastController.getPriceAnalysis);

module.exports = router;

