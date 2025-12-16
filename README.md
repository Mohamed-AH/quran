# 🌙 Hafiz - Quran Memorization Tracker

> **حافظ** - Your personal companion for tracking Quran memorization journey

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version: 2.0](https://img.shields.io/badge/Version-2.0-blue.svg)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()

A beautiful, bilingual (Arabic/English) web application for tracking your Quran memorization progress. Built with modern web technologies, cloud-synced across devices, and installable as a Progressive Web App.

## ✨ Features

### 🔐 Authentication & Security
- **OAuth Login**: Sign in with Google or GitHub
- **JWT Tokens**: Secure authentication with automatic refresh
- **Privacy First**: Your data belongs to you
- **Cloud Sync**: Access your progress from any device

### 📊 Core Functionality
- **Daily Logging**: Track new pages memorized and pages reviewed
- **Quality Ratings**: Rate your memorization and review quality (1-5 stars)
- **30 Juz Management**: Individual tracking for all 30 Juz with accurate Arabic names
- **Progress Visualization**: Real-time progress ring and statistics
- **Streak Tracking**: Monitor consecutive days of practice
- **Comprehensive History**: View all past entries with dates and details

### 🌐 User Experience
- **Interactive Demo**: Try the app before signing up on landing page
- **Bilingual Interface**: Full Arabic and English support with RTL/LTR layouts
- **Responsive Design**: Beautiful UI on mobile, tablet, and desktop
- **PWA Support**: Installable as a native-like app with offline UI
- **Loading States**: Skeleton loaders and smooth transitions
- **Toast Notifications**: User-friendly feedback messages

### 📈 Statistics & Analytics
- **Total Pages**: Track overall memorization progress
- **Completion Percentage**: Visual progress toward completing all 604 pages
- **Average Quality**: Monitor memorization and review quality trends
- **Current Streak**: Track consecutive days of practice
- **Juz Completion**: Monitor progress through all 30 Juz

## 🏗️ Architecture

### Frontend (Vanilla JavaScript)
- **index.html**: Landing page with interactive demo
- **app.html**: Main authenticated application
- **callback.html**: OAuth callback handler
- **Modular JS**:
  - `js/config.js` - Configuration and constants
  - `js/storage.js` - localStorage wrapper
  - `js/auth.js` - OAuth flow and JWT management
  - `js/api.js` - HTTP client with retry logic
  - `js/ui.js` - Toast notifications, loaders, skeletons
  - `js/app.js` - Main application logic
  - `js/demo.js` - Landing page demo data

### Backend (Node.js/Express)
- **RESTful API**: Clean endpoint structure
- **MongoDB Atlas**: Cloud database
- **JWT Authentication**: Access tokens (15min) with refresh capability
- **OAuth Integration**: Google and GitHub providers
- **Error Handling**: Comprehensive error responses
- **Input Validation**: Request validation middleware

### Tech Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Database**: MongoDB Atlas
- **Authentication**: Passport.js, JWT
- **Fonts**: Google Fonts (Cairo, Amiri, Rakkas, Crimson Pro)
- **Deployment**: Frontend (Vercel/Netlify), Backend (Railway/Render)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- MongoDB Atlas account (free tier)
- Google OAuth credentials
- GitHub OAuth app (optional)

### Backend Setup

1. **Clone the repository**
```bash
git clone https://github.com/Mohamed-AH/quran.git
cd quran/backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your credentials:
# - MONGODB_URI
# - JWT_SECRET
# - GOOGLE_CLIENT_ID
# - GOOGLE_CLIENT_SECRET
# - GITHUB_CLIENT_ID (optional)
# - GITHUB_CLIENT_SECRET (optional)
```

4. **Start the server**
```bash
# Development
npm run dev

# Production
npm start
```

Backend runs on `http://localhost:5000`

### Frontend Setup

1. **Update API configuration**
```javascript
// js/config.js
const CONFIG = {
    API_BASE_URL: 'http://localhost:5000/api',  // Change in production
    // ...
};
```

2. **Serve the frontend**
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server

# Using PHP
php -S localhost:8000
```

3. **Open in browser**
```
http://localhost:8000
```

### Production Deployment

#### Backend Deployment (Railway/Render)
1. Connect your GitHub repository
2. Set environment variables in dashboard
3. Deploy from `main` branch
4. Note your backend URL (e.g., `https://your-app.railway.app`)

#### Frontend Deployment (Vercel/Netlify)
1. Update `js/config.js` with production backend URL
2. Deploy via GitHub or drag-and-drop
3. Configure custom domain (optional)

## 📱 Installation as PWA

### Mobile (iOS/Android)
1. Open the app in Safari/Chrome
2. Tap the Share button
3. Select "Add to Home Screen"
4. Launch like a native app!

### Desktop (Chrome/Edge)
1. Open the app
2. Click the install icon in address bar
3. Click "Install"
4. Launch from desktop like a native app

## 🎯 How to Use

### First Time Setup
1. Open the landing page
2. Try the **interactive demo** to explore features
3. Click **"تسجيل الدخول" (Sign In)**
4. Choose Google or GitHub
5. Complete OAuth authentication
6. Start tracking your memorization!

### Daily Logging
1. Go to **"اليوم" (Today)** tab
2. Enter new pages memorized (e.g., "1-3, 5")
3. Rate your memorization quality (1-5 stars)
4. Enter pages reviewed
5. Rate review quality
6. Add any notes
7. Click **"حفظ اليوم" (Save Today)**

### Managing Juz
1. Go to **"الأجزاء" (Juz)** tab
2. Click on any Juz card
3. Update status: Not Started / In Progress / Completed
4. Set pages memorized (0-20)
5. Add start/end dates
6. Save notes specific to that Juz

### Viewing Progress
- **History Tab**: See all past entries chronologically
- **Statistics Tab**: View detailed analytics
- **Dashboard Cards**: Quick overview at the top

### Language Switching
- Click language toggle button (top right)
- Automatically detects browser language
- Preference saved for future visits

## 💾 Data Storage & Sync

### Cloud Storage
- **Database**: MongoDB Atlas (cloud-hosted)
- **Automatic Sync**: Changes saved immediately to cloud
- **Multi-Device**: Access from phone, tablet, computer
- **No Manual Export**: Data automatically backed up
- **Security**: Encrypted connections, secure authentication

### Privacy & Security
✅ **Your data is private** - Only you can access it
✅ **Secure authentication** - OAuth 2.0 standard
✅ **Encrypted storage** - MongoDB Atlas encryption
✅ **No tracking** - We don't track your usage
✅ **Open source** - Code is transparent and auditable

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/google` - Google OAuth redirect
- `POST /api/auth/github` - GitHub OAuth redirect
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/github/callback` - GitHub OAuth callback
- `POST /api/auth/refresh` - Refresh access token

### User Management
- `GET /api/user/me` - Get current user profile
- `PUT /api/user/settings` - Update user settings

### Logs Management
- `GET /api/logs` - Get all logs (supports pagination)
- `POST /api/logs` - Create new log entry
- `GET /api/logs/:id` - Get specific log
- `PUT /api/logs/:id` - Update log
- `DELETE /api/logs/:id` - Delete log

### Juz Management
- `GET /api/juz` - Get all 30 Juz
- `PUT /api/juz/:juzNumber` - Update specific Juz

### Statistics
- `GET /api/stats` - Get comprehensive statistics

## 🗺️ Version History

### v2.0 - Cloud Version ✅ (Current)
- [x] User authentication (Google, GitHub OAuth)
- [x] Cloud database (MongoDB Atlas)
- [x] Multi-device sync
- [x] RESTful API with JWT
- [x] Modular frontend architecture
- [x] Interactive landing page demo
- [x] Enhanced loading states (skeleton loaders)
- [x] Toast notifications
- [x] PWA with manifest.json
- [x] Automatic token refresh
- [x] Bilingual support maintained

### v1.0 - LocalStorage Version ✅ (Deprecated)
- [x] Daily logging
- [x] Juz management
- [x] Multiple profiles (local)
- [x] Export/Import
- [x] Bilingual support
- [x] Statistics
- [x] PWA support

### v3.0 - Future Enhancements 🚧 (Planned)
- [ ] Service worker for offline support
- [ ] Enhanced analytics with charts
- [ ] Email notifications and reminders
- [ ] Weekly/monthly progress reports
- [ ] Social sharing features
- [ ] Custom themes
- [ ] Audio Quran integration
- [ ] Collaborative features for families

See [ROADMAP.md](./ROADMAP.md) for detailed production plan.

## 🧪 Testing

### Backend Testing
```bash
cd backend
npm test
```

### Frontend Testing
- Manual testing on Chrome, Firefox, Safari, Edge
- Mobile testing on iOS Safari and Chrome Android
- PWA installation testing
- OAuth flow testing with Google and GitHub

## 🐛 Known Issues

- [ ] PWA offline support limited (no service worker yet)
- [ ] Icons need PNG conversion (currently using SVG placeholder)
- [ ] Statistics tab doesn't have charts/graphs yet
- [ ] No email notifications system yet

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Areas for Contribution
- 🐛 Bug reports and fixes
- 💡 Feature suggestions
- 🌍 Translations to other languages
- 📱 UI/UX improvements
- 📚 Documentation enhancements
- ✨ Code optimization
- 🧪 Test coverage improvements

### How to Contribute
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines
- Keep code clean and well-commented
- Test on multiple browsers and devices
- Maintain bilingual support
- Follow existing code style
- Update documentation
- Add tests for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Mohamed A Hameed**
- GitHub: [@Mohamed-AH](https://github.com/Mohamed-AH)
- Email: emah84@gmail.com

## 🙏 Acknowledgments

- Quran verse references and Juz names
- Islamic design inspiration
- Arabic typography experts
- Open source community
- MongoDB Atlas for free tier
- All beta testers and contributors

## 📞 Support

- 🐛 **Bug Reports**: [Open an issue](https://github.com/Mohamed-AH/quran/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/Mohamed-AH/quran/discussions)
- 📧 **Email**: emah84@gmail.com

## 🌟 Star History

If you find this project helpful, please consider giving it a star! ⭐

---

<div align="center">

**جعل الله رحلة حفظك ميسرة وتقبل جهودك**

*May Allah make your memorization journey easy and accept your efforts*

Made with ❤️ for the Muslim Ummah

</div>
