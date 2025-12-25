const { APIError } = require('./errorHandler');

/**
 * Admin Middleware
 * Ensures only users with role='admin' can access protected routes
 * Must be used AFTER auth middleware (requires req.user to be set)
 */
const requireAdmin = (req, res, next) => {
  // Check if user is authenticated (should be set by auth middleware)
  if (!req.user) {
    throw new APIError('Authentication required', 401);
  }

  // Check if user has admin role
  if (req.user.role !== 'admin') {
    throw new APIError('Admin access required. You do not have permission to access this resource.', 403);
  }

  // User is admin, proceed
  next();
};

module.exports = {
  requireAdmin,
};
