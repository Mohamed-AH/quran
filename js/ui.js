/**
 * UI Utilities for Hafiz App v2.0
 * Handles toasts, loaders, modals, and other UI feedback
 */

const ui = {
  /**
   * Show success toast notification
   */
  showSuccess(message, isArabic = false) {
    this.showToast(message, 'success', isArabic);
  },

  /**
   * Show error toast notification
   */
  showError(message, isArabic = false) {
    this.showToast(message, 'error', isArabic);
  },

  /**
   * Show info toast notification
   */
  showInfo(message, isArabic = false) {
    this.showToast(message, 'info', isArabic);
  },

  /**
   * Show toast notification
   */
  showToast(message, type = 'info', isArabic = false) {
    // Remove existing toast if any
    const existingToast = document.getElementById('toast');
    if (existingToast) {
      existingToast.remove();
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      ${isArabic ? 'right' : 'left'}: 50%;
      transform: translateX(${isArabic ? '50%' : '-50%'});
      background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : 'var(--gold)'};
      color: white;
      padding: 15px 25px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-weight: 600;
      font-family: ${isArabic ? 'Cairo' : 'Crimson Pro'}, sans-serif;
      animation: slideIn 0.3s ease-out;
      max-width: 90%;
      text-align: center;
    `;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateX(${isArabic ? '50%' : '-50%'}) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(${isArabic ? '50%' : '-50%'}) translateY(0);
        }
      }
      @keyframes slideOut {
        from {
          opacity: 1;
          transform: translateX(${isArabic ? '50%' : '-50%'}) translateY(0);
        }
        to {
          opacity: 0;
          transform: translateX(${isArabic ? '50%' : '-50%'}) translateY(-20px);
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(toast);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        toast.remove();
        style.remove();
      }, 300);
    }, 3000);
  },

  /**
   * Show loading spinner
   */
  showLoader(message = '') {
    // Remove existing loader if any
    this.hideLoader();

    const isArabic = storage.getLanguage() === 'ar';
    const defaultMessage = isArabic ? 'جاري التحميل...' : 'Loading...';

    // Create loader overlay
    const loader = document.createElement('div');
    loader.id = 'loader';
    loader.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(10, 58, 42, 0.9);
      backdrop-filter: blur(5px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    // Create spinner
    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 50px;
      height: 50px;
      border: 5px solid rgba(212, 175, 55, 0.2);
      border-top: 5px solid var(--gold);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    `;

    // Create message
    const messageEl = document.createElement('div');
    messageEl.textContent = message || defaultMessage;
    messageEl.style.cssText = `
      color: var(--cream);
      margin-top: 20px;
      font-size: 1.1rem;
      font-family: ${isArabic ? 'Cairo' : 'Crimson Pro'}, sans-serif;
    `;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    loader.appendChild(spinner);
    loader.appendChild(messageEl);
    document.body.appendChild(loader);
  },

  /**
   * Hide loading spinner
   */
  hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.remove();
    }
  },

  /**
   * Show confirmation dialog
   */
  showConfirm(message, isArabic = false) {
    return new Promise((resolve) => {
      const confirmed = window.confirm(message);
      resolve(confirmed);
    });
  },

  /**
   * Disable button during operation
   */
  disableButton(button, isArabic = false) {
    if (!button) return;

    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = isArabic ? 'جاري الحفظ...' : 'Saving...';
    button.style.opacity = '0.6';
    button.style.cursor = 'not-allowed';
  },

  /**
   * Enable button after operation
   */
  enableButton(button) {
    if (!button) return;

    button.disabled = false;
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
    }
    button.style.opacity = '1';
    button.style.cursor = 'pointer';
  },

  /**
   * Create skeleton loader for content
   */
  createSkeleton(container, count = 3) {
    if (!container) return;

    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement('div');
      skeleton.className = 'skeleton';
      skeleton.style.cssText = `
        height: 80px;
        background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-radius: 10px;
        margin-bottom: 15px;
      `;
      container.appendChild(skeleton);
    }

    // Add shimmer animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
    `;
    document.head.appendChild(style);
  },

  /**
   * Show empty state message
   */
  showEmptyState(container, message, isArabic = false) {
    if (!container) return;

    container.innerHTML = `
      <div class="empty-state" style="text-align: center; padding: 60px 20px; color: var(--sage);">
        <div style="font-size: 4rem; margin-bottom: 20px;">📖</div>
        <div style="font-size: 1.2rem; font-family: ${isArabic ? 'Cairo' : 'Crimson Pro'}, sans-serif;">
          ${message}
        </div>
      </div>
    `;
  },

  /**
   * Format date to locale string
   */
  formatDate(date, isArabic = false) {
    const d = new Date(date);
    const locale = isArabic ? 'ar-SA' : 'en-US';
    return d.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  /**
   * Scroll to element smoothly
   */
  scrollTo(element) {
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

// Make ui globally accessible
if (typeof window !== 'undefined') {
  window.ui = ui;
}
