/**
 * Hafiz Backend API Server
 * Main entry point for the Express application
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

const connectDatabase = require('./config/database');
const passport = require('./config/passport');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Initialize Express app
const app = express();

// Trust proxy (required for Render, Railway, and other cloud platforms)
// This allows Express to trust the X-Forwarded-* headers from the reverse proxy
app.set('trust proxy', 1);

// Connect to database
connectDatabase();

// ============================================
// MIDDLEWARE
// ============================================

// Security headers
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true, // Allow cookies
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Initialize Passport
app.use(passport.initialize());

// Logging (only in development)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting (disabled in test/development mode for easier testing)
if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Max requests per window
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', limiter);
} else {
  console.log('⚠️  Rate limiting disabled in development mode');
}

// ============================================
// ROUTES
// ============================================

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Hafiz API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API version endpoint
app.get('/api/version', (req, res) => {
  res.status(200).json({
    success: true,
    version: '2.0.0',
    apiVersion: 'v1',
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Hafiz API',
    version: '2.0.0',
    docs: '/api/docs', // Future: API documentation
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/juz', require('./routes/juz'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/leaderboard', require('./routes/leaderboard'));

// ============================================
// STATIC FILES (Production only)
// ============================================

// Serve static files from parent directory in production (for Railway)
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '..', '..');

  // Serve static assets (CSS, JS, images)
  app.use('/css', express.static(path.join(staticPath, 'css')));
  app.use('/js', express.static(path.join(staticPath, 'js')));
  app.use('/assets', express.static(path.join(staticPath, 'assets')));

  // Serve HTML files
  app.get('/', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });

  app.get('/app.html', (req, res) => {
    res.sendFile(path.join(staticPath, 'app.html'));
  });

  app.get('/callback.html', (req, res) => {
    res.sendFile(path.join(staticPath, 'callback.html'));
  });

  app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(staticPath, 'manifest.json'));
  });

  console.log('📁 Serving static files from:', staticPath);
}

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler (must be after all routes)
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log(`🚀 Hafiz API Server Running`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🚀 Port: ${PORT}`);
  console.log(`🚀 URL: http://localhost:${PORT}`);
  console.log('🚀 ========================================');
  console.log('');
  console.log('📝 Available endpoints:');
  console.log(`   GET  /              - API info`);
  console.log(`   GET  /health        - Health check`);
  console.log(`   GET  /api/version   - API version`);
  console.log('');
  console.log('🔐 Authentication endpoints:');
  console.log(`   GET  /api/auth/google          - Google OAuth login`);
  console.log(`   GET  /api/auth/github          - GitHub OAuth login`);
  console.log(`   GET  /api/auth/me              - Get current user (requires auth)`);
  console.log(`   POST /api/auth/refresh         - Refresh access token`);
  console.log(`   POST /api/auth/logout          - Logout`);
  console.log('');
  console.log('👤 User endpoints:');
  console.log(`   GET    /api/user               - Get user profile (requires auth)`);
  console.log(`   PUT    /api/user               - Update user profile (requires auth)`);
  console.log(`   DELETE /api/user               - Delete user account (requires auth)`);
  console.log('');
  console.log('📝 Logs endpoints:');
  console.log(`   GET    /api/logs               - Get all logs with pagination (requires auth)`);
  console.log(`   POST   /api/logs               - Create new log (requires auth)`);
  console.log(`   GET    /api/logs/stats         - Get user statistics (requires auth)`);
  console.log(`   GET    /api/logs/:id           - Get single log (requires auth)`);
  console.log(`   PUT    /api/logs/:id           - Update log (requires auth)`);
  console.log(`   DELETE /api/logs/:id           - Delete log (requires auth)`);
  console.log('');
  console.log('📖 Juz endpoints:');
  console.log(`   GET    /api/juz                - Get all 30 Juz (requires auth)`);
  console.log(`   GET    /api/juz/summary        - Get Juz summary (requires auth)`);
  console.log(`   GET    /api/juz/:juzNumber     - Get single Juz (requires auth)`);
  console.log(`   PUT    /api/juz/:juzNumber     - Update Juz (requires auth)`);
  console.log('');
  console.log('📊 Statistics endpoints:');
  console.log(`   GET    /api/stats/combined     - Get combined Juz + Log statistics (requires auth)`);
  console.log('');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ UNHANDLED REJECTION! Shutting down...');
  console.error(err);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err);
  process.exit(1);
});

module.exports = app;
