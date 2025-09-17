require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');

async function checkUser() {
  try {
    await connectDB();
    
    const Register = require('./models/Register');
    const User = require('./models/User');
    const Staff = require('./models/Staff');
    
    const userId = '68978a74b25679ccd28e21ae';
    const email = 'shalumanoj960@gmail.com';
    
    console.log('🔍 Checking user with ID:', userId);
    console.log('🔍 Checking user with email:', email);
    
    // Check by ID in all collections
    const userById = await User.findById(userId);
    const registerById = await Register.findById(userId);
    const staffById = await Staff.findById(userId);
    
    console.log('\n📋 Results by ID:');
    console.log('User collection:', userById ? '✅ Found' : '❌ Not found');
    console.log('Register collection:', registerById ? '✅ Found' : '❌ Not found');
    console.log('Staff collection:', staffById ? '✅ Found' : '❌ Not found');
    
    // Check by email in all collections
    const userByEmail = await User.findOne({ email });
    const registerByEmail = await Register.findOne({ email });
    const staffByEmail = await Staff.findOne({ email });
    
    console.log('\n📋 Results by email:');
    if (userByEmail) {
      console.log('User collection:', userByEmail._id, userByEmail.name, userByEmail.email);
    }
    if (registerByEmail) {
      console.log('Register collection:', registerByEmail._id, registerByEmail.name, registerByEmail.email);
    }
    if (staffByEmail) {
      console.log('Staff collection:', staffByEmail._id, staffByEmail.name, staffByEmail.email);
    }
    
    // If found by email but not by ID, we need to update the token
    const foundUser = userByEmail || registerByEmail || staffByEmail;
    if (foundUser && foundUser._id.toString() !== userId) {
      console.log('\n🔧 ID mismatch detected!');
      console.log('Token has ID:', userId);
      console.log('Database has ID:', foundUser._id.toString());
      
      // Generate new token with correct ID
      const jwt = require('jsonwebtoken');
      const newPayload = {
        id: foundUser._id.toString(),
        email: foundUser.email,
        role: foundUser.role || 'farmer'
      };
      
      const newToken = jwt.sign(newPayload, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' });
      
      console.log('\n🔑 New token generated:');
      console.log(newToken);
      console.log('\n📋 Update commands for browser console:');
      console.log(`localStorage.setItem('token', '${newToken}');`);
      console.log(`localStorage.setItem('user', '${JSON.stringify(newPayload)}');`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUser();