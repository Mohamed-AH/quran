/**
 * Configuration for Hafiz App v2.0
 * Central configuration file for API endpoints and settings
 */

const CONFIG = {
  // API Configuration
  API_BASE_URL: 'http://localhost:5000/api',
  // Production API URL (update with your Render backend URL)
  PRODUCTION_API_URL: 'https://hafiz-backend.onrender.com/api',

  // LocalStorage Keys
  TOKEN_KEY: 'hafiz_jwt_token',
  LANGUAGE_KEY: 'hafiz_language',
  THEME_KEY: 'hafiz_theme',

  // Token Configuration
  TOKEN_EXPIRY_BUFFER: 60000, // Refresh token 1 minute before expiry

  // API Request Configuration
  API_TIMEOUT: 10000, // 10 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second

  // App Version
  VERSION: '2.0.0',

  // Feature Flags (for future use)
  FEATURES: {
    PWA_ENABLED: true,
    OFFLINE_MODE: false, // Phase 8
    EXPORT_DATA: false, // Removed as per decision
    PROFILES: false, // Removed as per decision
  }
};

// Detect environment
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

// Use production URL if in production
if (isProduction && CONFIG.PRODUCTION_API_URL) {
  CONFIG.API_BASE_URL = CONFIG.PRODUCTION_API_URL;
}

// Make CONFIG globally accessible
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
