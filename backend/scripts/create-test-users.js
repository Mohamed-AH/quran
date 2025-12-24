/**
 * Create Test Users Script
 * Adds multiple test users to test pagination in admin panel
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');

// Generate random name from pool
const firstNames = [
  'أحمد', 'محمد', 'فاطمة', 'عائشة', 'علي', 'حسن', 'حسين', 'خديجة',
  'عمر', 'عثمان', 'زينب', 'رقية', 'يوسف', 'إبراهيم', 'مريم', 'سارة',
  'عبدالله', 'عبدالرحمن', 'نور', 'ليلى', 'سلمى', 'آمنة', 'جعفر', 'طارق',
  'هند', 'سعيد', 'كريم', 'رشيد', 'نادية', 'لطيفة', 'منال', 'سمير'
];

const lastNames = [
  'محمد', 'أحمد', 'علي', 'حسن', 'حسين', 'عمر', 'خالد', 'سعيد',
  'إبراهيم', 'يوسف', 'موسى', 'عيسى', 'داود', 'سليمان', 'إسماعيل', 'إسحاق',
  'يعقوب', 'رشيد', 'كريم', 'ناصر', 'منصور', 'فاروق', 'صادق', 'طاهر'
];

function randomName() {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${firstName} ${lastName}`;
}

function randomRole() {
  // 90% users, 10% admins
  return Math.random() < 0.9 ? 'user' : 'admin';
}

function randomLanguage() {
  return Math.random() < 0.7 ? 'ar' : 'en';
}

async function createTestUsers(count = 50) {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB:', mongoose.connection.db.databaseName);

    console.log(`\n📝 Creating ${count} test users...`);

    const users = [];
    for (let i = 1; i <= count; i++) {
      const name = randomName();
      const role = randomRole();
      const language = randomLanguage();

      users.push({
        email: `test${i}@example.com`,
        name: name,
        profilePicture: null,
        authProvider: 'google',
        authProviderId: `test_${i}_${Date.now()}`,
        role: role,
        settings: {
          language: language,
          theme: 'default',
          showOnLeaderboard: Math.random() < 0.8, // 80% visible
          leaderboardDisplayName: null
        },
        lastLoginAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Random within last 30 days
      });

      if (i % 10 === 0) {
        console.log(`  Created ${i}/${count} users...`);
      }
    }

    // Insert all users at once
    await User.insertMany(users);

    console.log(`\n✅ Successfully created ${count} test users!`);

    // Show summary
    const totalUsers = await User.countDocuments();
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    const totalRegularUsers = await User.countDocuments({ role: 'user' });

    console.log('\n📊 Database Summary:');
    console.log(`   Total Users: ${totalUsers}`);
    console.log(`   Admins: ${totalAdmins}`);
    console.log(`   Regular Users: ${totalRegularUsers}`);

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Get count from command line argument or default to 50
const count = parseInt(process.argv[2]) || 50;

console.log(`
╔════════════════════════════════════════╗
║   Create Test Users for Pagination    ║
╚════════════════════════════════════════╝
`);

createTestUsers(count);
