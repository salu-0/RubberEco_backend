const Razorpay = require('razorpay');

// Test the current Razorpay configuration
const razorpay = new Razorpay({
  key_id: 'rzp_test_R79jO6N4F99QLG',
  key_secret: 'HgKjdH7mCViwebMQTIFmbx7R'
});

async function testRazorpayKeys() {
  try {
    console.log('Testing Razorpay keys...');
    console.log('Key ID:', 'rzp_test_R79jO6N4F99QLG');
    
    // Try to create a test order
    const order = await razorpay.orders.create({
      amount: 100, // 1 rupee in paise
      currency: 'INR',
      receipt: 'test_order_' + Date.now()
    });
    
    console.log('✅ Razorpay keys are valid!');
    console.log('Test order created:', order.id);
    
  } catch (error) {
    console.log('❌ Razorpay keys are invalid or expired');
    console.log('Error:', error.message);
    console.log('Status Code:', error.statusCode);
    
    if (error.statusCode === 401) {
      console.log('\n🔧 Solution: You need to get new Razorpay test keys');
      console.log('1. Go to https://dashboard.razorpay.com/');
      console.log('2. Login to your Razorpay account');
      console.log('3. Go to Settings > API Keys');
      console.log('4. Generate new test keys');
      console.log('5. Update the .env file with the new keys');
    }
  }
}

testRazorpayKeys();

