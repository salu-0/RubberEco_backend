const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const StaffRequest = require('../models/StaffRequest');
const Staff = require('../models/Staff');
const bcrypt = require('bcryptjs');
const { protect, adminOnly } = require('../middlewares/auth');
const { sendStaffWelcomeEmail, sendStaffApplicationConfirmation } = require('../utils/emailService');
const { ocrIdProofAndValidate } = require('../utils/ocr');
const { resetStaffPassword } = require('../controllers/staffController');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/staff-requests';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Allow images for photo
  if (file.fieldname === 'photo') {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Photo must be an image file'), false);
    }
  }
  // Allow images and PDFs for ID proof
  else if (file.fieldname === 'idProof') {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('ID proof must be an image or PDF file'), false);
    }
  }
  // Allow PDFs and documents for resume
  else if (file.fieldname === 'resume') {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Resume must be a PDF or Word document'), false);
    }
  }
  else {
    cb(new Error('Unexpected field'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Public route - Submit staff application
router.post('/', upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'idProof', maxCount: 1 },
  { name: 'resume', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('📝 Received staff application:', req.body);
    console.log('📁 Files:', req.files);

    const {
      fullName,
      dateOfBirth,
      gender,
      phone,
      email,
      presentAddress,
      permanentAddress,
      qualification,
      workExperience,
      skills,
      applyForPosition,
      additionalNotes
    } = req.body;

    // Parse address objects if they're strings
    const parsedPresentAddress = typeof presentAddress === 'string' 
      ? JSON.parse(presentAddress) 
      : presentAddress;
    
    let parsedPermanentAddress = typeof permanentAddress === 'string' 
      ? JSON.parse(permanentAddress) 
      : permanentAddress;

    // If same as present address, copy present address
    if (parsedPermanentAddress.sameAsPresent) {
      parsedPermanentAddress = {
        ...parsedPresentAddress,
        sameAsPresent: true
      };
    }

    // Check if email already exists
    const existingRequest = await StaffRequest.findOne({ email: email.toLowerCase() });
    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'An application with this email already exists'
      });
    }

    // Prepare file data
    const fileData = {};
    if (req.files) {
      ['photo', 'idProof', 'resume'].forEach(fieldName => {
        if (req.files[fieldName] && req.files[fieldName][0]) {
          const file = req.files[fieldName][0];
          fileData[fieldName] = {
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            path: file.path,
            url: `/uploads/staff-requests/${file.filename}`
          };
        }
      });
    }

    // Run OCR validation if idProof is present and is an image
    let verification = { idOcr: { status: 'skipped' } };
    let initialStatus = 'pending';
    if (fileData.idProof && fileData.idProof.mimetype && fileData.idProof.path) {
      if (fileData.idProof.mimetype.startsWith('image/')) {
        const ocrResult = await ocrIdProofAndValidate({
          filePath: fileData.idProof.path,
          expectedName: fullName,
          expectedDob: dateOfBirth,
          expectedIdNumber: ''
        });
        verification = { idOcr: ocrResult };
        // Policy: if OCR fails, accept submission but mark as under_review for manual verification
        if (ocrResult.status !== 'passed') {
          initialStatus = 'under_review';
        }
      } else if (fileData.idProof.mimetype === 'application/pdf') {
        // For now, reject PDFs (can be enhanced later to convert to image)
        Object.values(req.files || {}).flat().forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
        return res.status(400).json({
          success: false,
          message: 'PDF ID proofs not supported for automatic verification. Please upload an image file.'
        });
      }
    }

    // Create staff request
    const staffRequest = new StaffRequest({
      fullName,
      dateOfBirth,
      gender,
      phone,
      email: email.toLowerCase(),
      presentAddress: parsedPresentAddress,
      permanentAddress: parsedPermanentAddress,
      qualification,
      workExperience: workExperience || '',
      skills: skills || '',
      applyForPosition,
      additionalNotes: additionalNotes || '',
      ...fileData,
      verification,
      status: initialStatus
    });

    await staffRequest.save();

    console.log('✅ Staff application created:', staffRequest.applicationId);

    // Send confirmation email to applicant
    try {
      await sendStaffApplicationConfirmation({
        fullName: staffRequest.fullName,
        email: staffRequest.email,
        applyForPosition: staffRequest.applyForPosition,
        applicationId: staffRequest.applicationId,
        submittedAt: staffRequest.submittedAt
      });
      console.log('✅ Confirmation email sent to applicant');
    } catch (emailError) {
      console.error('❌ Failed to send confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: initialStatus === 'pending' 
        ? 'Application submitted successfully. You will receive a confirmation email shortly.' 
        : 'Application submitted. Your ID requires manual verification; our team will review it shortly.',
      applicationId: staffRequest.applicationId,
      data: {
        id: staffRequest._id,
        applicationId: staffRequest.applicationId,
        fullName: staffRequest.fullName,
        email: staffRequest.email,
        applyForPosition: staffRequest.applyForPosition,
        status: staffRequest.status,
        submittedAt: staffRequest.submittedAt
      },
      verification
    });

  } catch (error) {
    console.error('❌ Error creating staff request:', error);
    
    // Clean up uploaded files if there was an error
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit application'
    });
  }
});

// Public route - Get pending staff requests count for notifications
router.get('/pending/count', async (req, res) => {
  try {
    const pendingCount = await StaffRequest.countDocuments({ status: 'pending' });

    res.json({
      success: true,
      count: pendingCount
    });
  } catch (error) {
    console.error('❌ Error fetching pending staff requests count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending staff requests count'
    });
  }
});

// Admin routes (protected)
// Get all staff requests
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { 
      status = 'all', 
      position = 'all', 
      page = 1, 
      limit = 10,
      search = ''
    } = req.query;

    // Build filter
    const filter = {};
    if (status !== 'all') filter.status = status;
    if (position !== 'all') filter.applyForPosition = position;
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { applicationId: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    
    const requests = await StaffRequest.find(filter)
      .populate('reviewedBy', 'name email')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await StaffRequest.countDocuments(filter);

    // Get status counts
    const statusCounts = await StaffRequest.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const stats = {
      total,
      pending: statusCounts.find(s => s._id === 'pending')?.count || 0,
      under_review: statusCounts.find(s => s._id === 'under_review')?.count || 0,
      approved: statusCounts.find(s => s._id === 'approved')?.count || 0,
      rejected: statusCounts.find(s => s._id === 'rejected')?.count || 0
    };

    res.json({
      success: true,
      data: requests,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_items: total,
        items_per_page: parseInt(limit)
      },
      stats
    });

  } catch (error) {
    console.error('❌ Error fetching staff requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff requests'
    });
  }
});

// Get single staff request by ID
router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const request = await StaffRequest.findById(req.params.id)
      .populate('reviewedBy', 'name email')
      .populate('staffAccountId', 'name email role status');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Staff request not found'
      });
    }

    res.json({
      success: true,
      data: request
    });

  } catch (error) {
    console.error('❌ Error fetching staff request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff request'
    });
  }
});

// Approve staff request and create staff account
router.post('/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    const { notes = '', salary = 0 } = req.body;
    const request = await StaffRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Staff request not found'
      });
    }

    if (request.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Request is already approved'
      });
    }

    // Generate password using name and first two digits of phone number
    const generateStaffPassword = (fullName, phone) => {
      // Get first name (first word)
      const firstName = fullName.split(' ')[0].toLowerCase();
      // Get first two digits of phone number (remove any non-digit characters)
      const phoneDigits = phone.replace(/\D/g, '');
      const firstTwoDigits = phoneDigits.substring(0, 2);
      return `${firstName}${firstTwoDigits}`;
    };

    const generatedPassword = generateStaffPassword(request.fullName, request.phone);
    const hashedPassword = await bcrypt.hash(generatedPassword, 12);

    const staffData = {
      name: request.fullName,
      email: request.email,
      password: hashedPassword,
      phone: request.phone,
      role: request.applyForPosition,
      department: getDepartmentByRole(request.applyForPosition),
      location: `${request.presentAddress.city}, ${request.presentAddress.state}`,
      status: 'active',
      salary: salary || 0,
      address: {
        street: request.presentAddress.street,
        city: request.presentAddress.city,
        state: request.presentAddress.state,
        pincode: request.presentAddress.pincode
      },
      skills: request.skills ? request.skills.split(',').map(s => s.trim()) : [],
      notes: `Created from staff request ${request.applicationId}. ${notes}`,
      created_by: req.user.id,
      updated_by: req.user.id
    };

    const staff = new Staff(staffData);
    await staff.save();

    // Update request status
    await request.approve(req.user.id, notes);
    request.staffAccountId = staff._id;
    await request.save();

    console.log('✅ Staff request approved and account created:', staff.email);

    // Send welcome email with login credentials
    try {
      await sendStaffWelcomeEmail(
        {
          name: staff.name,
          email: staff.email,
          phone: staff.phone,
          role: staff.role,
          department: staff.department
        },
        {
          name: req.user.name || 'Admin',
          email: req.user.email || 'admin@rubbereco.com'
        },
        generatedPassword
      );
      console.log('✅ Welcome email sent to new staff member');
    } catch (emailError) {
      console.error('❌ Failed to send welcome email:', emailError);
      // Don't fail the approval if email fails
    }

    res.json({
      success: true,
      message: 'Staff request approved and account created successfully. Welcome email sent with login credentials.',
      data: {
        request: request,
        staff: {
          id: staff._id,
          name: staff.name,
          email: staff.email,
          role: staff.role,
          department: staff.department
        },
        loginCredentials: {
          email: staff.email,
          password: generatedPassword,
          note: 'Password generated from name and first two digits of phone number'
        }
      }
    });

  } catch (error) {
    console.error('❌ Error approving staff request:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to approve staff request'
    });
  }
});

// Helper function to get department by role
function getDepartmentByRole(role) {
  const roleDepartmentMap = {
    'tapper': 'Field Operations',
    'latex_collector': 'Field Operations',
    'supervisor': 'Field Management',
    'field_officer': 'Field Operations',
    'trainer': 'Training & Development',
    'skilled_worker': 'Operations',
    'manager': 'Management'
  };
  return roleDepartmentMap[role] || 'General';
}

// Reject staff request
router.post('/:id/reject', protect, adminOnly, async (req, res) => {
  try {
    const { notes = '' } = req.body;
    const request = await StaffRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Staff request not found'
      });
    }

    await request.reject(req.user.id, notes);

    res.json({
      success: true,
      message: 'Staff request rejected',
      data: request
    });

  } catch (error) {
    console.error('❌ Error rejecting staff request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject staff request'
    });
  }
});

// Move to review
router.post('/:id/review', protect, adminOnly, async (req, res) => {
  try {
    const { notes = '' } = req.body;
    const request = await StaffRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Staff request not found'
      });
    }

    await request.moveToReview(req.user.id, notes);

    res.json({
      success: true,
      message: 'Staff request moved to review',
      data: request
    });

  } catch (error) {
    console.error('❌ Error moving staff request to review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to move staff request to review'
    });
  }
});

// Download file (ID proof, resume, photo)
router.get('/:id/download/:fileType', protect, adminOnly, async (req, res) => {
  try {
    console.log(`🔍 Download request: ID=${req.params.id}, FileType=${req.params.fileType}`);

    const { id, fileType } = req.params;
    const request = await StaffRequest.findById(id);

    if (!request) {
      console.log('❌ Staff request not found:', id);
      return res.status(404).json({
        success: false,
        message: 'Staff request not found'
      });
    }

    console.log(`🔍 Found request for ${request.email}, checking file: ${fileType}`);

    const fileData = request[fileType];
    if (!fileData || !fileData.path) {
      console.log(`❌ File data not found for ${fileType}:`, fileData);
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    console.log(`🔍 File data found:`, {
      path: fileData.path,
      originalName: fileData.originalName,
      size: fileData.size
    });

    const filePath = path.resolve(fileData.path);
    console.log(`🔍 Resolved file path: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      console.log(`❌ File does not exist on disk: ${filePath}`);
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    console.log(`✅ File exists, sending download: ${fileData.originalName}`);
    res.download(filePath, fileData.originalName);

  } catch (error) {
    console.error('❌ Error downloading file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file'
    });
  }
});

// Utility route: Reset staff password
const staffController = require('../controllers/staffController');
router.post('/reset-password', staffController.resetStaffPassword);

module.exports = router;
