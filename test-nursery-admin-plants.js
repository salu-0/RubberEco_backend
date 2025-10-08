const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testNurseryAdminPlants() {
  try {
    console.log('🧪 Testing Nursery Admin Plant Fetching...\n');
    
    // Test credentials for GreenGrow Rubber Nursery
    const loginData = {
      email: 'greengrownursery@gmail.com',
      password: 'nursery@1'
    };
    
    console.log('1. Logging in as nursery admin...');
    const loginResponse = await fetch('http://localhost:5000/api/nursery-admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(loginData)
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    const loginResult = await loginResponse.json();
    console.log('✅ Login successful!');
    console.log(`   User: ${loginResult.user.name}`);
    console.log(`   Nursery Center: ${loginResult.user.nurseryCenterName}`);
    console.log(`   Token: ${loginResult.token ? 'Received' : 'Missing'}\n`);
    
    // Test fetching plants
    console.log('2. Fetching plants for this nursery center...');
    const plantsResponse = await fetch('http://localhost:5000/api/nursery-admin/plants', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${loginResult.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!plantsResponse.ok) {
      throw new Error(`Plants fetch failed: ${plantsResponse.status}`);
    }
    
    const plantsResult = await plantsResponse.json();
    console.log('✅ Plants fetched successfully!');
    console.log(`   Number of plants: ${plantsResult.data.length}`);
    
    if (plantsResult.data.length > 0) {
      console.log('   Plant details:');
      plantsResult.data.forEach((plant, index) => {
        console.log(`   ${index + 1}. ${plant.name} (${plant.variety})`);
        console.log(`      Stock: ${plant.stockAvailable}`);
        console.log(`      Price: ₹${plant.unitPrice}`);
        console.log(`      Description: ${plant.description}`);
      });
    } else {
      console.log('   ⚠️  No plants found for this nursery center');
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testNurseryAdminPlants();
