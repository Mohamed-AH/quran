# 🧪 Testing Guide - Hafiz v2.0 Frontend

> Comprehensive manual testing checklist for Phase 5 Frontend Migration

## 📋 Pre-Testing Setup

### 1. Start Backend Server

```bash
cd backend
npm run dev
```

**Expected output:**
```
Server running on port 5000
MongoDB connected successfully
✓ Backend ready
```

**Verify backend is running:**
```bash
curl http://localhost:5000/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

### 2. Start Frontend Server

Open a new terminal:

```bash
# From project root
python -m http.server 8000

# OR using Node.js
npx http-server -p 8000

# OR using PHP
php -S localhost:8000
```

**Expected output:**
```
Serving HTTP on 0.0.0.0 port 8000
```

### 3. Open Browser

Navigate to: **http://localhost:8000**

---

## ✅ Testing Checklist

### 🎨 1. Landing Page Tests

#### 1.1 Initial Load
- [ ] Page loads without errors
- [ ] Hero section displays correctly
- [ ] Arabic title "حافظ" visible
- [ ] English subtitle "Hafiz - Quran Memorization Tracker" visible
- [ ] Sign in buttons visible (Google + GitHub)

#### 1.2 Interactive Demo
- [ ] Scroll down to demo section
- [ ] Demo banner shows "Try It Now - No Login Required"
- [ ] Today tab shows sample data
  - [ ] Sample new pages: "1-5"
  - [ ] Star ratings visible (5 stars for new)
  - [ ] Sample review pages: "10-15"
  - [ ] Star ratings visible (4 stars for review)
  - [ ] Sample notes displayed

#### 1.3 Demo Navigation
- [ ] Click "Juz" tab
  - [ ] 30 Juz cards displayed
  - [ ] Juz 1, 4, 7 show green border (completed)
  - [ ] Juz 2, 3, 5 show yellow border (in progress)
  - [ ] Other Juz show red border (not started)
  - [ ] Arabic names visible on cards

- [ ] Click "History" tab
  - [ ] 5 sample log entries visible
  - [ ] Most recent entry at top
  - [ ] Dates, pages, ratings displayed

- [ ] Click "Stats" tab
  - [ ] Total pages: 83
  - [ ] Completed Juz: 3
  - [ ] Current streak: 7
  - [ ] Completion: 13.7%

#### 1.4 Demo Statistics Cards
- [ ] Top left card: "83 صفحات محفوظة"
- [ ] Top right card: "3 أجزاء مكتملة"
- [ ] Bottom left card: "7 أيام متتالية"
- [ ] Bottom right card: Circular progress showing 13.7%

#### 1.5 Language Detection
- [ ] Check browser console for "Detected language: ar" or "en"
- [ ] Should auto-detect based on browser settings

---

### 🔐 2. Authentication Tests

#### 2.1 Google OAuth Flow

**Steps:**
1. Click "Continue with Google" button
2. Should redirect to Google login
3. Select your Google account
4. Grant permissions
5. Should redirect to callback.html
6. Should show "تم تسجيل الدخول بنجاح!" (Success message)
7. After 1.5 seconds, redirects to app.html

**Verify:**
- [ ] Redirected to backend OAuth endpoint
- [ ] Google login page appeared
- [ ] Callback.html shows loading spinner
- [ ] Success icon (✅) appears
- [ ] Redirected to app.html
- [ ] User name/email appears in header (top center)
- [ ] Logout button visible

**Check browser console:**
- [ ] No JavaScript errors
- [ ] Token stored in localStorage: `hafiz_jwt_token`

**Verify token:**
```javascript
// In browser console
localStorage.getItem('hafiz_jwt_token')
// Should return a long JWT string
```

#### 2.2 GitHub OAuth Flow (if configured)

**Steps:**
1. Sign out first
2. Click "Continue with GitHub" button
3. Authorize application
4. Should redirect back and sign in

**Verify:**
- [ ] Same flow as Google
- [ ] User authenticated successfully
- [ ] GitHub username/email appears

#### 2.3 Callback Error Handling

**Test error scenario:**
1. Manually navigate to: `http://localhost:8000/callback.html?error=access_denied`
2. Should see error message
3. Should show "Back to Home" link

**Verify:**
- [ ] Error icon (❌) appears
- [ ] Error message in Arabic/English
- [ ] Back link works

#### 2.4 Authentication State

**Test protected route:**
1. Sign out completely
2. Manually navigate to: `http://localhost:8000/app.html`
3. Should immediately redirect to index.html

**Verify:**
- [ ] Cannot access app.html without authentication
- [ ] Redirects to landing page

---

### ✍️ 3. Daily Logging Tests

#### 3.1 Basic Log Entry

**Steps:**
1. Navigate to "Today" tab (should be default)
2. Check current date displays correctly
3. Enter new pages: `1-3`
4. Click 5 stars for new quality
5. Enter review pages: `10-12`
6. Click 4 stars for review quality
7. Add notes: `Test entry`
8. Click "حفظ اليوم" (Save Today)

**Verify:**
- [ ] Success toast message appears (green)
- [ ] Form clears after saving
- [ ] Statistics update immediately:
  - [ ] Total pages increases by 3
  - [ ] Progress percentage updates
  - [ ] Current streak updates (if applicable)

#### 3.2 Page Format Validation

**Test valid formats:**
- [ ] Single page: `5` → Should accept
- [ ] Range: `1-5` → Should accept
- [ ] Multiple: `1, 3, 5` → Should accept
- [ ] Mixed: `1-3, 7, 10-12` → Should accept
- [ ] Arabic numbers: `١-٥` → Should accept (if supported)

**Test invalid formats:**
- [ ] Empty field → Should show error
- [ ] Invalid characters: `abc` → Should show error
- [ ] Out of range: `605` → Should show error (max 604)
- [ ] Invalid range: `10-5` → Should show error

**Verify error handling:**
- [ ] Error toast appears (red)
- [ ] Form doesn't clear
- [ ] Data not saved
- [ ] User can correct and retry

#### 3.3 Quality Ratings

**Test star selection:**
- [ ] Click 1st star → All stars before highlighted
- [ ] Click 5th star → All 5 stars highlighted
- [ ] Click same star again → Should deselect
- [ ] Hover effect works

**Test without rating:**
- [ ] Try to save without selecting stars
- [ ] Should use default rating or show error

#### 3.4 Notes Field

**Test notes:**
- [ ] Enter short note: `Good session`
- [ ] Enter long note (500+ characters)
- [ ] Enter Arabic text: `الحمد لله`
- [ ] Enter emoji: `🌟 💚`
- [ ] Leave empty (optional field)

**Verify:**
- [ ] All text saves correctly
- [ ] Notes appear in history
- [ ] No character limit issues

#### 3.5 Multiple Entries Same Day

**Steps:**
1. Save first log entry
2. Refresh page
3. Add another log entry for today

**Verify:**
- [ ] Both entries saved
- [ ] Statistics reflect both entries
- [ ] History shows both entries
- [ ] No data loss

---

### 📚 4. Juz Management Tests

#### 4.1 View Juz Grid

**Navigate to "Juz" tab:**
- [ ] All 30 Juz cards displayed
- [ ] Cards show:
  - [ ] Juz number (1-30)
  - [ ] Arabic name (e.g., "الم" for Juz 1)
  - [ ] Progress bar (0-20 pages)
  - [ ] Status color (red/yellow/green border)

#### 4.2 Update Juz Status

**Steps:**
1. Click on "Juz 1" card
2. Modal opens with form
3. Update status to "In Progress"
4. Set pages memorized: `5`
5. Set start date: Today's date
6. Add note: `Started memorizing`
7. Click "حفظ" (Save)

**Verify:**
- [ ] Modal closes
- [ ] Juz 1 card updates:
  - [ ] Border changes to yellow
  - [ ] Progress bar shows 5/20 (25%)
  - [ ] Status text updates
- [ ] Statistics update
- [ ] Toast success message

#### 4.3 Complete a Juz

**Steps:**
1. Click any Juz (e.g., Juz 2)
2. Set status: "Completed"
3. Set pages: `20`
4. Set completion date: Today
5. Add note: `Alhamdulillah`
6. Save

**Verify:**
- [ ] Border changes to green
- [ ] Progress shows 20/20 (100%)
- [ ] "Completed Juz" stat increases by 1
- [ ] Total pages stat increases by 20

#### 4.4 Modal Cancel

**Steps:**
1. Open any Juz modal
2. Make changes
3. Click "إلغاء" (Cancel)

**Verify:**
- [ ] Modal closes
- [ ] Changes not saved
- [ ] Juz card unchanged

#### 4.5 Date Validation

**Test dates:**
- [ ] Set end date before start date → Should accept (no validation yet) or show warning
- [ ] Set future start date → Should accept
- [ ] Clear dates → Should accept (optional)

---

### 📜 5. History Tests

#### 5.1 View History

**Navigate to "History" tab:**
- [ ] All log entries displayed
- [ ] Most recent entries at top
- [ ] Each entry shows:
  - [ ] Date (formatted correctly)
  - [ ] New pages
  - [ ] New rating (stars)
  - [ ] Review pages
  - [ ] Review rating (stars)
  - [ ] Notes

#### 5.2 Empty History

**Test with new account:**
1. Sign out
2. Create new account
3. Navigate to History tab

**Verify:**
- [ ] Empty state message (if implemented)
- [ ] No errors in console
- [ ] Prompts user to add first entry

#### 5.3 Scroll Performance

**Test with many entries:**
- [ ] Create 20+ log entries (use loop if needed)
- [ ] Navigate to History
- [ ] Scroll through list

**Verify:**
- [ ] Smooth scrolling
- [ ] All entries render
- [ ] No memory leaks
- [ ] Performance acceptable

---

### 📊 6. Statistics Tests

#### 6.1 Dashboard Statistics

**Verify top cards:**
- [ ] **Total Pages**: Sum of unique pages from all logs
- [ ] **Completed Juz**: Count of Juz with status "Completed"
- [ ] **Current Streak**: Days with consecutive entries
- [ ] **Progress Circle**: Percentage (total pages ÷ 604 × 100)

#### 6.2 Progress Calculation

**Test calculation:**
1. Note current total pages
2. Add log with 5 new pages
3. Verify total increases by 5
4. Check progress percentage updates

**Manual calculation:**
```
If total pages = 50:
Progress = (50 ÷ 604) × 100 = 8.3%
```

#### 6.3 Streak Tracking

**Test streak:**
1. Note current streak
2. Add entry for today
3. Verify streak increases or maintains

**Test broken streak:**
1. Check last log date in database
2. If more than 1 day gap, streak should reset to 1

#### 6.4 Statistics Tab

**Navigate to "Statistics" tab:**
- [ ] Detailed stats displayed
- [ ] Shows same data as dashboard cards
- [ ] Additional analytics (if implemented)
- [ ] No calculation errors

---

### 🌐 7. Language Switching Tests

#### 7.1 Toggle Language

**In Arabic mode:**
1. Click language toggle button (should say "English")
2. Interface switches to English

**Verify:**
- [ ] All labels change to English
- [ ] Text direction changes to LTR
- [ ] Font changes to Crimson Pro
- [ ] Date format changes
- [ ] Number format changes
- [ ] Tab names change
- [ ] Button text changes

**In English mode:**
1. Click language toggle (should say "العربية")
2. Interface switches to Arabic

**Verify:**
- [ ] All labels change to Arabic
- [ ] Text direction changes to RTL
- [ ] Font changes to Cairo
- [ ] Date format changes
- [ ] Tab names change
- [ ] Button text changes

#### 7.2 Language Persistence

**Test persistence:**
1. Switch to English
2. Refresh page
3. Should stay in English

**Verify:**
- [ ] Language preference saved in localStorage
- [ ] Persists across page refreshes
- [ ] Persists across sessions

#### 7.3 Help Modal Language

**Test help modal:**
1. In Arabic: Click "?" button
2. Modal shows Arabic help text
3. Close modal
4. Switch to English
5. Click "?" button again
6. Modal shows English help text

**Verify:**
- [ ] Help content matches language
- [ ] All help sections visible
- [ ] Scrolling works
- [ ] Close button works

---

### 📱 8. PWA Installation Tests

#### 8.1 Desktop Installation (Chrome/Edge)

**Steps:**
1. Open in Chrome or Edge
2. Look for install icon (⊕) in address bar
3. Click icon
4. Click "Install" in dialog
5. App opens in new window

**Verify:**
- [ ] Install prompt appears
- [ ] App installs successfully
- [ ] Opens in standalone window
- [ ] No browser UI (address bar, etc.)
- [ ] App icon in taskbar
- [ ] Can pin to taskbar
- [ ] Can launch from Start menu

#### 8.2 Mobile Installation (iOS)

**Steps (requires actual iOS device):**
1. Open in Safari on iPhone/iPad
2. Tap Share button (⬆️)
3. Scroll and tap "Add to Home Screen"
4. Edit name if desired
5. Tap "Add"

**Verify:**
- [ ] App icon appears on home screen
- [ ] Tap icon launches app
- [ ] Opens in full screen
- [ ] Looks like native app
- [ ] Appears in app switcher

#### 8.3 Mobile Installation (Android)

**Steps (requires actual Android device):**
1. Open in Chrome on Android
2. Tap three dots menu (⋮)
3. Tap "Add to Home screen" or "Install app"
4. Tap "Add"

**Verify:**
- [ ] App icon appears on home screen
- [ ] Tap icon launches app
- [ ] Opens in full screen
- [ ] Appears in app drawer
- [ ] Can view in recent apps

#### 8.4 Manifest Configuration

**Check manifest.json:**
```bash
curl http://localhost:8000/manifest.json
```

**Verify fields:**
- [ ] `name`: "حافظ - Hafiz: Quran Memorization Tracker"
- [ ] `short_name`: "حافظ Hafiz"
- [ ] `start_url`: "/"
- [ ] `display`: "standalone"
- [ ] `background_color`: "#0a3a2a"
- [ ] `theme_color`: "#d4af37"
- [ ] `icons`: Array with 192x192 and 512x512

---

### 🔧 9. Error Handling Tests

#### 9.1 Network Errors

**Test backend down:**
1. Stop backend server (Ctrl+C in backend terminal)
2. Try to save a log entry
3. Should show error toast

**Verify:**
- [ ] Error message appears
- [ ] User-friendly message (not technical)
- [ ] Form doesn't clear
- [ ] User can retry after backend restarts

**Test slow network:**
1. Open Chrome DevTools
2. Network tab → Throttling → Slow 3G
3. Try to load data

**Verify:**
- [ ] Loading spinners appear
- [ ] Skeleton loaders show
- [ ] Eventually loads or times out gracefully

#### 9.2 Authentication Errors

**Test expired token:**
1. Manually expire token in localStorage:
```javascript
// In browser console
localStorage.setItem('hafiz_jwt_token', 'invalid.token.here')
```
2. Refresh page
3. Should redirect to login

**Verify:**
- [ ] Invalid token detected
- [ ] Redirects to index.html
- [ ] Clears invalid token
- [ ] User can sign in again

#### 9.3 Input Validation Errors

**Test various invalid inputs:**
- [ ] Negative page numbers: `-5`
- [ ] Decimal pages: `1.5`
- [ ] Special characters: `@#$%`
- [ ] SQL injection attempt: `1'; DROP TABLE logs;--`
- [ ] XSS attempt: `<script>alert('xss')</script>`
- [ ] Very long text (10000+ chars)

**Verify:**
- [ ] All invalid inputs rejected
- [ ] Appropriate error messages
- [ ] No security vulnerabilities
- [ ] No app crashes

#### 9.4 API Error Responses

**Test error scenarios:**
- [ ] 400 Bad Request → User-friendly error
- [ ] 401 Unauthorized → Redirect to login
- [ ] 404 Not Found → Appropriate message
- [ ] 500 Server Error → Generic error message
- [ ] Network timeout → Retry or error message

---

### 🔄 10. Cloud Sync Tests

#### 10.1 Multi-Device Sync

**Setup:**
1. Sign in on first browser (Chrome)
2. Create log entry
3. Sign in on second browser (Firefox) with same account
4. Check if data appears

**Verify:**
- [ ] Same user data on both browsers
- [ ] Log entries sync
- [ ] Juz data sync
- [ ] Statistics match

#### 10.2 Concurrent Updates

**Test concurrent editing:**
1. Open app in two browser tabs
2. In tab 1: Create log entry
3. In tab 2: Refresh page
4. Check if tab 2 shows new entry

**Verify:**
- [ ] Data syncs between tabs
- [ ] No data conflicts
- [ ] Last write wins (expected behavior)

#### 10.3 Offline Handling

**Test offline behavior:**
1. Disconnect from internet
2. Try to use app

**Verify:**
- [ ] Shows offline message (if implemented)
- [ ] Graceful degradation
- [ ] Doesn't break completely
- [ ] Can reconnect and continue

---

### 🧹 11. Browser Compatibility Tests

#### 11.1 Chrome/Chromium
- [ ] Fully functional
- [ ] No console errors
- [ ] PWA installable
- [ ] All features work

#### 11.2 Firefox
- [ ] Fully functional
- [ ] No console errors
- [ ] All features work
- [ ] RTL layout correct

#### 11.3 Safari (Desktop)
- [ ] Fully functional
- [ ] No console errors
- [ ] All features work
- [ ] Fonts load correctly

#### 11.4 Edge
- [ ] Fully functional
- [ ] No console errors
- [ ] PWA installable
- [ ] All features work

#### 11.5 Mobile Browsers
- [ ] Chrome Android: Works
- [ ] Safari iOS: Works
- [ ] Responsive layout
- [ ] Touch interactions work

---

### 🎯 12. UI/UX Tests

#### 12.1 Responsive Design

**Test breakpoints:**
- [ ] Desktop (1920x1080): Looks good
- [ ] Laptop (1366x768): Looks good
- [ ] Tablet (768x1024): Looks good
- [ ] Mobile (375x667): Looks good
- [ ] Small mobile (320x568): Looks good

#### 12.2 Loading States

**Verify loading indicators:**
- [ ] Spinner on initial page load
- [ ] Skeleton loaders for data
- [ ] Button disabled during submission
- [ ] Loading text appears
- [ ] Smooth transitions

#### 12.3 Toast Notifications

**Test toasts:**
- [ ] Success toast: Green, auto-dismisses
- [ ] Error toast: Red, auto-dismisses
- [ ] Info toast: Gold, auto-dismisses
- [ ] Position correct (RTL vs LTR)
- [ ] Animation smooth

#### 12.4 Accessibility

**Basic accessibility:**
- [ ] Tab navigation works
- [ ] Enter key submits forms
- [ ] Escape key closes modals
- [ ] Focus indicators visible
- [ ] Contrast ratios acceptable

---

## 📝 Test Results Template

### Test Session Information
- **Date**: YYYY-MM-DD
- **Tester**: Your Name
- **Environment**:
  - OS:
  - Browser:
  - Screen size:
- **Backend Version**:
- **Frontend Version**: 2.0

### Summary
- **Total Tests**: X
- **Passed**: X
- **Failed**: X
- **Skipped**: X

### Failed Tests
1. Test name: Description of failure
2. ...

### Bugs Found
1. **Bug title**: Description, steps to reproduce, severity
2. ...

### Recommendations
- List any suggestions for improvements
- Performance issues
- UX improvements

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot read property of undefined"
**Solution**: Check module loading order in HTML

### Issue: Token not storing
**Solution**: Check browser localStorage settings

### Issue: OAuth redirect not working
**Solution**: Verify backend URL in config.js

### Issue: Statistics not updating
**Solution**: Refresh page, check API response in Network tab

### Issue: PWA not installing
**Solution**: Must be on HTTPS or localhost, check manifest.json

---

## ✅ Sign-off

**Tested by**: ___________________
**Date**: ___________________
**Signature**: ___________________

All critical tests passed: ☐ Yes ☐ No

Ready for production: ☐ Yes ☐ No

**Notes**:
_______________________________________
_______________________________________
_______________________________________

---

**End of Testing Guide**
