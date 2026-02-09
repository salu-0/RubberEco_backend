const express = require('express');
const router = express.Router();

const weatherController = require('../controllers/weatherController');
const { protect } = require('../middlewares/auth');

// Live weather endpoints (OpenWeatherMap integration)
// GET /api/weather/current?district=Kottayam
router.get('/current', protect, weatherController.getCurrentWeather);

// GET /api/weather/forecast?district=Kottayam&days=5
router.get('/forecast', protect, weatherController.getWeatherForecast);

// GET /api/weather/districts - List all available districts
router.get('/districts', protect, weatherController.getAvailableDistricts);

// Historical rainfall prediction (SARIMA model)
// GET /api/weather/next-month?month=2&year=2026
router.get('/next-month', protect, weatherController.getNextMonthForecast);

module.exports = router;


