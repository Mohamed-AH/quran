# Admin Panel & Leaderboard Testing Guide

## Overview
This document provides comprehensive testing procedures for the newly implemented Admin Panel and Leaderboard features.

**Branch:** `claude/plan-quran-app-updates-D7zEz`
**Features:**
- Admin Panel with global settings control
- User management (promote, demote, delete)
- Invite code system for signup control
- Global leaderboard with privacy settings
- Opt-out privacy controls

---

## Table of Contents
1. [Pre-Testing Setup](#pre-testing-setup)
2. [Backend API Testing](#backend-api-testing)
3. [Admin Panel Testing](#admin-panel-testing)
4. [Leaderboard Testing](#leaderboard-testing)
5. [Privacy Settings Testing](#privacy-settings-testing)
6. [Integration Testing](#integration-testing)
7. [Edge Cases & Error Scenarios](#edge-cases--error-scenarios)
8. [Performance Testing](#performance-testing)

---

## Pre-Testing Setup

### 1. Environment Setup

```bash
# Ensure you're on the correct branch
git checkout claude/plan-quran-app-updates-D7zEz
git pull origin claude/plan-quran-app-updates-D7zEz

# Install dependencies
cd backend
npm install

# Start MongoDB (if not running)
# mongod --dbpath /path/to/your/data

# Start the backend server
npm run dev
```

### 2. Create Test Data

```bash
# Create test script: backend/scripts/create-test-data.js
```

Create this file with the following content:

```javascript
// backend/scripts/create-test-data.js
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Log = require('../src/models/Log');
const Juz = require('../src/models/Juz');
const AppSettings = require('../src/models/AppSettings');
const InviteCode = require('../src/models/InviteCode');

async function createTestData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hafiz-v2', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB');

    // 1. Create admin user
    const admin = await User.findOneAndUpdate(
      { email: 'admin@test.com' },
      {
        name: 'Admin User',
        email: 'admin@test.com',
        oauthProvider: 'google',
        oauthId: 'admin-test-id',
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
    console.log('✅ Created admin user:', admin.email);

    // 2. Create test students with varying progress
    const students = [
      { name: 'أحمد محمد', email: 'ahmad@test.com', pages: 450, juz: 22, streak: 45, show: true },
      { name: 'فاطمة علي', email: 'fatima@test.com', pages: 380, juz: 19, streak: 30, show: true },
      { name: 'محمد خالد', email: 'mohammed@test.com', pages: 320, juz: 16, streak: 25, show: true },
      { name: 'عائشة حسن', email: 'aisha@test.com', pages: 280, juz: 14, streak: 20, show: true },
      { name: 'يوسف إبراهيم', email: 'yusuf@test.com', pages: 240, juz: 12, streak: 18, show: true },
      { name: 'مريم أحمد', email: 'mariam@test.com', pages: 200, juz: 10, streak: 15, show: false }, // Hidden
      { name: 'عمر سعيد', email: 'omar@test.com', pages: 150, juz: 7, streak: 10, show: true },
      { name: 'خديجة رشيد', email: 'khadija@test.com', pages: 100, juz: 5, streak: 8, show: true },
      { name: 'علي حسين', email: 'ali@test.com', pages: 60, juz: 3, streak: 5, show: true },
      { name: 'نور الدين', email: 'nour@test.com', pages: 20, juz: 1, streak: 3, show: true }
    ];

    for (const student of students) {
      const user = await User.findOneAndUpdate(
        { email: student.email },
        {
          name: student.name,
          email: student.email,
          oauthProvider: 'google',
          oauthId: `test-${student.email}`,
          role: 'user',
          settings: {
            language: 'ar',
            theme: 'dark',
            showOnLeaderboard: student.show,
            leaderboardDisplayName: null
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

        await Log.findOneAndUpdate(
          { user: user._id, date: { $gte: new Date(logDate.setHours(0, 0, 0, 0)), $lt: new Date(logDate.setHours(23, 59, 59, 999)) } },
          {
            user: user._id,
            date: logDate,
            newPages: `${Math.floor(Math.random() * 5) + 1}-${Math.floor(Math.random() * 5) + 6}`,
            newRating: Math.floor(Math.random() * 2) + 4,
            reviewPages: `${Math.floor(Math.random() * 10) + 1}-${Math.floor(Math.random() * 10) + 11}`,
            reviewRating: Math.floor(Math.random() * 2) + 3,
            notes: 'Test log entry'
          },
          { upsert: true, new: true }
        );
      }

      console.log(`✅ Created student: ${student.name}`);
    }

    // 3. Initialize app settings
    const settings = await AppSettings.findOneAndUpdate(
      {},
      {
        requireInviteCode: false,
        leaderboardEnabled: true
      },
      { upsert: true, new: true }
    );
    console.log('✅ Initialized app settings:', settings);

    // 4. Create sample invite codes
    const inviteCodes = [
      { code: 'WELCOME2024', maxUses: 10, description: 'Welcome code for new students' },
      { code: 'TRIAL123', maxUses: 5, description: 'Trial institution access' },
      { code: 'ADMIN001', maxUses: 1, description: 'Single-use admin code', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
    ];

    for (const code of inviteCodes) {
      await InviteCode.findOneAndUpdate(
        { code: code.code },
        {
          ...code,
          createdBy: admin._id,
          isActive: true
        },
        { upsert: true, new: true }
      );
      console.log(`✅ Created invite code: ${code.code}`);
    }

    console.log('\n🎉 Test data created successfully!');
    console.log('\nTest Accounts:');
    console.log('Admin: admin@test.com');
    console.log('Students: ahmad@test.com, fatima@test.com, mohammed@test.com, etc.');
    console.log('\nInvite Codes: WELCOME2024, TRIAL123, ADMIN001');

  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

createTestData();
```

Run the test data script:

```bash
cd backend
node scripts/create-test-data.js
```

### 3. Get Authentication Token

```bash
# Method 1: Login via browser and extract token from localStorage
# 1. Open browser console on localhost:5000
# 2. Run: localStorage.getItem('hafiz_token')

# Method 2: Create a test token script
# Create backend/scripts/get-admin-token.js
```

```javascript
// backend/scripts/get-admin-token.js
const jwt = require('jsonwebtoken');

const adminUser = {
  _id: 'YOUR_ADMIN_USER_ID_HERE', // Replace with actual ID after running create-test-data.js
  email: 'admin@test.com',
  name: 'Admin User',
  role: 'admin'
};

const token = jwt.sign(
  adminUser,
  process.env.JWT_SECRET || 'your-secret-key-here',
  { expiresIn: '7d' }
);

console.log('Admin Token:');
console.log(token);
```

---

## Backend API Testing

### Setup for API Tests

```bash
# Save your token as an environment variable
export ADMIN_TOKEN="your-admin-token-here"
export USER_TOKEN="your-user-token-here"
export API_BASE="http://localhost:5000/api"
```

### 1. App Settings API

#### Get App Settings
```bash
curl -X GET "$API_BASE/admin/settings" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "settings": {
    "requireInviteCode": false,
    "leaderboardEnabled": true
  }
}
```

#### Update App Settings
```bash
# Enable signup control and disable leaderboard
curl -X PATCH "$API_BASE/admin/settings" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requireInviteCode": true,
    "leaderboardEnabled": false
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "settings": {
    "requireInviteCode": true,
    "leaderboardEnabled": false
  }
}
```

#### Test Non-Admin Access (Should Fail)
```bash
curl -X PATCH "$API_BASE/admin/settings" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"requireInviteCode": true}'
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Admin access required"
}
```

### 2. User Management API

#### Get All Users
```bash
curl -X GET "$API_BASE/admin/users?page=1&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### Get User Details
```bash
curl -X GET "$API_BASE/admin/users/USER_ID_HERE" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### Promote User to Admin
```bash
curl -X PUT "$API_BASE/admin/users/USER_ID_HERE/role" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

#### Demote User to Regular User
```bash
curl -X PUT "$API_BASE/admin/users/USER_ID_HERE/role" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "user"}'
```

#### Delete User
```bash
curl -X DELETE "$API_BASE/admin/users/USER_ID_HERE" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 3. Invite Code API

#### Get All Invite Codes
```bash
curl -X GET "$API_BASE/admin/invite-codes" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### Create Invite Code
```bash
curl -X POST "$API_BASE/admin/invite-codes" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "maxUses": 5,
    "expiresAt": "2025-12-31",
    "description": "Test code for QA"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "inviteCode": {
    "_id": "...",
    "code": "ABC123XYZ",
    "maxUses": 5,
    "usedCount": 0,
    "isActive": true,
    "description": "Test code for QA"
  }
}
```

#### Deactivate Invite Code
```bash
curl -X PUT "$API_BASE/admin/invite-codes/INVITE_CODE_ID/deactivate" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### Delete Invite Code
```bash
curl -X DELETE "$API_BASE/admin/invite-codes/INVITE_CODE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 4. Leaderboard API

#### Get Leaderboard (When Enabled)
```bash
curl -X GET "$API_BASE/leaderboard?limit=25" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "leaderboard": [
    {
      "userId": "...",
      "name": "أحمد محمد",
      "rank": 1,
      "totalPages": 450,
      "completedJuz": 22,
      "streak": 45
    }
  ],
  "cached": true,
  "lastUpdated": "2025-12-21T..."
}
```

#### Get My Rank
```bash
curl -X GET "$API_BASE/leaderboard/me" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "onLeaderboard": true,
  "rank": 5,
  "totalUsers": 10,
  "stats": {
    "totalPages": 240,
    "completedJuz": 12,
    "streak": 18
  }
}
```

#### Test Leaderboard When Disabled
```bash
# First disable leaderboard via admin settings
curl -X PATCH "$API_BASE/admin/settings" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"leaderboardEnabled": false}'

# Then try to access leaderboard
curl -X GET "$API_BASE/leaderboard" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Leaderboard is currently disabled"
}
```

#### Refresh Leaderboard Cache (Admin Only)
```bash
curl -X POST "$API_BASE/leaderboard/refresh" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 5. Dashboard Stats API

```bash
curl -X GET "$API_BASE/admin/dashboard/stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "stats": {
    "totalUsers": 11,
    "activeUsers": 10,
    "totalPages": 2700,
    "totalJuz": 129,
    "avgPagesPerUser": 245,
    "avgJuzPerUser": 11.7,
    "recentActivity": {
      "last7Days": 8,
      "last30Days": 11
    }
  }
}
```

---

## Admin Panel Testing

### Test Checklist

#### 1. Access Control
- [ ] Non-admin users cannot access `/admin.html`
- [ ] Admin users can access admin panel
- [ ] Unauthorized API requests return 403 errors

#### 2. Global Settings

**Test: Signup Control Toggle**
1. Navigate to admin panel
2. Toggle "Signup Control" OFF → ON
3. Verify toggle state changes
4. Open new incognito window
5. Try to register → Should require invite code
6. Toggle back to OFF
7. Try to register → Should allow without invite code

**Test: Leaderboard Toggle**
1. Toggle "Leaderboard" ON → OFF
2. Switch to regular user account
3. Navigate to leaderboard tab
4. Should see "Leaderboard is currently disabled"
5. Switch back to admin
6. Toggle leaderboard back ON
7. User should now see leaderboard

#### 3. Dashboard Statistics

**Manual Test:**
1. Open admin panel
2. Verify all statistics display correctly:
   - [ ] Total Users count
   - [ ] Active Users count
   - [ ] Total Pages count
   - [ ] Completed Juz count
3. Compare with database counts:
```javascript
// Run in MongoDB shell
db.users.countDocuments()
db.logs.aggregate([{$group: {_id: null, totalPages: {$sum: "$pages"}}}])
```

#### 4. User Management

**Test: View Users**
- [ ] User table loads with data
- [ ] Pagination works (if > 10 users)
- [ ] Search by name/email filters correctly
- [ ] Filter by role (all/admin/user) works

**Test: View User Details**
1. Click "View" on any user
2. Verify modal shows:
   - [ ] User name, email, role
   - [ ] Total pages, completed juz, streak
   - [ ] Join date and last activity

**Test: Promote User**
1. Select a regular user
2. Click "View" → "Promote to Admin"
3. Confirm action
4. Verify:
   - [ ] User role changes to "admin"
   - [ ] User can now access admin panel
   - [ ] Badge shows "admin"

**Test: Demote Admin**
1. Select an admin user (not yourself)
2. Click "Demote to User"
3. Confirm action
4. Verify:
   - [ ] User role changes to "user"
   - [ ] User loses admin panel access

**Test: Delete User**
1. Select a test user
2. Click "Delete"
3. Confirm with user name
4. Verify:
   - [ ] User removed from list
   - [ ] User's logs and juz data deleted
   - [ ] Cannot login with that account

**Test: Cannot Delete Last Admin**
1. Ensure only one admin exists
2. Try to delete that admin
3. Should show error: "Cannot delete the last admin user"

**Test: Cannot Demote Last Admin**
1. Ensure only one admin exists
2. Try to demote that admin
3. Should show error: "Cannot demote the last admin user"

#### 5. Invite Code Management

**Test: Create Invite Code**
1. Click "Create Invite Code"
2. Fill form:
   - Max Uses: 5
   - Expires: (date picker - 7 days from now)
   - Description: "Test Code"
3. Submit
4. Verify:
   - [ ] New code appears in grid
   - [ ] Code is randomly generated (8 uppercase chars)
   - [ ] Copy button works
   - [ ] Shows 0/5 uses

**Test: Use Invite Code**
1. Copy an active invite code
2. Open incognito window
3. Try to register (if signup control is ON)
4. Enter invite code
5. Complete registration
6. Return to admin panel
7. Verify:
   - [ ] Used count increased (e.g., 1/5)
   - [ ] Used by list shows new user

**Test: Deactivate Code**
1. Click "Deactivate" on active code
2. Confirm action
3. Verify:
   - [ ] Badge changes to "Inactive"
   - [ ] Cannot be used for signup

**Test: Delete Code**
1. Click "Delete" on any code
2. Confirm action
3. Verify code removed from grid

**Test: Expired Code**
1. Create code with expiration date in past (via API or DB)
2. Try to use for signup
3. Should show "Invite code has expired"

---

## Leaderboard Testing

### Frontend Testing

#### Test: View Leaderboard

**Prerequisites:**
- Leaderboard enabled (admin setting)
- Multiple users with activity
- At least one user opted out

**Steps:**
1. Login as regular user
2. Click "🏆 المتصدرون" / "🏆 Leaderboard" tab
3. Verify:
   - [ ] Top 25 users displayed
   - [ ] Columns: Rank, Student, Pages, Juz, Streak
   - [ ] Users sorted by total pages (descending)
   - [ ] Current user's row highlighted
   - [ ] Top 3 ranks have special styling
   - [ ] Opted-out users NOT shown
   - [ ] Arabic numerals display for AR language
   - [ ] English numerals display for EN language

#### Test: My Rank Section

1. Verify "Your Rank" card displays:
   - [ ] User's current rank
   - [ ] Total number of students on leaderboard
   - [ ] User's total pages
   - [ ] User's completed juz
   - [ ] User's current streak
2. Compare with API response for accuracy

#### Test: Leaderboard Disabled State

1. Login as admin
2. Toggle leaderboard OFF
3. Login as regular user
4. Navigate to leaderboard tab
5. Verify:
   - [ ] Shows "Leaderboard is currently disabled" message
   - [ ] No rank section displayed
   - [ ] No table displayed
   - [ ] Privacy settings button hidden or disabled

#### Test: Not on Leaderboard State

1. User opts out via privacy settings
2. Navigate to leaderboard tab
3. Verify:
   - [ ] Shows "You are not on the leaderboard" message
   - [ ] Suggests enabling in settings
   - [ ] No rank card displayed

#### Test: Language Toggle

1. View leaderboard in Arabic
2. Switch to English
3. Verify:
   - [ ] All labels translated
   - [ ] Numerals converted (Arabic → English)
   - [ ] RTL → LTR layout
4. Switch back to Arabic
5. Verify conversion back to Arabic numerals

#### Test: Responsive Design

**Desktop (> 1024px):**
- [ ] Full table width
- [ ] All columns visible
- [ ] Large rank numbers for top 3

**Tablet (768px - 1024px):**
- [ ] Table responsive
- [ ] Readable font sizes
- [ ] No horizontal scroll

**Mobile (< 768px):**
- [ ] Table scales appropriately
- [ ] Font size adjusted
- [ ] Rank card stacks vertically
- [ ] Stats in single column

---

## Privacy Settings Testing

### Test: Open Privacy Settings

1. Navigate to leaderboard tab
2. Click "⚙️ إعدادات الخصوصية" / "⚙️ Privacy Settings"
3. Verify modal opens with:
   - [ ] Current toggle state loaded
   - [ ] Current display name loaded
   - [ ] Appropriate language

### Test: Toggle Visibility

**Test: Opt Out**
1. Open privacy settings
2. Toggle "Show on leaderboard" OFF
3. Save changes
4. Verify:
   - [ ] Success message shown
   - [ ] User removed from leaderboard table
   - [ ] "Not on leaderboard" message appears
   - [ ] My Rank section hidden

**Test: Opt In**
1. Open privacy settings (when opted out)
2. Toggle "Show on leaderboard" ON
3. Save changes
4. Verify:
   - [ ] Success message shown
   - [ ] User appears in leaderboard table
   - [ ] My Rank section displays
   - [ ] Correct rank shown

### Test: Custom Display Name

**Test: Set Custom Name**
1. Open privacy settings
2. Enter custom name: "الطالب المجتهد"
3. Save changes
4. Check leaderboard table
5. Verify:
   - [ ] Custom name shown instead of real name
   - [ ] Name truncated if too long

**Test: Remove Custom Name**
1. Open privacy settings
2. Clear display name field
3. Save changes
4. Check leaderboard table
5. Verify:
   - [ ] Real name shown again

**Test: Name Too Long**
1. Open privacy settings
2. Enter 51+ character name
3. Try to save
4. Verify:
   - [ ] Error shown: "Display name must not exceed 50 characters"
   - [ ] Changes not saved

### Test: Cancel Changes

1. Open privacy settings
2. Make changes (toggle, name)
3. Click "Cancel"
4. Reopen modal
5. Verify:
   - [ ] Previous settings still active
   - [ ] Changes discarded

### Test: Modal Close

1. Open privacy settings
2. Click outside modal (on backdrop)
3. Verify modal closes
4. Click close button (×)
5. Verify modal closes

---

## Integration Testing

### End-to-End User Journey

#### Journey 1: New Student Registration (With Invite Code)

1. **Admin Setup:**
   - Login as admin
   - Enable signup control
   - Create invite code "STUDENT2024" (max uses: 5)
   - Copy code

2. **Student Registration:**
   - Open incognito window
   - Navigate to app
   - Click signup
   - Enter invite code "STUDENT2024"
   - Complete OAuth login
   - Verify account created

3. **Admin Verification:**
   - Check user list → new user appears
   - Check invite code → used count = 1/5
   - Check "Used By" → shows new user

#### Journey 2: Student Progress → Leaderboard

1. **Student Activity:**
   - Login as new student
   - Add daily logs for 7 days
   - Mark 3 juz as completed
   - Verify streak increases

2. **Leaderboard:**
   - Navigate to leaderboard tab
   - Verify student appears in rankings
   - Check rank position
   - Verify stats match activity

3. **Privacy Change:**
   - Open privacy settings
   - Set custom name "نجم القرآن"
   - Opt out from leaderboard
   - Verify disappears from leaderboard
   - Opt back in
   - Verify reappears with custom name

#### Journey 3: Admin Moderation

1. **Promote User:**
   - Admin promotes top student to admin
   - Student can now access admin panel
   - Student sees admin controls

2. **Leaderboard Control:**
   - Admin temporarily disables leaderboard
   - All users see "disabled" message
   - Admin re-enables leaderboard
   - Users can view rankings again

3. **Signup Control:**
   - Admin enables invite-only signup
   - New users need invite codes
   - Admin creates codes for trial institutions
   - Tracks usage per institution

---

## Edge Cases & Error Scenarios

### 1. Admin Access Edge Cases

**Test: Last Admin Protection**
```javascript
// Browser console test
// 1. Ensure only one admin exists
// 2. Try to delete/demote that admin
// Expected: Error message preventing action
```

**Test: Self-Demotion Protection**
```javascript
// 1. Login as admin
// 2. Try to demote yourself
// Expected: Warning or prevention
```

### 2. Leaderboard Edge Cases

**Test: No Users on Leaderboard**
1. All users opt out
2. Navigate to leaderboard
3. Expected: "No users on leaderboard yet" message

**Test: Tie in Rankings**
1. Create users with identical stats (via DB)
2. Check leaderboard
3. Expected: Consistent ordering (by secondary criteria)

**Test: Cache Expiration**
1. Load leaderboard (data cached)
2. Wait 1 hour (or modify cache duration for testing)
3. Reload leaderboard
4. Expected: Fresh data fetched

**Test: Concurrent Updates**
1. Multiple users update stats simultaneously
2. Admin refreshes cache
3. Expected: No data corruption

### 3. Invite Code Edge Cases

**Test: Expired Code**
```bash
# Create code with past expiration via API
curl -X POST "$API_BASE/admin/invite-codes" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "maxUses": 10,
    "expiresAt": "2024-01-01",
    "description": "Expired code test"
  }'

# Try to use for signup
# Expected: "Invite code has expired" error
```

**Test: Max Uses Reached**
1. Create code with maxUses: 1
2. Use it once
3. Try to use again
4. Expected: "Invite code has reached maximum uses" error

**Test: Deactivated Code**
1. Create active code
2. Deactivate it
3. Try to use
4. Expected: "Invite code is not active" error

**Test: Invalid Code Format**
1. Try signup with code "abc" (too short)
2. Expected: Validation error

### 4. Privacy Settings Edge Cases

**Test: Special Characters in Display Name**
1. Enter name: `<script>alert('test')</script>`
2. Save
3. Check leaderboard
4. Expected: HTML escaped, no XSS

**Test: Empty String vs Null**
1. Set display name to empty string ""
2. Save
3. Expected: Stored as null, shows real name

**Test: Unicode Characters**
1. Enter name: "🏆 الطالب المجتهد 🌟"
2. Save
3. Expected: Emoji displayed correctly

**Test: Network Failure During Save**
1. Open DevTools → Network tab
2. Throttle to "Offline"
3. Try to save privacy settings
4. Expected: Error message shown

### 5. Concurrent Access

**Test: Multiple Admins**
1. Two admins open admin panel simultaneously
2. Admin 1 deletes user
3. Admin 2 tries to view same user
4. Expected: Graceful error handling

**Test: Settings Race Condition**
1. Admin 1 toggles setting ON
2. Admin 2 toggles setting OFF simultaneously
3. Expected: Last write wins, consistent state

---

## Performance Testing

### Leaderboard Performance

**Test: Large Dataset**
```javascript
// Create 1000+ users via script
// Test leaderboard load time
// Expected: < 2 seconds with caching
```

**Test: Cache Effectiveness**
```bash
# First request (cold cache)
time curl -X GET "$API_BASE/leaderboard"

# Second request (warm cache)
time curl -X GET "$API_BASE/leaderboard"

# Expected: Second request significantly faster
```

### Admin Panel Performance

**Test: User List Pagination**
1. Create 100+ users
2. Navigate through pages
3. Expected: < 1 second per page load

**Test: Dashboard Stats**
1. Large dataset (100+ users, 1000+ logs)
2. Load admin panel
3. Expected: Stats load within 3 seconds

---

## Automated Testing Scripts

### Browser Console Tests

#### Test Leaderboard API
```javascript
// Run in browser console (logged in as user)
async function testLeaderboard() {
  console.log('🧪 Testing Leaderboard API...\n');

  // Test 1: Get leaderboard
  const response1 = await fetch('/api/leaderboard?limit=10', {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('hafiz_token')}` }
  });
  const data1 = await response1.json();
  console.log('✅ Get Leaderboard:', data1);

  // Test 2: Get my rank
  const response2 = await fetch('/api/leaderboard/me', {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('hafiz_token')}` }
  });
  const data2 = await response2.json();
  console.log('✅ Get My Rank:', data2);

  // Test 3: Update privacy settings
  const response3 = await fetch('/api/user', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('hafiz_token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      settings: {
        showOnLeaderboard: true,
        leaderboardDisplayName: 'Test User'
      }
    })
  });
  const data3 = await response3.json();
  console.log('✅ Update Privacy:', data3);

  console.log('\n🎉 All tests completed!');
}

testLeaderboard();
```

#### Test Admin API
```javascript
// Run in browser console (logged in as admin)
async function testAdminAPI() {
  const token = localStorage.getItem('hafiz_token');
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  console.log('🧪 Testing Admin API...\n');

  // Test 1: Get settings
  const settings = await (await fetch('/api/admin/settings', { headers })).json();
  console.log('✅ Get Settings:', settings);

  // Test 2: Get dashboard stats
  const stats = await (await fetch('/api/admin/dashboard/stats', { headers })).json();
  console.log('✅ Dashboard Stats:', stats);

  // Test 3: Get users
  const users = await (await fetch('/api/admin/users?page=1&limit=5', { headers })).json();
  console.log('✅ Get Users:', users);

  // Test 4: Get invite codes
  const codes = await (await fetch('/api/admin/invite-codes', { headers })).json();
  console.log('✅ Invite Codes:', codes);

  console.log('\n🎉 Admin API tests completed!');
}

testAdminAPI();
```

---

## Test Results Documentation

### Test Report Template

```markdown
# Test Report - Admin Panel & Leaderboard
**Date:** YYYY-MM-DD
**Tester:** [Name]
**Environment:** [Development/Staging/Production]
**Branch:** claude/plan-quran-app-updates-D7zEz

## Summary
- Total Tests:
- Passed: ✅
- Failed: ❌
- Skipped: ⏭️

## Backend API Tests
| Test Case | Status | Notes |
|-----------|--------|-------|
| Get App Settings | ✅ | |
| Update Settings | ✅ | |
| Get Leaderboard | ✅ | |
| User Management | ✅ | |
| Invite Codes | ✅ | |

## Frontend Tests
| Test Case | Status | Notes |
|-----------|--------|-------|
| Admin Panel Access | ✅ | |
| Settings Toggle | ✅ | |
| User Management UI | ✅ | |
| Leaderboard Display | ✅ | |
| Privacy Settings | ✅ | |

## Issues Found
1. [Issue description]
   - Severity: High/Medium/Low
   - Steps to reproduce:
   - Expected vs Actual:

## Recommendations
- [Recommendation 1]
- [Recommendation 2]
```

---

## Next Steps After Testing

1. **Fix Critical Bugs:** Address any high-severity issues
2. **Performance Optimization:** If tests reveal slowness
3. **Documentation Updates:** Based on test findings
4. **User Acceptance Testing:** Share with trial institutions
5. **Deployment Planning:** Prepare for production rollout

---

## Contact & Support

For questions or issues during testing:
- **GitHub Issues:** https://github.com/Mohamed-AH/quran/issues
- **Branch:** `claude/plan-quran-app-updates-D7zEz`

---

**Last Updated:** 2025-12-21
