const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Staff = require('../models/Staff');

// Protect routes - require authentication
const protect = async (req, res, next) => {
  try {
    console.log('🔐 Auth middleware called for:', req.method, req.path);
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    console.log('🔑 Token found:', !!token);
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }



    try {
      // Verify token with multiple possible secrets for compatibility
      const secretsToTry = [
        process.env.JWT_SECRET,
        'dev-insecure-secret-change-me', // current dev fallback
        'your-secret-key' // legacy fallback
      ].filter(Boolean);

      console.log('🔑 Verifying token with secret:', process.env.JWT_SECRET ? 'Present' : 'Missing');

      let decoded;
      let lastError;
      for (const secret of secretsToTry) {
        try {
          decoded = jwt.verify(token, secret);
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!decoded) {
        throw lastError || new Error('Token verification failed');
      }
      console.log('🔍 Decoded token:', { id: decoded.id, email: decoded.email, exp: decoded.exp });

      // Get user from database - check both User and Staff collections
      let user = await User.findById(decoded.id).select('-password');
      console.log('🔍 User found in User collection:', !!user);

      // If not found in User collection, check Staff collection
      if (!user) {
        user = await Staff.findById(decoded.id).select('-password');
        console.log('🔍 User found in Staff collection:', !!user);
        if (user) {
          console.log('🔍 Staff user details:', { id: user._id, name: user.name, email: user.email });
        }
      }

      // Also check Register collection for farmers
      if (!user) {
        const Register = require('../models/Register');
        user = await Register.findById(decoded.id).select('-password');
        console.log('🔍 User found in Register collection:', !!user);
        if (user) {
          console.log('🔍 Register user details:', { id: user._id, name: user.name, email: user.email });
        }
      }

      if (!user) {
        console.log('❌ User not found in either collection for ID:', decoded.id);
        return res.status(401).json({
          success: false,
          message: 'Token is valid but user not found'
        });
      }

      // Add user to request object
      req.user = user;
      next();
    } catch (error) {
      console.log('❌ Token verification failed:', error.message);
      console.log('🔍 Token that failed:', token.substring(0, 20) + '...');
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

// Admin only access
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
};

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Please login first.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}`
      });
    }

    next();
  };
};

module.exports = {
  protect,
  adminOnly,
  authorize
};