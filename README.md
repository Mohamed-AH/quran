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

### 🎙️ Recitation Coach (تلاوة)
- **Live Listening**: Recite into your microphone and watch words light up as you say them
- **Pick a Passage or Just Recite**: Choose a surah (and ayah range), or use **"اتلُ مباشرة" (Just Recite)** and the coach detects what you're reciting automatically
- **Mistake Detection**: Skipped verses and unfinished verses are flagged in the session summary
- **Repetition Friendly**: Repeating words or verses for emphasis and contemplation is never counted as a mistake
- **Pause Friendly**: Breathe and pause for reflection between verses — the coach keeps listening patiently
- **100% On-Device & Private**: Powered by [tilawa](https://github.com/Mohamed-AH/tilawa) — recognition runs entirely in your browser; your voice never leaves your device

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
- **Recitation Coach modules**:
  - `js/recitation.js` - Recite tab controller (picker, live view, summary)
  - `js/recitation-coach.js` - Coaching state machine (start/end, mistakes, repetition tolerance)
  - `js/recitation-audio.js` + `js/recitation-audio-processor.js` - Mic capture → 16 kHz chunks
  - `js/recitation-assets.js` - One-time model download + Cache Storage
  - `js/vendor/tilawa-worker.js` - Speech-recognition Web Worker (built in `tilawa-build/`, see its README)

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

### Reciting with the Coach 🎙️
The **"التلاوة" (Recite)** tab is a personal listening coach: it hears your recitation, follows along word by word, and gives you an honest summary at the end.

**Starting a session — two ways:**
1. **Pick a passage**: tap a surah card, optionally narrow the ayah range (من آية / إلى آية), then **"ابدأ التلاوة" (Start Reciting)**.
2. **Just Recite (اتلُ مباشرة)**: tap the 🎯 card at the top of the surah grid and simply begin reciting from anywhere in the Quran. The coach identifies your surah and ayah automatically within a few seconds, shows the surah name it locked onto, and follows you from there to the end of the surah (or until you stop).

**First use only:** the app downloads the speech-recognition model (≈ 88 MB) with a progress bar. It's cached on your device — every later session starts instantly, and recognition works fully offline after that. You'll also be asked once for microphone permission.

**During recitation:**
- The current verse is displayed large; each word turns **gold** as the coach hears it
- The pulse dot next to the timer shows the coach is hearing you
- **Pauses are welcome** — breathe, reflect, take your time between verses; nothing counts down and nothing is flagged
- **Repetition is welcome** — repeating a word or returning to an earlier verse shows a gentle "إعادة — أحسنت التدبر" note, never an error
- Completed verses appear below with a ✓; verses you jumped over are marked ↷
- Tap **"⏹ إنهاء" (Stop)** whenever you're done — or just finish reciting the last verse of the picked passage and the coach stops listening on its own, a couple of seconds later, without waiting for you to tap anything

**The summary shows:**
- A score out of 100 (verses completed, word coverage, recognition confidence)
- **Skipped verses** with their full text so you can review them
- **Missed words** highlighted in red inside their verse
- Repetitions listed as neutral notes (they never reduce your score)
- Verses you didn't reach are listed separately — stopping early isn't a mistake

**Requirements:** a modern browser (Chrome, Edge, Firefox, or Safari) with microphone access. Everything runs on your device — no audio is ever uploaded.

**Works on restricted networks:** the verse data is served from the app itself (`assets/tilawa/`) and the model from the app's backend (`/api/tilawa/model`), so the coach works even on corporate networks that block GitHub. The original GitHub URLs remain as automatic fallbacks, and the backend can be pointed at an internal mirror via the `TILAWA_MODEL_UPSTREAM` environment variable.

**For developers:** the recognition worker is prebuilt and committed under `js/vendor/`; rebuild it with `cd tilawa-build && npm install && npm run build`, and run the coach's test suite with `npm test` (see `tilawa-build/README.md`). A standalone harness page, `test-recitation.html`, lets you stream a WAV file or live mic through the full pipeline with raw event and coach-verdict logs side by side.

**Debug mode:** open the app once with `?debug=1` — the flag persists (survives OAuth redirects and navigation) until you open with `?debug=0`. No URL access? Tap the Recite tab title 7 times. Debug mode gives you:
- An **on-screen debug panel** (works on phones — no devtools needed): build stamp, live mic level, chunk counter, inference stats, coach state, and a rolling event log, with a **"copy report"** button that puts a full JSON diagnostic on the clipboard — paste that into an issue when reporting problems.
- Verbose console logging: `[recite:audio]` (capture settings, cadence), `[recite:ui]` (every tilawa event + the coach's decision), `[tilawa:diag]` (the recognizer's internals), `[tilawa:stats]` (every 5 s — watch `realtimeFactor`: above ~0.9 means the device can't keep up with real-time recognition).

Even without debug mode, a few `[recite]` breadcrumb lines always print (module loaded + build, session start, engine ready, session end) so you can confirm the deployed version and that the pipeline is alive.

**Layered start detection (the coach doesn't rely on tilawa's tracker alone):** field debugging (see `tilawa-build/README.md` if present, or git history around build stamps `2026-07-20*`) surfaced real cases where tilawa's `RecitationTracker` locks onto a wrong verse from pre-recitation noise and then refuses to jump to the actual recitation (`advance_decision ... blocked, reason: "live non-continuation discovery blocked"`). Rather than depend on the tracker's own advance gate, the coach starts and advances from THREE independent signals, any one of which is sufficient: (1) `verse_match` — the tracker's own committed match; (2) `verse_candidate` — its ranked discovery candidates, scanned for the best IN-RANGE one (not just the top-ranked, which can be an out-of-range fusion pick); (3) transcript alignment — if the decoded `raw_transcript` text aligns to enough expected words, that alignment IS the start/advance signal, independent of the tracker's internal state entirely. A stuck tracker is also actively un-stuck: an out-of-range lock during `awaiting_start` triggers a tracker reset so discovery re-runs clean.

**How correction works (and its limits):** the [tilawa](https://github.com/Mohamed-AH/tilawa) engine is a streaming *recognizer* — it identifies verses and tracks position through continuous multi-verse recitation, but it does not judge correctness. All coaching verdicts are computed in this app on top of its events, in three layers: (1) structural — skipped verses, unfinished verses, out-of-order jumps, detected from verse-level tracking (very reliable); (2) word-level — the recognizer's decoded transcript is aligned against the expected passage text to confirm word coverage and detect omitted or substituted words (`tilawa-build/src/align.js`; substitution/omission *claims* are behind `CONFIG.FEATURES.WORD_VERDICTS`, off by default until calibrated with real wrong-recitation clips — coverage improvement from the same alignment is always on); (3) content verification — tilawa's own position tracking can complete a verse via a duration-based fallback with zero actual lexical confirmation (it advances on "roughly the right amount of speech happened," not "these were the right words"), so the coach cross-checks tilawa's own per-cycle lexical-match signal, both session-wide (a session with real matches nowhere is entirely unscored) and per-verse (a single fabricated verse inside an otherwise good session is flagged `unverified` rather than silently credited — see `tilawa-build/README.md`'s content-verification sections for the exact mechanism and its known calibration limits). Missed-word verdicts have a soft middle tier too: a verse's own last 1-2 words can be genuinely spoken but never individually confirmed if the tracker advances to the next verse before one more cycle would have caught them — genuinely indistinguishable from a real omission using tilawa's data alone, so these surface as "possibly missed (unconfirmed)" rather than a flat accusation (see `tilawa-build/README.md`'s "A verse's own last word(s) can be said but never confirmed" section). Not detectable with this model: tajweed quality and diacritic-level (haraka) mistakes — those would need a different model, not more code. The coach also recognizes that opening a surah is done several equally accepted ways — with isti'adhah, with the Basmala, with both, or with neither — and never flags any of them as missed or substituted (see `tilawa-build/README.md`'s "Isti'adhah / Basmala are optional" section for the exact rule).

**Why Render server logs are quiet during recitation:** the entire pipeline — microphone, speech recognition, coaching — runs inside the browser; audio never leaves the device (this is the privacy design, not a bug). The only server-side event is the one-time model download, which logs `[tilawa] model requested (server cache HIT/MISS)` lines on the backend.

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
