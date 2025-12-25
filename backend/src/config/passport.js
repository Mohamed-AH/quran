const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const { User, Juz, AppSettings, InviteCode } = require('../models');

/**
 * Passport.js Configuration
 * OAuth 2.0 strategies for Google and GitHub
 */

/**
 * Serialize user to session
 * Only store user ID in session
 */
passport.serializeUser((user, done) => {
  done(null, user._id);
});

/**
 * Deserialize user from session
 * Retrieve full user object from database
 */
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

/**
 * Google OAuth 2.0 Strategy
 */
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists
          let user = await User.findOne({
            authProvider: 'google',
            authProviderId: profile.id,
          });

          // If user exists, just update last login and return
          if (user) {
            user.lastLoginAt = new Date();
            await user.save();
            return done(null, user);
          }

          // New user - check if invite codes are required
          const settings = await AppSettings.getSettings();
          if (settings.requireInviteCode) {
            // Extract invite code from state parameter
            let inviteCodeValue = null;
            try {
              const state = req.query.state ? JSON.parse(req.query.state) : null;
              inviteCodeValue = state?.inviteCode;
            } catch (e) {
              // Ignore JSON parse errors
            }

            if (!inviteCodeValue) {
              return done(new Error('Invite code required for signup'), null);
            }

            // Validate invite code
            const inviteCode = await InviteCode.findOne({ code: inviteCodeValue });
            const validation = inviteCode ? inviteCode.isValid() : { valid: false, reason: 'Code not found' };

            if (!validation.valid) {
              return done(new Error(validation.reason || 'Invalid invite code'), null);
            }
          }

          // Create new user
          user = await User.findOrCreateFromOAuth(profile, 'google');

          // Mark invite code as used
          if (settings.requireInviteCode) {
            try {
              const state = req.query.state ? JSON.parse(req.query.state) : null;
              const inviteCodeValue = state?.inviteCode;
              if (inviteCodeValue) {
                const inviteCode = await InviteCode.findOne({ code: inviteCodeValue });
                if (inviteCode) {
                  await inviteCode.markAsUsed(user._id);
                }
              }
            } catch (e) {
              // Ignore errors updating invite code usage
              console.error('Error marking invite code as used:', e);
            }
          }

          // Initialize Juz for new users
          const juzCount = await Juz.countDocuments({ userId: user._id });
          if (juzCount === 0) {
            await Juz.initializeForUser(user._id);
          }

          done(null, user);
        } catch (error) {
          done(error, null);
        }
      }
    )
  );
} else {
  console.warn('⚠️  Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
}

/**
 * GitHub OAuth Strategy
 */
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || '/api/auth/github/callback',
        scope: ['user:email'], // Request email access
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists
          let user = await User.findOne({
            authProvider: 'github',
            authProviderId: profile.id,
          });

          // If user exists, just update last login and return
          if (user) {
            user.lastLoginAt = new Date();
            await user.save();
            return done(null, user);
          }

          // New user - check if invite codes are required
          const settings = await AppSettings.getSettings();
          if (settings.requireInviteCode) {
            // Extract invite code from state parameter
            let inviteCodeValue = null;
            try {
              const state = req.query.state ? JSON.parse(req.query.state) : null;
              inviteCodeValue = state?.inviteCode;
            } catch (e) {
              // Ignore JSON parse errors
            }

            if (!inviteCodeValue) {
              return done(new Error('Invite code required for signup'), null);
            }

            // Validate invite code
            const inviteCode = await InviteCode.findOne({ code: inviteCodeValue });
            const validation = inviteCode ? inviteCode.isValid() : { valid: false, reason: 'Code not found' };

            if (!validation.valid) {
              return done(new Error(validation.reason || 'Invalid invite code'), null);
            }
          }

          // Create new user
          user = await User.findOrCreateFromOAuth(profile, 'github');

          // Mark invite code as used
          if (settings.requireInviteCode) {
            try {
              const state = req.query.state ? JSON.parse(req.query.state) : null;
              const inviteCodeValue = state?.inviteCode;
              if (inviteCodeValue) {
                const inviteCode = await InviteCode.findOne({ code: inviteCodeValue });
                if (inviteCode) {
                  await inviteCode.markAsUsed(user._id);
                }
              }
            } catch (e) {
              // Ignore errors updating invite code usage
              console.error('Error marking invite code as used:', e);
            }
          }

          // Initialize Juz for new users
          const juzCount = await Juz.countDocuments({ userId: user._id });
          if (juzCount === 0) {
            await Juz.initializeForUser(user._id);
          }

          done(null, user);
        } catch (error) {
          done(error, null);
        }
      }
    )
  );
} else {
  console.warn('⚠️  GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.');
}

module.exports = passport;
