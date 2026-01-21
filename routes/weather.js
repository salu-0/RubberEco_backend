const express = require('express');
const router = express.Router();

const weatherController = require('../controllers/weatherController');
const { protect } = require('../middlewares/auth');

// Farmer weather endpoint - must be logged in
router.get('/next-month', protect, weatherController.getNextMonthForecast);

module.exports = router;


