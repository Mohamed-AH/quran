# Hafiz App - Render Deployment Guide

Complete guide for deploying both frontend and backend on Render.com

## 📋 Prerequisites

Before deploying, ensure you have:

1. ✅ GitHub repository with your code
2. ✅ MongoDB Atlas database set up
3. ✅ Google OAuth credentials configured
4. ✅ GitHub OAuth credentials configured
5. ✅ Render.com account (free)

---

## 🚀 Deployment Steps

### Step 1: Push Code to GitHub

```bash
# Make sure all changes are committed
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### Step 2: Deploy Backend on Render

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Click "New +" → "Web Service"**
3. **Connect GitHub repository**
4. **Configure Backend:**
   - **Name**: `hafiz-backend`
   - **Region**: Oregon (US West) or closest to you
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

5. **Add Environment Variables** (click "Advanced" → "Add Environment Variable"):

```env
# Required Environment Variables
NODE_ENV=production
PORT=10000
MONGODB_URI=your-mongodb-atlas-connection-string
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://hafiz-backend.onrender.com/api/auth/google/callback

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=https://hafiz-backend.onrender.com/api/auth/github/callback

# Frontend URL (will update after frontend deployment)
FRONTEND_URL=https://hafiz-frontend.onrender.com

# Security
COOKIE_SECURE=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

6. **Click "Create Web Service"**
7. **Wait for deployment** (~2-5 minutes)
8. **Note your backend URL**: `https://hafiz-backend.onrender.com`

### Step 3: Update OAuth Callback URLs

**Google Cloud Console:**
1. Go to: https://console.cloud.google.com/apis/credentials
2. Edit your OAuth 2.0 Client ID
3. Add to "Authorized redirect URIs":
   ```
   https://hafiz-backend.onrender.com/api/auth/google/callback
   ```
4. Save

**GitHub OAuth Settings:**
1. Go to: https://github.com/settings/developers
2. Edit your OAuth App
3. Update "Authorization callback URL":
   ```
   https://hafiz-backend.onrender.com/api/auth/github/callback
   ```
4. Save

### Step 4: Deploy Frontend on Render

1. **Go to Render Dashboard**
2. **Click "New +" → "Static Site"**
3. **Connect same GitHub repository**
4. **Configure Frontend:**
   - **Name**: `hafiz-frontend`
   - **Branch**: `main`
   - **Root Directory**: `.` (leave empty or put a single dot)
   - **Build Command**: `echo "Static site - no build needed"`
   - **Publish Directory**: `.` (root directory)

5. **Add Environment Variables** (optional):
   ```env
   NODE_VERSION=18
   ```

6. **Click "Create Static Site"**
7. **Wait for deployment** (~1-2 minutes)
8. **Note your frontend URL**: `https://hafiz-frontend.onrender.com`

### Step 5: Update Frontend Config

Update your backend URL in the deployed frontend:

1. Go to your **Backend** service on Render
2. Navigate to **Environment** tab
3. Update `FRONTEND_URL` to your actual frontend URL:
   ```
   FRONTEND_URL=https://hafiz-frontend.onrender.com
   ```
4. Save (will trigger re-deploy)

### Step 6: Update js/config.js

The config file should already have the production URL:
```javascript
PRODUCTION_API_URL: 'https://hafiz-backend.onrender.com/api',
```

If your backend has a different name, update this URL accordingly.

### Step 7: Test Your Deployment

1. **Visit your frontend**: `https://hafiz-frontend.onrender.com`
2. **Test the demo**: Click "Try the App"
3. **Test login**: Try logging in with Google/GitHub
4. **Test functionality**: Create a log entry, update Juz progress

---

## 🔧 Troubleshooting

### Backend Spinning Down?

**Problem**: First request takes 30-60 seconds
**Solution**: Use a free uptime monitor:

1. **UptimeRobot** (https://uptimerobot.com):
   - Create free account
   - Add new monitor
   - Monitor URL: `https://hafiz-backend.onrender.com/health`
   - Check interval: 5 minutes
   - This keeps your backend awake!

2. **Cron-job.org** (https://cron-job.org):
   - Create free account
   - Add cronjob
   - URL: `https://hafiz-backend.onrender.com/health`
   - Interval: Every 10 minutes

### CORS Errors?

**Check**:
1. `FRONTEND_URL` in backend env vars matches your frontend URL
2. No trailing slashes in URLs
3. HTTPS (not HTTP) in production URLs

### OAuth Not Working?

**Check**:
1. Callback URLs updated in Google/GitHub consoles
2. OAuth credentials are correct in env vars
3. Backend URL is correct in callbacks

### 500 Errors?

**Check**:
1. MongoDB Atlas allows connections from `0.0.0.0/0`
2. All required env vars are set
3. Check Render logs: Dashboard → Service → Logs

---

## 📊 Monitoring

### View Logs:

1. Go to Render Dashboard
2. Select your service (backend or frontend)
3. Click "Logs" tab
4. Monitor real-time logs

### Health Check:

Test backend health:
```bash
curl https://hafiz-backend.onrender.com/health
```

Should return:
```json
{
  "success": true,
  "message": "Hafiz API is running",
  "timestamp": "2024-12-18T...",
  "environment": "production"
}
```

---

## 🎯 Post-Deployment Checklist

- [ ] Backend deployed successfully
- [ ] Frontend deployed successfully
- [ ] OAuth callbacks updated
- [ ] Demo mode works
- [ ] Login with Google works
- [ ] Login with GitHub works
- [ ] Data saves correctly
- [ ] MongoDB connection works
- [ ] Uptime monitor set up (optional)
- [ ] Custom domain configured (optional)

---

## 💰 Keeping It Free

**Free Tier Limits:**
- Backend: 750 hours/month (enough for 24/7)
- Frontend: Unlimited
- Spins down after 15 min inactivity

**To Avoid Cold Starts (FREE):**
1. Set up UptimeRobot pinging every 5-10 minutes
2. Or upgrade to paid ($7/month) for always-on

---

## 🔄 Updating Your App

When you push changes to GitHub:
1. Backend auto-deploys from `backend/` directory changes
2. Frontend auto-deploys from root directory changes
3. Wait 2-5 minutes for deployment
4. Changes go live automatically!

**Manual Deploy:**
1. Go to Render Dashboard
2. Select your service
3. Click "Manual Deploy" → "Deploy latest commit"

---

## 📱 Custom Domain (Optional)

### For Frontend:
1. Go to your static site settings
2. Click "Custom Domain"
3. Add your domain (e.g., `hafiz.app`)
4. Follow DNS instructions

### For Backend:
1. Go to your web service settings
2. Click "Custom Domain"
3. Add API subdomain (e.g., `api.hafiz.app`)
4. Update `PRODUCTION_API_URL` in `js/config.js`
5. Update `GOOGLE_CALLBACK_URL` and `GITHUB_CALLBACK_URL`

---

## 🆘 Need Help?

1. **Render Docs**: https://render.com/docs
2. **Render Community**: https://community.render.com
3. **MongoDB Atlas**: https://www.mongodb.com/docs/atlas/
4. **Check logs**: Render Dashboard → Logs

---

## ✅ Success!

Your Hafiz app is now live! 🎉

- **Frontend**: https://hafiz-frontend.onrender.com
- **Backend**: https://hafiz-backend.onrender.com
- **Health Check**: https://hafiz-backend.onrender.com/health

Share it with the world! 🌍
