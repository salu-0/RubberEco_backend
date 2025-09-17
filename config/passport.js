const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const jwt = require('jsonwebtoken');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
   callbackURL: process.env.NODE_ENV === 'production'
    ? 'https://pgltndcmhubrebqgcdsr.supabase.co/auth/v1/callback' // Must match exactly
    : 'http://localhost:5173/auth/callback', // Or 5173 if using Vite
  proxy: true
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user exists by googleId or email
    let user = await User.findOne({ 
      $or: [
        { googleId: profile.id },
        { email: profile.emails[0].value }
      ]
    });

    if (!user) {
      // Create new user
      user = new User({
        googleId: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
        isVerified: true // Mark as verified since it's from Google
      });
      await user.save();
    } else if (!user.googleId) {
      // If user exists but doesn't have googleId, update it
      user.googleId = profile.id;
      await user.save();
    }

    done(null, user);
  } catch (error) {
    done(error, null);
  }
}));

// Serialize and deserialize user (simplified for JWT)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Helper function to generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '1h' }
  );
};

module.exports = {
  passport,
  generateToken,
};