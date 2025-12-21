# MongoDB Testing Setup Guide

## Overview
This guide covers MongoDB setup and verification for testing the Hafiz admin panel and leaderboard features.

---

## Table of Contents
1. [MongoDB Installation Options](#mongodb-installation-options)
2. [Database Configuration](#database-configuration)
3. [Running Test Data Scripts](#running-test-data-scripts)
4. [Verification Queries](#verification-queries)
5. [MongoDB Compass (GUI Tool)](#mongodb-compass-gui-tool)
6. [Common Issues & Troubleshooting](#common-issues--troubleshooting)
7. [Reset & Cleanup](#reset--cleanup)

---

## MongoDB Installation Options

### Option 1: Local MongoDB (Recommended for Testing)

#### macOS
```bash
# Using Homebrew
brew tap mongodb/brew
brew install mongodb-community@7.0

# Start MongoDB
brew services start mongodb-community@7.0

# Verify it's running
mongosh --eval "db.version()"
```

#### Ubuntu/Debian
```bash
# Import MongoDB public GPG key
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify
mongosh --eval "db.version()"
```

#### Windows
```powershell
# Download installer from: https://www.mongodb.com/try/download/community
# Or use Chocolatey:
choco install mongodb

# Start MongoDB service
net start MongoDB

# Verify
mongosh --eval "db.version()"
```

### Option 2: Docker (Easiest for Testing)

```bash
# Pull MongoDB image
docker pull mongo:7.0

# Run MongoDB container
docker run -d \
  --name mongodb-hafiz \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password123 \
  -v mongodb_data:/data/db \
  mongo:7.0

# Verify it's running
docker ps | grep mongodb-hafiz

# Connect to MongoDB shell
docker exec -it mongodb-hafiz mongosh
```

### Option 3: MongoDB Atlas (Cloud - Production)

1. Sign up at https://www.mongodb.com/cloud/atlas
2. Create free cluster (M0 Sandbox)
3. Set up database user
4. Whitelist your IP address (0.0.0.0/0 for testing)
5. Get connection string:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/hafiz-v2?retryWrites=true&w=majority
   ```

---

## Database Configuration

### 1. Update Environment Variables

Create or update `backend/.env`:

```bash
# Local MongoDB
MONGODB_URI=mongodb://localhost:27017/hafiz-v2

# Docker MongoDB (if using authentication)
MONGODB_URI=mongodb://admin:password123@localhost:27017/hafiz-v2?authSource=admin

# MongoDB Atlas (cloud)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hafiz-v2?retryWrites=true&w=majority

# JWT Secret (for token generation)
JWT_SECRET=your-secret-key-change-in-production

# Server configuration
PORT=5000
NODE_ENV=development
```

### 2. Verify Connection

Create a test script: `backend/scripts/test-connection.js`

```javascript
const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hafiz-v2';

    console.log('🔄 Connecting to MongoDB...');
    console.log('URI:', mongoUri.replace(/:[^:]*@/, ':****@')); // Hide password

    await mongoose.connect(mongoUri);

    console.log('✅ Connected successfully!');
    console.log('Database:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
    console.log('Port:', mongoose.connection.port);

    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📁 Collections:', collections.map(c => c.name).join(', ') || 'None');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected successfully');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
```

Run it:
```bash
cd backend
node scripts/test-connection.js
```

---

## Running Test Data Scripts

### Step 1: Install Dependencies

```bash
cd backend
npm install
```

### Step 2: Run Test Data Generation

```bash
# This creates admin user, students, logs, juz, invite codes
node scripts/create-test-data.js
```

**Expected Output:**
```
✅ Connected to MongoDB
📝 Creating admin user...
✅ Created admin user: admin@test.com (ID: 67...)

📝 Creating test students...
✅ Created student: أحمد محمد (450 pages, 22 juz, 45 day streak)
✅ Created student: فاطمة علي (380 pages, 19 juz, 30 day streak)
...

📝 Initializing app settings...
✅ App settings initialized: { requireInviteCode: false, leaderboardEnabled: true }

📝 Creating invite codes...
✅ Created invite code: WELCOME2024 (10 uses, no expiration)
...

🎉 Test data created successfully!
```

### Step 3: Verify Data Was Created

```bash
# Connect to MongoDB shell
mongosh hafiz-v2

# Or if using Docker:
docker exec -it mongodb-hafiz mongosh hafiz-v2
```

---

## Verification Queries

### Connect to MongoDB Shell

```bash
# Local
mongosh hafiz-v2

# Docker
docker exec -it mongodb-hafiz mongosh hafiz-v2

# Atlas
mongosh "mongodb+srv://cluster.mongodb.net/hafiz-v2" --username your-username
```

### 1. Verify Collections Exist

```javascript
// Show all collections
show collections

// Should show:
// - users
// - logs
// - juz
// - invitecodes
// - appsettings
```

### 2. Check Users

```javascript
// Count total users
db.users.countDocuments()
// Expected: 11 (1 admin + 10 students)

// Find admin user
db.users.findOne({ role: 'admin' })

// List all users with key info
db.users.find({}, { name: 1, email: 1, role: 1 }).pretty()

// Check leaderboard settings
db.users.find(
  {},
  {
    name: 1,
    'settings.showOnLeaderboard': 1,
    'settings.leaderboardDisplayName': 1
  }
).pretty()

// Find users who opted out
db.users.find({ 'settings.showOnLeaderboard': false })

// Find users with custom display names
db.users.find({ 'settings.leaderboardDisplayName': { $ne: null } })
```

### 3. Check Logs (Daily Activity)

```javascript
// Count total logs
db.logs.countDocuments()
// Expected: Sum of all student streaks (e.g., 45+30+25+... ≈ 200+)

// Get recent logs
db.logs.find().sort({ date: -1 }).limit(5).pretty()

// Count logs per user
db.logs.aggregate([
  { $group: { _id: '$user', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])

// Check specific user's logs
db.logs.find({ user: ObjectId('USER_ID_HERE') }).sort({ date: -1 })
```

### 4. Check Juz Progress

```javascript
// Count total juz records
db.juz.countDocuments()
// Expected: Sum of completed juz (22+19+16+... ≈ 100+)

// Find completed juz
db.juz.find({ status: 'completed' }).count()

// Check user's juz progress (replace with actual user ID)
db.juz.find({ user: ObjectId('USER_ID_HERE') }).sort({ juzNumber: 1 })

// Get juz completion summary
db.juz.aggregate([
  { $group: { _id: '$status', count: { $sum: 1 } } }
])
```

### 5. Check Invite Codes

```javascript
// List all invite codes
db.invitecodes.find().pretty()

// Active codes only
db.invitecodes.find({ isActive: true })

// Check usage
db.invitecodes.find(
  {},
  { code: 1, maxUses: 1, usedCount: 1, isActive: 1 }
)

// Find expired codes
db.invitecodes.find({
  expiresAt: { $lt: new Date() },
  isActive: true
})
```

### 6. Check App Settings

```javascript
// View current settings
db.appsettings.findOne()

// Should show:
// {
//   requireInviteCode: false,
//   leaderboardEnabled: true
// }
```

### 7. Calculate Leaderboard (Manual Verification)

```javascript
// Aggregate leaderboard data (same logic as backend)
db.users.aggregate([
  // Only users who opted in
  { $match: { 'settings.showOnLeaderboard': { $ne: false } } },

  // Lookup juz data
  {
    $lookup: {
      from: 'juz',
      localField: '_id',
      foreignField: 'user',
      as: 'juzData'
    }
  },

  // Calculate stats
  {
    $project: {
      name: 1,
      displayName: { $ifNull: ['$settings.leaderboardDisplayName', '$name'] },
      totalPages: {
        $sum: {
          $map: {
            input: '$juzData',
            as: 'juz',
            in: '$$juz.pages'
          }
        }
      },
      completedJuz: {
        $size: {
          $filter: {
            input: '$juzData',
            as: 'juz',
            cond: { $eq: ['$$juz.status', 'completed'] }
          }
        }
      }
    }
  },

  // Sort by total pages
  { $sort: { totalPages: -1, completedJuz: -1 } },

  // Limit to top 10
  { $limit: 10 }
])
```

---

## MongoDB Compass (GUI Tool)

### 1. Install MongoDB Compass

Download from: https://www.mongodb.com/try/download/compass

### 2. Connect to Your Database

**Local MongoDB:**
```
mongodb://localhost:27017
```

**Docker:**
```
mongodb://admin:password123@localhost:27017/?authSource=admin
```

**Atlas:**
```
mongodb+srv://username:password@cluster.mongodb.net
```

### 3. Navigate and Explore

1. Select database: `hafiz-v2`
2. Browse collections:
   - `users` - View all users, search, filter
   - `logs` - Browse daily activity
   - `juz` - See progress data
   - `invitecodes` - Check codes
   - `appsettings` - View global settings

### 4. Useful Compass Features

- **Schema Analysis:** See data structure
- **Query Builder:** Visual query interface
- **Aggregation Pipeline Builder:** Build complex queries
- **Index Management:** View and create indexes
- **Export/Import:** Backup and restore data

---

## Common Issues & Troubleshooting

### Issue 1: "MongoServerError: Authentication failed"

**Solution:**
```bash
# If using Docker, ensure credentials match
docker exec -it mongodb-hafiz mongosh -u admin -p password123 --authenticationDatabase admin

# Update .env with correct credentials
MONGODB_URI=mongodb://admin:password123@localhost:27017/hafiz-v2?authSource=admin
```

### Issue 2: "MongooseServerSelectionError: connect ECONNREFUSED"

**Causes:**
- MongoDB not running
- Wrong port (default: 27017)
- Firewall blocking connection

**Solution:**
```bash
# Check if MongoDB is running
# macOS:
brew services list | grep mongodb

# Linux:
sudo systemctl status mongod

# Docker:
docker ps | grep mongodb

# Start MongoDB if not running
brew services start mongodb-community@7.0  # macOS
sudo systemctl start mongod                 # Linux
docker start mongodb-hafiz                  # Docker
```

### Issue 3: "Cannot find module 'mongoose'"

**Solution:**
```bash
cd backend
npm install
```

### Issue 4: Test Data Already Exists

The `create-test-data.js` script uses `findOneAndUpdate` with `upsert: true`, so running it multiple times will update existing data rather than creating duplicates.

To start fresh:
```javascript
// Connect to MongoDB shell
mongosh hafiz-v2

// Drop all collections
db.users.drop()
db.logs.drop()
db.juz.drop()
db.invitecodes.drop()
db.appsettings.drop()

// Exit and run script again
exit
```

```bash
node scripts/create-test-data.js
```

### Issue 5: "User ID not found" when generating token

**Solution:**
```bash
# Find admin user ID first
mongosh hafiz-v2 --eval "db.users.findOne({role: 'admin'}, {_id: 1, email: 1})"

# Then generate token
node scripts/get-admin-token.js admin@test.com
```

### Issue 6: Atlas Connection Timeout

**Solution:**
1. Whitelist your IP in Atlas dashboard
2. Or allow access from anywhere: `0.0.0.0/0` (testing only!)
3. Check connection string format:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/hafiz-v2
   ```

---

## Reset & Cleanup

### Reset All Test Data

```javascript
// MongoDB shell
use hafiz-v2

// Drop entire database
db.dropDatabase()

// Verify
show dbs  // hafiz-v2 should be gone
```

Then re-run:
```bash
node scripts/create-test-data.js
```

### Reset Specific Collections

```javascript
// MongoDB shell
use hafiz-v2

// Drop individual collections
db.users.drop()
db.logs.drop()
db.juz.drop()
db.invitecodes.drop()
db.appsettings.drop()
```

### Clean Up Specific User

```javascript
// Find user ID
const user = db.users.findOne({ email: 'test@example.com' })

// Delete user and all their data
db.logs.deleteMany({ user: user._id })
db.juz.deleteMany({ user: user._id })
db.users.deleteOne({ _id: user._id })
```

---

## Advanced Testing Queries

### 1. Simulate Leaderboard Cache Refresh

```javascript
// This mimics what the backend does
const leaderboard = db.users.aggregate([
  { $match: { 'settings.showOnLeaderboard': { $ne: false } } },
  {
    $lookup: {
      from: 'juz',
      let: { userId: '$_id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$user', '$$userId'] } } },
        {
          $group: {
            _id: null,
            totalPages: { $sum: '$pages' },
            completedJuz: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            }
          }
        }
      ],
      as: 'juzStats'
    }
  },
  {
    $lookup: {
      from: 'logs',
      let: { userId: '$_id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$user', '$$userId'] } } },
        { $sort: { date: -1 } },
        { $limit: 100 }
      ],
      as: 'recentLogs'
    }
  },
  {
    $project: {
      userId: '$_id',
      name: { $ifNull: ['$settings.leaderboardDisplayName', '$name'] },
      totalPages: { $ifNull: [{ $arrayElemAt: ['$juzStats.totalPages', 0] }, 0] },
      completedJuz: { $ifNull: [{ $arrayElemAt: ['$juzStats.completedJuz', 0] }, 0] },
      streak: 0 // Streak calculation complex, simplified here
    }
  },
  { $sort: { totalPages: -1, completedJuz: -1 } }
])

leaderboard.forEach(printjson)
```

### 2. Test Invite Code Usage

```javascript
// Find an active code
const code = db.invitecodes.findOne({ code: 'WELCOME2024' })

// Simulate usage (replace USER_ID with actual new user ID)
db.invitecodes.updateOne(
  { _id: code._id },
  {
    $inc: { usedCount: 1 },
    $push: {
      usedBy: {
        user: ObjectId('USER_ID_HERE'),
        usedAt: new Date()
      }
    }
  }
)

// Verify
db.invitecodes.findOne({ code: 'WELCOME2024' })
```

### 3. Check Data Consistency

```javascript
// Users without any activity
db.users.aggregate([
  {
    $lookup: {
      from: 'logs',
      localField: '_id',
      foreignField: 'user',
      as: 'logs'
    }
  },
  { $match: { logs: { $size: 0 } } },
  { $project: { name: 1, email: 1 } }
])

// Juz marked complete but < 20 pages
db.juz.find({
  status: 'completed',
  pages: { $lt: 20 }
})

// Users with logs but no juz records
db.users.aggregate([
  {
    $lookup: {
      from: 'logs',
      localField: '_id',
      foreignField: 'user',
      as: 'logs'
    }
  },
  {
    $lookup: {
      from: 'juz',
      localField: '_id',
      foreignField: 'user',
      as: 'juz'
    }
  },
  {
    $match: {
      $and: [
        { logs: { $ne: [] } },
        { juz: { $size: 0 } }
      ]
    }
  },
  { $project: { name: 1, email: 1, logCount: { $size: '$logs' } } }
])
```

---

## Quick Reference Commands

```bash
# Start MongoDB (choose one)
brew services start mongodb-community@7.0  # macOS
sudo systemctl start mongod                 # Linux
docker start mongodb-hafiz                  # Docker

# Connect to shell
mongosh hafiz-v2

# Generate test data
cd backend
node scripts/create-test-data.js

# Get admin token
node scripts/get-admin-token.js

# Test API
bash scripts/test-api.sh $ADMIN_TOKEN

# Verify data
mongosh hafiz-v2 --eval "db.users.countDocuments()"
mongosh hafiz-v2 --eval "db.logs.countDocuments()"
mongosh hafiz-v2 --eval "db.juz.countDocuments()"

# Reset database
mongosh hafiz-v2 --eval "db.dropDatabase()"
```

---

## Next Steps

1. ✅ Install MongoDB
2. ✅ Configure connection in `.env`
3. ✅ Test connection with `test-connection.js`
4. ✅ Generate test data with `create-test-data.js`
5. ✅ Verify data using MongoDB shell or Compass
6. ✅ Get admin token with `get-admin-token.js`
7. ✅ Run API tests with `test-api.sh`
8. ✅ Test frontend manually (see TESTING.md)

---

**Last Updated:** 2025-12-21
