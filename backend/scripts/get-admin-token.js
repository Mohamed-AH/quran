/**
 * Admin Token Generator
 * Generates a JWT token for an admin user for API testing
 *
 * Usage:
 * 1. First run create-test-data.js to create admin user
 * 2. Run this script: node backend/scripts/get-admin-token.js <admin-email>
 * 3. Copy the token for use in curl/API testing
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');

// Load environment variables
require('dotenv').config();

async function generateAdminToken() {
  try {
    const adminEmail = process.argv[2] || 'admin@test.com';

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hafiz-v2';
    await mongoose.connect(mongoUri);

    console.log('✅ Connected to MongoDB\n');

    // Find admin user
    const admin = await User.findOne({ email: adminEmail });

    if (!admin) {
      console.error(`❌ Admin user not found: ${adminEmail}`);
      console.log('\n💡 Run create-test-data.js first to create test users');
      process.exit(1);
    }

    if (admin.role !== 'admin') {
      console.error(`❌ User ${adminEmail} is not an admin (role: ${admin.role})`);
      process.exit(1);
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const token = jwt.sign(
      {
        userId: admin._id.toString(),
        email: admin.email,
        name: admin.name,
        role: admin.role
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    console.log('═══════════════════════════════════════════════════════');
    console.log('🔑 Admin Token Generated');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`User: ${admin.name} (${admin.email})`);
    console.log(`Role: ${admin.role}`);
    console.log(`ID: ${admin._id}`);
    console.log(`Expires: 7 days from now`);
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('📋 Token (copy this for API testing):\n');
    console.log(token);
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('💡 Usage Examples:\n');
    console.log('# Set as environment variable:');
    console.log(`export ADMIN_TOKEN="${token.substring(0, 50)}..."`);
    console.log('\n# Use in curl:');
    console.log('curl -X GET "http://localhost:5000/api/admin/settings" \\');
    console.log(`  -H "Authorization: Bearer ${token.substring(0, 30)}..." \\`);
    console.log('  -H "Content-Type: application/json"');
    console.log('\n# Use in browser console:');
    console.log(`localStorage.setItem('hafiz_token', '${token.substring(0, 30)}...');`);
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error generating token:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the script
generateAdminToken();
