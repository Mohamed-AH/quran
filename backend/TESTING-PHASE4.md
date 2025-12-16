# Phase 4 Testing Guide

## Prerequisites

1. **MongoDB Atlas** configured in `.env` file
2. **OAuth credentials** (Google or GitHub) configured in `.env` file
3. **Server running** on port 5000

## Quick Start

### Step 1: Update `.env` file

Make sure your `backend/.env` file has:

```bash
# MongoDB Atlas
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASSWORD@cluster0.abhqc.mongodb.net/hafiz?appName=Cluster0

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### Step 2: Start the server

```bash
cd backend
npm start
```

You should see:
```
🚀 Hafiz API Server Running
🚀 Port: 5000
✓ MongoDB connected: hafiz
```

### Step 3: Get an access token

**Option A: Using Browser (Easiest)**

1. Open: `http://localhost:5000/api/auth/google` (or `/github`)
2. Complete OAuth login
3. Copy the `accessToken` from the JSON response

**Option B: Using curl**

```bash
# This will redirect you through OAuth flow
curl http://localhost:5000/api/auth/google
```

After successful authentication, you'll get a response like:
```json
{
  "success": true,
  "message": "Authentication successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {...}
}
```

Copy the `accessToken` value.

### Step 4: Run the automated test script

```bash
cd backend
./test-phase4.sh YOUR_ACCESS_TOKEN
```

Example:
```bash
./test-phase4.sh eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzVmMGYxZjI4YWEzNDAwMTNhYjEyMzQiLCJpYXQiOjE3MzQzMzQ4MDAsImV4cCI6MTczNDMzNTcwMH0.abcd1234...
```

## What the Script Tests

### 1. User Endpoints ✓
- GET `/api/user` - Get current user profile
- PUT `/api/user` - Update user profile (name, language, theme)
- GET `/api/user` - Verify update

### 2. Juz Endpoints ✓
- GET `/api/juz` - Get all 30 Juz (auto-initialization)
- GET `/api/juz/summary` - Get summary statistics
- GET `/api/juz/1` - Get single Juz
- PUT `/api/juz/1` - Update Juz (pages, notes)
- PUT `/api/juz/1` - Complete Juz (pages=20)
- GET `/api/juz/summary` - Verify summary updated

### 3. Logs Endpoints ✓
- POST `/api/logs` - Create log entry
- GET `/api/logs` - Get all logs
- GET `/api/logs?limit=10` - Get logs with pagination
- GET `/api/logs/stats` - Get statistics
- GET `/api/logs/:id` - Get single log
- PUT `/api/logs/:id` - Update log
- POST `/api/logs` - Create second log

### 4. Validation Tests ✓
- Invalid rating (>5) - Should return 400
- Invalid page format (XSS) - Should return 400
- Missing required data - Should return 400
- Invalid Juz number (>30) - Should return 400
- Invalid Juz pages (>20) - Should return 400

### 5. Duplicate Prevention ✓
- Try to create duplicate log for same date - Should return 400

### 6. Date Filtering ✓
- GET logs with date range (startDate, endDate)

### 7. Delete Tests (Optional)
- DELETE `/api/logs/:id` - Delete log (commented out)
- DELETE `/api/user` - Delete account (commented out - DANGER!)

## Expected Output

```
========================================
Phase 4 CRUD API Test Suite
========================================

========================================
1. Testing User Endpoints
========================================

Testing: GET /api/user - Get current user profile
✓ PASS (HTTP 200)
{
  "success": true,
  "user": {
    "email": "your-email@gmail.com",
    "name": "Your Name",
    ...
  }
}

Testing: PUT /api/user - Update user profile
✓ PASS (HTTP 200)
...

========================================
Test Summary
========================================
Passed: 25
Failed: 0
Total:  25

✓ All tests passed!
```

## Manual Testing

If you prefer to test manually with curl:

### Get User Profile
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/user
```

### Create Log
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newPages":"1-5","newRating":4,"reviewPages":"10-15","reviewRating":5}' \
  http://localhost:5000/api/logs
```

### Get All Juz
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/juz
```

### Update Juz
```bash
curl -X PUT \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pages":10,"notes":"Progress on Juz 1"}' \
  http://localhost:5000/api/juz/1
```

### Get Logs with Pagination
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  'http://localhost:5000/api/logs?limit=20&offset=0'
```

### Get Statistics
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/logs/stats
```

## Troubleshooting

### Issue: "Error: Bearer token required"
- Make sure you're passing the access token as the first argument
- Token should not include the word "Bearer", just the token itself

### Issue: "HTTP 401 - Authentication required"
- Your token may have expired (tokens last 15 minutes)
- Get a new token by authenticating again

### Issue: "HTTP 500 - Internal Server Error"
- Check server logs for detailed error
- Verify MongoDB connection is working
- Check that all dependencies are installed

### Issue: "Connection refused"
- Make sure the server is running on port 5000
- Check that nothing else is using port 5000

### Issue: "MongoDB connection failed"
- Verify your MongoDB Atlas connection string in `.env`
- Check your IP address is whitelisted in MongoDB Atlas
- Verify your username/password are correct

## Next Steps After Testing

Once all tests pass:
1. ✅ Phase 4 is complete and verified
2. 🎯 Ready to proceed to Phase 5: Frontend Foundation (React + Vite)

## Security Notes

- Never commit `.env` file with real credentials
- Access tokens expire after 15 minutes (configurable)
- Refresh tokens expire after 7 days (configurable)
- Use `/api/auth/refresh` endpoint to get new access token without re-authenticating
- In production, always use HTTPS and secure cookies

## API Documentation

For detailed API documentation, see `PHASE4-SUMMARY.md`.
