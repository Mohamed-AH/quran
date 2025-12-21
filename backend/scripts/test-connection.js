/**
 * MongoDB Connection Test Script
 * Verifies MongoDB connection and displays database information
 *
 * Usage: node backend/scripts/test-connection.js
 */

const mongoose = require('mongoose');

// Load environment variables
require('dotenv').config();

async function testConnection() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hafiz-v2';

    console.log('🔄 Connecting to MongoDB...\n');

    // Hide password in output
    const safeUri = mongoUri.replace(/:[^:]*@/, ':****@');
    console.log('URI:', safeUri);

    // Connect
    await mongoose.connect(mongoUri);

    console.log('\n✅ Connected successfully!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Database Information:');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Name:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
    console.log('Port:', mongoose.connection.port);
    console.log('Ready State:', mongoose.connection.readyState, '(1 = connected)');

    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('Collections:');
    console.log('═══════════════════════════════════════════════════════');

    if (collections.length === 0) {
      console.log('⚠️  No collections found. Database is empty.');
      console.log('\n💡 Run this to create test data:');
      console.log('   node backend/scripts/create-test-data.js');
    } else {
      collections.forEach((collection, index) => {
        console.log(`${index + 1}. ${collection.name}`);
      });

      // Get document counts for each collection
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('Document Counts:');
      console.log('═══════════════════════════════════════════════════════');

      for (const collection of collections) {
        const count = await mongoose.connection.db
          .collection(collection.name)
          .countDocuments();
        console.log(`${collection.name.padEnd(20)} ${count} documents`);
      }
    }

    // Test read/write permissions
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('Testing Permissions:');
    console.log('═══════════════════════════════════════════════════════');

    try {
      // Try to write
      const testCollection = mongoose.connection.db.collection('_connection_test');
      await testCollection.insertOne({ test: true, timestamp: new Date() });
      console.log('✅ Write permission: OK');

      // Try to read
      const doc = await testCollection.findOne({ test: true });
      console.log('✅ Read permission: OK');

      // Clean up
      await testCollection.deleteOne({ _id: doc._id });
      console.log('✅ Delete permission: OK');
    } catch (permError) {
      console.error('❌ Permission error:', permError.message);
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected successfully\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection failed!\n');
    console.error('Error:', error.message);

    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 MongoDB is not running. Start it with:');
      console.log('   macOS: brew services start mongodb-community@7.0');
      console.log('   Linux: sudo systemctl start mongod');
      console.log('   Docker: docker start mongodb-hafiz');
    } else if (error.message.includes('Authentication failed')) {
      console.log('\n💡 Check your MongoDB credentials in .env file');
      console.log('   MONGODB_URI should include correct username/password');
    } else if (error.message.includes('MongoServerSelectionError')) {
      console.log('\n💡 Possible issues:');
      console.log('   1. MongoDB is not running');
      console.log('   2. Wrong connection string in .env');
      console.log('   3. Firewall blocking port 27017');
      console.log('   4. MongoDB Atlas IP whitelist (if using cloud)');
    }

    console.log('\n');
    process.exit(1);
  }
}

// Run the test
testConnection();
