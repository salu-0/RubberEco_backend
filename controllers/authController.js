const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Register = require('../models/Register');
const Staff = require('../models/Staff');
const { generateToken } = require('../utils/jwt');

// Helper function for sending error responses
const sendErrorResponse = (res, statusCode, message) => {
  return res.status(statusCode).json({
    success: false,
    message
  });
};

// Input validation middleware (could be moved to separate file)
const validateRegisterInput = (name, email, password) => {
  if (!name || !email || !password) {
    return 'Please provide name, email and password';
  }
  
  if (password.length < 6) {
    return 'Password must be at least 6 characters';
  }

  if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
    return 'Please provide a valid email address';
  }

  return null;
};

exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, role, googleId, isVerified } = req.body;

    // Validate input
    const validationError = validateRegisterInput(name, email, password);
    if (validationError) {
      return sendErrorResponse(res, 400, validationError);
    }

    // Check if user exists (by email or googleId)
    const existingUser = await Register.findOne({
      $or: [
        { email },
        ...(googleId ? [{ googleId }] : [])
      ]
    });

    if (existingUser) {
      // If it's a Google OAuth user trying to register again, just return success
      if (googleId && existingUser.googleId === googleId) {
        return res.status(200).json({
          success: true,
          message: 'User already exists',
          user: {
            id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email,
            isVerified: existingUser.isVerified,
            role: existingUser.role
          }
        });
      }
      return sendErrorResponse(res, 400, 'User already exists');
    }

    // Hash password (use placeholder for Google OAuth users)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new Register({
      name,
      email,
      password: hashedPassword,
      role: role || 'farmer',
      isVerified: isVerified || false,
      ...(googleId && { googleId })
    });

    const savedUser = await user.save();

    // Create email verification token (valid for 24 hours)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    savedUser.emailVerificationToken = verificationTokenHash;
    savedUser.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await savedUser.save();

    // Send verification email (best-effort – do not block registration if email fails)
    try {
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        const transporter = createEmailTransporter();
        await transporter.verify();

        const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
        const verifyUrl = `${backendUrl}/api/auth/verify-email?token=${verificationToken}`;

        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb;">
            <div style="background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
              <div style="background: linear-gradient(135deg,#22c55e,#16a34a); color: #fff; padding: 20px 24px;">
                <h2 style="margin:0">Verify your email</h2>
                <p style="margin:6px 0 0 0; opacity:.9">Complete your RubberEco registration</p>
              </div>
              <div style="padding: 24px; color:#111827;">
                <p>Hi ${name},</p>
                <p>Thanks for signing up to RubberEco. Please confirm your email address to activate your account.</p>
                <div style="text-align:center; margin: 24px 0;">
                  <a href="${verifyUrl}" style="display:inline-block;background:#22c55e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Verify Email</a>
                </div>
                <p style="color:#6b7280; font-size:14px;">This link expires in 24 hours. If you didn’t create this account, you can safely ignore this email.</p>
              </div>
            </div>
          </div>
        `;

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: savedUser.email,
          subject: 'Verify your email - RubberEco',
          html
        });
      }
    } catch (emailErr) {
      console.error('Email verification send failed:', emailErr.message);
    }

    // Respond without issuing auth token; require verification first
    res.status(201).json({
      success: true,
      message: 'Registration received. Please verify your email to activate your account.',
      user: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
        isVerified: savedUser.isVerified,
        role: savedUser.role
      }
    });

  } catch (error) {
    // Handle duplicate key error
    if (error.code === 11000 && error.keyPattern?.email) {
      return sendErrorResponse(res, 400, 'User already exists');
    }

    sendErrorResponse(res, 500, 'Server error during registration');
  }
};

exports.loginUser = async (req, res) => {
  try {
    console.log('Login request received');
    console.log('Request body:', req.body);

    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      console.log('Missing email or password');
      return sendErrorResponse(res, 400, 'Please provide email and password');
    }

    console.log('Login attempt for:', email);

    // Check all collections and prioritize based on role
    console.log('🔍 Checking Staff collection for:', email);
    let staffUser = await Staff.findOne({ email }).select('+password');
    let isStaff = false;

    console.log('🔍 Checking Register collection for:', email);
    let registerUser = await Register.findOne({ email }).select('+password');

    console.log('🔍 Checking User collection for:', email);
    let userUser = await User.findOne({ email }).select('+password');

    let user = null;

    // Prioritize based on role and collection
    if (userUser && userUser.role === 'broker') {
      console.log('✅ Found broker user in User collection:', userUser.name);
      user = userUser;
      isStaff = false;
    } else if (staffUser) {
      console.log('✅ Found user in Staff collection:', staffUser.name);
      user = staffUser;
      isStaff = true;
    } else if (registerUser) {
      console.log('✅ Found user in Register collection:', registerUser.name);
      user = registerUser;
      isStaff = false;
    } else if (userUser) {
      console.log('✅ Found user in User collection:', userUser.name);
      user = userUser;
      isStaff = false;
    } else {
      console.log('❌ User not found in any collection');
    }

    if (!user) {
      console.log('❌ User not found in any collection');
      return sendErrorResponse(res, 401, 'Invalid credentials');
    }

    // Verify password
    console.log('🔍 Comparing password for user:', user.name);
    console.log('🔍 Password provided:', password);
    console.log('🔍 Hashed password exists:', !!user.password);
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('🔍 Password match result:', isMatch);
    if (!isMatch) {
      console.log('❌ Password does not match');
      return sendErrorResponse(res, 401, 'Invalid credentials');
    }
    console.log('✅ Password matches, login successful');

    // Require email verification for non-staff accounts
    if (!isStaff && !user.isVerified) {
      return sendErrorResponse(res, 403, 'Please verify your email to continue');
    }

    // Generate JWT token
    const token = generateToken(user);

    // Send response without password
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: isStaff ? 'staff' : user.role,
      isVerified: isStaff ? true : user.isVerified, // Staff are considered verified by default
      ...(isStaff && {
        department: user.department,
        location: user.location,
        staffRole: user.role, // Keep the original staff role (field_officer, tapper, etc.)
        // Check if this staff member should use staff dashboard
        useStaffDashboard: ['tapper', 'field_officer', 'supervisor', 'trainer'].includes(user.role)
      })
    };

    res.status(200).json({
      success: true,
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Login error:', error);
    sendErrorResponse(res, 500, 'Server error during login');
  }
};

// Verify email using token
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return sendErrorResponse(res, 400, 'Verification token is required');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await Register.findOne({
      emailVerificationToken: tokenHash,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return sendErrorResponse(res, 400, 'Invalid or expired verification token');
    }

    user.isVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    // Optionally redirect to frontend success page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    if (req.accepts('html')) {
      return res.redirect(`${frontendUrl}/verify-success`);
    }

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Email verification error:', error);
    sendErrorResponse(res, 500, 'Server error during email verification');
  }
};

// Resend verification email
exports.resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return sendErrorResponse(res, 400, 'Email is required');
    }

    const user = await Register.findOne({ email: email.toLowerCase() });
    if (!user) {
      return sendErrorResponse(res, 404, 'User not found');
    }
    if (user.isVerified) {
      return sendErrorResponse(res, 400, 'Email already verified');
    }

    // Generate new token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');
    user.emailVerificationToken = verificationTokenHash;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    // Send email
    try {
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        const transporter = createEmailTransporter();
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
        const verifyUrl = `${backendUrl}/api/auth/verify-email?token=${verificationToken}`;
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: 'Verify your email - RubberEco',
          html: `<p>Please verify your email by clicking the link below:</p>
                 <p><a href="${verifyUrl}">Verify Email</a></p>`
        });
      }
    } catch (emailError) {
      console.error('Resend verification email failed:', emailError.message);
    }

    res.json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    console.error('Resend verification error:', error);
    sendErrorResponse(res, 500, 'Server error while resending verification email');
  }
};

exports.googleAuthCallback = async (req, res) => {
  try {
    if (!req.user) {
      return sendErrorResponse(res, 401, 'Google authentication failed');
    }

    const user = req.user;

    // Generate JWT token
    const token = generateToken(user);

    // Prepare user response
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      isVerified: true // Google-authenticated users are automatically verified
    };

    // For API response
    if (req.accepts('json')) {
      return res.status(200).json({
        success: true,
        token,
        user: userResponse
      });
    }

    // For OAuth redirect flow
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/success?token=${token}`;
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('Google auth callback error:', error);
    
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=google_auth_failed`;
    if (req.accepts('json')) {
      sendErrorResponse(res, 500, 'Server error during Google authentication');
    } else {
      res.redirect(redirectUrl);
    }
  }
};

// Optional: Add this if you want to handle both JSON and redirect responses
exports.handleGoogleAuth = (req, res, next) => {
  // Temporarily disabled for debugging
  res.status(501).json({ message: 'Google OAuth temporarily disabled' });
  // passport.authenticate('google', {
  //   session: false,
  //   failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=google_auth_failed`
  // })(req, res, next);
};

// Configure email transporter
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    // Additional Gmail configuration
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Test email configuration
const testEmailConfig = async () => {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const transporter = createEmailTransporter();
      await transporter.verify();
      console.log('✅ Email configuration is valid and ready to send emails');
      return true;
    } catch (error) {
      console.error('❌ Email configuration test failed:', error.message);
      return false;
    }
  } else {
    console.log('⚠️ Email configuration not found in environment variables');
    return false;
  }
};

// Export the test function
exports.testEmailConfig = testEmailConfig;

// Send a test email
exports.sendTestEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    console.log('🧪 Sending test email to:', email);

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        const transporter = createEmailTransporter();

        // Test the connection first
        await transporter.verify();
        console.log('✅ SMTP connection verified for test email');

        const testMessage = `
          <h2>Test Email from RubberEco</h2>
          <p>This is a test email to verify email functionality.</p>
          <p>If you receive this, email configuration is working correctly.</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        `;

        const result = await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'RubberEco - Test Email',
          html: testMessage
        });

        console.log('✅ Test email sent successfully:', result.messageId);

        res.json({
          success: true,
          message: 'Test email sent successfully',
          messageId: result.messageId
        });

      } catch (emailError) {
        console.error('❌ Test email failed:', emailError);
        res.status(500).json({
          success: false,
          message: 'Failed to send test email',
          error: emailError.message
        });
      }
    } else {
      res.status(500).json({
        success: false,
        message: 'Email configuration not found'
      });
    }

  } catch (error) {
    console.error('❌ Test email endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
  console.log('Forgot password endpoint called');
  try {
    const { email } = req.body;
    console.log('Email received:', email);

    if (!email) {
      return sendErrorResponse(res, 400, 'Email is required');
    }

    // Find user by email
    const user = await Register.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    console.log('✅ User found:', user.name, '(', user.email, ')');

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set reset token and expiration (1 hour)
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/reset-password?token=${resetToken}`;

    // Email content
    const message = `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset for your RubberEco account.</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;

    // Send email (only if email configuration is available)
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        console.log('Email configuration found, attempting to send email...');
        console.log('EMAIL_USER:', process.env.EMAIL_USER);
        console.log('EMAIL_PASS length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 'undefined');

        const transporter = createEmailTransporter();

        // Test the connection first
        await transporter.verify();
        console.log('SMTP connection verified successfully');

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: 'RubberEco - Password Reset Request',
          html: message
        };

        console.log('Sending email to:', user.email);
        const result = await transporter.sendMail(mailOptions);
        console.log(`Password reset email sent successfully to: ${user.email}`);
        console.log('Email result:', result.messageId);
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        console.error('Error details:', emailError.message);
        console.error('Error code:', emailError.code);
        // Don't fail the request if email fails, just log it
        console.log(`Reset token for ${user.email}: ${resetToken}`);
        console.log(`Reset URL: ${resetUrl}`);
      }
    } else {
      // For development: log the reset token to console
      console.log('Email not configured. Reset token for development:');
      console.log(`Email: ${user.email}`);
      console.log(`Reset Token: ${resetToken}`);
      console.log(`Reset URL: ${resetUrl}`);
    }

    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    sendErrorResponse(res, 500, 'Server error during password reset request');
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return sendErrorResponse(res, 400, 'Token and new password are required');
    }

    if (password.length < 6) {
      return sendErrorResponse(res, 400, 'Password must be at least 6 characters long');
    }

    // Hash the token to compare with stored hash
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token
    const user = await Register.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return sendErrorResponse(res, 400, 'Invalid or expired reset token');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update user password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    sendErrorResponse(res, 500, 'Server error during password reset');
  }
};

// Check if user exists and fetch details for staff application
exports.checkUserExists = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return sendErrorResponse(res, 400, 'Email is required');
    }

    // Check if user exists in Register collection
    const existingUser = await Register.findOne({ email: email.toLowerCase() });
    
    if (existingUser) {
      return res.status(200).json({
        success: true,
        exists: true,
        user: {
          id: existingUser._id,
          name: existingUser.name,
          email: existingUser.email,
          phone: existingUser.phone || '',
          location: existingUser.location || '',
          isVerified: existingUser.isVerified,
          role: existingUser.role
        }
      });
    }

    // User not found
    return res.status(200).json({
      success: true,
      exists: false,
      message: 'User not found in our records'
    });

  } catch (error) {
    console.error('Check user exists error:', error);
    sendErrorResponse(res, 500, 'Server error while checking user');
  }
};

// Send welcome email for new brokers
exports.sendWelcomeEmail = async (email, name, userType = 'broker') => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const welcomeMessage = userType === 'broker'
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to RubberEco!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Your Broker Account is Being Reviewed</p>
          </div>

          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #2d3748; margin-bottom: 20px;">Hello ${name}!</h2>

            <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
              Thank you for registering as a broker on RubberEco! We're excited to have you join our platform connecting rubber farmers and brokers across Kerala.
            </p>

            <div style="background: #f7fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
              <h3 style="color: #2d3748; margin: 0 0 10px 0;">What's Next?</h3>
              <ul style="color: #4a5568; margin: 0; padding-left: 20px;">
                <li>Our team is reviewing your broker credentials</li>
                <li>You'll receive an email once your account is verified</li>
                <li>After verification, you can start bidding on rubber tree lots</li>
                <li>Connect with farmers and grow your business</li>
              </ul>
            </div>

            <div style="background: #e6fffa; padding: 20px; border-radius: 8px; border-left: 4px solid #38b2ac; margin: 20px 0;">
              <h3 style="color: #2d3748; margin: 0 0 10px 0;">Platform Features</h3>
              <ul style="color: #4a5568; margin: 0; padding-left: 20px;">
                <li>Browse and bid on rubber tree lots</li>
                <li>Direct communication with farmers</li>
                <li>Track your bidding history and success rate</li>
                <li>Professional dashboard for managing deals</li>
              </ul>
            </div>

            <p style="color: #4a5568; line-height: 1.6; margin: 20px 0;">
              If you have any questions, please don't hesitate to contact our support team.
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login"
                 style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Login to Your Account
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

            <p style="color: #a0aec0; font-size: 14px; text-align: center; margin: 0;">
              This email was sent from RubberEco. If you didn't create an account, please ignore this email.
            </p>
          </div>
        </div>
      `
      : `Welcome to RubberEco, ${name}! Your account has been created successfully.`;

    const mailOptions = {
      from: `"RubberEco Platform" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: userType === 'broker'
        ? '🎉 Welcome to RubberEco - Broker Account Under Review'
        : 'Welcome to RubberEco',
      html: welcomeMessage
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent to ${email}`);
    return true;

  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    return false;
  }
};