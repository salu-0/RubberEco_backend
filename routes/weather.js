const express = require('express');
const router = express.Router();

const weatherController = require('../controllers/weatherController');
const { protect } = require('../middlewares/auth');

// Farmer weather endpoints - must be logged in
router.get('/next-month', protect, weatherController.getNextMonthForecast);
router.get('/forecast', protect, weatherController.getDistrictForecast);

module.exports = router;


