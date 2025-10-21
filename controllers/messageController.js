const Message = require('../models/Message');
const Bid = require('../models/Bid');
const TreeLot = require('../models/TreeLot');
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
    console.log('🔍 Farmer conversations request for farmerId:', farmerId);
    console.log('🔍 User from auth:', req.user);
    console.log('🔍 FarmerId type:', typeof farmerId);
    console.log('🔍 FarmerId value:', farmerId);
    
    // Get all lots owned by this farmer
    // Convert farmerId to ObjectId if it's a string
    const mongoose = require('mongoose');
    let queryFarmerId = farmerId;
    
    if (typeof farmerId === 'string' && mongoose.Types.ObjectId.isValid(farmerId)) {
      queryFarmerId = new mongoose.Types.ObjectId(farmerId);
    }
    
    console.log('🔍 Query farmerId:', queryFarmerId);
    
    const lots = await TreeLot.find({ farmerId: queryFarmerId });
    console.log('🏞️ Found lots for farmer:', lots.length);
    console.log('🏞️ Lots data:', lots.map(lot => ({ id: lot._id, lotId: lot.lotId, farmerId: lot.farmerId })));
    
    // Debug: Check if there are any lots at all
    const allLots = await TreeLot.find({}).limit(5);
    console.log('🏞️ Total lots in database:', allLots.length);
    console.log('🏞️ Sample lots:', allLots.map(lot => ({ id: lot._id, lotId: lot.lotId, farmerId: lot.farmerId })));
    
    // Debug: Check if there are any messages at all
    const allMessages = await Message.find({}).limit(5);
    console.log('💬 Total messages in database:', allMessages.length);
    console.log('💬 Sample messages:', allMessages.map(msg => ({ id: msg._id, conversationId: msg.conversationId, senderType: msg.senderType, content: msg.content.substring(0, 50) })));
    
    // Debug: Check if there are any bids at all
    const allBids = await Bid.find({}).limit(5);
    console.log('💰 Total bids in database:', allBids.length);
    console.log('💰 Sample bids:', allBids.map(bid => ({ id: bid._id, lotId: bid.lotId, bidderId: bid.bidderId, amount: bid.amount })));
    
    const conversations = await Promise.all(
      lots.map(async (lot) => {
        try {
          // Get bids on this lot - try both lotId formats
          let bids = await Bid.find({ lotId: lot.lotId })
            .sort({ createdAt: -1 })
            .populate('bidderId', 'fullName name profilePicture');
          
          // If no bids found with lotId, try with _id
          if (bids.length === 0) {
            bids = await Bid.find({ lotId: lot._id })
              .sort({ createdAt: -1 })
              .populate('bidderId', 'fullName name profilePicture');
          }
          
          console.log(`💰 Found ${bids.length} bids for lot ${lot.lotId}`);
          if (bids.length > 0) {
            console.log(`💰 Bid details:`, bids.map(bid => ({ id: bid._id, lotId: bid.lotId, bidderId: bid.bidderId })));
          }
          
          return Promise.all(bids.map(bid => {
            // Get last message for this conversation
            return Message.findOne({ 
              conversationId: bid._id 
            }).sort({ createdAt: -1 }).then(lastMessage => {
              console.log(`💬 Last message for bid ${bid._id}:`, lastMessage ? lastMessage.content : 'No messages');
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
    
    console.log('💬 Valid conversations found:', validConversations.length);
    console.log('💬 Conversations data:', validConversations);
    
    // If no conversations found, try a different approach
    if (validConversations.length === 0) {
      console.log('🔍 No conversations found with standard query, trying alternative approach...');
      
      // Try to find any messages where farmer is involved
      const allMessages = await Message.find({}).populate('senderId', 'fullName name profilePicture');
      console.log('💬 All messages in database:', allMessages.length);
      
      // Try to find conversations by looking at all bids and their messages
      const allBids = await Bid.find({}).populate('bidderId', 'fullName name profilePicture');
      console.log('💰 All bids in database:', allBids.length);
      
      // For each bid, check if it has messages and if the lot belongs to this farmer
      const alternativeConversations = [];
      for (const bid of allBids) {
        const lot = await TreeLot.findOne({ lotId: bid.lotId, farmerId: farmerId });
        if (lot) {
          const messages = await Message.find({ conversationId: bid._id });
          if (messages.length > 0) {
            const lastMessage = messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
            alternativeConversations.push({
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
              unreadCount: messages.filter(m => m.senderType === 'broker' && m.status !== 'read').length,
              isOnline: Math.random() > 0.5
            });
          }
        }
      }
      
      console.log('💬 Alternative conversations found:', alternativeConversations.length);
      
      res.json({
        success: true,
        conversations: alternativeConversations
      });
    } else {
      res.json({
        success: true,
        conversations: validConversations
      });
    }
    
  } catch (error) {
    console.error('Error fetching farmer conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch farmer conversations',
      error: error.message
    });
  }
};

// Debug endpoint to check database data
const debugDatabase = async (req, res) => {
  try {
    const farmerId = req.user.id;
    
    // Get all data for debugging
    const lots = await TreeLot.find({ farmerId: farmerId });
    const allLots = await TreeLot.find({}).limit(5);
    const allBids = await Bid.find({}).limit(5);
    const allMessages = await Message.find({}).limit(5);
    
    res.json({
      success: true,
      debug: {
        farmerId: farmerId,
        farmerLots: lots.length,
        totalLots: allLots.length,
        totalBids: allBids.length,
        totalMessages: allMessages.length,
        sampleLots: allLots.map(lot => ({ id: lot._id, lotId: lot.lotId, farmerId: lot.farmerId })),
        sampleBids: allBids.map(bid => ({ id: bid._id, lotId: bid.lotId, bidderId: bid.bidderId })),
        sampleMessages: allMessages.map(msg => ({ id: msg._id, conversationId: msg.conversationId, senderType: msg.senderType }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  getBrokerConversations,
  getConversationMessages,
  sendMessage,
  markAsRead,
  getFarmerConversations,
  debugDatabase
};
