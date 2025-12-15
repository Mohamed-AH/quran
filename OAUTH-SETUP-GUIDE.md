# OAuth Setup Guide
## Google & GitHub OAuth 2.0 Configuration

**Goal:** Setup OAuth credentials for Google and GitHub authentication

**Time Required:** 20-30 minutes (10-15 min per provider)

---

## 📋 Prerequisites

- ✅ Backend server running (Phase 2 complete)
- ✅ MongoDB Atlas connected
- ✅ Google account
- ✅ GitHub account

---

## 🔐 PART 1: Google OAuth Setup

### Step 1.1: Go to Google Cloud Console

1. Visit: **https://console.cloud.google.com/**
2. Sign in with your Google account

### Step 1.2: Create New Project

1. Click **"Select a project"** (top left, next to "Google Cloud")
2. Click **"NEW PROJECT"** (top right)
3. **Project name:** `Hafiz` or `Quran Tracker`
4. **Organization:** Leave as default (No organization)
5. Click **"CREATE"**
6. ⏳ Wait for project creation (~30 seconds)
7. Click **"SELECT PROJECT"** when ready

### Step 1.3: Enable Google+ API

1. In the left sidebar, go to **"APIs & Services"** → **"Library"**
2. Search for: **"Google+ API"**
3. Click on **"Google+ API"**
4. Click **"ENABLE"**
5. ⏳ Wait for activation (~10 seconds)

### Step 1.4: Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. **User Type:** Select **"External"**
3. Click **"CREATE"**

**App information:**
- **App name:** `Hafiz`
- **User support email:** Your email
- **App logo:** (optional - skip for now)

**App domain:**
- **Application home page:** `http://localhost:5000` (for development)
- Leave other fields empty for now

**Developer contact information:**
- **Email addresses:** Your email

4. Click **"SAVE AND CONTINUE"**

**Scopes:** (Step 2)
- Click **"ADD OR REMOVE SCOPES"**
- Select:
  - ✅ `.../auth/userinfo.email`
  - ✅ `.../auth/userinfo.profile`
- Click **"UPDATE"**
- Click **"SAVE AND CONTINUE"**

**Test users:** (Step 3)
- Click **"ADD USERS"**
- Add your email address (for testing)
- Click **"ADD"**
- Click **"SAVE AND CONTINUE"**

**Summary:** (Step 4)
- Review and click **"BACK TO DASHBOARD"**

### Step 1.5: Create OAuth 2.0 Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"CREATE CREDENTIALS"** → **"OAuth client ID"**

**Application type:** Web application

**Name:** `Hafiz Backend`

**Authorized JavaScript origins:**
- Click **"+ ADD URI"**
- Add: `http://localhost:5000`

**Authorized redirect URIs:**
- Click **"+ ADD URI"**
- Add: `http://localhost:5000/api/auth/google/callback`

3. Click **"CREATE"**

### Step 1.6: Copy Credentials

You'll see a popup with:
- **Your Client ID:** (long string like `123456789-abc...apps.googleusercontent.com`)
- **Your Client Secret:** (random string like `GOCSPX-...`)

💾 **IMPORTANT: Copy both values!**

Click **"OK"** (you can always view them again in Credentials page)

### Step 1.7: Update Backend .env

Open your backend `.env` file:

```bash
cd /home/user/quran/backend
nano .env  # or your editor
```

Update these lines:
```env
GOOGLE_CLIENT_ID=paste-your-client-id-here
GOOGLE_CLIENT_SECRET=paste-your-client-secret-here
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

**Example:**
```env
GOOGLE_CLIENT_ID=123456789-abcdef123456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-a1b2c3d4e5f6g7h8i9j0
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

Save the file.

---

## 🐙 PART 2: GitHub OAuth Setup

### Step 2.1: Go to GitHub Settings

1. Visit: **https://github.com/settings/developers**
2. Sign in to your GitHub account
3. Click **"OAuth Apps"** (left sidebar)
4. Click **"New OAuth App"** (or "Register a new application")

### Step 2.2: Register New Application

**Application name:** `Hafiz` or `Quran Memorization Tracker`

**Homepage URL:** `http://localhost:5000`

**Application description:** (optional)
```
Quran memorization tracking application with daily logging and progress monitoring.
```

**Authorization callback URL:** `http://localhost:5000/api/auth/github/callback`

⚠️ **CRITICAL:** Must be exactly this URL!

**Enable Device Flow:** Leave unchecked

Click **"Register application"**

### Step 2.3: Generate Client Secret

After registration, you'll see:

1. **Client ID:** (visible on screen - copy it)
2. **Client secrets:** Click **"Generate a new client secret"**
3. You may need to confirm with your password
4. 💾 **IMPORTANT: Copy the secret NOW!** (it won't be shown again)

### Step 2.4: Update Backend .env

Open your backend `.env` file:

```bash
nano .env
```

Update these lines:
```env
GITHUB_CLIENT_ID=paste-your-client-id-here
GITHUB_CLIENT_SECRET=paste-your-client-secret-here
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback
```

**Example:**
```env
GITHUB_CLIENT_ID=Iv1.a1b2c3d4e5f6g7h8
GITHUB_CLIENT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback
```

Save the file.

---

## ✅ Step 3: Verify .env Configuration

Your complete `.env` file should now have:

```env
# Server
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb+srv://mojed:YOUR_PASSWORD@cluster0.abhqc.mongodb.net/hafiz?appName=Cluster0

# JWT Secrets
JWT_SECRET=dev-jwt-secret-key-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth ← Should be filled
GOOGLE_CLIENT_ID=your-actual-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-actual-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# GitHub OAuth ← Should be filled
GITHUB_CLIENT_ID=Iv1.your-actual-github-client-id
GITHUB_CLIENT_SECRET=your-actual-github-secret
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback

# Frontend
FRONTEND_URL=http://localhost:3000

# Cookies
COOKIE_SECURE=false

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

---

## 🚀 Step 4: Restart Backend Server

### 4.1 Stop Current Server

Press `Ctrl+C` in your server terminal

### 4.2 Start Server

```bash
npm run dev
```

### 4.3 Verify OAuth is Configured

You should see in the console:
```
✅ MongoDB Connected: ...
📊 Database: hafiz

🚀 ========================================
🚀 Hafiz API Server Running
...
🚀 ========================================

📝 Available endpoints:
   GET  /              - API info
   GET  /health        - Health check
   GET  /api/version   - API version

🔐 Authentication endpoints:
   GET  /api/auth/google          - Google OAuth login
   GET  /api/auth/github          - GitHub OAuth login
   ...
```

✅ **If you see the auth endpoints listed, OAuth is configured!**

❌ **If you see warnings like:**
```
⚠️  Google OAuth not configured. Set GOOGLE_CLIENT_ID...
⚠️  GitHub OAuth not configured. Set GITHUB_CLIENT_ID...
```
→ Double-check your `.env` file has correct values

---

## 🧪 Step 5: Test OAuth Flow (Manual)

### 5.1 Test Google OAuth Redirect

Open browser and visit:
```
http://localhost:5000/api/auth/google
```

**Expected behavior:**
- Redirects to Google login page
- Shows app name "Hafiz"
- Shows requested permissions (email, profile)
- You can select your Google account

**After login:**
- Should redirect to `/api/auth/google/callback`
- Should return JSON with `accessToken` and `user` data

**Example response:**
```json
{
  "success": true,
  "message": "Authentication successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "your-email@gmail.com",
    "name": "Your Name",
    "profilePicture": "https://...",
    "authProvider": "google",
    "settings": {
      "language": "ar",
      "theme": "default"
    }
  }
}
```

### 5.2 Test GitHub OAuth Redirect

Open browser and visit:
```
http://localhost:5000/api/auth/github
```

**Expected behavior:**
- Redirects to GitHub authorization page
- Shows app name "Hafiz"
- Shows requested permissions (email access)
- Click "Authorize"

**After authorization:**
- Redirects to `/api/auth/github/callback`
- Returns JSON with `accessToken` and `user` data

---

## 🐛 Troubleshooting

### Problem 1: "redirect_uri_mismatch" (Google)

**Error in browser:**
```
Error 400: redirect_uri_mismatch
```

**Cause:** Callback URL in Google Console doesn't match

**Solution:**
1. Go to Google Cloud Console → Credentials
2. Edit your OAuth client
3. Verify "Authorized redirect URIs" has **exactly:**
   ```
   http://localhost:5000/api/auth/google/callback
   ```
4. Save and retry

---

### Problem 2: "The redirect_uri MUST match" (GitHub)

**Error page:**
```
The redirect_uri MUST match the registered callback URL
```

**Cause:** Callback URL in GitHub OAuth App doesn't match

**Solution:**
1. Go to GitHub Settings → OAuth Apps
2. Click on your app
3. Verify "Authorization callback URL" is **exactly:**
   ```
   http://localhost:5000/api/auth/github/callback
   ```
4. Update Application and retry

---

### Problem 3: "Access blocked: Hafiz has not completed verification"

**Cause:** Google requires app verification for production

**Solution for Development:**
- In OAuth consent screen → "Testing" section
- Add yourself as a test user
- Click "PUBLISH APP" → Stay in testing mode
- You and test users can now login

**For Production:**
- Complete Google's app verification process
- This is required before public launch

---

### Problem 4: OAuth warnings in server console

**Warnings:**
```
⚠️  Google OAuth not configured. Set GOOGLE_CLIENT_ID...
⚠️  GitHub OAuth not configured. Set GITHUB_CLIENT_ID...
```

**Cause:** Environment variables not loaded

**Solution:**
1. Verify `.env` file has correct values
2. Check for typos (CLIENT_ID not CLIEN_ID)
3. No quotes around values
4. Restart server (`Ctrl+C` then `npm run dev`)

---

### Problem 5: "Cannot read property 'emails' of undefined"

**Error in server console:**
```
TypeError: Cannot read property 'emails' of undefined
```

**Cause:** OAuth profile doesn't include email

**Solution:**
- **Google:** Make sure you requested `email` scope
- **GitHub:** Check user has public email or granted email permission

---

## 📊 Verification Checklist

Before proceeding, verify:

- ✅ Google Cloud Project created
- ✅ Google OAuth consent screen configured
- ✅ Google OAuth credentials created
- ✅ GitHub OAuth App created
- ✅ Both CLIENT_ID and CLIENT_SECRET in `.env`
- ✅ Callback URLs match exactly
- ✅ Server starts without warnings
- ✅ `/api/auth/google` redirects to Google login
- ✅ `/api/auth/github` redirects to GitHub authorization
- ✅ Both OAuth flows return JWT tokens

---

## 🎯 Success Criteria

OAuth is working when:

1. ✅ Visiting `/api/auth/google` redirects to Google
2. ✅ After Google login, returns JSON with `accessToken`
3. ✅ Visiting `/api/auth/github` redirects to GitHub
4. ✅ After GitHub auth, returns JSON with `accessToken`
5. ✅ User record created in MongoDB
6. ✅ 30 Juz initialized for new user

---

## 🔒 Security Notes

**For Development:**
- ✅ `http://localhost` is fine
- ✅ CLIENT_SECRET in `.env` (gitignored)
- ✅ Cookie secure = false (no HTTPS)

**For Production (Later):**
- ⚠️ Use HTTPS only
- ⚠️ Update callback URLs to production domain
- ⚠️ Set `COOKIE_SECURE=true` in `.env`
- ⚠️ Complete Google app verification
- ⚠️ Use strong JWT_SECRET (generate random)

---

## 📝 Quick Reference

**Google Cloud Console:** https://console.cloud.google.com/
**GitHub OAuth Apps:** https://github.com/settings/developers

**Google Callback URL:**
```
http://localhost:5000/api/auth/google/callback
```

**GitHub Callback URL:**
```
http://localhost:5000/api/auth/github/callback
```

**Test endpoints:**
```bash
# Google
curl http://localhost:5000/api/auth/google

# GitHub
curl http://localhost:5000/api/auth/github
```

---

## ✅ Next Steps

Once OAuth is working:
1. ✅ Test both Google and GitHub login flows
2. ✅ Verify user creation in MongoDB Atlas
3. ✅ Verify JWT tokens work
4. ✅ Ready for Phase 4 (CRUD API)!

---

جزاك الله خيراً
*May Allah reward you with goodness*
