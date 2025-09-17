const express = require('express');
const router = express.Router();
const { sendAdminNotificationEmail } = require('../utils/emailService');

// POST /api/admin/notifications/email - Send email notification to admin
router.post('/email', async (req, res) => {
  try {
    console.log('📧 Received admin notification email request:', req.body.type);

    const { type, title, message, data, timestamp } = req.body;

    // Validate required fields
    if (!type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: type, title, message'
      });
    }

    // Create notification data object
    const notificationData = {
      type,
      title,
      message,
      data: data || {},
      timestamp: timestamp || new Date().toISOString()
    };

    // Send email notification
    const result = await sendAdminNotificationEmail(notificationData);

    if (result.success) {
      console.log('✅ Admin notification email sent successfully');
      res.status(200).json({
        success: true,
        message: 'Admin notification email sent successfully',
        messageId: result.messageId
      });
    } else {
      console.log('⚠️ Failed to send admin notification email:', result.message);
      res.status(500).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ Error in admin notification email endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// GET /api/admin/notifications - Get all notifications (for future use)
router.get('/', async (req, res) => {
  try {
    // This would typically fetch from database
    // For now, return empty array as notifications are stored in localStorage
    res.status(200).json({
      success: true,
      notifications: [],
      message: 'Notifications are currently stored in browser localStorage'
    });
  } catch (error) {
    console.error('❌ Error fetching admin notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

// POST /api/admin/notifications/mark-read - Mark notification as read (for future use)
router.post('/mark-read', async (req, res) => {
  try {
    const { notificationId } = req.body;

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: 'Missing notification ID'
      });
    }

    // This would typically update database
    // For now, just return success
    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
});

// DELETE /api/admin/notifications/:id - Delete notification (for future use)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Missing notification ID'
      });
    }

    // This would typically delete from database
    // For now, just return success
    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
});

module.exports = router;
