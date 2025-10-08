const jwt = require('jsonwebtoken');

// Middleware to prevent nursery admin access to regular user routes
const preventNurseryAdminAccess = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return next(); // No token, let other middleware handle authentication
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // If the token belongs to a nursery admin, deny access to regular user routes
    if (decoded.role === 'nursery_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Nursery admins can only access their dashboard.'
      });
    }
    
    // If it's a regular user token, allow access
    req.user = decoded;
    next();
  } catch (error) {
    // Token is invalid, let other middleware handle it
    next();
  }
};

// Middleware to ensure only nursery admins can access nursery admin routes
const requireNurseryAdmin = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    console.log('🔍 Decoded token:', decoded);
    
    if (decoded.role !== 'nursery_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Nursery admin privileges required.'
      });
    }
    
    req.user = decoded;
    console.log('✅ Set req.user:', req.user);
    next();
  } catch (error) {
    console.error('❌ Token verification error:', error);
    res.status(400).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

module.exports = {
  preventNurseryAdminAccess,
  requireNurseryAdmin
};
