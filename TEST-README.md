# Automated Test Suite for Juz-Based Progress Tracking

## Quick Start

### 1. **Start your backend server**
```bash
cd backend
npm start
```

### 2. **Get your authentication token**
- Open the frontend in your browser
- Log in with Google/GitHub OAuth
- Open Browser DevTools (F12)
- Go to Console tab
- Run: `localStorage.getItem("hafiz_token")`
- Copy the token (without quotes)

### 3. **Run the test suite**
```bash
# From project root directory
node test-juz-system.js
```

### 4. **Enter your token when prompted**
Paste the token you copied from the browser

### 5. **Watch the tests run!**
The script will automatically test all functionality and report results.

---

## What Gets Tested

### ✅ Test Suite 1: Status-Pages Bidirectional Sync
- Completed status → automatically 20 pages
- Not Started status → automatically 0 pages
- 20 pages → status becomes Completed
- 15 pages → status becomes In Progress
- 0 pages → status becomes Not Started

### ✅ Test Suite 2: Dashboard Statistics
- Initial state calculations
- Updates when Juz changes
- No duplicate counting when modifying same Juz
- Multiple saves don't accumulate pages

### ✅ Test Suite 3: Statistics Tab Separation
- Juz Progress metrics present
- Activity Statistics metrics present
- Both sections clearly separated

### ✅ Test Suite 4: Daily Logs Independence
- Daily logs don't affect main progress graph
- Daily logs only affect streak and quality metrics
- Juz stats remain unchanged when adding logs

### ✅ Test Suite 5: Date Handling
- Empty dates work without errors
- Dates persist correctly
- Auto-fill dates on completion

### ✅ Test Suite 6: Edge Cases
- Mixed states (completed, in-progress, not-started)
- Totals always equal 30 Juz
- Complex calculations work correctly

---

## Understanding Results

### ✅ All Green
Everything works perfectly!

### ❌ Some Red
The script will show:
- Which tests failed
- What the expected value was
- What the actual value was

Use this information to debug and fix issues.

### Example Output
```
==============================================================
TEST SUITE 1: Status-Pages Bidirectional Sync
==============================================================

Test 1.1: Completed status → 20 pages
  ✅ Save Juz 1 as completed
  ✅ Juz 1 has 20 pages (not 5)
  ✅ Juz 1 status is completed
  ✅ Juz 1 has end date

Test 1.2: Not Started status → 0 pages
  ✅ Save Juz 2 as not-started
  ✅ Juz 2 has 0 pages (not 10)
  ...
```

---

## Troubleshooting

### "Connection refused"
- Make sure backend is running on port 5000
- Check: `http://localhost:5000/health`

### "Authentication required"
- Make sure you entered the correct token
- Token might have expired - get a fresh one

### "Juz not found"
- The Juz records might not be initialized
- Log in to the frontend first to initialize data

### Tests fail consistently
- Check backend logs for errors
- Check MongoDB connection
- Ensure all recent code changes are applied

---

## Manual Testing

If you prefer manual testing, follow the test plan in the main project documentation.

The automated script is faster and catches more edge cases!
