# Hafiz App - Railway Deployment Guide

Complete guide for deploying on Railway.app - Better than Render free tier!

## 🎯 Why Railway?

✅ **$5/month credit** (free trial)
✅ **No spin-down** (always-on, even on free tier!)
✅ **Better performance** (shared CPU, 512MB RAM)
✅ **Faster cold starts** (~5 seconds vs 30-60 seconds)
✅ **Simpler deployment** (one-click from GitHub)
✅ **Better developer experience**

---

## 📋 Prerequisites

1. ✅ GitHub repository with your code
2. ✅ MongoDB Atlas database
3. ✅ Google OAuth credentials
4. ✅ GitHub OAuth credentials
5. ✅ Railway account (free trial)

---

## 🚀 Quick Deployment (5 Minutes)

### Step 1: Sign Up for Railway

1. Go to https://railway.app
2. Click "Start a New Project"
3. Sign in with GitHub (free)
4. Get $5 credit automatically

### Step 2: Deploy Backend

1. **Click "New Project"**
2. **Select "Deploy from GitHub repo"**
3. **Choose your `quran` repository**
4. Railway auto-detects Node.js and starts building!

### Step 3: Configure Environment Variables

Click on your service → **Variables** tab → Add these:

```env
# Server
NODE_ENV=production
PORT=3000

# Database
MONGODB_URI=your-mongodb-atlas-connection-string

# JWT (generate with: openssl rand -base64 32)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://your-app-name.up.railway.app/api/auth/google/callback

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=https://your-app-name.up.railway.app/api/auth/github/callback

# Frontend (for CORS)
FRONTEND_URL=https://your-app-name.up.railway.app

# Security
COOKIE_SECURE=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
```

### Step 4: Get Your App URL

1. Click **Settings** tab
2. Scroll to **Domains**
3. Click **Generate Domain**
4. Copy your URL: `https://your-app-name.up.railway.app`

### Step 5: Update OAuth Callbacks

**Google Cloud Console:**
1. Go to: https://console.cloud.google.com/apis/credentials
2. Edit OAuth 2.0 Client ID
3. Add to "Authorized redirect URIs":
   ```
   https://your-app-name.up.railway.app/api/auth/google/callback
   ```
4. Add to "Authorized JavaScript origins":
   ```
   https://your-app-name.up.railway.app
   ```

**GitHub OAuth:**
1. Go to: https://github.com/settings/developers
2. Edit your OAuth App
3. Update "Authorization callback URL":
   ```
   https://your-app-name.up.railway.app/api/auth/github/callback
   ```
4. Update "Homepage URL":
   ```
   https://your-app-name.up.railway.app
   ```

### Step 6: Update Frontend Config

Update `js/config.js` with your Railway URL:

```javascript
PRODUCTION_API_URL: 'https://your-app-name.up.railway.app/api',
```

Push to GitHub - Railway auto-deploys!

### Step 7: Test Your App! 🎉

Visit: `https://your-app-name.up.railway.app`

---

## 📁 Project Structure for Railway

Railway serves everything from root, so:
- Frontend: `index.html`, `app.html`, etc. (root directory)
- Backend: Node.js API (serves from same domain)
- Static files: `css/`, `js/`, `assets/` (served by Express)

Your Express backend already serves static files! ✅

---

## 💰 Free Credit Usage

**Your $5/month covers:**
- ~550 hours of runtime (enough for 24/7!)
- Or ~750 hours if usage is optimized
- Monitor usage: Dashboard → Project → Usage

**Tips to Stay Within Free Tier:**
1. ✅ Railway auto-sleeps when idle (optional)
2. ✅ No spin-down needed (always reasonable performance)
3. ✅ Use MongoDB Atlas free tier
4. ✅ Optimize images and assets

**If You Run Out:**
- Add payment method ($0.000231/GB-hour)
- Or wait until next month for new $5 credit
- Typically costs $5-10/month for small apps

---

## 🔧 Railway CLI (Optional - Advanced)

Install Railway CLI for easier management:

```bash
# Install CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# View logs
railway logs

# Open in browser
railway open

# Deploy manually
railway up
```

---

## 📊 Monitoring

### View Logs:
1. Railway Dashboard → Your Project
2. Click on your service
3. **Deployments** tab → Latest deployment
4. Real-time logs appear automatically

### Metrics:
- **Usage** tab: Memory, CPU, network
- **Deployments** tab: Build history
- **Settings** → **Webhooks**: Set up notifications

### Health Check:
```bash
curl https://your-app-name.up.railway.app/health
```

---

## 🔄 Auto-Deploy from GitHub

Railway automatically deploys when you push to `main`:

```bash
git add .
git commit -m "Update app"
git push origin main
# Railway auto-deploys in ~1-2 minutes!
```

**Disable auto-deploy:**
1. Settings → Deployment → Turn off "Auto Deploy"

---

## 🚨 Troubleshooting

### Build Fails?
**Check:**
1. `backend/package.json` exists
2. Node version ≥ 18
3. All dependencies in package.json

**Fix:**
- Settings → Change Node version
- Trigger redeploy: Deployments → Three dots → Redeploy

### Can't Connect to MongoDB?
**Check:**
1. MongoDB Atlas allows `0.0.0.0/0` (all IPs)
2. Connection string is correct
3. Username/password don't have special characters

### OAuth Not Working?
**Check:**
1. Callback URLs match exactly (no trailing slash)
2. Railway domain is correct
3. OAuth credentials are correct
4. `FRONTEND_URL` matches your Railway URL

### 500 Errors?
**Check logs:**
1. Railway Dashboard → Service → Deployments
2. Click latest deployment
3. Scroll down to see error logs

---

## 🎯 Post-Deployment Checklist

- [ ] App deployed successfully
- [ ] Environment variables set
- [ ] Railway domain generated
- [ ] OAuth callbacks updated
- [ ] Frontend config updated with Railway URL
- [ ] Pushed changes to GitHub
- [ ] Demo mode works
- [ ] Login with Google works
- [ ] Login with GitHub works
- [ ] Data saves to MongoDB
- [ ] Health check responds

---

## 💡 Pro Tips

### Custom Domain (Optional):
1. Settings → Domains → Add custom domain
2. Point your DNS to Railway
3. Automatic HTTPS!

### Environment Variables:
- Add via Dashboard → Variables
- Or use Railway CLI: `railway variables set KEY=value`
- Can sync from `.env.production`

### Multiple Environments:
- Create separate services for staging/production
- Use Railway's environment feature

### Database Backups:
- MongoDB Atlas handles backups
- Or add Railway Postgres (paid)

---

## 🆘 Need Help?

- **Railway Docs**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **Railway Status**: https://status.railway.app
- **MongoDB Atlas**: https://www.mongodb.com/docs/atlas/

---

## ✅ Success!

Your Hafiz app is now live on Railway! 🎉

**Your URLs:**
- **App**: https://your-app-name.up.railway.app
- **Health**: https://your-app-name.up.railway.app/health
- **API**: https://your-app-name.up.railway.app/api

**Advantages over Render:**
- ✅ No cold starts
- ✅ Better performance
- ✅ Faster deploys
- ✅ Better logs and monitoring
- ✅ Easier to use

Share your app with the world! 🌍
