const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const User = require('../src/models/User');

async function checkUserSettings() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all users with their settings
    const users = await User.find({}).select('name email settings');

    console.log('=== ALL USERS AND THEIR SETTINGS ===\n');

    users.forEach((user, index) => {
      console.log(`User ${index + 1}:`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Settings:`, JSON.stringify(user.settings, null, 2));
      console.log('');
    });

    console.log('\n=== USERS VISIBLE ON LEADERBOARD ===\n');
    const visibleUsers = await User.find({ 'settings.showOnLeaderboard': true }).select('name settings');
    console.log(`Count: ${visibleUsers.length}`);
    visibleUsers.forEach(user => {
      const displayName = user.settings.leaderboardDisplayName || user.name;
      console.log(`  - ${user.name} (displays as: "${displayName}")`);
    });

    console.log('\n=== USERS HIDDEN FROM LEADERBOARD ===\n');
    const hiddenUsers = await User.find({ 'settings.showOnLeaderboard': false }).select('name settings');
    console.log(`Count: ${hiddenUsers.length}`);
    hiddenUsers.forEach(user => {
      console.log(`  - ${user.name}`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Connection closed');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUserSettings();
