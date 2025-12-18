# Demo Rebuild Plan - Complete Functional Demo

**Goal**: Create a fully working demo that mirrors the real app exactly, with localStorage instead of backend.

---

## Files to Create/Modify

### New Files:
1. **demo.html** - Full working demo (copy of app.html with demo mode)
2. **js/demo-app.js** - Demo version that uses localStorage + shows login modal on save
3. **css/demo-modal.css** - Styled login/signup modal

### Modified Files:
1. **index.html** - Add "Try Demo" button, polish login buttons
2. **js/demo.js** - Keep as data source

---

## Implementation Steps

### Phase 1: Create demo.html (30 min)
- Copy app.html structure exactly
- Load demo-app.js instead of app.js
- Add demo banner at top
- Same header, same tabs, same modals

### Phase 2: Create demo-app.js (45 min)
- Copy app.js logic exactly
- Replace API calls with localStorage operations
- Add demo data initialization
- Intercept save operations → show login modal
- Language detection: navigator.language
- All features work: Juz updates, daily logs, stats, language toggle

### Phase 3: Create login modal (20 min)
- Professional styled modal matching app design
- Google button: Logo left + "Continue with Google"
- GitHub button: Logo left + "Continue with GitHub"
- Close button (X)
- On click → Redirect to real app with login flow

### Phase 4: Update index.html (15 min)
- Add prominent "Try Demo" button
- Polish existing login buttons (remove duplicate logos)
- Clean layout

### Phase 5: Testing (10 min)
- Test all features work in demo
- Test language detection
- Test save → login modal
- Test login redirect

**Total Time**: ~2 hours

---

## Demo Features Checklist

✅ Juz grid displays 30 cards
✅ Click Juz → Opens modal
✅ Edit status/pages → Real-time sync works
✅ Save Juz → Shows login modal
✅ Add daily log → Shows login modal
✅ Stats update in real-time (localStorage)
✅ Tab switching works
✅ Language toggle works
✅ Language detection from browser
✅ All styling matches real app
✅ Professional login modal
✅ Redirect to real app after login

---

## Starting Implementation Now...
