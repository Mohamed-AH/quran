const mongoose = require('mongoose');

/**
 * User Schema
 * Stores authenticated user information from OAuth providers
 */
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    profilePicture: {
      type: String,
      trim: true,
      default: null,
    },
    authProvider: {
      type: String,
      required: true,
      enum: ['google', 'github'],
      index: true,
    },
    authProviderId: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      index: true,
    },
    settings: {
      language: {
        type: String,
        enum: ['ar', 'en'],
        default: 'ar',
      },
      theme: {
        type: String,
        enum: ['default', 'dark'],
        default: 'default',
      },
      showOnLeaderboard: {
        type: Boolean,
        default: true, // Opt-out (visible by default)
      },
      leaderboardDisplayName: {
        type: String,
        trim: true,
        maxlength: [50, 'Display name cannot exceed 50 characters'],
        default: null, // Will use user.name if null
      },
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Compound index for OAuth provider and provider ID (ensures uniqueness per provider)
userSchema.index({ authProvider: 1, authProviderId: 1 }, { unique: true });

// Instance method: Get safe user data (without sensitive fields)
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    profilePicture: this.profilePicture,
    authProvider: this.authProvider,
    role: this.role,
    settings: this.settings,
    createdAt: this.createdAt,
    lastLoginAt: this.lastLoginAt,
  };
};

// Static method: Find or create user from OAuth profile
userSchema.statics.findOrCreateFromOAuth = async function (profile, provider) {
  const { id, emails, displayName, photos } = profile;
  const email = emails && emails[0] ? emails[0].value : null;

  // Find existing user by provider and provider ID
  let user = await this.findOne({
    authProvider: provider,
    authProviderId: id,
  });

  if (user) {
    // Update last login
    user.lastLoginAt = new Date();
    await user.save();
    return user;
  }

  // Check if user with same email exists with different provider
  if (email) {
    const existingUser = await this.findOne({ email });
    if (existingUser) {
      // Email already registered with different provider
      const providerName = existingUser.authProvider === 'google' ? 'Google' : 'GitHub';
      throw new Error(`This email is already registered using ${providerName}. Please sign in with ${providerName} instead.`);
    }
  }

  // Create new user
  user = await this.create({
    email: email || `${provider}_${id}@hafiz.app`,
    name: displayName || 'User',
    profilePicture: photos && photos[0] ? photos[0].value : null,
    authProvider: provider,
    authProviderId: id,
  });

  return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
