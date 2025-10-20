const Message = require('../models/Message');
const Bid = require('../models/Bid');
const LandRegistration = require('../models/LandRegistration');
const Register = require('../models/Register');

// Get broker's conversations (based on their bids)
const getBrokerConversations = async (req, res) => {
  try {
    const brokerId = req.params.brokerId || req.user.id;
    
    // Get all bids placed by this broker
    const bids = await Bid.find({ bidderId: brokerId })
      .sort({ createdAt: -1 });
    
    const conversations = await Promise.all(
      bids.map(async (bid) => {
        try {
          // Get lot owner information
          const lot = await LandRegistration.findOne({ lotId: bid.lotId });
          if (!lot) return null;
          
          // Get farmer profile
          const farmer = await Register.findById(lot.ownerId);
          if (!farmer) return null;
          
          // Get last message for this conversation
          const lastMessage = await Message.findOne({ 
            conversationId: bid._id 
          }).sort({ createdAt: -1 });
          
          // Count unread messages from farmer
          const unreadCount = await Message.countDocuments({
            conversationId: bid._id,
            senderType: 'farmer',
            status: { $ne: 'read' }
          });
          
        return {
          _id: bid._id,
          farmerId: lot.ownerId,
          farmerName: farmer.fullName || farmer.name || 'Unknown Farmer',
          farmerAvatar: farmer.profilePicture || '',
          lotId: bid.lotId,
          bidId: bid._id,
            lotInfo: {
              location: lot.location || 'Location not specified',
              numberOfTrees: lot.numberOfTrees || 0,
              status: lot.status || 'active',
              bidAmount: bid.amount,
              bidStatus: bid.status
            },
            lastMessage: lastMessage ? lastMessage.content : 'No messages yet',
            lastMessageTime: lastMessage ? lastMessage.createdAt : bid.createdAt,
            unreadCount: unreadCount,
            isOnline: Math.random() > 0.5 // TODO: Implement real online status
          };
        } catch (error) {
          console.error(`Error processing bid ${bid._id}:`, error);
          return null;
        }
      })
    );
    
    // Filter out null results
    const validConversations = conversations.filter(conv => conv !== null);
    
    res.json({
      success: true,
      conversations: validConversations
    });
    
  } catch (error) {
    console.error('Error fetching broker conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
      error: error.message
    });
  }
};

// Get messages for a conversation (bid)
const getConversationMessages = async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    
    // Get all messages for this conversation (bid)
    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .populate('senderId', 'fullName name profilePicture');
    
    res.json({
      success: true,
      messages: messages
    });
    
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
};

// Send a message
const sendMessage = async (req, res) => {
  try {
    const { conversationId, content, senderType, replyTo } = req.body;
    const senderId = req.user.id;
    
    // Validate input
    if (!conversationId || !content || !senderType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    // Create new message
    const message = new Message({
      conversationId,
      senderId,
      senderType,
      content,
      replyTo: replyTo || null,
      status: 'sent'
    });
    
    await message.save();
    
    // Populate sender information
    await message.populate('senderId', 'fullName name profilePicture');
    
    res.status(201).json({
      success: true,
      message: message
    });
    
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
};

// Mark messages as read
const markAsRead = async (req, res) => {
  try {
    const { conversationId, messageIds } = req.body;
    const userId = req.user.id;
    
    // Update message status to read
    await Message.updateMany(
      { 
        _id: { $in: messageIds },
        conversationId: conversationId,
        senderType: 'farmer' // Only mark farmer messages as read
      },
      { status: 'read' }
    );
    
    res.json({
      success: true,
      message: 'Messages marked as read'
    });
    
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read',
      error: error.message
    });
  }
};

// Get farmer's conversations (where farmer is the recipient)
const getFarmerConversations = async (req, res) => {
  try {
    const farmerId = req.params.farmerId || req.user.id;
    
    // Get all lots owned by this farmer
    const lots = await LandRegistration.find({ ownerId: farmerId });
    
    const conversations = await Promise.all(
      lots.map(async (lot) => {
        try {
          // Get bids on this lot
          const bids = await Bid.find({ lotId: lot.lotId })
            .sort({ createdAt: -1 })
            .populate('bidderId', 'fullName name profilePicture');
          
          return Promise.all(bids.map(bid => {
            // Get last message for this conversation
            return Message.findOne({ 
              conversationId: bid._id 
            }).sort({ createdAt: -1 }).then(lastMessage => {
              // Count unread messages from broker
              return Message.countDocuments({
                conversationId: bid._id,
                senderType: 'broker',
                status: { $ne: 'read' }
              }).then(unreadCount => ({
                _id: bid._id,
                brokerId: bid.bidderId._id,
                brokerName: bid.bidderId.fullName || bid.bidderId.name || 'Unknown Broker',
                brokerAvatar: bid.bidderId.profilePicture || '',
                lotId: lot._id,
                bidId: bid._id,
                lotInfo: {
                  location: lot.location || 'Location not specified',
                  numberOfTrees: lot.numberOfTrees || 0,
                  status: lot.status || 'active',
                  bidAmount: bid.amount,
                  bidStatus: bid.status
                },
                lastMessage: lastMessage ? lastMessage.content : 'No messages yet',
                lastMessageTime: lastMessage ? lastMessage.createdAt : bid.createdAt,
                unreadCount: unreadCount,
                isOnline: Math.random() > 0.5 // TODO: Implement real online status
              }));
            });
          }));
        } catch (error) {
          console.error(`Error processing lot ${lot._id}:`, error);
          return null;
        }
      })
    );
    
    // Flatten and filter results
    const validConversations = conversations
      .flat()
      .filter(conv => conv !== null);
    
    res.json({
      success: true,
      conversations: validConversations
    });
    
  } catch (error) {
    console.error('Error fetching farmer conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch farmer conversations',
      error: error.message
    });
  }
};

module.exports = {
  getBrokerConversations,
  getConversationMessages,
  sendMessage,
  markAsRead,
  getFarmerConversations
};
