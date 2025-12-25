/**
 * API Client for Hafiz App v2.0
 * Handles all HTTP requests to the backend with interceptors, error handling, and retry logic
 */

const api = {
  /**
   * Make a GET request
   */
  async get(endpoint, options = {}) {
    return this.request('GET', endpoint, null, options);
  },

  /**
   * Make a POST request
   */
  async post(endpoint, data, options = {}) {
    return this.request('POST', endpoint, data, options);
  },

  /**
   * Make a PUT request
   */
  async put(endpoint, data, options = {}) {
    return this.request('PUT', endpoint, data, options);
  },

  /**
   * Make a DELETE request
   */
  async delete(endpoint, options = {}) {
    return this.request('DELETE', endpoint, null, options);
  },

  /**
   * Core request method with interceptors and retry logic
   */
  async request(method, endpoint, data = null, options = {}) {
    const { retryCount = 0, skipAuth = false } = options;

    try {
      // Build request configuration
      const config = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      // Add JWT token if not skipping auth
      if (!skipAuth) {
        const token = storage.getToken();
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
      }

      // Add body for POST/PUT requests
      if (data && (method === 'POST' || method === 'PUT')) {
        config.body = JSON.stringify(data);
        // Debug logging
        debug.log('🌐 API: Sending', method, 'request to', endpoint);
        debug.log('🌐 API: Request body (stringified):', config.body);
        debug.log('🌐 API: Request data (before stringify):', JSON.stringify(data, null, 2));
      }

      // Make request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);
      config.signal = controller.signal;

      const url = `${CONFIG.API_BASE_URL}${endpoint}`;
      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      // Handle different response statuses
      if (response.ok) {
        // Success response (2xx)
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        }
        return { success: true };
      }

      // Handle error responses
      return await this.handleErrorResponse(response, method, endpoint, data, options, retryCount);

    } catch (error) {
      // Handle network errors
      return await this.handleNetworkError(error, method, endpoint, data, options, retryCount);
    }
  },

  /**
   * Handle HTTP error responses
   */
  async handleErrorResponse(response, method, endpoint, data, options, retryCount) {
    const status = response.status;
    let errorData;

    try {
      errorData = await response.json();
    } catch {
      errorData = { error: 'Unknown error' };
    }

    // Handle 401 Unauthorized
    if (status === 401) {
      // Token expired or invalid
      const refreshed = await this.tryRefreshToken();
      if (refreshed && retryCount < 1) {
        // Retry the original request with new token
        return this.request(method, endpoint, data, { ...options, retryCount: retryCount + 1 });
      } else {
        // Refresh failed, logout user
        if (typeof auth !== 'undefined') {
          auth.logout();
        }
        throw new Error('Session expired. Please login again.');
      }
    }

    // Handle 403 Forbidden
    if (status === 403) {
      ui.showError('Access denied', storage.getLanguage() === 'ar');
      throw new Error('Access denied');
    }

    // Handle 404 Not Found
    if (status === 404) {
      throw new Error(errorData.error || 'Resource not found');
    }

    // Handle 500 Server Error
    if (status >= 500) {
      if (retryCount < CONFIG.RETRY_ATTEMPTS) {
        // Retry after delay
        await this.delay(CONFIG.RETRY_DELAY * Math.pow(2, retryCount));
        return this.request(method, endpoint, data, { ...options, retryCount: retryCount + 1 });
      }
      throw new Error('Server error. Please try again later.');
    }

    // Handle 400 Bad Request (validation errors)
    if (status === 400) {
      const message = errorData.details ? errorData.details.join(', ') : errorData.error;
      throw new Error(message || 'Invalid request');
    }

    // Generic error
    throw new Error(errorData.error || 'Request failed');
  },

  /**
   * Handle network errors (offline, timeout, etc.)
   */
  async handleNetworkError(error, method, endpoint, data, options, retryCount) {
    // Check if it's an abort (timeout)
    if (error.name === 'AbortError') {
      if (retryCount < CONFIG.RETRY_ATTEMPTS) {
        await this.delay(CONFIG.RETRY_DELAY * Math.pow(2, retryCount));
        return this.request(method, endpoint, data, { ...options, retryCount: retryCount + 1 });
      }
      throw new Error('Request timeout. Please try again.');
    }

    // Network error (offline)
    if (!navigator.onLine) {
      ui.showError('No internet connection', storage.getLanguage() === 'ar');
      throw new Error('No internet connection');
    }

    // Retry on network failure
    if (retryCount < CONFIG.RETRY_ATTEMPTS) {
      await this.delay(CONFIG.RETRY_DELAY * Math.pow(2, retryCount));
      return this.request(method, endpoint, data, { ...options, retryCount: retryCount + 1 });
    }

    throw new Error('Network error. Please check your connection.');
  },

  /**
   * Try to refresh the access token
   */
  async tryRefreshToken() {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // Send refresh token cookie
      });

      if (response.ok) {
        const data = await response.json();
        if (data.accessToken) {
          storage.setToken(data.accessToken);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  },

  /**
   * Delay helper for retry logic
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Make api globally accessible
if (typeof window !== 'undefined') {
  window.api = api;
}
