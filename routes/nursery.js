const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const PDFDocument = require('pdfkit');
const NurseryPlant = require('../models/NurseryPlant');
const NurseryBooking = require('../models/NurseryBooking');
const NurseryCenter = require('../models/NurseryCenter');
const User = require('../models/User');
const { protect } = require('../middlewares/auth');
const { sendNurseryBookingApprovalEmail } = require('../utils/emailService');
const { RUBBER_VARIETIES_POOL, getAllVarieties, isValidVariety, getVarietiesForCenter, isVarietyAvailableForCenter } = require('../constants/rubberVarieties');

// Config
const MIN_ADVANCE_PERCENT = 10; // can be made env-configurable
const RESERVATION_HOURS = 72; // hold stock for 72 hours after approval

// Get all rubber varieties
router.get('/varieties', async (req, res) => {
  try {
    res.json({ success: true, data: getAllVarieties() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load varieties', error: err.message });
  }
});

// Get varieties for a specific center
router.get('/centers/:id/varieties', async (req, res) => {
  try {
    const centerId = req.params.id;
    const center = await NurseryCenter.findById(centerId);
    if (!center) return res.status(404).json({ success: false, message: 'Nursery center not found' });
    
    // Get all centers to calculate distribution
    const allCenters = await NurseryCenter.find({ isActive: true }).sort({ _id: 1 });
    const centerIndex = allCenters.findIndex(c => c._id.toString() === centerId);
    
    if (centerIndex === -1) {
      return res.status(404).json({ success: false, message: 'Center not found in active centers' });
    }
    
    const centerVarieties = getVarietiesForCenter(centerIndex, allCenters.length);
    
    res.json({ 
      success: true, 
      data: {
        center: center,
        varieties: centerVarieties,
        varietyCount: centerVarieties.length,
        maxVarieties: 2
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load center varieties', error: err.message });
  }
});

// List plants
router.get('/plants', async (req, res) => {
  try {
    const plants = await NurseryPlant.find({ isActive: true })
      .populate('nurseryCenterId', 'name email location contact')
      .sort({ name: 1 });
    res.json({ success: true, data: plants });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load plants', error: err.message });
  }
});

// Nursery centers - list
router.get('/centers', async (req, res) => {
  try {
    const centers = await NurseryCenter.find({ isActive: true }).sort({ name: 1 });
    res.json({ success: true, data: centers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load centers', error: err.message });
  }
});

// Get nursery center varieties (admin)
router.get('/centers/:id/varieties', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    
    const centerId = req.params.id;
    const center = await NurseryCenter.findById(centerId);
    if (!center) return res.status(404).json({ success: false, message: 'Nursery center not found' });
    
    const plants = await NurseryPlant.find({ 
      nurseryCenterId: centerId,
      isActive: true 
    }).select('variety clone name');
    
    // Get unique varieties
    const varieties = new Set();
    plants.forEach(plant => {
      const variety = plant.variety || plant.clone || plant.name;
      if (variety) {
        varieties.add(variety);
      }
    });
    
    res.json({ 
      success: true, 
      data: {
        center: center,
        varieties: Array.from(varieties),
        varietyCount: varieties.size,
        maxVarieties: 2
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load varieties', error: err.message });
  }
});

// Nursery centers - bulk insert (admin)
router.post('/centers/bulk', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const items = Array.isArray(req.body) ? req.body : [];
    if (items.length === 0) return res.status(400).json({ success: false, message: 'No items' });

    // Upsert by name + email to avoid duplicates
    const results = [];
    for (const item of items) {
      const filter = { name: item.name, email: item.email };
      const update = { ...item, isActive: true };
      const options = { upsert: true, new: true, setDefaultsOnInsert: true };
      const doc = await NurseryCenter.findOneAndUpdate(filter, update, options);
      results.push(doc);
    }
    res.status(201).json({ success: true, data: results });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Create plant (admin)
router.post('/plants', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    
    const { nurseryCenterId, variety, clone } = req.body;
    if (!nurseryCenterId) {
      return res.status(400).json({ success: false, message: 'Nursery center ID is required' });
    }
    
    // Validate nursery center exists
    const nurseryCenter = await NurseryCenter.findById(nurseryCenterId);
    if (!nurseryCenter || !nurseryCenter.isActive) {
      return res.status(400).json({ success: false, message: 'Invalid nursery center' });
    }
    
    // Validate variety is available for this center
    const newVariety = variety || clone || req.body.name;
    if (newVariety) {
      if (!isValidVariety(newVariety)) {
        return res.status(400).json({ 
          success: false, 
          message: `Invalid variety. Please select from available varieties.` 
        });
      }
      
      // Check if variety is available for this center
      const allCenters = await NurseryCenter.find({ isActive: true }).sort({ _id: 1 });
      const centerIndex = allCenters.findIndex(c => c._id.toString() === nurseryCenterId);
      
      if (!isVarietyAvailableForCenter(newVariety, centerIndex, allCenters.length)) {
        const centerVarieties = getVarietiesForCenter(centerIndex, allCenters.length);
        return res.status(400).json({ 
          success: false, 
          message: `This variety is not available at ${nurseryCenter.name}. Available varieties: ${centerVarieties.map(v => v.name).join(', ')}` 
        });
      }
    }
    
    // Check variety limit per nursery center (max 2 varieties)
    const existingPlants = await NurseryPlant.find({ 
      nurseryCenterId: nurseryCenterId,
      isActive: true 
    });
    
    // Get unique varieties from existing plants
    const existingVarieties = new Set();
    existingPlants.forEach(plant => {
      const variety = plant.variety || plant.clone || plant.name;
      if (variety) {
        existingVarieties.add(variety.toLowerCase().trim());
      }
    });
    
    // Check if this would be a new variety
    if (newVariety) {
      const normalizedNewVariety = newVariety.toLowerCase().trim();
      if (existingVarieties.has(normalizedNewVariety)) {
        return res.status(400).json({ 
          success: false, 
          message: `This variety already exists for ${nurseryCenter.name}. Each center can only have 2 different varieties.` 
        });
      }
      
      if (existingVarieties.size >= 2) {
        return res.status(400).json({ 
          success: false, 
          message: `${nurseryCenter.name} already has 2 varieties. Each nursery center is limited to 2 varieties only.` 
        });
      }
    }
    
    const plant = await NurseryPlant.create(req.body);
    const populatedPlant = await NurseryPlant.findById(plant._id)
      .populate('nurseryCenterId', 'name email location contact');
    res.status(201).json({ success: true, data: populatedPlant });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Update plant price (admin)
router.put('/plants/:id/price', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const value = Number(req.body.unitPrice);
    if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ success: false, message: 'Invalid unitPrice' });
    const plant = await NurseryPlant.findByIdAndUpdate(req.params.id, { unitPrice: value }, { new: true });
    if (!plant) return res.status(404).json({ success: false, message: 'Plant not found' });
    res.json({ success: true, data: plant });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Update plant inventory (admin) - general update for stock and price
router.put('/plants/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    
    const { stockAvailable, unitPrice, variety, clone, name } = req.body;
    const updateData = {};
    
    if (stockAvailable !== undefined) {
      const stock = Number(stockAvailable);
      if (!Number.isFinite(stock) || stock < 0) {
        return res.status(400).json({ success: false, message: 'Invalid stockAvailable value' });
      }
      updateData.stockAvailable = stock;
    }
    
    if (unitPrice !== undefined) {
      const price = Number(unitPrice);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ success: false, message: 'Invalid unitPrice value' });
      }
      updateData.unitPrice = price;
    }
    
    // If variety/clone/name is being updated, check variety limit
    if (variety !== undefined || clone !== undefined || name !== undefined) {
      const plant = await NurseryPlant.findById(req.params.id).populate('nurseryCenterId');
      if (!plant) return res.status(404).json({ success: false, message: 'Plant not found' });
      
      const newVariety = variety || clone || name;
      if (newVariety) {
        // Get existing plants for this nursery center (excluding current plant)
        const existingPlants = await NurseryPlant.find({ 
          nurseryCenterId: plant.nurseryCenterId._id,
          isActive: true,
          _id: { $ne: req.params.id }
        });
        
        // Get unique varieties from existing plants
        const existingVarieties = new Set();
        existingPlants.forEach(existingPlant => {
          const existingVariety = existingPlant.variety || existingPlant.clone || existingPlant.name;
          if (existingVariety) {
            existingVarieties.add(existingVariety.toLowerCase().trim());
          }
        });
        
        const normalizedNewVariety = newVariety.toLowerCase().trim();
        if (existingVarieties.has(normalizedNewVariety)) {
          return res.status(400).json({ 
            success: false, 
            message: `This variety already exists for ${plant.nurseryCenterId.name}. Each center can only have 2 different varieties.` 
          });
        }
        
        if (existingVarieties.size >= 2) {
          return res.status(400).json({ 
            success: false, 
            message: `${plant.nurseryCenterId.name} already has 2 varieties. Each nursery center is limited to 2 varieties only.` 
          });
        }
      }
      
      // Add variety fields to update data
      if (variety !== undefined) updateData.variety = variety;
      if (clone !== undefined) updateData.clone = clone;
      if (name !== undefined) updateData.name = name;
    }
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }
    
    const updatedPlant = await NurseryPlant.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('nurseryCenterId', 'name email location contact');
    if (!updatedPlant) return res.status(404).json({ success: false, message: 'Plant not found' });
    
    res.json({ success: true, data: updatedPlant });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Bulk set default price for plants missing price (admin)
router.post('/plants/bulk-set-default-price', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const defaultPrice = Number(req.body.defaultPrice);
    if (!Number.isFinite(defaultPrice) || defaultPrice <= 0) return res.status(400).json({ success: false, message: 'Invalid defaultPrice' });
    const result = await NurseryPlant.updateMany({ $or: [ { unitPrice: { $exists: false } }, { unitPrice: null }, { unitPrice: { $lte: 0 } } ] }, { $set: { unitPrice: defaultPrice } });
    res.json({ success: true, data: { matched: result.matchedCount ?? result.nModified, modified: result.modifiedCount ?? result.nModified } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Create advance booking (farmer)
router.post('/bookings', protect, async (req, res) => {
  try {
    const { plantId, quantity, advancePercent, nurseryCenterId } = req.body;
    const farmer = await User.findById(req.user.id);
    const plant = await NurseryPlant.findById(plantId);
    if (!plant || !plant.isActive) return res.status(404).json({ success: false, message: 'Plant not found' });

    // Validate nursery center
    const nurseryCenter = await NurseryCenter.findById(nurseryCenterId);
    if (!nurseryCenter || !nurseryCenter.isActive) return res.status(404).json({ success: false, message: 'Nursery center not found' });

    const resolvedUnitPrice = Number(plant.unitPrice ?? plant.price);
    if (!Number.isFinite(resolvedUnitPrice) || resolvedUnitPrice <= 0) {
      return res.status(400).json({ success: false, message: 'Plant price not configured' });
    }

    const qtyParsed = parseInt(quantity, 10);
    const minQty = Number(plant.minOrderQty || 1);
    const qty = Number.isFinite(qtyParsed) && qtyParsed > 0 ? Math.max(minQty, qtyParsed) : minQty;

    const advancePctParsed = parseInt(advancePercent, 10);
    const advancePct = Number.isFinite(advancePctParsed) ? Math.max(MIN_ADVANCE_PERCENT, advancePctParsed) : MIN_ADVANCE_PERCENT;

    const amountTotal = resolvedUnitPrice * qty;
    const amountAdvance = Math.round((amountTotal * advancePct) / 100);
    const amountBalance = amountTotal - amountAdvance;

    const booking = await NurseryBooking.create({
      farmerId: farmer._id,
      farmerName: farmer.name,
      farmerEmail: farmer.email,
      nurseryCenterId: nurseryCenter._id,
      nurseryCenterName: nurseryCenter.name,
      plantId: plant._id,
      plantName: plant.name || plant.variety || plant.clone || 'Rubber Plant',
      unitPrice: resolvedUnitPrice,
      quantity: qty,
      amountTotal,
      advancePercent: advancePct,
      amountAdvance,
      amountBalance,
      status: 'pending'
    });

    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Create Razorpay order for advance payment
router.post('/bookings/:id/create-advance-order', protect, async (req, res) => {
  try {
    const booking = await NurseryBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.farmerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ success: false, message: 'Razorpay keys not configured' });
    }

    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });

    const options = {
      amount: Math.max(1, Math.round(booking.amountAdvance * 100)), // in paise
      currency: 'INR',
      receipt: `nursery-adv-${booking._id}`,
      notes: {
        bookingId: String(booking._id),
        plantName: booking.plantName,
        farmerName: booking.farmerName
      }
    };
    const order = await razorpay.orders.create(options);

    booking.payment.advanceOrderId = order.id;
    await booking.save();

    res.json({ success: true, data: { orderId: order.id, amount: order.amount, currency: order.currency, key: process.env.RAZORPAY_KEY_ID } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Verify Razorpay payment signature and mark advance paid
router.post('/bookings/:id/verify-advance', protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const booking = await NurseryBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.farmerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ success: false, message: 'Razorpay not configured' });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Signature verification failed' });
    }

    booking.payment.advancePaid = true;
    booking.payment.advanceTxnId = razorpay_payment_id;
    booking.payment.advancePaymentId = razorpay_payment_id;
    booking.payment.advanceSignature = razorpay_signature;
    await booking.save();

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Download PDF receipt for a booking advance
router.get('/bookings/:id/receipt', protect, async (req, res) => {
  try {
    const booking = await NurseryBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.farmerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="nursery-receipt-${booking._id}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    // Header
    doc
      .fontSize(20)
      .fillColor('#059669')
      .text('RubberEco Nursery - Payment Receipt', { align: 'center' })
      .moveDown();

    doc.fontSize(10).fillColor('#000').text(`Receipt ID: REC-${booking._id}`);
    doc.text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    // Farmer and booking info
    doc.fontSize(12).text('Payer Details', { underline: true });
    doc.text(`Name: ${booking.farmerName}`);
    doc.text(`Email: ${booking.farmerEmail}`);
    doc.moveDown(0.5);

    doc.fontSize(12).text('Booking Details', { underline: true });
    doc.text(`Plant: ${booking.plantName}`);
    doc.text(`Quantity: ${booking.quantity}`);
    doc.text(`Unit Price: ₹${booking.unitPrice.toLocaleString()}`);
    doc.text(`Advance %: ${booking.advancePercent}%`);
    doc.text(`Total Amount: ₹${booking.amountTotal.toLocaleString()}`);
    doc.moveDown(0.5);

    // Payment
    doc.fontSize(12).text('Payment', { underline: true });
    doc.text(`Advance Amount: ₹${booking.amountAdvance.toLocaleString()}`);
    doc.text(`Status: ${booking.payment.advancePaid ? 'Paid' : 'Pending'}`);
    if (booking.payment.advancePaid) {
      doc.text(`Payment ID: ${booking.payment.advancePaymentId || booking.payment.advanceTxnId}`);
      doc.text(`Order ID: ${booking.payment.advanceOrderId || '-'}`);
    }
    doc.moveDown(1);

    doc.fontSize(10).fillColor('#555').text('This is a system-generated receipt for your advance payment towards nursery saplings booking.', { align: 'center' });

    doc.end();
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Approve or reject booking (nursery/admin)
router.put('/bookings/:id/decision', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !['admin', 'field_worker'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Admin or staff only' });
    }

    const { action, notes } = req.body; // action: 'approve' | 'reject'
    const booking = await NurseryBooking.findById(req.params.id).populate('plantId');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (action === 'approve') {
      if (!booking.payment.advancePaid) {
        return res.status(400).json({ success: false, message: 'Advance not paid yet' });
      }

      // Reserve stock if available
      if (booking.plantId.stockAvailable < booking.quantity) {
        return res.status(400).json({ success: false, message: 'Insufficient stock' });
      }

      booking.status = 'approved';
      booking.approvalNotes = notes || '';
      booking.reservedStock = booking.quantity;
      booking.reservationExpiresAt = new Date(Date.now() + RESERVATION_HOURS * 60 * 60 * 1000);
      await booking.save();

      // Decrease available stock
      booking.plantId.stockAvailable -= booking.quantity;
      await booking.plantId.save();

      // Send approval email to farmer
      try {
        const farmerData = {
          farmerName: booking.farmerName,
          farmerEmail: booking.farmerEmail
        };
        
        const emailResult = await sendNurseryBookingApprovalEmail(farmerData, booking);
        if (emailResult.success) {
          console.log('✅ Nursery booking approval email sent successfully');
        } else {
          console.log('⚠️ Failed to send nursery booking approval email:', emailResult.message);
        }
      } catch (emailError) {
        console.error('❌ Error sending nursery booking approval email:', emailError);
        // Don't fail the request if email fails
      }
    } else if (action === 'reject') {
      booking.status = 'rejected';
      booking.approvalNotes = notes || '';
      await booking.save();
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Get my bookings (farmer)
router.get('/bookings/my', protect, async (req, res) => {
  try {
    const bookings = await NurseryBooking.find({ farmerId: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch bookings', error: err.message });
  }
});

// Admin list all bookings
router.get('/bookings', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const bookings = await NurseryBooking.find()
      .populate('nurseryCenterId', 'name location')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch bookings', error: err.message });
  }
});

module.exports = router;



