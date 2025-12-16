# Phase 5: Frontend Migration - Final Implementation Plan

**Status**: ✅ Decisions Finalized - Ready for Implementation
**Start Date**: December 16, 2024
**Target Duration**: 2 weeks

---

## ✅ Confirmed Decisions

1. **Frontend Stack**: Vanilla JavaScript (keep existing, no React migration)
2. **Profiles Migration**: No migration (fresh start for all users)
3. **Auth Flow**: Backend-handled OAuth (already implemented)
4. **Token Storage**: localStorage (simple, upgrade to httpOnly in production)
5. **Code Organization**: Split into modules (better maintainability)
6. **Offline Support**: Online only (Phase 8 enhancement)
7. **Migration Approach**: Big bang (all features at once)
8. **NEW: Landing Page**: Demo screen + login options for non-authenticated users ✨

---

## 🎨 Landing Page & User Flow Design

### User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     LANDING PAGE (NEW)                      │
│                                                             │
│  [Logo & Title]                                             │
│  "Track your Quran memorization journey"                    │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │         INTERACTIVE DEMO / PREVIEW                      │ │
│  │                                                         │ │
│  │  Option A: Static Screenshots (Fastest)                │ │
│  │  Option B: Live Mock Data Demo (Better UX)             │ │
│  │  Option C: Video Demo (Medium effort)                  │ │
│  │                                                         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────────────┐  ┌──────────────────────────────┐│
│  │  Login with Google  │  │  Login with GitHub           ││
│  └─────────────────────┘  └──────────────────────────────┘│
│                                                             │
│  [Features list: Daily logs • 30 Juz tracking • Stats]     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    User clicks login
                            │
                            ▼
           ┌────────────────────────────────┐
           │  Backend OAuth Flow             │
           │  (Google/GitHub)                │
           └────────────────────────────────┘
                            │
                            ▼
                   Returns with JWT token
                            │
                            ▼
           ┌────────────────────────────────┐
           │  AUTHENTICATED APP              │
           │                                 │
           │  • Full functionality           │
           │  • All features unlocked        │
           │  • Data from backend API        │
           └────────────────────────────────┘
```

### Landing Page Demo Options

**Option A: Static Screenshots Carousel** ⚡ *Fastest - Recommended*
- 3-4 high-quality screenshots of key features
- Image carousel with captions
- Shows: Daily log form, Juz grid, Statistics dashboard
- ✅ Pros: Easiest to implement, no logic needed, fast load
- ❌ Cons: Not interactive
- **Time**: 1 day

**Option B: Live Interactive Demo with Mock Data** ✨ *Best UX*
- Actual app UI with read-only mock data
- Users can click around and explore
- "This is a demo - Login to use your own data" banner
- Shows realistic experience
- ✅ Pros: Users see exactly what they'll get, interactive
- ❌ Cons: More code, need mock data generation
- **Time**: 2-3 days

**Option C: Video Demo** 📹 *Medium Effort*
- Short 30-60 second video showcasing features
- Autoplay with mute option
- Professional feel
- ✅ Pros: Engaging, shows workflows
- ❌ Cons: Need to create video, larger file size
- **Time**: 1-2 days (plus video creation)

**Recommended for v2.0**: **Option B (Live Interactive Demo)**
- Best conversion rate (users can try before login)
- Showcases the beautiful UI you already have
- Minimal additional code (reuse existing components)
- Can add Option C (video) later as enhancement

---

## 📁 New File Structure

```
quran/
├── index.html                  # Landing page (new)
├── app.html                    # Main app (authenticated)
├── css/
│   ├── styles.css             # Global styles
│   ├── landing.css            # Landing page styles
│   └── app.css                # App-specific styles
├── js/
│   ├── config.js              # Configuration (API URL, etc.)
│   ├── api.js                 # API client with interceptors
│   ├── auth.js                # Authentication logic
│   ├── storage.js             # localStorage wrapper
│   ├── ui.js                  # UI utilities (toasts, loaders)
│   ├── demo.js                # Landing page demo logic (mock data)
│   ├── app.js                 # Main app logic
│   ├── logs.js                # Daily logs management
│   ├── juz.js                 # Juz tracking management
│   └── stats.js               # Statistics calculations
├── assets/
│   ├── screenshots/           # Screenshots for demo (Option A)
│   ├── video/                 # Demo video (Option C)
│   └── icons/                 # App icons
├── manifest.json              # PWA manifest (update)
├── service-worker.js          # Service worker (optional, Phase 8)
└── backend/                   # Existing backend
```

---

## 📋 Detailed Task Breakdown

### Milestone 1: Project Setup (Day 1)
**Goal**: Restructure files and setup infrastructure

- [ ] **1.1** Create new file structure (css/, js/, assets/ folders)
- [ ] **1.2** Split existing index.html into:
  - `index.html` (landing page shell)
  - `app.html` (main app shell)
- [ ] **1.3** Extract CSS from inline to `css/styles.css`
- [ ] **1.4** Extract JavaScript from inline to `js/app.js`
- [ ] **1.5** Update script/link tags in HTML files
- [ ] **1.6** Test that existing app still works after split
- [ ] **1.7** Create `js/config.js` with API base URL

**Deliverable**: Modular file structure, no functionality changes

---

### Milestone 2: API Client Setup (Day 1-2)
**Goal**: Create robust API communication layer

- [ ] **2.1** Create `js/api.js` - API client module
  ```javascript
  // Base client with fetch/axios
  const API_BASE = 'http://localhost:5000/api';

  const api = {
    get: (endpoint) => { /* with auth header */ },
    post: (endpoint, data) => { /* with auth header */ },
    put: (endpoint, data) => { /* with auth header */ },
    delete: (endpoint) => { /* with auth header */ }
  };
  ```

- [ ] **2.2** Add request interceptor
  - Attach JWT token from localStorage to Authorization header
  - Set Content-Type: application/json

- [ ] **2.3** Add response interceptor
  - Handle 401 (Unauthorized) → logout + redirect to landing
  - Handle 403 (Forbidden) → show error
  - Handle 500 (Server Error) → show error with retry
  - Handle network errors → show offline message

- [ ] **2.4** Implement token refresh logic
  - Detect 401 with expired token
  - Call `/api/auth/refresh` endpoint
  - Retry original request with new token
  - Logout if refresh fails

- [ ] **2.5** Add retry logic for failed requests
  - Retry network failures up to 3 times
  - Exponential backoff (1s, 2s, 4s)

- [ ] **2.6** Create error handling utilities in `js/ui.js`
  - `showError(message, isArabic)`
  - `showSuccess(message, isArabic)`
  - `showLoader()`
  - `hideLoader()`

**Deliverable**: Complete API client with error handling

---

### Milestone 3: Authentication Module (Day 2-3)
**Goal**: Implement authentication flow

- [ ] **3.1** Create `js/auth.js` - Authentication module
  ```javascript
  const auth = {
    isAuthenticated: () => { /* check token in localStorage */ },
    getToken: () => { /* get JWT from localStorage */ },
    setToken: (token) => { /* store JWT */ },
    logout: () => { /* clear token, redirect */ },
    handleCallback: () => { /* handle OAuth redirect */ }
  };
  ```

- [ ] **3.2** Implement `isAuthenticated()` function
  - Check if JWT exists in localStorage
  - Optionally: decode JWT and check expiry

- [ ] **3.3** Implement OAuth callback handler
  - Parse URL for token (redirect from backend)
  - Store token in localStorage
  - Redirect to app.html

- [ ] **3.4** Implement logout function
  - Call `/api/auth/logout` endpoint
  - Clear localStorage token
  - Redirect to landing page (index.html)

- [ ] **3.5** Add route guard in app.html
  - Check authentication on page load
  - Redirect to landing if not authenticated

**Deliverable**: Complete authentication system

---

### Milestone 4: Landing Page (Day 3-4)
**Goal**: Create attractive landing page with demo

#### 4.1 Landing Page HTML Structure
- [ ] **4.1.1** Create header section
  - Logo/title: "حافظ | Hafiz"
  - Tagline: "Track your Quran memorization journey"
  - Language toggle (AR/EN)

- [ ] **4.1.2** Create demo section
  - Container for demo content
  - "Try the Demo" or "See it in Action" heading

- [ ] **4.1.3** Create login section
  - "Login with Google" button → redirects to `/api/auth/google`
  - "Login with GitHub" button → redirects to `/api/auth/github`
  - Terms/privacy links (if needed)

- [ ] **4.1.4** Create features section
  - Icon + "Daily memorization logs"
  - Icon + "Track all 30 Juz"
  - Icon + "Visualize your progress"
  - Icon + "Cloud sync across devices"

- [ ] **4.1.5** Create footer
  - Version info
  - Links (optional)

#### 4.2 Landing Page Styles (css/landing.css)
- [ ] **4.2.1** Design hero section (top)
  - Centered layout
  - Gradient background (match current theme)
  - Large, clear typography

- [ ] **4.2.2** Design demo section
  - Card/container styling
  - Shadows and depth
  - Responsive layout

- [ ] **4.2.3** Design login buttons
  - Brand colors (Google red, GitHub black)
  - Icons for each provider
  - Hover effects
  - Mobile-friendly sizing

- [ ] **4.2.4** Design features section
  - Grid layout (2x2 or 4x1)
  - Icons + text
  - Clean, modern look

- [ ] **4.2.5** Responsive design
  - Mobile (< 768px): Stack vertically
  - Tablet (768-1024px): 2-column layout
  - Desktop (> 1024px): Full layout

#### 4.3 Interactive Demo Implementation (js/demo.js)
- [ ] **4.3.1** Create mock data generator
  ```javascript
  const mockData = {
    user: { name: 'Demo User', language: 'ar', theme: 'default' },
    juz: [/* 30 Juz with sample progress */],
    logs: [/* Sample logs from past week */],
    stats: { totalDays: 45, currentStreak: 7, avgRating: 4.2 }
  };
  ```

- [ ] **4.3.2** Render demo UI components
  - Show mini version of Juz grid (clickable but read-only)
  - Show sample daily log entries
  - Show statistics dashboard
  - Add "This is a demo" banner overlay

- [ ] **4.3.3** Make demo interactive
  - Allow clicking through Juz
  - Show log details on click
  - Animate stats
  - All buttons disabled with tooltip: "Login to use"

- [ ] **4.3.4** Add "Login to Get Started" CTA in demo
  - Prominent button after demo interaction
  - Smooth scroll to login section

**Deliverable**: Complete landing page with demo

---

### Milestone 5: Replace LocalStorage with API Calls (Day 5-8)
**Goal**: Migrate all data operations to backend API

#### 5.1 User Profile Operations (js/app.js)
- [ ] **5.1.1** Replace `loadUser()` with API call
  - Old: `localStorage.getItem('user')`
  - New: `GET /api/user`
  - Store in memory + localStorage (as cache)

- [ ] **5.1.2** Replace `updateUser()` with API call
  - Old: `localStorage.setItem('user', ...)`
  - New: `PUT /api/user`
  - Update cache after success

- [ ] **5.1.3** Remove all profile-related code
  - Delete profile selection UI
  - Delete profile CRUD functions
  - Update UI to show single user

#### 5.2 Juz Operations (js/juz.js)
- [ ] **5.2.1** Replace `loadJuz()` with API call
  - Old: `localStorage.getItem('juz')`
  - New: `GET /api/juz`
  - Cache in localStorage

- [ ] **5.2.2** Replace `loadJuzSummary()` with API call
  - Old: Calculate from localStorage
  - New: `GET /api/juz/summary`

- [ ] **5.2.3** Replace `updateJuz()` with API call
  - Old: `localStorage.setItem('juz', ...)`
  - New: `PUT /api/juz/:juzNumber`
  - Optimistic update (update UI immediately, rollback on error)

- [ ] **5.2.4** Add auto-initialization detection
  - Backend auto-creates 30 Juz on first GET
  - Handle loading state during first load

#### 5.3 Daily Logs Operations (js/logs.js)
- [ ] **5.3.1** Replace `loadLogs()` with API call
  - Old: `localStorage.getItem('logs')`
  - New: `GET /api/logs?limit=50&offset=0`
  - Implement pagination (load more on scroll)

- [ ] **5.3.2** Replace `createLog()` with API call
  - Old: `localStorage.setItem('logs', ...)`
  - New: `POST /api/logs`
  - Handle duplicate error (same date)

- [ ] **5.3.3** Replace `updateLog()` with API call
  - Old: Update localStorage array
  - New: `PUT /api/logs/:id`

- [ ] **5.3.4** Replace `deleteLog()` with API call
  - Old: Filter localStorage array
  - New: `DELETE /api/logs/:id`
  - Confirm dialog before delete

#### 5.4 Statistics Operations (js/stats.js)
- [ ] **5.4.1** Replace `calculateStats()` with API call
  - Old: Calculate from localStorage logs
  - New: `GET /api/logs/stats`
  - Cache for 5 minutes (avoid unnecessary calls)

- [ ] **5.4.2** Update statistics UI
  - Show loading skeleton
  - Display stats from API
  - Auto-refresh on log creation/update

#### 5.5 Remove Old LocalStorage Code
- [ ] **5.5.1** Remove all localStorage data operations
  - Keep only: JWT token storage
  - Keep: Language preference
  - Keep: Theme preference
  - Remove: profiles, logs, juz data

- [ ] **5.5.2** Add localStorage as cache layer (optional)
  - Cache API responses for offline viewing
  - Clear cache on logout
  - Sync cache with API on login

**Deliverable**: All features working with backend API

---

### Milestone 6: UI Enhancements (Day 9-10)
**Goal**: Polish UI with loading states and error handling

#### 6.1 Loading States
- [ ] **6.1.1** Add loading spinners
  - On login redirect
  - On API calls (Juz, Logs, Stats)
  - On form submissions

- [ ] **6.1.2** Add skeleton loaders
  - Juz grid skeleton (30 boxes)
  - Logs list skeleton (5 items)
  - Stats skeleton (4 metrics)

- [ ] **6.1.3** Disable buttons during operations
  - "Save" button during log creation
  - Juz cells during update
  - Prevent double-submission

- [ ] **6.1.4** Add progress indicators
  - Upload progress (if adding import feature)
  - Sync progress (if implementing)

#### 6.2 Error Handling
- [ ] **6.2.1** Network error messages (AR + EN)
  - "No internet connection"
  - "Server is unavailable"
  - "Request timed out"

- [ ] **6.2.2** API error display
  - Validation errors (show field-specific)
  - 400: "Invalid data"
  - 401: "Session expired" → redirect login
  - 403: "Access denied"
  - 404: "Not found"
  - 500: "Server error" + retry button

- [ ] **6.2.3** Toast notifications
  - Success: "Log saved ✓"
  - Error: "Failed to save log ✗"
  - Info: "Syncing data..."
  - Auto-dismiss after 3-5 seconds

- [ ] **6.2.4** Offline detection
  - Show banner when offline
  - Disable editing when offline
  - Queue requests (future enhancement)

#### 6.3 UX Improvements
- [ ] **6.3.1** Optimistic updates
  - Update UI immediately (don't wait for API)
  - Rollback on error
  - Show subtle loading indicator

- [ ] **6.3.2** Confirmation dialogs
  - "Are you sure?" before delete
  - "Unsaved changes" before navigation
  - "Logout?" confirmation

- [ ] **6.3.3** Empty states
  - "No logs yet - Add your first entry!"
  - "Start tracking Juz 1"
  - Friendly illustrations/icons

**Deliverable**: Polished UI with great UX

---

### Milestone 7: Testing (Day 11-12)
**Goal**: Comprehensive testing of all features

#### 7.1 Manual Testing
- [ ] **7.1.1** Landing page
  - Test demo (all options clickable, read-only)
  - Test login buttons (both Google & GitHub)
  - Test responsive layout (mobile, tablet, desktop)
  - Test language toggle

- [ ] **7.1.2** Authentication flow
  - Test Google OAuth complete flow
  - Test GitHub OAuth complete flow
  - Test callback handling
  - Test token storage
  - Test logout
  - Test token expiry (wait 15min or manipulate token)
  - Test refresh token flow

- [ ] **7.1.3** User profile
  - Test profile load
  - Test profile update (name, language, theme)
  - Test settings persistence

- [ ] **7.1.4** Juz management
  - Test Juz grid load (all 30)
  - Test Juz summary stats
  - Test Juz update (pages, notes)
  - Test status auto-update (0→not-started, 1-19→in-progress, 20→completed)
  - Test single Juz view

- [ ] **7.1.5** Daily logs
  - Test log creation (today)
  - Test duplicate prevention (try same date)
  - Test log update
  - Test log delete (with confirmation)
  - Test log list with pagination
  - Test date filtering
  - Test empty state

- [ ] **7.1.6** Statistics
  - Test stats display
  - Test stats calculation
  - Test stats update after log change

#### 7.2 Error Scenario Testing
- [ ] **7.2.1** Test offline mode
  - Disconnect internet
  - Try to load app
  - Check error messages
  - Reconnect and verify recovery

- [ ] **7.2.2** Test invalid data
  - Try invalid rating (>5)
  - Try XSS in notes
  - Try invalid page format
  - Verify validation messages

- [ ] **7.2.3** Test API errors
  - Stop backend server → check error handling
  - Corrupt JWT token → check 401 handling
  - Delete user in DB → check 404 handling

#### 7.3 Browser Testing
- [ ] **7.3.1** Chrome (latest)
- [ ] **7.3.2** Firefox (latest)
- [ ] **7.3.3** Safari (latest)
- [ ] **7.3.4** Edge (latest)
- [ ] **7.3.5** Mobile Safari (iOS)
- [ ] **7.3.6** Mobile Chrome (Android)

#### 7.4 Performance Testing
- [ ] **7.4.1** Test with slow network (Chrome throttling)
- [ ] **7.4.2** Test with 100+ logs (large dataset)
- [ ] **7.4.3** Check page load time
- [ ] **7.4.4** Check bundle size (if applicable)

**Deliverable**: Fully tested, production-ready frontend

---

### Milestone 8: Documentation (Day 13)
**Goal**: Update all documentation

- [ ] **8.1** Update README.md
  - Add v2.0 features list
  - Add setup instructions (backend + frontend)
  - Add OAuth setup guide reference
  - Add screenshots

- [ ] **8.2** Create USER-GUIDE.md
  - How to sign up
  - How to use daily logs
  - How to track Juz
  - How to view statistics
  - FAQ section

- [ ] **8.3** Create DEPLOYMENT-GUIDE.md
  - Frontend hosting options (Netlify, Vercel, Render Static)
  - Environment variables setup
  - Production build instructions
  - Domain setup

- [ ] **8.4** Update PWA manifest.json
  - Update app name
  - Update icons
  - Update start_url
  - Update scope

- [ ] **8.5** Create PHASE5-SUMMARY.md
  - What was built
  - Features completed
  - Testing results
  - Known issues/limitations
  - Next steps

**Deliverable**: Complete documentation

---

### Milestone 9: Final Review & Polish (Day 14)
**Goal**: Final checks and polish

- [ ] **9.1** Code review
  - Check for console.logs (remove debug logs)
  - Check for TODO comments
  - Check for hardcoded values
  - Verify error handling everywhere

- [ ] **9.2** Performance optimization
  - Minimize API calls
  - Add caching where appropriate
  - Optimize images
  - Check for memory leaks

- [ ] **9.3** Security review
  - XSS prevention
  - CSRF tokens (if needed)
  - Validate all user inputs
  - Check token storage security

- [ ] **9.4** Accessibility
  - Add ARIA labels
  - Test keyboard navigation
  - Test screen reader (basic)
  - Check color contrast

- [ ] **9.5** Final testing pass
  - Complete user journey (landing → login → use → logout)
  - Test on fresh browser (no cache)
  - Test with new user account
  - Check bilingual support (AR + EN)

- [ ] **9.6** Git cleanup
  - Commit all changes
  - Write clear commit messages
  - Create Phase 5 summary
  - Tag release: v2.0.0-beta

**Deliverable**: Production-ready Phase 5 completion

---

## 📊 Phase 5 Timeline

| Week | Days | Milestone | Deliverable |
|------|------|-----------|-------------|
| 1 | Day 1 | Project Setup | Modular file structure |
| 1 | Day 1-2 | API Client | Complete API layer |
| 1 | Day 2-3 | Authentication | Auth flow working |
| 1 | Day 3-4 | Landing Page | Demo + login page |
| 1 | Day 5-7 | API Integration | All features on API |
| 2 | Day 8 | API Integration | Complete migration |
| 2 | Day 9-10 | UI Polish | Loading states, errors |
| 2 | Day 11-12 | Testing | Fully tested |
| 2 | Day 13 | Documentation | Complete docs |
| 2 | Day 14 | Final Review | Production ready |

**Total: 14 days (2 weeks)**

---

## 🎯 Success Criteria

### Must Have ✅
- [x] Landing page with interactive demo
- [x] Google OAuth login working
- [x] GitHub OAuth login working
- [x] All v1.0 features migrated to API
- [x] No localStorage used for data (only token/preferences)
- [x] Error handling with user-friendly messages
- [x] Loading states on all async operations
- [x] Bilingual support maintained (AR/EN)
- [x] Responsive design maintained
- [x] Token refresh working
- [x] Logout working

### Nice to Have 🌟
- [ ] Optimistic updates
- [ ] Offline read-only cache
- [ ] Pagination for logs
- [ ] Keyboard shortcuts
- [ ] PWA manifest updated
- [ ] Analytics tracking

### Out of Scope (Phase 6+)
- ❌ Offline write support
- ❌ Service Worker
- ❌ Data export feature
- ❌ Social sharing
- ❌ Email notifications
- ❌ Advanced statistics

---

## 🚨 Risks & Mitigation

### Risk 1: OAuth Redirect Issues
**Impact**: Medium
**Mitigation**:
- Test early with both providers
- Check callback URL configuration
- Add detailed error logging

### Risk 2: Token Expiry Edge Cases
**Impact**: Medium
**Mitigation**:
- Implement robust refresh token logic
- Test token expiry scenarios
- Add auto-refresh before expiry

### Risk 3: API Performance with Large Datasets
**Impact**: Low
**Mitigation**:
- Implement pagination for logs
- Add caching layer
- Optimize backend queries (already done)

### Risk 4: Browser Compatibility Issues
**Impact**: Low
**Mitigation**:
- Test on multiple browsers early
- Use standard APIs (no experimental features)
- Add polyfills if needed

---

## 📝 Landing Page Design Mockup

### Desktop Layout (1200px+)
```
┌─────────────────────────────────────────────────────────────┐
│  [Language Toggle: EN/عربي]                      [v2.0]     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│                    ⭐ حافظ | Hafiz ⭐                         │
│           Track Your Quran Memorization Journey              │
│                                                               │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                         │  │
│  │              INTERACTIVE DEMO SECTION                   │  │
│  │                                                         │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ 🎯 This is a demo - Login to use your own data  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                         │  │
│  │  [Juz Grid - 30 boxes with sample progress]            │  │
│  │  [Daily Logs - Sample entries from past week]          │  │
│  │  [Statistics - Sample metrics]                         │  │
│  │                                                         │  │
│  │  All clickable but disabled with tooltip               │  │
│  │                                                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│                  ┌─────────────────────────┐                 │
│                  │   🔐 Login to Start     │                 │
│                  └─────────────────────────┘                 │
│                                                               │
│     ┌──────────────────────┐    ┌──────────────────────┐   │
│     │ 🔵 Login with Google │    │ ⚫ Login with GitHub │   │
│     └──────────────────────┘    └──────────────────────┘   │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    ✨ Features ✨                       │ │
│  │                                                          │ │
│  │  📝 Daily Logs    📚 30 Juz    📊 Statistics    ☁️ Cloud│ │
│  │  Track daily      Progress     Visualize       Sync     │ │
│  │  memorization     on all       your streak     across   │ │
│  │  sessions         Juz          & progress      devices  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│              Secure • Cloud-based • Free Forever             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Mobile Layout (< 768px)
```
┌─────────────────────────────┐
│ [عربي/EN]        [v2.0]     │
├─────────────────────────────┤
│                             │
│      ⭐ حافظ | Hafiz ⭐      │
│  Track Your Quran Journey   │
│                             │
│  ┌─────────────────────────┐│
│  │    DEMO SECTION         ││
│  │  (Stacked vertically)   ││
│  │                         ││
│  │  [Juz Grid - Compact]   ││
│  │  [Sample Logs]          ││
│  │  [Stats Cards]          ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │  🔵 Login with Google   ││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │  ⚫ Login with GitHub    ││
│  └─────────────────────────┘│
│                             │
│  ✨ Features:               │
│  📝 Daily tracking          │
│  📚 30 Juz progress         │
│  📊 Statistics              │
│  ☁️ Cloud sync              │
│                             │
└─────────────────────────────┘
```

---

## 🎨 Color Scheme (From Current App)

```css
:root {
  --forest-dark: #0a3a2a;    /* Main background */
  --forest-mid: #145a3e;     /* Cards, containers */
  --forest-light: #1e7a54;   /* Accents */
  --gold: #d4af37;           /* Primary actions */
  --gold-light: #f4d77f;     /* Hover states */
  --cream: #faf8f3;          /* Text, backgrounds */
  --sage: #8ba888;           /* Secondary elements */
  --shadow: rgba(10, 58, 42, 0.3);
}
```

**Maintain this theme for brand consistency!**

---

## 🔧 Technical Specifications

### API Configuration
```javascript
// js/config.js
const CONFIG = {
  API_BASE_URL: 'http://localhost:5000/api',
  // Change to production URL when deploying
  PRODUCTION_API_URL: 'https://hafiz-api.onrender.com/api',

  TOKEN_KEY: 'hafiz_jwt_token',
  REFRESH_TOKEN_KEY: 'hafiz_refresh_token',
  LANGUAGE_KEY: 'hafiz_language',
  THEME_KEY: 'hafiz_theme',

  TOKEN_EXPIRY_BUFFER: 60000, // Refresh 1min before expiry
  API_TIMEOUT: 10000, // 10 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000 // 1 second
};
```

### Authentication Flow
```javascript
// js/auth.js
const auth = {
  // Check if user is logged in
  isAuthenticated() {
    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    if (!token) return false;

    // Optional: Check if token is expired
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  },

  // Get stored token
  getToken() {
    return localStorage.getItem(CONFIG.TOKEN_KEY);
  },

  // Store token after login
  setToken(token) {
    localStorage.setItem(CONFIG.TOKEN_KEY, token);
  },

  // Handle OAuth callback
  handleCallback() {
    // Backend redirects to: /callback?token=JWT_HERE
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
      this.setToken(token);
      window.location.href = '/app.html';
    } else {
      // Error in OAuth
      showError('Login failed', false);
      window.location.href = '/';
    }
  },

  // Logout
  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem(CONFIG.TOKEN_KEY);
      window.location.href = '/';
    }
  }
};
```

---

## 📋 Next Steps After Plan Approval

1. ✅ Get your approval on this plan
2. Create feature branch: `phase5-frontend-migration`
3. Start with Milestone 1 (Project Setup)
4. Daily check-ins to review progress
5. Adjust timeline if needed
6. Test thoroughly at each milestone
7. Merge to main when Phase 5 complete

---

## ❓ Questions for Final Confirmation

1. **Demo Style**: Confirm Option B (Live Interactive Demo)? Or prefer Option A (Screenshots)?
2. **PWA**: Keep PWA features or remove for now?
3. **Export Feature**: Remove completely or add "Export my data" button?
4. **Language Default**: Arabic or English as default on landing page?
5. **Analytics**: Add Google Analytics / Plausible tracking?

Please confirm these final points and I'll be ready to start implementation! 🚀

---

**Status**: ⏸️ Awaiting Final Approval
**Next**: Begin Milestone 1 (Project Setup)
