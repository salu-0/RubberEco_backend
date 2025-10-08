const mongoose = require('mongoose');
const NurseryAdmin = require('../models/NurseryAdmin');
const NurseryCenter = require('../models/NurseryCenter');
const NurseryPlant = require('../models/NurseryPlant');
const NurseryBooking = require('../models/NurseryBooking');
const Shipment = require('../models/Shipment');
const Payment = require('../models/Payment');
const Register = require('../models/Register');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Helper function to send error responses
const sendErrorResponse = (res, statusCode, message) => {
  res.status(statusCode).json({
    success: false,
    message
  });
};

// Helper function to find admin in Register collection only
const findAdminById = async (adminId) => {
  console.log('🔍 Looking for admin in Register collection with ID:', adminId);
  
  const registerUser = await Register.findById(new mongoose.Types.ObjectId(adminId));
  
  if (registerUser) {
    console.log('🔍 Found in Register collection:', registerUser.name);
    
    // If nurseryCenterId is not available in Register, try to find it by email
    let nurseryCenterId = registerUser.nurseryCenterId;
    if (!nurseryCenterId) {
      console.log('🔍 No nurseryCenterId in Register, searching by email...');
      const nurseryCenter = await NurseryCenter.findOne({ email: registerUser.email });
      if (nurseryCenter) {
        nurseryCenterId = nurseryCenter._id;
        console.log('🔍 Found nursery center by email:', nurseryCenter.name);
        
        // Update the Register user with the nurseryCenterId
        await Register.findByIdAndUpdate(adminId, { 
          nurseryCenterId: nurseryCenterId,
          nurseryCenterName: nurseryCenter.name 
        });
        console.log('🔍 Updated Register user with nurseryCenterId');
      }
    }
    
    // Convert Register user to admin format
    const admin = {
      _id: registerUser._id,
      name: registerUser.name,
      email: registerUser.email,
      phone: registerUser.phone,
      nurseryCenterId: nurseryCenterId,
      location: registerUser.location,
      permissions: registerUser.permissions || {
        managePlants: true,
        manageStock: true,
        managePricing: true,
        manageShipments: true,
        managePayments: true,
        viewReports: true
      }
    };
    
    console.log('✅ Admin data prepared:', {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      nurseryCenterId: admin.nurseryCenterId
    });
    
    return admin;
  }
  
  console.log('❌ Admin not found in Register collection');
  return null;
};

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      email: user.email, 
      role: 'nursery_admin',
      nurseryCenterId: user.nurseryCenterId 
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
};

// Login nursery admin
exports.loginNurseryAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return sendErrorResponse(res, 400, 'Please provide email and password');
    }

    // Find nursery admin
    const admin = await NurseryAdmin.findOne({ email }).select('+password');
    if (!admin) {
      return sendErrorResponse(res, 401, 'Invalid credentials');
    }

    // Check if admin is active
    if (!admin.isActive) {
      return sendErrorResponse(res, 403, 'Account is deactivated');
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return sendErrorResponse(res, 401, 'Invalid credentials');
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate JWT token
    const token = generateToken(admin);

    // Send response without password
    const userResponse = {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      nurseryCenterId: admin.nurseryCenterId,
      nurseryCenterName: admin.nurseryCenterName,
      location: admin.location,
      permissions: admin.permissions,
      lastLogin: admin.lastLogin
    };

    res.status(200).json({
      success: true,
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Nursery admin login error:', error);
    sendErrorResponse(res, 500, 'Server error during login');
  }
};

// Get nursery admin profile
exports.getProfile = async (req, res) => {
  try {
    console.log('🔍 getProfile called with req.user.id:', req.user.id);
    console.log('🔍 req.user:', req.user);
    
    const admin = await findAdminById(req.user.id);
    
    console.log('🔍 Admin found:', admin ? 'Yes' : 'No');
    if (admin) {
      console.log('🔍 Admin name:', admin.name);
    }
    
    if (!admin) {
      return sendErrorResponse(res, 404, 'Nursery admin not found');
    }

    res.status(200).json({
      success: true,
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        nurseryCenter: admin.nurseryCenterId,
        location: admin.location,
        permissions: admin.permissions,
        lastLogin: admin.lastLogin,
        createdAt: admin.createdAt
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    sendErrorResponse(res, 500, 'Server error while fetching profile');
  }
};

// Update nursery admin profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, location } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (location) updateData.location = location;

    const admin = await NurseryAdmin.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!admin) {
      return sendErrorResponse(res, 404, 'Nursery admin not found');
    }

    res.status(200).json({
      success: true,
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        location: admin.location
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    sendErrorResponse(res, 500, 'Server error while updating profile');
  }
};

// Get nursery center plants
exports.getPlants = async (req, res) => {
  try {
    console.log('🌱 getPlants called for admin ID:', req.user.id);
    const admin = await findAdminById(req.user.id);
    if (!admin) {
      console.log('❌ Admin not found');
      return sendErrorResponse(res, 404, 'Nursery admin not found');
    }

    console.log('✅ Admin found:', {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      nurseryCenterId: admin.nurseryCenterId
    });

    if (!admin.nurseryCenterId) {
      console.log('❌ No nursery center ID found for admin');
      return sendErrorResponse(res, 400, 'Nursery center not associated with admin');
    }

    const plants = await NurseryPlant.find({ 
      nurseryCenterId: admin.nurseryCenterId,
      isActive: true 
    }).sort({ name: 1 });

    console.log('🌱 Plants found:', plants.length);
    plants.forEach(plant => {
      console.log(`  - ${plant.name} (Stock: ${plant.stockAvailable}, Price: ${plant.unitPrice})`);
    });

    res.status(200).json({
      success: true,
      data: plants
    });

  } catch (error) {
    console.error('Get plants error:', error);
    sendErrorResponse(res, 500, 'Server error while fetching plants');
  }
};

// Update plant stock and price
exports.updatePlant = async (req, res) => {
  try {
    const { plantId } = req.params;
    const { stockAvailable, unitPrice, name, description, features } = req.body;

    // Align admin lookup with other endpoints (profile/plants etc.)
    const admin = await findAdminById(req.user.id);
    if (!admin) {
      return sendErrorResponse(res, 404, 'Nursery admin not found');
    }

    // Check if plant belongs to this nursery center
    const plant = await NurseryPlant.findOne({
      _id: plantId,
      nurseryCenterId: admin.nurseryCenterId
    });

    if (!plant) {
      return sendErrorResponse(res, 404, 'Plant not found or not authorized');
    }

    const updateData = {};
    if (stockAvailable !== undefined) {
      const stock = Number(stockAvailable);
      if (!Number.isFinite(stock) || stock < 0) {
        return sendErrorResponse(res, 400, 'Invalid stock value');
      }
      updateData.stockAvailable = stock;
    }

    if (unitPrice !== undefined) {
      const price = Number(unitPrice);
      if (!Number.isFinite(price) || price < 0) {
        return sendErrorResponse(res, 400, 'Invalid price value');
      }
      updateData.unitPrice = price;
    }

    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (features) updateData.features = features;

    const updatedPlant = await NurseryPlant.findByIdAndUpdate(
      plantId,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedPlant
    });

  } catch (error) {
    console.error('Update plant error:', error);
    sendErrorResponse(res, 500, 'Server error while updating plant');
  }
};

// Get nursery bookings
exports.getBookings = async (req, res) => {
  try {
    const admin = await findAdminById(req.user.id);
    if (!admin) {
      return sendErrorResponse(res, 404, 'Nursery admin not found');
    }

    const { status, page = 1, limit = 10 } = req.query;
    const query = { nurseryCenterId: admin.nurseryCenterId };
    
    if (status) {
      query.status = status;
    }

    const bookings = await NurseryBooking.find(query)
      .populate('farmerId', 'name email phone')
      .populate('plantId', 'name variety unitPrice')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await NurseryBooking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get bookings error:', error);
    sendErrorResponse(res, 500, 'Server error while fetching bookings');
  }
};

// Update booking status
exports.updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, approvalNotes } = req.body;

    const admin = await NurseryAdmin.findById(new mongoose.Types.ObjectId(req.user.id));
    if (!admin) {
      return sendErrorResponse(res, 404, 'Nursery admin not found');
    }

    const booking = await NurseryBooking.findOne({
      _id: bookingId,
      nurseryCenterId: admin.nurseryCenterId
    });

    if (!booking) {
      return sendErrorResponse(res, 404, 'Booking not found or not authorized');
    }

    const updateData = { status };
    if (approvalNotes) updateData.approvalNotes = approvalNotes;

    const updatedBooking = await NurseryBooking.findByIdAndUpdate(
      bookingId,
      updateData,
      { new: true, runValidators: true }
    ).populate('farmerId', 'name email phone')
     .populate('plantId', 'name variety unitPrice');

    res.status(200).json({
      success: true,
      data: updatedBooking
    });

  } catch (error) {
    console.error('Update booking status error:', error);
    sendErrorResponse(res, 500, 'Server error while updating booking status');
  }
};

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const admin = await findAdminById(req.user.id);
    if (!admin) {
      return sendErrorResponse(res, 404, 'Nursery admin not found');
    }

    const [
      totalPlants,
      totalStock,
      totalBookings,
      pendingBookings,
      completedBookings,
      totalRevenue
    ] = await Promise.all([
      NurseryPlant.countDocuments({ 
        nurseryCenterId: admin.nurseryCenterId, 
        isActive: true 
      }),
      NurseryPlant.aggregate([
        { $match: { nurseryCenterId: admin.nurseryCenterId, isActive: true } },
        { $group: { _id: null, total: { $sum: '$stockAvailable' } } }
      ]),
      NurseryBooking.countDocuments({ nurseryCenterId: admin.nurseryCenterId }),
      NurseryBooking.countDocuments({ 
        nurseryCenterId: admin.nurseryCenterId, 
        status: 'pending' 
      }),
      NurseryBooking.countDocuments({ 
        nurseryCenterId: admin.nurseryCenterId, 
        status: 'completed' 
      }),
      NurseryBooking.aggregate([
        { $match: { nurseryCenterId: admin.nurseryCenterId, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amountTotal' } } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalPlants,
        totalStock: totalStock[0]?.total || 0,
        totalBookings,
        pendingBookings,
        completedBookings,
        totalRevenue: totalRevenue[0]?.total || 0
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    sendErrorResponse(res, 500, 'Server error while fetching dashboard statistics');
  }
};

// Get shipments
exports.getShipments = async (req, res) => {
  try {
    const admin = await findAdminById(req.user.id);
    if (!admin) {
      return sendErrorResponse(res, 404, 'Nursery admin not found');
    }

    const { status, page = 1, limit = 10 } = req.query;
    const query = { nurseryCenterId: admin.nurseryCenterId };
    
    if (status) {
      query.status = status;
    }

    const shipments = await Shipment.find(query)
      .populate('farmerId', 'name email phone')
      .populate('bookingId', 'plantName quantity amountTotal')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Shipment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        shipments,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get shipments error:', error);
    sendErrorResponse(res, 500, 'Server error while fetching shipments');
  }
};

// Update shipment status
exports.updateShipmentStatus = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const { status, notes } = req.body;

    const admin = await NurseryAdmin.findById(new mongoose.Types.ObjectId(req.user.id));
    if (!admin) {
      return sendErrorResponse(res, 404, 'Nursery admin not found');
    }

    const shipment = await Shipment.findOne({
      _id: shipmentId,
      nurseryCenterId: admin.nurseryCenterId
    });

    if (!shipment) {
      return sendErrorResponse(res, 404, 'Shipment not found or not authorized');
    }

    // Add to status history
    shipment.statusHistory.push({
      status,
      notes,
      updatedBy: admin.name
    });

    shipment.status = status;
    const updatedShipment = await shipment.save();

    res.status(200).json({
      success: true,
      data: updatedShipment
    });

  } catch (error) {
    console.error('Update shipment status error:', error);
    sendErrorResponse(res, 500, 'Server error while updating shipment status');
  }
};

// Get payments
exports.getPayments = async (req, res) => {
  try {
    const admin = await findAdminById(req.user.id);
    if (!admin) {
      return sendErrorResponse(res, 404, 'Nursery admin not found');
    }

    const { status, paymentMethod, page = 1, limit = 10 } = req.query;
    const query = { nurseryCenterId: admin.nurseryCenterId };
    
    if (status) {
      query.paymentStatus = status;
    }
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    const payments = await Payment.find(query)
      .populate('farmerId', 'name email phone')
      .populate('bookingId', 'plantName quantity amountTotal')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get payments error:', error);
    sendErrorResponse(res, 500, 'Server error while fetching payments');
  }
};

// Update payment status
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status, notes } = req.body;

    const admin = await NurseryAdmin.findById(new mongoose.Types.ObjectId(req.user.id));
    if (!admin) {
      return sendErrorResponse(res, 404, 'Nursery admin not found');
    }

    const payment = await Payment.findOne({
      _id: paymentId,
      nurseryCenterId: admin.nurseryCenterId
    });

    if (!payment) {
      return sendErrorResponse(res, 404, 'Payment not found or not authorized');
    }

    // Add to payment timeline
    payment.paymentTimeline.push({
      status,
      notes,
      amount: payment.amount
    });

    payment.paymentStatus = status;
    payment.processedBy = admin.name;
    const updatedPayment = await payment.save();

    res.status(200).json({
      success: true,
      data: updatedPayment
    });

  } catch (error) {
    console.error('Update payment status error:', error);
    sendErrorResponse(res, 500, 'Server error while updating payment status');
  }
};

// Create shipment for approved booking
exports.createShipment = async (req, res) => {
  try {
    const { bookingId, shippingAddress, carrier, estimatedDelivery, shippingCost } = req.body;

    const admin = await NurseryAdmin.findById(new mongoose.Types.ObjectId(req.user.id));
    if (!admin) {
      return sendErrorResponse(res, 404, 'Nursery admin not found');
    }

    // Check if booking exists and is approved
    const booking = await NurseryBooking.findOne({
      _id: bookingId,
      nurseryCenterId: admin.nurseryCenterId,
      status: 'approved'
    });

    if (!booking) {
      return sendErrorResponse(res, 404, 'Approved booking not found');
    }

    // Check if shipment already exists
    const existingShipment = await Shipment.findOne({ bookingId });
    if (existingShipment) {
      return sendErrorResponse(res, 400, 'Shipment already exists for this booking');
    }

    const shipment = new Shipment({
      bookingId,
      nurseryCenterId: admin.nurseryCenterId,
      farmerId: booking.farmerId,
      farmerName: booking.farmerName,
      farmerEmail: booking.farmerEmail,
      shippingAddress,
      plantDetails: {
        plantId: booking.plantId,
        plantName: booking.plantName,
        quantity: booking.quantity,
        unitPrice: booking.unitPrice
      },
      shipmentDetails: {
        carrier,
        estimatedDelivery: new Date(estimatedDelivery),
        shippingCost,
        packagingType: 'Standard'
      },
      status: 'preparing',
      statusHistory: [{
        status: 'preparing',
        notes: 'Shipment created',
        updatedBy: admin.name
      }]
    });

    await shipment.save();

    res.status(201).json({
      success: true,
      data: shipment
    });

  } catch (error) {
    console.error('Create shipment error:', error);
    sendErrorResponse(res, 500, 'Server error while creating shipment');
  }
};
