/**
 * MongoDB Diagnostic Script
 * Helps identify authentication and connection issues
 *
 * Usage: node backend/scripts/diagnose-mongodb.js
 */

const { MongoClient } = require('mongodb');

async function diagnose() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hafiz-v2';

  console.log('🔍 MongoDB Diagnostic Tool\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('Testing Connection...');
  console.log('═══════════════════════════════════════════════════════\n');

  // Test 1: Basic connection
  console.log('Test 1: Basic Connection');
  const safeUri = mongoUri.replace(/:[^:]*@/, ':****@');
  console.log('URI:', safeUri, '\n');

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('✅ Connection established\n');

    // Test 2: Admin command (requires auth if enabled)
    console.log('Test 2: List Databases (admin command)');
    try {
      const adminDb = client.db().admin();
      const dbs = await adminDb.listDatabases();
      console.log('✅ Can list databases');
      console.log('   Databases:', dbs.databases.map(db => db.name).join(', '), '\n');
    } catch (error) {
      console.log('❌ Cannot list databases');
      console.log('   Error:', error.message);
      if (error.message.includes('authentication') || error.message.includes('requires authentication')) {
        console.log('   🔒 Authentication is ENABLED\n');
      }
    }

    // Test 3: Database operations
    console.log('Test 3: Database Operations');
    try {
      const db = client.db('hafiz-v2');
      const collections = await db.listCollections().toArray();
      console.log('✅ Can list collections');
      console.log('   Collections:', collections.map(c => c.name).join(', ') || 'None', '\n');
    } catch (error) {
      console.log('❌ Cannot list collections');
      console.log('   Error:', error.message, '\n');
    }

    // Test 4: Write operation
    console.log('Test 4: Write Permission');
    try {
      const db = client.db('hafiz-v2');
      const testCol = db.collection('_diagnostic_test');
      await testCol.insertOne({ test: true, timestamp: new Date() });
      console.log('✅ Can write to database');

      const doc = await testCol.findOne({ test: true });
      console.log('✅ Can read from database');

      await testCol.deleteOne({ _id: doc._id });
      console.log('✅ Can delete from database\n');
    } catch (error) {
      console.log('❌ Cannot write to database');
      console.log('   Error:', error.message, '\n');
    }

  } catch (error) {
    console.log('❌ Connection failed');
    console.log('Error:', error.message, '\n');

    if (error.message.includes('ECONNREFUSED')) {
      console.log('📋 Diagnosis: MongoDB is not running\n');
      console.log('Solutions:');
      console.log('  macOS: brew services start mongodb-community@7.0');
      console.log('  Linux: sudo systemctl start mongod');
      console.log('  Docker: docker run -d --name mongodb-hafiz -p 27017:27017 mongo:7.0\n');
    } else if (error.message.includes('authentication failed') || error.message.includes('auth')) {
      console.log('📋 Diagnosis: Authentication credentials are incorrect\n');
      console.log('Solutions:');
      console.log('  1. Check your .env file has correct username/password');
      console.log('  2. Connection string should be: mongodb://username:password@localhost:27017/hafiz-v2?authSource=admin\n');
    }
  } finally {
    await client.close();
  }

  // Recommendations
  console.log('═══════════════════════════════════════════════════════');
  console.log('Recommendations:');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!process.env.MONGODB_URI) {
    console.log('⚠️  No MONGODB_URI in .env file');
    console.log('   Using default: mongodb://localhost:27017/hafiz-v2\n');
  }

  console.log('For local testing, choose one:\n');
  console.log('Option 1: Docker (Easiest - No Auth Required)');
  console.log('  docker run -d --name mongodb-hafiz -p 27017:27017 mongo:7.0');
  console.log('  MONGODB_URI=mongodb://localhost:27017/hafiz-v2\n');

  console.log('Option 2: Local MongoDB without Auth');
  console.log('  Edit config file and disable security.authorization');
  console.log('  MONGODB_URI=mongodb://localhost:27017/hafiz-v2\n');

  console.log('Option 3: Local MongoDB with Auth');
  console.log('  Create user in MongoDB and use credentials');
  console.log('  MONGODB_URI=mongodb://admin:password123@localhost:27017/hafiz-v2?authSource=admin\n');

  console.log('Option 4: MongoDB Atlas (Cloud)');
  console.log('  Create free cluster at mongodb.com/cloud/atlas');
  console.log('  MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/hafiz-v2\n');
}

diagnose().catch(console.error);
