const Razorpay = require('razorpay');
const crypto = require('crypto');

// Lazy initialize Razorpay to avoid crashing server on missing env
let razorpayClient = null;
function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay keys not configured');
  }
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }
  return razorpayClient;
}

// Create order for shop items
exports.createOrder = async (req, res) => {
  try {
    const { items, totals, shipping } = req.body;
    const userId = req.user.id;

    if (!items || !totals || !shipping) {
      return res.status(400).json({
        success: false,
        message: 'Missing required order data'
      });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'Razorpay keys not configured'
      });
    }

    // Calculate total amount in paise
    const amountInPaise = Math.round(totals.total * 100);
    
    if (amountInPaise < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order amount'
      });
    }

    // Generate unique receipt
    const receipt = `order_${Date.now()}_${userId.slice(-6)}`;

    // Create Razorpay order
    const order = await getRazorpay().orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: receipt,
      notes: {
        userId: userId,
        items: JSON.stringify(items.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.qty,
          price: item.price
        }))),
        shipping: JSON.stringify(shipping),
        totals: JSON.stringify(totals)
      }
    });

    // Store order in database (you can create an Order model if needed)
    // For now, we'll return the order details
    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        // Expose public key so frontend doesn't hardcode it
        key: process.env.RAZORPAY_KEY_ID
      }
    });

  } catch (error) {
    console.error('❌ Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
};

// Verify payment signature
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification data'
      });
    }

    // Create signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    // Verify signature
    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    // Here you would typically:
    // 1. Update order status in database
    // 2. Send confirmation email
    // 3. Update inventory
    // 4. Create shipping record

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id
      }
    });

  } catch (error) {
    console.error('❌ Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  }
};

// Get order status
exports.getOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // Here you would typically fetch order from database
    // For now, return a mock response
    res.json({
      success: true,
      data: {
        orderId: orderId,
        status: 'confirmed',
        paymentStatus: 'completed',
        userId: userId
      }
    });

  } catch (error) {
    console.error('❌ Error getting order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get order status',
      error: error.message
    });
  }
};

// Get user orders
exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    // Here you would typically fetch orders from database
    // For now, return a mock response
    res.json({
      success: true,
      data: {
        orders: [],
        message: 'Orders will be implemented with database integration'
      }
    });

  } catch (error) {
    console.error('❌ Error getting user orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user orders',
      error: error.message
    });
  }
};
