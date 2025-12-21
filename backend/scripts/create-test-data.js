/**
 * Test Data Generation Script
 * Creates sample users, logs, juz, invite codes, and settings for testing
 *
 * Usage: node backend/scripts/create-test-data.js
 */

const mongoose = require('mongoose');
const User = require('../src/models/User');
const Log = require('../src/models/Log');
const Juz = require('../src/models/Juz');
const AppSettings = require('../src/models/AppSettings');
const InviteCode = require('../src/models/InviteCode');

// Load environment variables
require('dotenv').config();

async function createTestData() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hafiz-v2';
    await mongoose.connect(mongoUri);

    console.log('✅ Connected to MongoDB');
    console.log('⚠️  This will create test data in your database\n');

    // 1. Create admin user
    console.log('📝 Creating admin user...');
    const admin = await User.findOneAndUpdate(
      { email: 'admin@test.com' },
      {
        name: 'Admin User',
        email: 'admin@test.com',
        oauthProvider: 'google',
        oauthId: 'admin-test-id-' + Date.now(),
        role: 'admin',
        settings: {
          language: 'en',
          theme: 'dark',
          showOnLeaderboard: true,
          leaderboardDisplayName: 'Admin'
        }
      },
      { upsert: true, new: true }
    );
    console.log(`✅ Created admin user: ${admin.email} (ID: ${admin._id})`);

    // 2. Create test students with varying progress
    console.log('\n📝 Creating test students...');
    const students = [
      { name: 'أحمد محمد', email: 'ahmad@test.com', pages: 450, juz: 22, streak: 45, show: true, displayName: null },
      { name: 'فاطمة علي', email: 'fatima@test.com', pages: 380, juz: 19, streak: 30, show: true, displayName: 'الطالبة المجتهدة' },
      { name: 'محمد خالد', email: 'mohammed@test.com', pages: 320, juz: 16, streak: 25, show: true, displayName: null },
      { name: 'عائشة حسن', email: 'aisha@test.com', pages: 280, juz: 14, streak: 20, show: true, displayName: null },
      { name: 'يوسف إبراهيم', email: 'yusuf@test.com', pages: 240, juz: 12, streak: 18, show: true, displayName: null },
      { name: 'مريم أحمد', email: 'mariam@test.com', pages: 200, juz: 10, streak: 15, show: false, displayName: null }, // Opted out
      { name: 'عمر سعيد', email: 'omar@test.com', pages: 150, juz: 7, streak: 10, show: true, displayName: null },
      { name: 'خديجة رشيد', email: 'khadija@test.com', pages: 100, juz: 5, streak: 8, show: true, displayName: null },
      { name: 'علي حسين', email: 'ali@test.com', pages: 60, juz: 3, streak: 5, show: true, displayName: 'نجم القرآن' },
      { name: 'نور الدين', email: 'nour@test.com', pages: 20, juz: 1, streak: 3, show: true, displayName: null }
    ];

    for (const student of students) {
      const user = await User.findOneAndUpdate(
        { email: student.email },
        {
          name: student.name,
          email: student.email,
          oauthProvider: 'google',
          oauthId: `test-${student.email}-${Date.now()}`,
          role: 'user',
          settings: {
            language: 'ar',
            theme: 'dark',
            showOnLeaderboard: student.show,
            leaderboardDisplayName: student.displayName
          }
        },
        { upsert: true, new: true }
      );

      // Create Juz progress for each student
      const completedJuzCount = student.juz;
      for (let i = 1; i <= completedJuzCount; i++) {
        await Juz.findOneAndUpdate(
          { user: user._id, juzNumber: i },
          {
            user: user._id,
            juzNumber: i,
            status: 'completed',
            pages: 20,
            startDate: new Date(Date.now() - (completedJuzCount - i) * 7 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() - (completedJuzCount - i) * 7 * 24 * 60 * 60 * 1000 + 5 * 24 * 60 * 60 * 1000)
          },
          { upsert: true, new: true }
        );
      }

      // Create daily logs for streak
      for (let i = 0; i < student.streak; i++) {
        const logDate = new Date();
        logDate.setDate(logDate.getDate() - i);
        logDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues

        await Log.findOneAndUpdate(
          {
            user: user._id,
            date: {
              $gte: new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate(), 0, 0, 0),
              $lt: new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate(), 23, 59, 59)
            }
          },
          {
            user: user._id,
            date: logDate,
            newPages: `${Math.floor(Math.random() * 5) + 1}-${Math.floor(Math.random() * 5) + 6}`,
            newRating: Math.floor(Math.random() * 2) + 4,
            reviewPages: `${Math.floor(Math.random() * 10) + 1}-${Math.floor(Math.random() * 10) + 11}`,
            reviewRating: Math.floor(Math.random() * 2) + 3,
            notes: 'Test log entry for testing purposes'
          },
          { upsert: true, new: true }
        );
      }

      console.log(`✅ Created student: ${student.name} (${student.pages} pages, ${student.juz} juz, ${student.streak} day streak)`);
    }

    // 3. Initialize app settings
    console.log('\n📝 Initializing app settings...');
    const settings = await AppSettings.findOneAndUpdate(
      {},
      {
        requireInviteCode: false,
        leaderboardEnabled: true
      },
      { upsert: true, new: true }
    );
    console.log('✅ App settings initialized:', {
      requireInviteCode: settings.requireInviteCode,
      leaderboardEnabled: settings.leaderboardEnabled
    });

    // 4. Create sample invite codes
    console.log('\n📝 Creating invite codes...');
    const inviteCodes = [
      {
        code: 'WELCOME2024',
        maxUses: 10,
        description: 'Welcome code for new students',
        expiresAt: null
      },
      {
        code: 'TRIAL123',
        maxUses: 5,
        description: 'Trial institution access',
        expiresAt: null
      },
      {
        code: 'ADMIN001',
        maxUses: 1,
        description: 'Single-use admin code',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      },
      {
        code: 'EXPIRED99',
        maxUses: 10,
        description: 'Expired code for testing',
        expiresAt: new Date('2024-01-01') // Past date
      }
    ];

    for (const code of inviteCodes) {
      await InviteCode.findOneAndUpdate(
        { code: code.code },
        {
          ...code,
          createdBy: admin._id,
          usedCount: 0,
          usedBy: [],
          isActive: true
        },
        { upsert: true, new: true }
      );
      console.log(`✅ Created invite code: ${code.code} (${code.maxUses} uses, ${code.expiresAt ? 'expires: ' + code.expiresAt.toISOString().split('T')[0] : 'no expiration'})`);
    }

    console.log('\n\n🎉 Test data created successfully!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 Summary:');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`✅ Admin User: admin@test.com (ID: ${admin._id})`);
    console.log(`✅ Student Users: ${students.length} users`);
    console.log(`✅ Invite Codes: ${inviteCodes.length} codes`);
    console.log(`✅ App Settings: Configured`);
    console.log('\n📧 Test Accounts:');
    console.log('   Admin: admin@test.com');
    console.log('   Students: ahmad@test.com, fatima@test.com, mohammed@test.com, etc.');
    console.log('\n🎟️  Invite Codes:');
    console.log('   Active: WELCOME2024, TRIAL123, ADMIN001');
    console.log('   Expired: EXPIRED99 (for testing)');
    console.log('\n💡 Next Steps:');
    console.log('   1. Start your backend server: npm run dev');
    console.log('   2. Login with any test account via OAuth');
    console.log('   3. Use admin@test.com for admin panel access');
    console.log('   4. Check leaderboard to see rankings');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error creating test data:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');
  }
}

// Run the script
createTestData();
