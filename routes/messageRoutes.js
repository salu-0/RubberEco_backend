const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middlewares/auth');

// Broker routes
router.get('/broker/:brokerId', auth.protect, messageController.getBrokerConversations);
router.get('/broker', auth.protect, messageController.getBrokerConversations);

// Farmer routes
router.get('/farmer/:farmerId', auth.protect, messageController.getFarmerConversations);
router.get('/farmer', auth.protect, messageController.getFarmerConversations);

// Message routes
router.get('/conversation/:conversationId', auth.protect, messageController.getConversationMessages);
router.post('/send', auth.protect, messageController.sendMessage);
router.post('/mark-read', auth.protect, messageController.markAsRead);

module.exports = router;
