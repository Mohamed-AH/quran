const Joi = require('joi');

/**
 * Validation Schemas
 * Input validation for all API endpoints using Joi
 */

// ============================================
// USER VALIDATION
// ============================================

const updateUserSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).messages({
    'string.empty': 'Name cannot be empty',
    'string.max': 'Name cannot exceed 100 characters',
  }),
  // Allow language and theme at top level (for direct updates)
  language: Joi.string().valid('ar', 'en').messages({
    'any.only': 'Language must be either "ar" or "en"',
  }),
  theme: Joi.string().valid('default', 'dark').messages({
    'any.only': 'Theme must be either "default" or "dark"',
  }),
  // Also allow settings object (for nested updates)
  settings: Joi.object({
    language: Joi.string().valid('ar', 'en').messages({
      'any.only': 'Language must be either "ar" or "en"',
    }),
    theme: Joi.string().valid('default', 'dark').messages({
      'any.only': 'Theme must be either "default" or "dark"',
    }),
    showOnLeaderboard: Joi.boolean().messages({
      'boolean.base': 'showOnLeaderboard must be true or false',
    }),
    leaderboardDisplayName: Joi.string().trim().max(50).allow(null, '').messages({
      'string.max': 'Display name cannot exceed 50 characters',
    }),
  }),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

// ============================================
// LOG VALIDATION
// ============================================

const createLogSchema = Joi.object({
  date: Joi.date().iso().optional(),
  newPages: Joi.string()
    .trim()
    .pattern(/^[\d\s,\-]*$/)
    .max(100)
    .allow('')
    .messages({
      'string.pattern.base': 'Invalid page format. Use numbers, commas, spaces, and hyphens only (e.g., "1-3, 5")',
      'string.max': 'New pages cannot exceed 100 characters',
    }),
  newRating: Joi.number().integer().min(0).max(5).default(0).messages({
    'number.min': 'Rating must be between 0 and 5',
    'number.max': 'Rating must be between 0 and 5',
  }),
  reviewPages: Joi.string()
    .trim()
    .pattern(/^[\d\s,\-]*$/)
    .max(100)
    .allow('')
    .messages({
      'string.pattern.base': 'Invalid page format. Use numbers, commas, spaces, and hyphens only (e.g., "10-15")',
      'string.max': 'Review pages cannot exceed 100 characters',
    }),
  reviewRating: Joi.number().integer().min(0).max(5).default(0).messages({
    'number.min': 'Rating must be between 0 and 5',
    'number.max': 'Rating must be between 0 and 5',
  }),
  notes: Joi.string().trim().max(1000).allow('').messages({
    'string.max': 'Notes cannot exceed 1000 characters',
  }),
})
  .custom((value, helpers) => {
    // At least one of newPages or reviewPages must be provided
    if (!value.newPages && !value.reviewPages) {
      return helpers.error('any.custom', {
        message: 'At least one of newPages or reviewPages must be provided',
      });
    }
    return value;
  })
  .messages({
    'any.custom': '{{#message}}',
  });

const updateLogSchema = Joi.object({
  newPages: Joi.string()
    .trim()
    .pattern(/^[\d\s,\-]*$/)
    .max(100)
    .allow('')
    .messages({
      'string.pattern.base': 'Invalid page format',
      'string.max': 'New pages cannot exceed 100 characters',
    }),
  newRating: Joi.number().integer().min(0).max(5).messages({
    'number.min': 'Rating must be between 0 and 5',
    'number.max': 'Rating must be between 0 and 5',
  }),
  reviewPages: Joi.string()
    .trim()
    .pattern(/^[\d\s,\-]*$/)
    .max(100)
    .allow('')
    .messages({
      'string.pattern.base': 'Invalid page format',
      'string.max': 'Review pages cannot exceed 100 characters',
    }),
  reviewRating: Joi.number().integer().min(0).max(5).messages({
    'number.min': 'Rating must be between 0 and 5',
    'number.max': 'Rating must be between 0 and 5',
  }),
  notes: Joi.string().trim().max(1000).allow('').messages({
    'string.max': 'Notes cannot exceed 1000 characters',
  }),
}).min(1);

// Query parameters for getting logs
const getLogsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50).messages({
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 100',
  }),
  offset: Joi.number().integer().min(0).default(0).messages({
    'number.min': 'Offset must be 0 or greater',
  }),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional().messages({
    'date.min': 'End date must be after start date',
  }),
});

// ============================================
// JUZ VALIDATION
// ============================================

const updateJuzSchema = Joi.object({
  status: Joi.string().valid('not-started', 'in-progress', 'completed').messages({
    'any.only': 'Status must be one of: not-started, in-progress, completed',
  }),
  pages: Joi.number().integer().min(0).max(20).messages({
    'number.min': 'Pages must be between 0 and 20',
    'number.max': 'Pages must be between 0 and 20',
  }),
  startDate: Joi.date().iso().allow(null).optional(),
  endDate: Joi.date().iso().allow(null).min(Joi.ref('startDate')).optional().messages({
    'date.min': 'End date cannot be before start date',
  }),
  notes: Joi.string().trim().max(500).allow('').messages({
    'string.max': 'Notes cannot exceed 500 characters',
  }),
}).min(1);

// Juz number parameter (URL params come as strings, so we wrap in object and convert)
const juzNumberSchema = Joi.object({
  juzNumber: Joi.number().integer().min(1).max(30).required().messages({
    'number.base': 'Juz number must be a valid number',
    'number.min': 'Juz number must be between 1 and 30',
    'number.max': 'Juz number must be between 1 and 30',
    'any.required': 'Juz number is required',
  }),
});

// ============================================
// VALIDATION MIDDLEWARE
// ============================================

/**
 * Create validation middleware for request body
 */
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    req.body = value;
    next();
  };
};

/**
 * Create validation middleware for query parameters
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    req.query = value;
    next();
  };
};

/**
 * Create validation middleware for URL parameters
 */
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      convert: true, // Allow string to number conversion
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    req.params = value;
    next();
  };
};

module.exports = {
  // Schemas
  updateUserSchema,
  createLogSchema,
  updateLogSchema,
  getLogsQuerySchema,
  updateJuzSchema,
  juzNumberSchema,

  // Middleware
  validateBody,
  validateQuery,
  validateParams,
};
