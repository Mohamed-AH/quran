const mongoose = require('mongoose');

/**
 * AppSettings Schema
 * Global application settings (singleton - only one document)
 * Controls app-wide features like signup restrictions and leaderboard
 */
const appSettingsSchema = new mongoose.Schema(
  {
    // Signup Control
    requireInviteCode: {
      type: Boolean,
      default: false, // Allow open signup by default
    },

    // Leaderboard Control
    leaderboardEnabled: {
      type: Boolean,
      default: true, // Leaderboard enabled by default
    },

    // Future settings can be added here
    // maintenanceMode: { type: Boolean, default: false },
    // maxUsersAllowed: { type: Number, default: null },
    // etc.
  },
  {
    timestamps: true,
  }
);

// Static method: Get or create singleton settings
appSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();

  if (!settings) {
    // Create default settings if none exist
    settings = await this.create({
      requireInviteCode: false,
      leaderboardEnabled: true,
    });
  }

  return settings;
};

// Static method: Update settings
appSettingsSchema.statics.updateSettings = async function (updates) {
  let settings = await this.getSettings();

  // Update only allowed fields
  const allowedFields = ['requireInviteCode', 'leaderboardEnabled'];
  Object.keys(updates).forEach((key) => {
    if (allowedFields.includes(key)) {
      settings[key] = updates[key];
    }
  });

  await settings.save();
  return settings;
};

const AppSettings = mongoose.model('AppSettings', appSettingsSchema);

module.exports = AppSettings;
