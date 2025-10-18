require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Load models
require('./models/Register');
require('./models/TappingRequest');
require('./models/TrainingEnrollment');
require('./models/LandRegistration');
require('./models/TenancyOffering');
require('./models/Certificate');
require('./models/Attendance');
require('./models/NurseryAdmin');
require('./models/Shipment');
require('./models/Payment');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const staffRoutes = require('./routes/staffRoutes');
const treeLotRoutes = require('./routes/treeLots');
const bidRoutes = require('./routes/bids');
const messageRoutes = require('./routes/messages');
const adminNotificationRoutes = require('./routes/adminNotifications');
const tappingRequestRoutes = require('./routes/tappingRequests');
const availableTappersRoutes = require('./routes/availableTappers');
const tappingSchedulesRoutes = require('./routes/tappingSchedules');
const nurseryRoutes = require('./routes/nursery');
const trainingEnrollmentRoutes = require('./routes/trainingEnrollment');
const practicalTrainingRoutes = require('./routes/practicalTrainingRoutes');
const staffRequestRoutes = require('./routes/staffRequestRoutes');
const serviceRequestApplicationRoutes = require('./routes/serviceRequestApplicationRoutes');
const newServiceApplicationRoutes = require('./routes/newServiceApplicationRoutes');
const leaveRequestRoutes = require('./routes/leaveRequests');
const landRegistrationRoutes = require('./routes/landRegistration');
const tenancyOfferingsRoutes = require('./routes/tenancyOfferings');
const certificateRoutes = require('./routes/certificateRoutes');
const attendanceRoutes = require('./routes/attendance');
const nurseryAdminRoutes = require('./routes/nurseryAdminRoutes');
const orderRoutes = require('./routes/orderRoutes');
const BidAlert = require('./models/BidAlert');
const Bid = require('./models/Bid');
const TreeLot = require('./models/TreeLot');
const Register = require('./models/Register');
const { createEmailTransporter } = require('./utils/emailService');

const cors = require('cors');

const app = express();

// Database connection
connectDB();

// Request logging middleware (production-ready)
app.use((req, res, next) => {
  next();
});

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman, file://)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:5175',
      'http://127.0.0.1:5176',
      'http://127.0.0.1:3000',
      'https://rubber-eco-frontend.vercel.app'  // Vercel production frontend
    ];

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow file:// protocol for testing
    if (origin && origin.startsWith('file://')) {
      return callback(null, true);
    }

    return callback(null, true); // Allow all origins for development
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
// Increase body size limit to handle profile images (base64 encoded)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  // Log ALL requests to see what's happening
  console.log(`🌐 ${req.method} ${req.url} - ${new Date().toISOString()}`);

  if (req.url.includes('/api/auth/login') || (req.method === 'PUT' && req.url.includes('/api/users/'))) {
    console.log('📋 Origin:', req.headers.origin);
    console.log('📋 User-Agent:', req.headers['user-agent']);
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Routes

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    db: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

app.post('/api/training/direct-demo-enroll', async (req, res) => {
  try {
    const TrainingEnrollment = require('./models/TrainingEnrollment');

    const enrollmentData = {
      userId: req.body.userId,
      moduleId: req.body.moduleId,
      moduleTitle: req.body.moduleTitle,
      moduleLevel: req.body.moduleLevel,
      paymentAmount: req.body.paymentAmount,
      paymentMethod: req.body.paymentMethod || 'stripe',
      paymentStatus: 'completed',
      paymentId: req.body.paymentId,
      userDetails: req.body.userDetails,
      progress: {
        completedLessons: [],
        totalLessons: 0,
        progressPercentage: 0,
        lastAccessedDate: new Date()
      }
    };

    const enrollment = new TrainingEnrollment(enrollmentData);
    await enrollment.save();

    res.json({
      success: true,
      message: 'Direct demo enrollment successful',
      enrollmentId: enrollment._id
    });
  } catch (error) {
    console.error('Direct demo enrollment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Direct demo enrollment failed'
    });
  }
});

app.get('/api/training/direct-user/:userId', async (req, res) => {
  try {
    const TrainingEnrollment = require('./models/TrainingEnrollment');
    const { userId } = req.params;

    const enrollments = await TrainingEnrollment.find({
      userId,
      isActive: true
    }).sort({ enrollmentDate: -1 });

    res.json({
      success: true,
      enrollments: enrollments.map(enrollment => ({
        id: enrollment._id,
        moduleId: enrollment.moduleId,
        moduleTitle: enrollment.moduleTitle,
        moduleLevel: enrollment.moduleLevel,
        paymentAmount: enrollment.paymentAmount,
        paymentMethod: enrollment.paymentMethod,
        paymentStatus: enrollment.paymentStatus,
        enrollmentDate: enrollment.enrollmentDate,
        progress: enrollment.progress,
        certificateIssued: enrollment.certificateIssued,
        certificateIssuedDate: enrollment.certificateIssuedDate
      }))
    });
  } catch (error) {
    console.error('Direct get user enrollments error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get user enrollments'
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/tree-lots', treeLotRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin/notifications', adminNotificationRoutes);



// Tapping schedules route (moved up to avoid conflicts)
app.use('/api/tapping-schedules', tappingSchedulesRoutes);
app.use('/api/nursery', nurseryRoutes);
app.use('/api/farmer-requests', tappingRequestRoutes);

// Available tappers route (separate to avoid conflicts)
app.use('/api/available-tappers', availableTappersRoutes);

// Training enrollment routes
app.use('/api/training', trainingEnrollmentRoutes);

// Practical training routes
app.use('/api/practical-training', practicalTrainingRoutes);

// Staff request routes
app.use('/api/staff-requests', staffRequestRoutes);

// Service request application routes
app.use('/api/service-applications', serviceRequestApplicationRoutes);
app.use('/api/new-service-applications', newServiceApplicationRoutes);

// Service request routes (Fertilizer & Rain Guard) - Full version with auth
const serviceRequestRoutes = require('./routes/serviceRequests');
app.use('/api/service-requests', serviceRequestRoutes);

// Leave request routes
app.use('/api/leave-requests', leaveRequestRoutes);

// Land registration routes
app.use('/api/land-registration', landRegistrationRoutes);

// Tenancy offerings routes
app.use('/api/tenancy-offerings', tenancyOfferingsRoutes);

// Certificate routes
app.use('/api/certificates', certificateRoutes);

// Attendance routes
app.use('/api/attendance', attendanceRoutes);

// Nursery admin routes
app.use('/api/nursery-admin', nurseryAdminRoutes);

// Order routes
app.use('/api/orders', orderRoutes);

// Admin payments routes
const adminPaymentsRoutes = require('./routes/adminPayments');
app.use('/api/admin', adminPaymentsRoutes);




// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`MongoDB Collection: Register`);

  // Test email configuration on startup
  const { testEmailConfig } = require('./controllers/authController');
  if (testEmailConfig) {
    await testEmailConfig();
  }

  // Lightweight in-process scheduler to send 'bidding ends tomorrow' alerts
  const transporter = createEmailTransporter();
  setInterval(async () => {
    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Find lots ending between 24h and 25h from now to avoid repeated sends
      const lotsEndingSoon = await TreeLot.find({
        biddingEndDate: { $gte: in24h, $lte: new Date(in24h.getTime() + 60 * 60 * 1000) },
        status: 'active'
      }).lean();

      if (lotsEndingSoon.length === 0) return;

      for (const lot of lotsEndingSoon) {
        // Top bid for the lot
        const topBid = await Bid.findOne({ lotId: lot.lotId, status: 'active' }).sort({ amount: -1 }).lean();
        if (!topBid) continue;

        // Any brokers who set an alert for this lot and not notified yet
        const alerts = await BidAlert.find({ lotId: lot.lotId, type: 'ending_soon', notified: false }).lean();
        if (alerts.length === 0) continue;

        for (const alert of alerts) {
          const broker = await Register.findById(alert.bidderId).lean();
          if (!broker || !broker.email) continue;

          const isSecuring = String(topBid.bidderId) === String(alert.bidderId);
          const subject = `Reminder: Bidding for Lot #${lot.lotId} ends tomorrow`;
          const html = `
            <div style="font-family:Arial,sans-serif;padding:16px">
              <h2>⏰ Bid Ending Tomorrow</h2>
              <p>Hello ${broker.name || 'Broker'},</p>
              <p>Bidding for tree lot <strong>#${lot.lotId}</strong> ends on <strong>${new Date(lot.biddingEndDate).toLocaleString('en-IN')}</strong>.</p>
              <p>${isSecuring ? 'You are currently securing the highest bid.' : 'You are not the highest bidder currently.'}</p>
              <p>Current highest: <strong>₹${(topBid.amount||0).toLocaleString('en-IN')}</strong></p>
              <p><em>This alert was sent because you enabled notifications for this lot.</em></p>
            </div>`;

          try {
            await transporter.sendMail({
              from: `"RubberEco" <${process.env.EMAIL_USER}>`,
              to: broker.email,
              subject,
              html
            });

            // mark as notified
            await BidAlert.updateOne({ _id: alert._id }, { notified: true, notifiedAt: new Date() });
          } catch (e) {
            console.warn('Failed to send bid alert email:', e.message);
          }
        }
      }
    } catch (e) {
      console.warn('Bid alert scheduler error:', e.message);
    }
  }, 15 * 60 * 1000); // run every 15 minutes
});