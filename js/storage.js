/**
 * Storage Module for Hafiz App v2.0
 * Wrapper for localStorage with type safety and error handling
 * Only stores: JWT token, language preference, theme preference
 * All data (logs, juz, user) comes from API
 */

const storage = {
  /**
   * Get JWT token
   */
  getToken() {
    try {
      return localStorage.getItem(CONFIG.TOKEN_KEY);
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  },

  /**
   * Set JWT token
   */
  setToken(token) {
    try {
      localStorage.setItem(CONFIG.TOKEN_KEY, token);
    } catch (error) {
      console.error('Error setting token:', error);
    }
  },

  /**
   * Remove JWT token
   */
  removeToken() {
    try {
      localStorage.removeItem(CONFIG.TOKEN_KEY);
    } catch (error) {
      console.error('Error removing token:', error);
    }
  },

  /**
   * Get language preference
   */
  getLanguage() {
    try {
      return localStorage.getItem(CONFIG.LANGUAGE_KEY) || 'ar';
    } catch (error) {
      console.error('Error getting language:', error);
      return 'ar';
    }
  },

  /**
   * Set language preference
   */
  setLanguage(lang) {
    try {
      localStorage.setItem(CONFIG.LANGUAGE_KEY, lang);
    } catch (error) {
      console.error('Error setting language:', error);
    }
  },

  /**
   * Get theme preference
   */
  getTheme() {
    try {
      return localStorage.getItem(CONFIG.THEME_KEY) || 'default';
    } catch (error) {
      console.error('Error getting theme:', error);
      return 'default';
    }
  },

  /**
   * Set theme preference
   */
  setTheme(theme) {
    try {
      localStorage.setItem(CONFIG.THEME_KEY, theme);
    } catch (error) {
      console.error('Error setting theme:', error);
    }
  },

  /**
   * Clear all app data (on logout)
   */
  clear() {
    try {
      this.removeToken();
      // Keep language and theme preferences
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  },

  /**
   * Cache API response (optional, for offline viewing)
   * Note: This is temporary cache, cleared on logout
   */
  setCacheItem(key, value, ttl = 300000) { // 5 minutes default
    try {
      const item = {
        value: value,
        expiry: Date.now() + ttl
      };
      localStorage.setItem(`cache_${key}`, JSON.stringify(item));
    } catch (error) {
      console.error('Error setting cache:', error);
    }
  },

  /**
   * Get cached item if not expired
   */
  getCacheItem(key) {
    try {
      const itemStr = localStorage.getItem(`cache_${key}`);
      if (!itemStr) return null;

      const item = JSON.parse(itemStr);
      if (Date.now() > item.expiry) {
        // Expired, remove it
        localStorage.removeItem(`cache_${key}`);
        return null;
      }

      return item.value;
    } catch (error) {
      console.error('Error getting cache:', error);
      return null;
    }
  },

  /**
   * Clear all cache
   */
  clearCache() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
};

// Make storage globally accessible
if (typeof window !== 'undefined') {
  window.storage = storage;
}
