# Hafiz Backend API

Backend API for Hafiz Quran Memorization Tracker v2.0

## 🚀 Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js 4.x
- **Database:** MongoDB Atlas
- **ODM:** Mongoose 7.x
- **Authentication:** Passport.js (OAuth 2.0)
- **Validation:** Joi
- **Security:** Helmet, CORS, Rate Limiting

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration files
│   │   └── database.js   # MongoDB connection
│   ├── models/           # Mongoose schemas
│   │   ├── User.js       # User model
│   │   ├── Log.js        # Daily log model
│   │   ├── Juz.js        # Juz progress model
│   │   └── index.js      # Models export
│   ├── routes/           # API routes (Phase 3)
│   ├── controllers/      # Route handlers (Phase 3)
│   ├── middleware/       # Custom middleware
│   │   └── errorHandler.js
│   ├── utils/            # Helper functions (Phase 3)
│   └── server.js         # Entry point
├── tests/                # Test files (Phase 6)
├── .env                  # Environment variables (create from .env.example)
├── .env.example          # Environment variables template
├── .gitignore           # Git ignore rules
├── package.json          # Dependencies and scripts
└── README.md             # This file
```

## 🛠️ Setup Instructions

### Prerequisites

- Node.js 18+ and npm 9+
- MongoDB Atlas account (free tier)
- Git

### 1. Clone Repository

```bash
cd backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Create `.env` file from template:

```bash
cp .env.example .env
```

Edit `.env` and update these values:

```env
# Required for Phase 2 testing
NODE_ENV=development
PORT=5000
MONGODB_URI=your-mongodb-atlas-connection-string

# Will be needed in Phase 3 (OAuth setup)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Generate secure random strings for production
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-token-key

# Frontend URL (update when deployed)
FRONTEND_URL=http://localhost:3000
```

### 4. Setup MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create free account (M0 tier - 512MB free)
3. Create cluster:
   - Cloud Provider: AWS (or any)
   - Region: Closest to you
   - Cluster Name: hafiz-cluster
4. Create database user:
   - Username: hafiz-user
   - Password: (generate secure password)
5. Configure network access:
   - IP Whitelist: Add `0.0.0.0/0` (allow all) for development
   - **Production:** Restrict to specific IPs
6. Get connection string:
   - Click "Connect" → "Connect your application"
   - Copy connection string
   - Replace `<password>` with your database password
   - Update `MONGODB_URI` in `.env`

Example connection string:
```
mongodb+srv://hafiz-user:YOUR_PASSWORD@hafiz-cluster.xxxxx.mongodb.net/hafiz?retryWrites=true&w=majority
```

### 5. Run Development Server

```bash
npm run dev
```

Server will start at `http://localhost:5000`

## ✅ Testing the Server

### Test health endpoint:

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "success": true,
  "message": "Hafiz API is running",
  "timestamp": "2025-12-15T10:30:00.000Z",
  "environment": "development"
}
```

### Test version endpoint:

```bash
curl http://localhost:5000/api/version
```

Expected response:
```json
{
  "success": true,
  "version": "2.0.0",
  "apiVersion": "v1"
}
```

### Test database connection:

Check console logs when starting the server:
```
✅ MongoDB Connected: cluster0.xxxxx.mongodb.net
📊 Database: hafiz
```

## 📦 Available Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon (auto-restart)
npm test           # Run tests (Phase 6)
npm run lint       # Run ESLint
npm run format     # Format code with Prettier
```

## 🔧 Current Endpoints (Phase 2)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | / | API info | ✅ Working |
| GET | /health | Health check | ✅ Working |
| GET | /api/version | API version | ✅ Working |

**Phase 3 will add:** Auth endpoints (OAuth, JWT)
**Phase 4 will add:** CRUD endpoints (logs, juz, users)

## 🗄️ Database Models

### User Model

```javascript
{
  email: String (unique, required),
  name: String (required),
  profilePicture: String,
  authProvider: "google" | "github",
  authProviderId: String (unique per provider),
  settings: {
    language: "ar" | "en",
    theme: "default" | "dark"
  },
  lastLoginAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `email` (unique)
- `authProvider + authProviderId` (unique compound)

### Log Model

```javascript
{
  userId: ObjectId (ref: User, indexed),
  date: Date (indexed),
  newPages: String,
  newRating: Number (0-5),
  reviewPages: String,
  reviewRating: Number (0-5),
  notes: String (max 1000 chars),
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `userId + date` (unique compound) - Prevents duplicate logs per day
- `userId + date DESC` - Efficient querying

**Validation:**
- At least one of `newPages` or `reviewPages` required
- Page format: numbers, commas, spaces, hyphens only (e.g., "1-3, 5-7")
- Ratings: 0-5
- Date normalized to midnight UTC

### Juz Model

```javascript
{
  userId: ObjectId (ref: User, indexed),
  juzNumber: Number (1-30, required),
  status: "not-started" | "in-progress" | "completed",
  pages: Number (0-20),
  startDate: Date,
  endDate: Date,
  notes: String (max 500 chars),
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `userId + juzNumber` (unique compound) - One record per user per juz

**Auto-behaviors:**
- When pages = 0 → status = "not-started"
- When pages = 20 → status = "completed" (auto-set endDate)
- When 0 < pages < 20 → status = "in-progress" (auto-set startDate)

## 🔒 Security Features

- ✅ Helmet (security headers)
- ✅ CORS (configured for frontend URL only)
- ✅ Rate limiting (100 requests/15 minutes per IP)
- ✅ Input validation (Mongoose schemas)
- ✅ Error handling (custom middleware)
- 🔜 JWT authentication (Phase 3)
- 🔜 OAuth 2.0 (Phase 3)
- 🔜 Request sanitization (Phase 4)

## 🐛 Troubleshooting

### MongoDB connection fails

**Error:** `MongoServerError: bad auth`
- Check username/password in connection string
- Verify database user exists in MongoDB Atlas

**Error:** `MongooseServerSelectionError: Could not connect`
- Check IP whitelist in MongoDB Atlas (add 0.0.0.0/0 for testing)
- Verify internet connection
- Check firewall settings

### Port already in use

**Error:** `EADDRINUSE: address already in use :::5000`
```bash
# Find process using port 5000
lsof -i :5000

# Kill the process
kill -9 <PID>

# Or use different port in .env
PORT=5001
```

### Module not found errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## 📝 Next Steps (Phase 3)

- [ ] Setup Google OAuth credentials
- [ ] Setup GitHub OAuth credentials
- [ ] Implement Passport.js strategies
- [ ] Create JWT utilities
- [ ] Build auth routes and controllers
- [ ] Add auth middleware

## 👨‍💻 Development Notes

### Code Quality Standards

- **Naming:** camelCase for functions/variables, PascalCase for classes
- **Error Handling:** Always use try-catch for async operations
- **Validation:** Validate all inputs (Mongoose + Joi)
- **Comments:** Only for complex logic, code should be self-documenting
- **Async/Await:** No callbacks, use async/await
- **Environment Variables:** Never hardcode secrets

### Testing Checklist

Before committing:
- [ ] Server starts without errors
- [ ] Health endpoint responds
- [ ] MongoDB connects successfully
- [ ] No console errors
- [ ] Code follows standards
- [ ] Environment variables documented

## 📚 Resources

- [Express.js Documentation](https://expressjs.com/)
- [Mongoose Documentation](https://mongoosejs.com/)
- [MongoDB Atlas Setup](https://www.mongodb.com/docs/atlas/getting-started/)
- [Passport.js Documentation](http://www.passportjs.org/)
- [JWT Introduction](https://jwt.io/introduction)

## 📄 License

MIT

---

**Phase 2 Status:** ✅ COMPLETE
**Next Phase:** Phase 3 - Authentication System
