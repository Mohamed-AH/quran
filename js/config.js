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
    RECITATION: true, // Tilawa recitation practice tab
    // Transcript-alignment word verdicts (missing/substituted word claims).
    // Off until calibrated against real wrong-recitation clips — the
    // alignment events still flow in debug/harness for tuning.
    WORD_VERDICTS: false,
  },

  // Tilawa recitation engine assets (https://github.com/Mohamed-AH/tilawa,
  // pinned to the commit the vendored core was built from — see tilawa-build/).
  // Each entry is an ORDERED fallback chain, same-origin first: corporate
  // networks often block GitHub domains, but anything served from the app's
  // own origin (committed assets/tilawa/ files, and the backend model proxy
  // at /api/tilawa/model) works wherever the app itself loads.
  TILAWA: {
    CACHE_NAME: 'tilawa-v1',
    MODEL_BYTES: 88307366, // verified before caching to reject truncated downloads
    MODEL_SOURCES: [
      // Backend proxy (same-origin via the static site's /api/* rewrite).
      // Filled in below once API_BASE_URL is resolved for the environment.
      null,
      // Direct fallback (GitHub LFS media) for dev without a backend.
      'https://media.githubusercontent.com/media/Mohamed-AH/tilawa/ec5cdc72c1c48ba29866ca2e3197d6b9a0e2e793/web/frontend/public/fastconformer_full_mixed.onnx',
    ],
    ASSET_BASES: [
      'assets/tilawa/', // committed to this repo — same-origin, no CORS
      'https://raw.githubusercontent.com/Mohamed-AH/tilawa/ec5cdc72c1c48ba29866ca2e3197d6b9a0e2e793/web/frontend/public/',
    ],
    ASSETS: {
      vocab: 'vocab.json',
      quranCtcTokens: 'quran_ctc_tokens.json',
      quran: 'quran.json',
    },
    WORKER_PATH: 'js/vendor/tilawa-worker.js',
  }
};

// Detect environment
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

// Use production URL if in production
if (isProduction && CONFIG.PRODUCTION_API_URL) {
  CONFIG.API_BASE_URL = CONFIG.PRODUCTION_API_URL;
}

// Primary model source = backend proxy, resolved for this environment.
CONFIG.TILAWA.MODEL_SOURCES[0] = CONFIG.API_BASE_URL + '/tilawa/model';

// Recitation build stamp — logged at startup and shown in the debug panel so
// a stale deploy is immediately recognizable. Bump on every recitation change.
CONFIG.TILAWA.BUILD = '2026-07-20e';

// Recitation debug mode: verbose console logging through the whole pipeline
// (audio capture → worker/inference → tilawa diagnostics → coach verdicts)
// plus the on-screen debug panel in the Recite tab.
//
// Enable: open the app once with ?debug=1 (or #debug) — the flag PERSISTS
// itself to localStorage so OAuth redirects and navigation can't lose it —
// or tap the Recite tab title 7 times. Disable with ?debug=0 (or 7 taps).
CONFIG.TILAWA.DEBUG = (() => {
  try {
    const params = new URLSearchParams(window.location.search);
    const hashOn = window.location.hash === '#debug';
    if (params.get('debug') === '0') {
      localStorage.removeItem('hafiz_recite_debug');
    } else if (params.has('debug') || hashOn) {
      localStorage.setItem('hafiz_recite_debug', '1');
    }
    return localStorage.getItem('hafiz_recite_debug') === '1';
  } catch (e) {
    return false;
  }
})();

// Debug Utility - Only logs in development environment
const debug = {
  log: (...args) => {
    if (!isProduction) console.log(...args);
  },
  warn: (...args) => {
    if (!isProduction) console.warn(...args);
  },
  error: (...args) => {
    // Always log errors, even in production
    console.error(...args);
  },
  info: (...args) => {
    if (!isProduction) console.info(...args);
  },
  table: (...args) => {
    if (!isProduction) console.table(...args);
  }
};

// Make CONFIG and debug globally accessible
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
