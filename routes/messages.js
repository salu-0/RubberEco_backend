const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');

// @route   GET /api/messages/conversations
// @desc    Get broker's conversations
// @access  Private (Broker only)
router.get('/conversations', protect, async (req, res) => {
  try {
    // Mock conversations data for now
    const mockConversations = [
      {
        id: 'C001',
        farmerId: 'F001',
        farmerName: 'John Doe',
        farmerAvatar: null,
        lotId: 'RT001',
        lotInfo: {
          location: 'Kottayam, Kerala',
          numberOfTrees: 150,
          status: 'active'
        },
        lastMessage: 'Thank you for your interest in my rubber plantation.',
        lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        unreadCount: 2,
        isOnline: true
      },
      {
        id: 'C002',
        farmerId: 'F003',
        farmerName: 'Ravi Kumar',
        farmerAvatar: null,
        lotId: 'RT003',
        lotInfo: {
          location: 'Wayanad, Kerala',
          numberOfTrees: 100,
          status: 'active'
        },
        lastMessage: 'The trees are in excellent condition for tapping.',
        lastMessageTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        unreadCount: 0,
        isOnline: false
      },
      {
        id: 'C003',
        farmerId: 'F002',
        farmerName: 'Maria Sebastian',
        farmerAvatar: null,
        lotId: 'RT002',
        lotInfo: {
          location: 'Idukki, Kerala',
          numberOfTrees: 200,
          status: 'won'
        },
        lastMessage: 'Congratulations on winning the bid! When can we meet?',
        lastMessageTime: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days ago
        unreadCount: 1,
        isOnline: true
      }
    ];

    res.json({
      success: true,
      data: mockConversations
    });

  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching conversations'
    });
  }
});

// @route   GET /api/messages/conversations/:id/messages
// @desc    Get messages for a specific conversation
// @access  Private
router.get('/conversations/:id/messages', protect, async (req, res) => {
  try {
    const conversationId = req.params.id;

    // Mock messages data for now
    const mockMessages = [
    ];

    res.json({
      success: true,
      data: mockMessages
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching messages'
    });
  }
});

// @route   POST /api/messages/conversations/:id/messages
// @desc    Send a message in a conversation
// @access  Private
router.post('/conversations/:id/messages', protect, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // TODO: Implement actual message saving when database models are ready
    
    // Mock response for now
    const newMessage = {
      id: `M${Date.now()}`,
      senderId: req.user.id,
      senderType: 'broker',
      content: content.trim(),
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: newMessage
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending message'
    });
  }
});

// @route   GET /api/messages/notifications
// @desc    Get broker's notifications
// @access  Private (Broker only)
router.get('/notifications', protect, async (req, res) => {
  try {
    // Mock notifications data for now
    const mockNotifications = [
      {
        id: 'N001',
        type: 'outbid',
        title: 'You have been outbid',
        message: 'You have been outbid on Lot #RT001',
        lotId: 'RT001',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        read: false,
        priority: 'high'
      },
      {
        id: 'N002',
        type: 'won',
        title: 'Congratulations!',
        message: 'You won the bid for Lot #RT003',
        lotId: 'RT003',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        read: false,
        priority: 'high'
      },
      {
        id: 'N003',
        type: 'message',
        title: 'New message',
        message: 'You have a new message from John Doe',
        conversationId: 'C001',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        read: true,
        priority: 'medium'
      },
      {
        id: 'N004',
        type: 'bid_ending',
        title: 'Bidding ending soon',
        message: 'Bidding for Lot #RT005 ends in 2 hours',
        lotId: 'RT005',
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        read: true,
        priority: 'medium'
      }
    ];

    res.json({
      success: true,
      data: mockNotifications
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications'
    });
  }
});

// @route   PUT /api/messages/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/notifications/:id/read', protect, async (req, res) => {
  try {
    const notificationId = req.params.id;

    // TODO: Implement actual notification update when database models are ready
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating notification'
    });
  }
});

// @route   PUT /api/messages/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/notifications/read-all', protect, async (req, res) => {
  try {
    // TODO: Implement actual bulk notification update when database models are ready
    
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating notifications'
    });
  }
});

module.exports = router;
