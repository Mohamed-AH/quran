# MongoDB Atlas Setup Guide
## Complete Step-by-Step Instructions

**Goal:** Setup free MongoDB Atlas database and connect to Hafiz backend

**Time Required:** 10-15 minutes

---

## 📋 Prerequisites

- ✅ Email address (for MongoDB account)
- ✅ Internet connection
- ✅ Backend code ready (Phase 2 complete)

---

## 🚀 Step 1: Create MongoDB Atlas Account

### 1.1 Go to MongoDB Atlas

Visit: **https://www.mongodb.com/cloud/atlas/register**

### 1.2 Sign Up

**Option A: Sign up with Google (Recommended)**
- Click "Sign up with Google"
- Choose your Google account
- Accept terms

**Option B: Sign up with Email**
- Enter email address
- Create password (min 8 characters)
- First name, Last name
- Click "Create your Atlas account"

### 1.3 Complete Verification

- Check your email inbox
- Click verification link
- You'll be redirected to Atlas dashboard

---

## 🗄️ Step 2: Create Database Cluster

### 2.1 Choose Deployment Type

After login, you'll see "Deploy a database" page:

1. Click **"M0 FREE"** (the free tier)
   - 512 MB Storage
   - Shared RAM
   - No credit card required ✅

### 2.2 Configure Cluster

**Provider & Region:**
- **Cloud Provider:** AWS (recommended) or Google Cloud
- **Region:** Choose closest to you:
  - US: `us-east-1` (N. Virginia)
  - Europe: `eu-west-1` (Ireland)
  - Asia: `ap-south-1` (Mumbai)
  - Middle East: `eu-west-1` (Ireland - closest)

**Cluster Name:**
- Default: `Cluster0` (you can change to `hafiz-cluster`)

**Additional Settings:**
- Leave everything else as default

Click **"Create"** (bottom right)

⏳ **Wait 3-5 minutes** for cluster creation

---

## 🔐 Step 3: Setup Security

### 3.1 Create Database User

You'll see "Security Quickstart" screen:

**Authentication Method:** Username and Password

1. **Username:** `hafiz-user` (or your choice)
2. **Password:** Click "Autogenerate Secure Password"
   - ⚠️ **IMPORTANT:** Copy this password! You'll need it.
   - Or create your own: min 8 characters, letters + numbers

   Example: `Hafiz2024Secure!`

3. Click **"Create User"**

💾 **Save your credentials now:**
```
Username: hafiz-user
Password: [your-generated-password]
```

### 3.2 Setup Network Access

Still on Security Quickstart:

**Where would you like to connect from?**

**For Development (Recommended for now):**
- Select "My Local Environment"
- Click **"Add My Current IP Address"**
- Or manually add: `0.0.0.0/0` (allow all IPs)
  - Description: "Allow all (development only)"

⚠️ **Note:** `0.0.0.0/0` allows access from anywhere. Fine for development, but restrict in production!

Click **"Finish and Close"**

Click **"Go to Databases"**

---

## 🔌 Step 4: Get Connection String

### 4.1 Navigate to Connect

On the Databases page:

1. Find your cluster (e.g., `Cluster0`)
2. Click **"Connect"** button (middle of cluster card)

### 4.2 Choose Connection Method

You'll see "Connect to Cluster0" modal:

1. Click **"Drivers"** (Connect your application)
2. **Driver:** Node.js
3. **Version:** 5.5 or later (default)

### 4.3 Copy Connection String

You'll see a connection string like this:

```
mongodb+srv://hafiz-user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

**Important Steps:**

1. **Copy the entire string**
2. **Replace `<password>`** with your actual password (from Step 3.1)
3. **Add database name:** Insert `/hafiz` before the `?`

**Final format should look like:**
```
mongodb+srv://hafiz-user:YOUR_ACTUAL_PASSWORD@cluster0.xxxxx.mongodb.net/hafiz?retryWrites=true&w=majority
```

**Example (with fake password):**
```
mongodb+srv://hafiz-user:Hafiz2024Secure!@cluster0.ab12cd.mongodb.net/hafiz?retryWrites=true&w=majority
```

💾 **Save this connection string!** You'll add it to `.env` file.

---

## ⚙️ Step 5: Configure Backend

### 5.1 Navigate to Backend Folder

```bash
cd /home/user/quran/backend
```

### 5.2 Open .env File

The `.env` file already exists (created in Phase 2). Edit it:

```bash
# Linux/Mac:
nano .env

# Or use any text editor
```

### 5.3 Update MONGODB_URI

Find this line:
```env
MONGODB_URI=mongodb://localhost:27017/hafiz-test
```

**Replace it with your Atlas connection string:**
```env
MONGODB_URI=mongodb+srv://hafiz-user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/hafiz?retryWrites=true&w=majority
```

⚠️ **Critical:** Replace `YOUR_PASSWORD` with actual password!

### 5.4 Verify Other Settings

Your `.env` should look like:

```env
NODE_ENV=development
PORT=5000

# Your MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://hafiz-user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/hafiz?retryWrites=true&w=majority

JWT_SECRET=dev-jwt-secret-key-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback

FRONTEND_URL=http://localhost:3000

COOKIE_SECURE=false

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

LOG_LEVEL=info
```

**Save the file** (Ctrl+X, then Y, then Enter in nano)

---

## ✅ Step 6: Test Backend Connection

### 6.1 Install Dependencies (if not already done)

```bash
cd /home/user/quran/backend
npm install
```

### 6.2 Start Development Server

```bash
npm run dev
```

### 6.3 Expected Output

If successful, you should see:

```
✅ MongoDB Connected: cluster0.xxxxx.mongodb.net
📊 Database: hafiz

🚀 ========================================
🚀 Hafiz API Server Running
🚀 Environment: development
🚀 Port: 5000
🚀 URL: http://localhost:5000
🚀 ========================================

📝 Available endpoints:
   GET  /              - API info
   GET  /health        - Health check
   GET  /api/version   - API version
```

✅ **Success!** If you see "MongoDB Connected", you're good to go!

---

## 🧪 Step 7: Test Endpoints

### 7.1 Test Health Endpoint

**Open new terminal** (keep server running in first terminal):

```bash
curl http://localhost:5000/health
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Hafiz API is running",
  "timestamp": "2025-12-15T12:00:00.000Z",
  "environment": "development"
}
```

### 7.2 Test Version Endpoint

```bash
curl http://localhost:5000/api/version
```

**Expected Response:**
```json
{
  "success": true,
  "version": "2.0.0",
  "apiVersion": "v1"
}
```

### 7.3 Test Root Endpoint

```bash
curl http://localhost:5000/
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Welcome to Hafiz API",
  "version": "2.0.0",
  "docs": "/api/docs"
}
```

### 7.4 Test 404 Handler

```bash
curl http://localhost:5000/invalid-route
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Route not found: /invalid-route"
}
```

✅ **All tests passing?** Your backend is working perfectly!

---

## 🔍 Step 8: Verify Database in Atlas

### 8.1 Go to Atlas Dashboard

1. Go to https://cloud.mongodb.com/
2. Login if needed
3. Click "Browse Collections"

### 8.2 Check Database

You should see:
- **Database:** `hafiz`
- **Collections:** (empty for now - will be created when data is added)
  - `users` (will be created in Phase 3)
  - `logs` (will be created in Phase 4)
  - `juzs` (will be created in Phase 4)

⚠️ **Don't worry if collections are empty!** They're created automatically when first document is inserted.

---

## 🐛 Troubleshooting

### Problem 1: "MongoServerError: bad auth"

**Cause:** Wrong username or password

**Solution:**
1. Go to Atlas → Database Access
2. Verify username is `hafiz-user`
3. Click "Edit" → "Edit Password"
4. Generate new password
5. Update `.env` file with new password
6. Restart server

---

### Problem 2: "MongooseServerSelectionError: Could not connect"

**Cause:** IP not whitelisted

**Solution:**
1. Go to Atlas → Network Access
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere"
4. IP: `0.0.0.0/0`
5. Confirm
6. Wait 1-2 minutes
7. Restart server

---

### Problem 3: Connection string format error

**Common mistakes:**
- ❌ `<password>` not replaced
- ❌ Special characters in password not URL-encoded
- ❌ Missing `/hafiz` database name
- ❌ Extra spaces in connection string

**Solution:**
Double-check your connection string format:
```
mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/hafiz?retryWrites=true&w=majority
```

**Special characters in password?**
If your password has special characters like `@`, `#`, `$`, etc., they need to be URL-encoded:

| Character | Encoded |
|-----------|---------|
| @ | %40 |
| # | %23 |
| $ | %24 |
| & | %26 |

Example: Password `Pass@123` becomes `Pass%40123`

---

### Problem 4: Port 5000 already in use

**Error:** `EADDRINUSE: address already in use :::5000`

**Solution:**
```bash
# Find process using port 5000
lsof -i :5000

# Kill it
kill -9 [PID]

# Or use different port in .env
PORT=5001
```

---

### Problem 5: "Cannot find module 'express'"

**Cause:** Dependencies not installed

**Solution:**
```bash
cd /home/user/quran/backend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

---

## 📊 Verification Checklist

Before proceeding to Phase 3, verify:

- ✅ MongoDB Atlas account created
- ✅ Free cluster (M0) created successfully
- ✅ Database user created
- ✅ Network access configured (0.0.0.0/0)
- ✅ Connection string copied
- ✅ `.env` file updated with connection string
- ✅ Server starts without errors
- ✅ "MongoDB Connected" message appears
- ✅ All 4 endpoints tested successfully
- ✅ Database visible in Atlas dashboard

---

## 🎯 Success Criteria

You're ready for Phase 3 when:

1. ✅ Server starts and logs show:
   ```
   ✅ MongoDB Connected: cluster0.xxxxx.mongodb.net
   📊 Database: hafiz
   ```

2. ✅ Health check returns success:
   ```json
   { "success": true, "message": "Hafiz API is running" }
   ```

3. ✅ No connection errors in console

4. ✅ Can see `hafiz` database in Atlas dashboard

---

## 🚀 Next Steps

Once everything is working:

1. ✅ **Keep server running** in one terminal
2. ✅ **Test endpoints** in another terminal
3. ✅ **Verify logs** - no errors
4. ✅ **Ready for Phase 3!**

---

## 📝 Quick Reference

**MongoDB Atlas:** https://cloud.mongodb.com/
**Backend folder:** `/home/user/quran/backend`
**Start server:** `npm run dev`
**Health check:** `curl http://localhost:5000/health`

**Connection String Format:**
```
mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/hafiz?retryWrites=true&w=majority
```

---

## 💡 Pro Tips

1. **Bookmark Atlas Dashboard** - You'll use it often
2. **Save connection string** in password manager
3. **Use MongoDB Compass** (optional GUI tool) for visual database browsing
4. **Check Atlas Metrics** - Monitor database performance
5. **Setup alerts** in Atlas for downtime notifications

---

## ✅ Phase 2 + Setup Complete!

Once you complete this setup successfully, you'll have:

✅ Backend running locally
✅ Connected to cloud database
✅ All endpoints working
✅ Ready for Phase 3 (Authentication)

**Need help?** Check troubleshooting section or ask! 🙂

---

جزاك الله خيراً
*May Allah reward you with goodness*
