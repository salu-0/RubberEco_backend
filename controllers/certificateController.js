const Certificate = require('../models/Certificate');
const TrainingEnrollment = require('../models/TrainingEnrollment');
const User = require('../models/User');

// Generate certificate for completed training
exports.generateCertificate = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const userId = req.user.id;

    console.log('🎓 Generating certificate for enrollment:', enrollmentId);

    // Find the enrollment
    const enrollment = await TrainingEnrollment.findById(enrollmentId)
      .populate('userId', 'name email');

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Training enrollment not found'
      });
    }

    // Verify user owns this enrollment
    if (enrollment.userId._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if course is 100% complete
    if (enrollment.progress.progressPercentage < 100) {
      return res.status(400).json({
        success: false,
        message: 'Course must be 100% complete to generate certificate',
        currentProgress: enrollment.progress.progressPercentage
      });
    }

    // Check if certificate already exists
    const existingCertificate = await Certificate.findOne({
      userId: enrollment.userId._id,
      trainingModuleId: enrollment.moduleId
    });

    if (existingCertificate) {
      return res.json({
        success: true,
        message: 'Certificate already exists',
        certificate: existingCertificate
      });
    }

    // Create new certificate
    const certificate = new Certificate({
      userId: enrollment.userId._id,
      trainingModuleId: enrollment.moduleId,
      trainingModuleTitle: enrollment.moduleTitle,
      trainingLevel: enrollment.moduleLevel,
      completionDate: new Date(),
      completionPercentage: 100
    });

    await certificate.save();

    // Update enrollment to mark certificate as issued
    enrollment.certificateIssued = true;
    enrollment.certificateIssuedDate = new Date();
    await enrollment.save();

    console.log('✅ Certificate generated successfully:', certificate.certificateNumber);

    res.json({
      success: true,
      message: 'Certificate generated successfully',
      certificate: {
        certificateNumber: certificate.certificateNumber,
        verificationCode: certificate.verificationCode,
        issuedDate: certificate.issuedDate,
        validUntil: certificate.validUntil,
        trainingModuleTitle: certificate.trainingModuleTitle,
        trainingLevel: certificate.trainingLevel,
        userName: enrollment.userId.name,
        userEmail: enrollment.userId.email
      }
    });

  } catch (error) {
    console.error('❌ Error generating certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate certificate',
      error: error.message
    });
  }
};

// Get user's certificates
exports.getUserCertificates = async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user can access these certificates
    if (userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const certificates = await Certificate.getUserCertificates(userId);

    res.json({
      success: true,
      certificates
    });

  } catch (error) {
    console.error('❌ Error fetching certificates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch certificates',
      error: error.message
    });
  }
};

// Verify certificate
exports.verifyCertificate = async (req, res) => {
  try {
    const { certificateNumber, verificationCode } = req.body;

    if (!certificateNumber || !verificationCode) {
      return res.status(400).json({
        success: false,
        message: 'Certificate number and verification code are required'
      });
    }

    const certificate = await Certificate.verifyCertificate(certificateNumber, verificationCode);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found or invalid'
      });
    }

    if (!certificate.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Certificate is expired or revoked'
      });
    }

    res.json({
      success: true,
      message: 'Certificate is valid',
      certificate: {
        certificateNumber: certificate.certificateNumber,
        userName: certificate.userId.name,
        userEmail: certificate.userId.email,
        trainingModuleTitle: certificate.trainingModuleTitle,
        trainingLevel: certificate.trainingLevel,
        completionDate: certificate.completionDate,
        issuedDate: certificate.issuedDate,
        validUntil: certificate.validUntil,
        status: certificate.status
      }
    });

  } catch (error) {
    console.error('❌ Error verifying certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify certificate',
      error: error.message
    });
  }
};

// Get certificate by ID
exports.getCertificateById = async (req, res) => {
  try {
    const { certificateId } = req.params;
    const userId = req.user.id;

    const certificate = await Certificate.findById(certificateId)
      .populate('userId', 'name email');

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    // Verify user can access this certificate
    if (certificate.userId._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      certificate
    });

  } catch (error) {
    console.error('❌ Error fetching certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch certificate',
      error: error.message
    });
  }
};
