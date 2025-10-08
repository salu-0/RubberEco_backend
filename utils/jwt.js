const jwt = require('jsonwebtoken');

// Helper function to generate JWT token
const generateToken = (user, role = null) => {
  const payload = { 
    id: user._id, 
    email: user.email 
  };
  
  // Add role if provided or if user has a role property
  if (role) {
    payload.role = role;
  } else if (user.role) {
    payload.role = user.role;
  }
  
  return jwt.sign(
    payload,
    process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
    { expiresIn: process.env.JWT_EXPIRE || '1h' }
  );
};

module.exports = {
  generateToken
};
