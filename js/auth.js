/**
 * Authentication Module for Hafiz App v2.0
 * Handles OAuth login, token management, and session validation
 */

const auth = {
  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    const token = storage.getToken();
    if (!token) return false;

    // Optionally check if token is expired
    try {
      const payload = this.parseJWT(token);
      const now = Math.floor(Date.now() / 1000);

      // Check if token is expired
      if (payload.exp && payload.exp < now) {
        // Token expired, clear it
        storage.removeToken();
        return false;
      }

      return true;
    } catch {
      // Invalid token
      storage.removeToken();
      return false;
    }
  },

  /**
   * Parse JWT token to get payload
   */
  parseJWT(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      throw new Error('Invalid token');
    }
  },

  /**
   * Get stored token
   */
  getToken() {
    return storage.getToken();
  },

  /**
   * Store token after login
   */
  setToken(token) {
    storage.setToken(token);
  },

  /**
   * Handle OAuth callback
   * Called when user returns from OAuth provider
   */
  handleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');

    if (error) {
      // OAuth error
      const isArabic = storage.getLanguage() === 'ar';
      ui.showError(
        isArabic ? 'فشل تسجيل الدخول' : 'Login failed',
        isArabic
      );
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
      return false;
    }

    if (token) {
      // Success! Store token
      this.setToken(token);

      // Clear URL parameters
      window.history.replaceState({}, document.title, '/app.html');

      return true;
    }

    return false;
  },

  /**
   * Initiate Google OAuth login
   */
  loginWithGoogle() {
    window.location.href = `${CONFIG.API_BASE_URL}/auth/google`;
  },

  /**
   * Initiate GitHub OAuth login
   */
  loginWithGitHub() {
    window.location.href = `${CONFIG.API_BASE_URL}/auth/github`;
  },

  /**
   * Logout user
   */
  async logout() {
    try {
      // Call logout endpoint (clears refresh token cookie)
      // Skip auth since logout endpoint doesn't require it
      await api.post('/auth/logout', null, { skipAuth: true });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage
      storage.removeToken();

      // Redirect to landing page
      window.location.href = '/';
    }
  },

  /**
   * Get current user info from API
   */
  async getCurrentUser() {
    try {
      const response = await api.get('/auth/me');
      return response.user;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  },

  /**
   * Check authentication and redirect if needed
   * Call this on protected pages (app.html)
   */
  requireAuth() {
    // Check if on OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('token') || urlParams.has('error')) {
      const success = this.handleCallback();
      if (!success) return false;
    }

    // Check if authenticated
    if (!this.isAuthenticated()) {
      // Not authenticated, redirect to landing page
      window.location.href = '/';
      return false;
    }

    return true;
  },

  /**
   * Initialize authentication on page load
   */
  init() {
    // Detect language from browser if not set
    if (!storage.getLanguage()) {
      const browserLang = navigator.language || navigator.userLanguage;
      const isArabic = browserLang.startsWith('ar');
      storage.setLanguage(isArabic ? 'ar' : 'en');
    }

    // Set initial language and direction
    const lang = storage.getLanguage();
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }
};

// Make auth globally accessible
if (typeof window !== 'undefined') {
  window.auth = auth;
}
