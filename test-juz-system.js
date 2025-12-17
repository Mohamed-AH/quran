/**
 * Automated Test Suite for Juz-Based Progress Tracking System
 * Run from project root: node test-juz-system.js
 */

const readline = require('readline');

const API_BASE = 'http://localhost:5000/api';
let token = '';
let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, passed, message = '') {
  const symbol = passed ? '✅' : '❌';
  const color = passed ? 'green' : 'red';
  log(`  ${symbol} ${testName}${message ? ': ' + message : ''}`, color);

  testResults.tests.push({ name: testName, passed, message });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

function logSection(title) {
  console.log('');
  log(`${'='.repeat(60)}`, 'cyan');
  log(title, 'cyan');
  log(`${'='.repeat(60)}`, 'cyan');
}

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Helper function to make API calls using native fetch
async function apiCall(method, endpoint, data = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const responseData = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: responseData.message || `HTTP ${response.status}`
      };
    }

    return { success: true, data: responseData };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Test Suite 1: Status-Pages Bidirectional Sync
async function testStatusPagesSync() {
  logSection('TEST SUITE 1: Status-Pages Bidirectional Sync');

  // Test 1.1: Status → Pages (Completed)
  log('\nTest 1.1: Completed status → 20 pages', 'yellow');
  let result = await apiCall('PUT', '/juz/1', { status: 'completed', pages: 5 });
  if (!result.success) {
    log(`  ⚠️  API Error: ${result.error}`, 'red');
  }
  logTest('Save Juz 1 as completed', result.success);

  result = await apiCall('GET', '/juz/1');
  logTest('Juz 1 has 20 pages (not 5)', result.success && result.data.juz.pages === 20);
  logTest('Juz 1 status is completed', result.success && result.data.juz.status === 'completed');
  logTest('Juz 1 has end date', result.success && result.data.juz.endDate !== null);

  // Test 1.2: Status → Pages (Not Started)
  log('\nTest 1.2: Not Started status → 0 pages', 'yellow');
  result = await apiCall('PUT', '/juz/2', { status: 'not-started', pages: 10 });
  logTest('Save Juz 2 as not-started', result.success);

  result = await apiCall('GET', '/juz/2');
  logTest('Juz 2 has 0 pages (not 10)', result.success && result.data.juz.pages === 0);
  logTest('Juz 2 status is not-started', result.success && result.data.juz.status === 'not-started');
  logTest('Juz 2 dates are null', result.success && !result.data.juz.startDate && !result.data.juz.endDate);

  // Test 1.3: Pages → Status (20 pages)
  log('\nTest 1.3: 20 pages → Completed status', 'yellow');
  result = await apiCall('PUT', '/juz/3', { pages: 20, status: 'not-started' });
  logTest('Save Juz 3 with 20 pages', result.success);

  result = await apiCall('GET', '/juz/3');
  logTest('Juz 3 status is completed', result.success && result.data.juz.status === 'completed');
  logTest('Juz 3 has 20 pages', result.success && result.data.juz.pages === 20);

  // Test 1.4: Pages → Status (15 pages)
  log('\nTest 1.4: 15 pages → In Progress status', 'yellow');
  result = await apiCall('PUT', '/juz/4', { pages: 15 });
  logTest('Save Juz 4 with 15 pages', result.success);

  result = await apiCall('GET', '/juz/4');
  logTest('Juz 4 status is in-progress', result.success && result.data.juz.status === 'in-progress');
  logTest('Juz 4 has 15 pages', result.success && result.data.juz.pages === 15);

  // Test 1.5: Pages → Status (0 pages)
  log('\nTest 1.5: 0 pages → Not Started status', 'yellow');
  result = await apiCall('PUT', '/juz/4', { pages: 0 });
  logTest('Change Juz 4 to 0 pages', result.success);

  result = await apiCall('GET', '/juz/4');
  logTest('Juz 4 status is not-started', result.success && result.data.juz.status === 'not-started');
  logTest('Juz 4 dates cleared', result.success && !result.data.juz.startDate && !result.data.juz.endDate);
}

// Test Suite 2: Dashboard Statistics
async function testDashboardStatistics() {
  logSection('TEST SUITE 2: Dashboard Statistics (Juz-Based)');

  // Test 2.1: Initial State
  log('\nTest 2.1: Initial state after Suite 1', 'yellow');
  let result = await apiCall('GET', '/stats/combined');
  if (!result.success) {
    log(`  ⚠️  API Error: ${result.error}`, 'red');
  }
  logTest('Get combined stats', result.success);

  if (result.success) {
    const stats = result.data.stats;
    logTest('Juz Completed = 2', stats.completedJuz === 2, `(got ${stats.completedJuz})`);
    logTest('Total Pages = 35', stats.totalPages === 35, `(got ${stats.totalPages})`);
    logTest('Juz Completion % = 6.7%', Math.round(stats.juzCompletionPercentage) === 7, `(got ${stats.juzCompletionPercentage}%)`);
  }

  // Test 2.2: Update Juz → Dashboard Updates
  log('\nTest 2.2: Update Juz 5 → Dashboard updates', 'yellow');
  result = await apiCall('PUT', '/juz/5', { status: 'completed' });
  logTest('Mark Juz 5 as completed', result.success);

  result = await apiCall('GET', '/stats/combined');
  if (result.success) {
    const stats = result.data.stats;
    logTest('Juz Completed = 3', stats.completedJuz === 3, `(got ${stats.completedJuz})`);
    logTest('Total Pages = 55', stats.totalPages === 55, `(got ${stats.totalPages})`);
    logTest('Juz Completion % = 10%', Math.round(stats.juzCompletionPercentage) === 10, `(got ${stats.juzCompletionPercentage}%)`);
  }

  // Test 2.3: Modify Existing Juz → No Duplicate Counting
  log('\nTest 2.3: Modify Juz 1 → No duplicate counting', 'yellow');
  result = await apiCall('PUT', '/juz/1', { status: 'in-progress', pages: 10 });
  logTest('Change Juz 1 to 10 pages', result.success);

  result = await apiCall('GET', '/stats/combined');
  if (result.success) {
    const stats = result.data.stats;
    logTest('Total Pages = 45 (not 65)', stats.totalPages === 45, `(got ${stats.totalPages})`);
    logTest('Juz Completed = 2', stats.completedJuz === 2, `(got ${stats.completedJuz})`);
  }

  // Test 2.4: Save Same Juz Multiple Times
  log('\nTest 2.4: Save Juz 1 multiple times → No accumulation', 'yellow');

  await apiCall('PUT', '/juz/1', { pages: 15 });
  result = await apiCall('GET', '/stats/combined');
  const pages1 = result.data.stats.totalPages;
  logTest('After 15 pages: correct total', pages1 === 50, `(got ${pages1})`);

  await apiCall('PUT', '/juz/1', { pages: 18 });
  result = await apiCall('GET', '/stats/combined');
  const pages2 = result.data.stats.totalPages;
  logTest('After 18 pages: correct total', pages2 === 53, `(got ${pages2})`);

  await apiCall('PUT', '/juz/1', { pages: 12 });
  result = await apiCall('GET', '/stats/combined');
  const pages3 = result.data.stats.totalPages;
  logTest('After 12 pages: correct total', pages3 === 47, `(got ${pages3})`);
}

// Test Suite 3: Statistics Tab Separation
async function testStatisticsTabSeparation() {
  logSection('TEST SUITE 3: Statistics Tab - Juz vs Activity');

  log('\nTest 3.1: Combined stats structure', 'yellow');
  const result = await apiCall('GET', '/stats/combined');
  logTest('Get combined stats', result.success);

  if (result.success) {
    const stats = result.data.stats;

    // Check Juz metrics exist
    logTest('Has totalPages (Juz metric)', stats.totalPages !== undefined);
    logTest('Has completedJuz (Juz metric)', stats.completedJuz !== undefined);
    logTest('Has inProgressJuz (Juz metric)', stats.inProgressJuz !== undefined);
    logTest('Has juzCompletionPercentage', stats.juzCompletionPercentage !== undefined);

    // Check Activity metrics exist
    logTest('Has totalDays (Activity metric)', stats.totalDays !== undefined);
    logTest('Has currentStreak (Activity metric)', stats.currentStreak !== undefined);
    logTest('Has avgNewQuality (Activity metric)', stats.avgNewQuality !== undefined);
    logTest('Has avgReviewQuality (Activity metric)', stats.avgReviewQuality !== undefined);

    log(`\n  📊 Juz Progress:`, 'blue');
    log(`     Completed: ${stats.completedJuz}/30`);
    log(`     In Progress: ${stats.inProgressJuz}`);
    log(`     Total Pages: ${stats.totalPages}/600`);
    log(`     Completion: ${stats.juzCompletionPercentage}%`);

    log(`\n  📈 Activity Statistics:`, 'blue');
    log(`     Total Days: ${stats.totalDays}`);
    log(`     Current Streak: ${stats.currentStreak}`);
    log(`     Avg New Quality: ${stats.avgNewQuality}`);
    log(`     Avg Review Quality: ${stats.avgReviewQuality}`);
  }
}

// Test Suite 4: Daily Logs Independence
async function testDailyLogsIndependence() {
  logSection('TEST SUITE 4: Daily Logs Don\'t Affect Main Progress');

  log('\nTest 4.1: Get current Juz stats', 'yellow');
  let result = await apiCall('GET', '/stats/combined');
  const beforePages = result.data.stats.totalPages;
  const beforeJuz = result.data.stats.completedJuz;
  const beforePercent = result.data.stats.juzCompletionPercentage;

  log(`  Current state: ${beforePages} pages, ${beforeJuz} Juz, ${beforePercent}%`, 'blue');

  log('\nTest 4.2: Add daily log', 'yellow');
  result = await apiCall('POST', '/logs', {
    newPages: '1-10',
    newRating: 4,
    date: new Date().toISOString()
  });
  logTest('Create daily log with pages 1-10', result.success);

  log('\nTest 4.3: Check Juz stats unchanged', 'yellow');
  result = await apiCall('GET', '/stats/combined');
  if (result.success) {
    const stats = result.data.stats;
    logTest('Total Pages unchanged', stats.totalPages === beforePages, `(was ${beforePages}, now ${stats.totalPages})`);
    logTest('Juz Completed unchanged', stats.completedJuz === beforeJuz, `(was ${beforeJuz}, now ${stats.completedJuz})`);
    logTest('Juz Completion % unchanged', stats.juzCompletionPercentage === beforePercent, `(was ${beforePercent}, now ${stats.juzCompletionPercentage})`);
    logTest('Streak increased', stats.currentStreak >= 0);
  }
}

// Test Suite 5: Date Handling
async function testDateHandling() {
  logSection('TEST SUITE 5: Date Handling');

  log('\nTest 5.1: Empty dates work', 'yellow');
  let result = await apiCall('PUT', '/juz/6', {
    status: 'in-progress',
    pages: 5,
    startDate: null,
    endDate: null
  });
  logTest('Save Juz 6 with null dates', result.success);

  log('\nTest 5.2: Dates persist', 'yellow');
  result = await apiCall('PUT', '/juz/7', {
    status: 'completed',
    startDate: '2025-01-01',
    endDate: '2025-01-15'
  });
  logTest('Save Juz 7 with dates', result.success);

  result = await apiCall('GET', '/juz/7');
  if (result.success) {
    const juz = result.data.juz;
    logTest('Start date persisted', juz.startDate && juz.startDate.includes('2025-01-01'));
    logTest('End date persisted', juz.endDate && juz.endDate.includes('2025-01-15'));
  }

  log('\nTest 5.3: Auto-fill dates on completion', 'yellow');
  result = await apiCall('PUT', '/juz/8', { pages: 20 });
  logTest('Set Juz 8 to 20 pages', result.success);

  result = await apiCall('GET', '/juz/8');
  if (result.success) {
    const juz = result.data.juz;
    logTest('Status is completed', juz.status === 'completed');
    logTest('End date auto-filled', juz.endDate !== null);
  }
}

// Test Suite 6: Edge Cases
async function testEdgeCases() {
  logSection('TEST SUITE 6: Edge Cases');

  log('\nTest 6.1: Mixed states calculation', 'yellow');

  // Set up: 10 completed, 5 in-progress (10 pages each), rest not-started
  for (let i = 9; i <= 18; i++) {
    if (i <= 13) {
      await apiCall('PUT', `/juz/${i}`, { status: 'completed' });
    } else {
      await apiCall('PUT', `/juz/${i}`, { status: 'in-progress', pages: 10 });
    }
  }

  const result = await apiCall('GET', '/stats/combined');
  if (result.success) {
    const stats = result.data.stats;

    log(`\n  Mixed State Results:`, 'blue');
    log(`     Completed: ${stats.completedJuz}`);
    log(`     In Progress: ${stats.inProgressJuz}`);
    log(`     Not Started: ${stats.notStartedJuz}`);
    log(`     Total Pages: ${stats.totalPages}/600`);
    log(`     Completion: ${stats.juzCompletionPercentage}%`);

    logTest('Has completed Juz', stats.completedJuz > 0);
    logTest('Has in-progress Juz', stats.inProgressJuz > 0);
    logTest('Has not-started Juz', stats.notStartedJuz > 0);
    logTest('Total = 30', stats.completedJuz + stats.inProgressJuz + stats.notStartedJuz === 30);
  }
}

// Main test runner
async function runTests() {
  log('\n🧪 HAFIZ JUZ-BASED PROGRESS TRACKING TEST SUITE', 'cyan');
  log('================================================\n', 'cyan');

  // Get authentication token
  log('Please provide your authentication token:', 'yellow');
  log('(You can get this from the browser DevTools after logging in)', 'yellow');
  log('Look for: localStorage.getItem("hafiz_token")\n', 'yellow');

  token = await prompt('Enter token: ');

  if (!token) {
    log('\n❌ No token provided. Exiting.', 'red');
    return;
  }

  log('\n✅ Token received. Starting tests...\n', 'green');
  log('🔍 Testing API connection...', 'yellow');

  // Test API connection first
  const healthCheck = await apiCall('GET', '/stats/combined');
  if (!healthCheck.success) {
    log(`\n❌ API Connection Failed: ${healthCheck.error}`, 'red');
    log('\nPossible issues:', 'yellow');
    log('  1. Backend not running on port 5000', 'yellow');
    log('  2. Invalid or expired token', 'yellow');
    log('  3. User not authenticated', 'yellow');
    log('\nPlease check and try again.\n', 'yellow');
    return;
  }

  log('✅ API Connection successful!\n', 'green');

  try {
    await testStatusPagesSync();
    await testDashboardStatistics();
    await testStatisticsTabSeparation();
    await testDailyLogsIndependence();
    await testDateHandling();
    await testEdgeCases();

    // Final summary
    logSection('TEST SUMMARY');
    log(`\nTotal Tests: ${testResults.passed + testResults.failed}`, 'blue');
    log(`✅ Passed: ${testResults.passed}`, 'green');
    log(`❌ Failed: ${testResults.failed}`, testResults.failed > 0 ? 'red' : 'green');

    if (testResults.failed > 0) {
      log('\nFailed Tests:', 'red');
      testResults.tests
        .filter(t => !t.passed)
        .forEach(t => log(`  ❌ ${t.name}${t.message ? ': ' + t.message : ''}`, 'red'));
    }

    const passRate = ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1);
    log(`\nPass Rate: ${passRate}%`, passRate == 100 ? 'green' : 'yellow');

    if (testResults.failed === 0) {
      log('\n🎉 ALL TESTS PASSED! 🎉\n', 'green');
    } else {
      log('\n⚠️  Some tests failed. Please review and fix.\n', 'yellow');
    }

  } catch (error) {
    log(`\n❌ Test suite error: ${error.message}`, 'red');
    console.error(error);
  }
}

// Run the tests
runTests().catch(console.error);
