/**
 * Hafiz App v2.0 - Main Application Logic
 * API-based version (replaces localStorage)
 * Supports demo mode via ?demo=true query parameter
 */

// ================================
// DEMO MODE DETECTION
// ================================

const isDemoMode = new URLSearchParams(window.location.search).get('demo') === 'true';

const trans = {
    ar: {
        appTitle: 'حافظ', subtitle: 'رحلة حفظ القرآن الكريم', langBtn: 'English',
        labelPages: 'صفحات من الأجزاء', labelJuz: 'أجزاء مكتملة', labelStreak: 'أيام متتالية',
        labelProgress: 'نسبة الإنجاز', tabToday: 'اليوم', tabJuz: 'الأجزاء',
        tabHistory: 'السجل', tabStats: 'الإحصائيات',
        btnSave: 'حفظ اليوم', btnLogout: 'تسجيل الخروج', btnAdmin: 'لوحة الإدارة', btnBackHome: 'العودة للرئيسية',
        demoBanner: '📊 جرب التطبيق الآن - البيانات المعروضة للتوضيح فقط',
        loginModalTitle: 'ابدأ رحلتك الآن', loginModalSubtitle: 'سجّل دخولك لحفظ تقدمك ومزامنته عبر جميع أجهزتك',
        loginGoogle: 'تسجيل الدخول بحساب Google', loginGithub: 'تسجيل الدخول بحساب GitHub',
        labelNewPages: 'صفحات القرآن المحفوظة اليوم (مثال: 1-5، 10)',
        labelNewQuality: 'جودة الحفظ الجديد', labelReviewPages: 'صفحات المراجعة (مثال: 10-15)',
        labelReviewQuality: 'جودة المراجعة', labelNotes: 'ملاحظات اليوم',
        placeholderNewPages: 'أدخل أرقام الصفحات: 1-5، 10', placeholderReviewPages: 'أدخل أرقام الصفحات: 10-15',
        placeholderNotes: 'آيات صعبة، إنجازات، أو أي ملاحظات...',
        statsTitle: 'إحصائيات مفصلة', labelJuzStatus: 'حالة الجزء',
        labelJuzPages: 'التقدم: ___ صفحة من 20', labelJuzStart: 'تاريخ البدء',
        labelJuzEnd: 'تاريخ الإتمام', labelJuzNotes: 'ملاحظات',
        placeholderJuzNotes: 'ملاحظات عن هذا الجزء...', btnJuzSave: 'حفظ', btnJuzCancel: 'إلغاء',
        statusNotStarted: 'لم يبدأ', statusInProgress: 'جاري الحفظ', statusCompleted: 'مكتمل',
        emptyHistory: 'لا يوجد سجل بعد. ابدأ بتسجيل يومك الأول!',
        newMemorization: 'حفظ جديد', review: 'مراجعة', notes: 'ملاحظات', pages: 'صفحات',
        newPagesPlaceholder: 'مثال: 1-3، 5',
        reviewPagesPlaceholder: 'مثال: 10-15',
        notesPlaceholder: 'آيات صعبة، إنجازات، أو أي ملاحظات...',
        juzNotesPlaceholder: 'ملاحظات عن هذا الجزء...',
        rating: 'تقييم', totalDays: 'إجمالي أيام التسجيل', avgNewQuality: 'متوسط جودة الحفظ',
        avgReviewQuality: 'متوسط جودة المراجعة', juzInProgress: 'أجزاء قيد الحفظ',
        saveSuccess: 'تم حفظ سجل اليوم بنجاح!', saveJuzSuccess: 'تم حفظ بيانات الجزء بنجاح!',
        alertEnterPages: 'الرجاء إدخال صفحات الحفظ أو المراجعة', helpTitle: 'كيفية الاستخدام',
        loadingData: 'جاري تحميل البيانات...', errorLoading: 'خطأ في تحميل البيانات',
        savingData: 'جاري الحفظ...', errorSaving: 'خطأ في الحفظ',
        tabLeaderboard: '🏆 المتصدرون', leaderboardTitle: '🏆 لوحة المتصدرين',
        leaderboardDesc: 'أفضل الطلاب في حفظ القرآن الكريم',
        myRankTitle: 'ترتيبك', myRankText: 'من أصل', totalUsersText: 'طالب',
        myPagesText: 'صفحة', myJuzText: 'جزء', myStreakText: 'يوم متتالي',
        thRank: 'المرتبة', thStudent: 'الطالب', thPages: 'الصفحات',
        thJuz: 'الأجزاء', thStreak: 'التتالي',
        leaderboardDisabledText: 'لوحة المتصدرين معطلة حالياً',
        notOnLeaderboardText: 'لست على لوحة المتصدرين. قم بتفعيلها من الإعدادات أو ابدأ الحفظ!',
        loadingLeaderboard: 'جاري التحميل...', btnPrivacySettings: '⚙️ إعدادات الخصوصية',
        showOnLeaderboard: 'إظهاري على لوحة المتصدرين',
        leaderboardDisplayName: 'اسم العرض على لوحة المتصدرين',
        leaderboardPrivacyDesc: 'اختر ما إذا كنت تريد الظهور على لوحة المتصدرين وكيف يظهر اسمك',
        privacyTitle: 'إعدادات الخصوصية',
        privacyDesc: 'اختر ما إذا كنت تريد الظهور على لوحة المتصدرين وكيف يظهر اسمك',
        privacyShowLabel: 'إظهاري على لوحة المتصدرين',
        privacyShowDesc: 'عند التفعيل، سيتم عرض تقدمك على لوحة المتصدرين',
        privacyNameLabel: 'اسم العرض على لوحة المتصدرين',
        privacyNameDesc: 'الحد الأقصى: 50 حرفاً',
        privacyNamePlaceholder: 'اترك فارغاً لاستخدام اسمك الحقيقي',
        privacySaveBtn: 'حفظ التغييرات',
        privacyCancelBtn: 'إلغاء',
        privacySaveSuccess: 'تم حفظ إعدادات الخصوصية بنجاح!',
        privacyNameTooLong: 'اسم العرض يجب ألا يتجاوز 50 حرفاً',
        tabRecite: '🎙️ التلاوة',
        reciteTitle: '🎙️ التلاوة',
        reciteDesc: 'اختر سورة واتلُها — سأستمع إليك وأتابع تلاوتك كلمة كلمة',
        reciteUnsupportedText: 'متصفحك لا يدعم ميزة التلاوة (يتطلب ميكروفون و WebAssembly)',
        reciteSetupTitle: 'تجهيز المستمع الذكي',
        reciteSetupNote: 'يتم تنزيل نموذج التعرف على التلاوة (≈ ٨٨ م.ب) لمرة واحدة فقط — يعمل بعدها على جهازك دون إنترنت',
        btnReciteSetupCancel: 'إلغاء',
        labelReciteFrom: 'من آية',
        labelReciteTo: 'إلى آية',
        btnReciteStart: '🎙️ ابدأ التلاوة',
        btnReciteCancel: 'إلغاء',
        btnReciteStop: '⏹ إنهاء',
        reciteLeaveConfirm: 'جلسة التلاوة ما زالت جارية — هل تريد إنهاءها والمغادرة؟'
    },
    en: {
        appTitle: 'Hafiz', subtitle: 'Your Quran Memorization Journey', langBtn: 'العربية',
        labelPages: 'Pages from Juz', labelJuz: 'Juz Completed', labelStreak: 'Day Streak',
        labelProgress: 'Completion', tabToday: 'Today', tabJuz: 'Juz', tabHistory: 'History',
        tabStats: 'Statistics',
        btnSave: 'Save Today', btnLogout: 'Logout', btnAdmin: 'Admin Panel', btnBackHome: 'Back to Home',
        demoBanner: '📊 Try the App Now - Demo Data for Illustration Only',
        loginModalTitle: 'Start Your Journey Now', loginModalSubtitle: 'Login to save your progress and sync across all your devices',
        loginGoogle: 'Continue with Google', loginGithub: 'Continue with GitHub',
        labelNewPages: 'Quran Pages Practiced Today (e.g., 1-5, 10)', labelNewQuality: 'New Memorization Quality',
        labelReviewPages: 'Review Pages (e.g., 10-15)', labelReviewQuality: 'Review Quality',
        labelNotes: 'Notes for Today', placeholderNewPages: 'Enter page numbers: 1-5, 10',
        placeholderReviewPages: 'Enter page numbers: 10-15', placeholderNotes: 'Difficult verses, achievements...',
        statsTitle: 'Detailed Statistics', labelJuzStatus: 'Juz Status',
        labelJuzPages: 'Progress: ___ pages out of 20', labelJuzStart: 'Start Date',
        labelJuzEnd: 'Completion Date', labelJuzNotes: 'Notes',
        placeholderJuzNotes: 'Notes about this Juz...', btnJuzSave: 'Save', btnJuzCancel: 'Cancel',
        statusNotStarted: 'Not Started', statusInProgress: 'In Progress', statusCompleted: 'Completed',
        emptyHistory: 'No history yet. Start by logging your first day!',
        newMemorization: 'New Memorization', review: 'Review', notes: 'Notes', pages: 'pages',
        newPagesPlaceholder: 'Example: 1-3, 5',
        reviewPagesPlaceholder: 'Example: 10-15',
        notesPlaceholder: 'Difficult verses, achievements, or any notes...',
        juzNotesPlaceholder: 'Notes about this Juz...',
        rating: 'rating', totalDays: 'Total Days Logged', avgNewQuality: 'Avg New Quality',
        avgReviewQuality: 'Avg Review Quality', juzInProgress: 'Juz In Progress',
        saveSuccess: 'Today\'s log saved successfully!', saveJuzSuccess: 'Juz data saved successfully!',
        alertEnterPages: 'Please enter memorization or review pages', helpTitle: 'How to Use',
        loadingData: 'Loading data...', errorLoading: 'Error loading data',
        savingData: 'Saving...', errorSaving: 'Error saving',
        tabLeaderboard: '🏆 Leaderboard', leaderboardTitle: '🏆 Leaderboard',
        leaderboardDesc: 'Top students in Quran memorization',
        myRankTitle: 'Your Rank', myRankText: 'out of', totalUsersText: 'students',
        myPagesText: 'pages', myJuzText: 'juz', myStreakText: 'day streak',
        thRank: 'Rank', thStudent: 'Student', thPages: 'Pages',
        thJuz: 'Juz', thStreak: 'Streak',
        leaderboardDisabledText: 'Leaderboard is currently disabled',
        notOnLeaderboardText: 'You are not on the leaderboard. Enable it in settings or start memorizing!',
        loadingLeaderboard: 'Loading...', btnPrivacySettings: '⚙️ Privacy Settings',
        showOnLeaderboard: 'Show me on leaderboard',
        leaderboardDisplayName: 'Display name on leaderboard',
        leaderboardPrivacyDesc: 'Choose if you want to appear on the leaderboard and how your name is displayed',
        privacyTitle: 'Privacy Settings',
        privacyDesc: 'Choose if you want to appear on the leaderboard and how your name is displayed',
        privacyShowLabel: 'Show me on leaderboard',
        privacyShowDesc: 'When enabled, your progress will be displayed on the leaderboard',
        privacyNameLabel: 'Display name on leaderboard',
        privacyNameDesc: 'Maximum: 50 characters',
        privacyNamePlaceholder: 'Leave empty to use your real name',
        privacySaveBtn: 'Save Changes',
        privacyCancelBtn: 'Cancel',
        privacySaveSuccess: 'Privacy settings saved successfully!',
        privacyNameTooLong: 'Display name must not exceed 50 characters',
        tabRecite: '🎙️ Recite',
        reciteTitle: '🎙️ Recitation',
        reciteDesc: 'Pick a surah and recite — I will listen and follow your recitation word by word',
        reciteUnsupportedText: 'Your browser does not support the recitation feature (microphone and WebAssembly required)',
        reciteSetupTitle: 'Preparing your listening coach',
        reciteSetupNote: 'The recitation-recognition model (≈ 88 MB) is downloaded once — afterwards it runs on your device, no internet needed',
        btnReciteSetupCancel: 'Cancel',
        labelReciteFrom: 'From ayah',
        labelReciteTo: 'To ayah',
        btnReciteStart: '🎙️ Start Reciting',
        btnReciteCancel: 'Cancel',
        btnReciteStop: '⏹ Stop',
        reciteLeaveConfirm: 'A recitation session is still running — end it and leave?'
    }
};

const juzNames = {
    ar: ['آلم (الفاتحة - البقرة)', 'سَيَقُولُ (البقرة)', 'تِلْكَ الرُّسُلُ (البقرة - آل عمران)',
        'لَنْ تَنَالُوا (آل عمران - النساء)', 'وَالْمُحْصَنَاتُ (النساء)', 'لَا يُحِبُّ اللَّهُ (النساء - المائدة)',
        'وَإِذَا سَمِعُوا (المائدة - الأنعام)', 'وَلَوْ أَنَّنَا (الأنعام - الأعراف)', 'قَالَ الْمَلَأُ (الأعراف - الأنفال)',
        'وَاعْلَمُوا (الأنفال - التوبة)', 'يَتَعَذَّرُونَ (التوبة - هود)', 'وَمَا مِنْ دَآبَّةٍ (هود - يوسف)',
        'وَمَا أُبَرِّئُ (يوسف - إبراهيم)', 'رُبَمَا (الحجر - النحل)', 'سُبْحَانَ الَّذِي (الإسراء - الكهف)',
        'قَالَ أَلَمْ (الكهف - طه)', 'اقْتَرَبَ (الأنبياء - الحج)', 'قَدْ أَفْلَحَ (المؤمنون - الفرقان)',
        'وَقَالَ الَّذِينَ (الفرقان - النمل)', 'أَمَّنْ خَلَقَ (النمل - العنكبوت)', 'اُتْلُ مَا أُوحِيَ (العنكبوت - الأحزاب)',
        'وَمَنْ يَقْنُتْ (الأحزاب - يس)', 'وَأَنزَلْنَا (يس - الزمر)', 'فَمَنْ أَظْلَمُ (الزمر - فصلت)',
        'إِلَيْهِ يُرَدُّ (فصلت - الجاثية)', 'حَا مِيمْ (الأحقاف - الذاريات)', 'قَالَ فَمَا خَطْبُكُمْ (الذاريات - الحديد)',
        'قَدْ سَمِعَ اللَّهُ (المجادلة - التحريم)', 'تَبَارَكَ الَّذِي (الملك - المرسلات)', 'عَمَّ يَتَسَاءَلُونَ (النبأ - الناس)'],
    en: ['Alif Lam Meem (Al-Fatiha - Al-Baqarah)', 'Sayaqool (Al-Baqarah)', 'Tilkal Rusul (Al-Baqarah - Al-Imran)',
        'Lan Tana Loo (Al-Imran - An-Nisa)', 'Wal Mohsanat (An-Nisa)', 'La Yuhibbullah (An-Nisa - Al-Ma\'idah)',
        'Wa Iza Samiu (Al-Ma\'idah - Al-An\'am)', 'Wa Lau Annana (Al-An\'am - Al-A\'raf)', 'Qalal Malao (Al-A\'raf - Al-Anfal)',
        'Wa A\'lamu (Al-Anfal - At-Tauba)', 'Yatazeroon (At-Tauba - Hud)', 'Wa Mamin Da\'abat (Hud - Yusuf)',
        'Wa Ma Ubrioo (Yusuf - Ibrahim)', 'Rubama (Al-Hijr - An-Nahl)', 'Subhanallazi (Al-Isra - Al-Kahf)',
        'Qal Alam (Al-Kahf - Ta-Ha)', 'Aqtarabo (Al-Anbiyaa - Al-Hajj)', 'Qadd Aflaha (Al-Muminun - Al-Furqan)',
        'Wa Qalallazina (Al-Furqan - An-Naml)', 'A\'man Khalaq (An-Naml - Al-Ankabut)', 'Utlu Ma Oohi (Al-Ankabut - Al-Azhab)',
        'Wa Manyaqnut (Al-Azhab - Ya-Sin)', 'Wa Anzalna (Ya-Sin - Az-Zumar)', 'Faman Azlam (Az-Zumar - Fussilat)',
        'Elahe Yuruddo (Fussilat - Al-Jasiyah)', 'Ha\'a Meem (Al-Ahqaf - Az-Dhariyat)', 'Qala Fama Khatbukum (Az-Dhariyat - Al-Hadid)',
        'Qadd Sami Allah (Al-Mujadilah - At-Tahrim)', 'Tabarakallazi (Al-Mulk - Al-Mursalat)', 'Amma Yatasa\'aloon (An-Naba - An-Nas)']
};

// Application state
let data = {
    juz: [],
    logs: [],
    stats: {},
    settings: { newRating: 0, reviewRating: 0, language: 'ar' }
};
let currentJuz = null;

// ================================
// DEMO MODE FUNCTIONS
// ================================

function loadDemoData() {
    // Load from localStorage or initialize with demo.js data
    const stored = localStorage.getItem('hafiz_demo_data');
    if (stored && typeof demoData !== 'undefined') {
        try {
            const parsed = JSON.parse(stored);
            data.juz = parsed.juz || demoData.juz;
            data.logs = parsed.logs || demoData.logs;
            data.stats = parsed.stats || calculateDemoStats();
            return;
        } catch (error) {
            debug.error('Error parsing stored demo data:', error);
        }
    }

    // Initialize with demo data from demo.js (if available)
    if (typeof demoData !== 'undefined') {
        data.juz = JSON.parse(JSON.stringify(demoData.juz));
        data.logs = JSON.parse(JSON.stringify(demoData.logs));
        data.stats = calculateDemoStats();
    } else {
        // Fallback: create empty structure
        data.juz = [];
        for (let i = 1; i <= 30; i++) {
            data.juz.push({
                juzNumber: i,
                status: 'not-started',
                pages: 0,
                startDate: null,
                endDate: null,
                notes: ''
            });
        }
        data.logs = [];
        data.stats = calculateDemoStats();
    }
}

function calculateDemoStats() {
    let totalPages = 0, completedJuz = 0, inProgressJuz = 0;

    data.juz.forEach(juz => {
        totalPages += juz.pages || 0;
        if (juz.status === 'completed') completedJuz++;
        else if (juz.status === 'in-progress') inProgressJuz++;
    });

    const juzCompletionPercentage = ((completedJuz / 30) * 100).toFixed(1);

    let totalDays = data.logs.length;
    let currentStreak = 0;
    let avgNewQuality = 0, avgReviewQuality = 0;

    if (totalDays > 0) {
        let totalNew = 0, totalReview = 0, countNew = 0, countReview = 0;

        data.logs.forEach(log => {
            if (log.newRating > 0) { totalNew += log.newRating; countNew++; }
            if (log.reviewRating > 0) { totalReview += log.reviewRating; countReview++; }
        });

        avgNewQuality = countNew > 0 ? (totalNew / countNew).toFixed(1) : 0;
        avgReviewQuality = countReview > 0 ? (totalReview / countReview).toFixed(1) : 0;
    }

    return {
        totalPages, completedJuz, inProgressJuz,
        notStartedJuz: 30 - completedJuz - inProgressJuz,
        juzCompletionPercentage: parseFloat(juzCompletionPercentage),
        totalDays, currentStreak,
        avgNewQuality: parseFloat(avgNewQuality),
        avgReviewQuality: parseFloat(avgReviewQuality)
    };
}

function showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.add('active');
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.remove('active');
}

function loginWithProvider(provider) {
    window.location.href = `/app.html?auth=${provider}`;
}

function handleBackToHome() {
    window.location.href = '/';
}

function goToAdminPanel() {
    window.location.href = '/admin.html';
}

function handleLogout() {
    const currentLang = storage.getLanguage();
    const confirmMsg = currentLang === 'ar'
        ? 'هل أنت متأكد من تسجيل الخروج؟'
        : 'Are you sure you want to logout?';

    if (confirm(confirmMsg)) {
        auth.logout();
    }
}

function detectBrowserLanguage() {
    const browserLang = navigator.language || navigator.languages[0];
    return browserLang.startsWith('ar') ? 'ar' : 'en';
}

// ================================
// INITIALIZATION
// ================================

async function init() {
    try {
        // DEMO MODE: Detect browser language
        if (isDemoMode && !storage.getLanguage()) {
            data.settings.language = detectBrowserLanguage();
            storage.setLanguage(data.settings.language);
        } else {
            data.settings.language = storage.getLanguage();
        }

        const isArabic = data.settings.language === 'ar';
        ui.showLoader();

        // Show skeleton loaders while data loads
        const juzGrid = document.getElementById('juzGrid');
        const historyList = document.getElementById('historyList');
        const detailedStats = document.getElementById('detailedStats');

        if (juzGrid) ui.createSkeleton(juzGrid, 30);
        if (historyList) ui.createSkeleton(historyList, 5);
        if (detailedStats) ui.createSkeleton(detailedStats, 4);

        if (isDemoMode) {
            // DEMO MODE: Load from localStorage or demo.js
            loadDemoData();
            applyLanguage();
        } else {
            // NORMAL MODE: Load from API
            await loadSettings();
            applyLanguage();

            await Promise.all([
                loadJuz(),
                loadLogs(),
                loadStats()
            ]);
        }

        // Update UI
        updateStats();
        displayJuz();
        displayHistory();
        displayDetailedStats();
        updateCurrentDate();

        ui.hideLoader();
    } catch (error) {
        debug.error('Initialization error:', error);
        ui.hideLoader();
        const t = trans[data.settings.language];
        ui.showError(t.errorLoading, data.settings.language === 'ar');
    }
}

// ================================
// DATA LOADING
// ================================

async function loadSettings() {
    try {
        const response = await api.get('/user');
        if (response && response.user && response.user.settings) {
            // Preserve language from localStorage (don't overwrite with API)
            const localLanguage = storage.getLanguage();
            data.settings = { ...data.settings, ...response.user.settings };
            data.settings.language = localLanguage; // Keep localStorage preference

            // Store user ID for leaderboard highlighting
            if (response.user._id) {
                data.currentUserId = response.user._id;
            }
        }
    } catch (error) {
        debug.error('Error loading settings:', error);
        // Use default settings (language already set from localStorage)
    }
}

async function loadJuz() {
    try {
        const response = await api.get('/juz');
        data.juz = response.juz || [];

        // Ensure all 30 juz exist
        if (data.juz.length === 0) {
            data.juz = [];
            for (let i = 1; i <= 30; i++) {
                data.juz.push({
                    juzNumber: i,
                    status: 'not-started',
                    pages: 0,
                    startDate: null,
                    endDate: null,
                    notes: ''
                });
            }
        }
    } catch (error) {
        debug.error('Error loading juz:', error);
        // Initialize empty juz array
        data.juz = [];
        for (let i = 1; i <= 30; i++) {
            data.juz.push({
                juzNumber: i,
                status: 'not-started',
                pages: 0,
                startDate: null,
                endDate: null,
                notes: ''
            });
        }
    }
}

async function loadLogs() {
    try {
        const response = await api.get('/logs');
        data.logs = response.logs || [];
    } catch (error) {
        debug.error('Error loading logs:', error);
        data.logs = [];
    }
}

async function loadStats() {
    try {
        const response = await api.get('/stats/combined');
        data.stats = response.stats || {};
    } catch (error) {
        debug.error('Error loading stats:', error);
        data.stats = {};
    }
}

// ================================
// DAILY LOG OPERATIONS
// ================================

// Validate page format
function validatePages(pageStr, isArabic) {
    if (!pageStr || pageStr.trim() === '') return { valid: true };

    const t = trans[data.settings.language];

    // Check for invalid characters
    if (!/^[\d\s,\-]+$/.test(pageStr)) {
        return {
            valid: false,
            error: isArabic
                ? 'صيغة غير صحيحة. استخدم الأرقام والفواصل والشرطات فقط'
                : 'Invalid format. Use numbers, commas, and hyphens only'
        };
    }

    // Parse and validate each part
    const parts = pageStr.split(',').map(s => s.trim()).filter(s => s);

    for (const part of parts) {
        if (part.includes('-')) {
            // Range validation
            const [start, end] = part.split('-').map(n => parseInt(n.trim()));

            if (isNaN(start) || isNaN(end)) {
                return {
                    valid: false,
                    error: isArabic
                        ? `نطاق غير صحيح: ${part}`
                        : `Invalid range: ${part}`
                };
            }

            if (start < 1 || end > 604) {
                return {
                    valid: false,
                    error: isArabic
                        ? `الصفحات يجب أن تكون بين 1-604 (وجدنا: ${part})`
                        : `Pages must be between 1-604 (found: ${part})`
                };
            }

            if (start > end) {
                return {
                    valid: false,
                    error: isArabic
                        ? `نطاق غير صحيح: ${start} أكبر من ${end}`
                        : `Invalid range: ${start} is greater than ${end}`
                };
            }
        } else {
            // Single page validation
            const page = parseInt(part.trim());

            if (isNaN(page)) {
                return {
                    valid: false,
                    error: isArabic
                        ? `رقم غير صحيح: ${part}`
                        : `Invalid number: ${part}`
                };
            }

            if (page < 1 || page > 604) {
                return {
                    valid: false,
                    error: isArabic
                        ? `الصفحة يجب أن تكون بين 1-604 (وجدنا: ${page})`
                        : `Page must be between 1-604 (found: ${page})`
                };
            }
        }
    }

    return { valid: true };
}

async function saveLog() {
    const t = trans[data.settings.language];
    const isArabic = data.settings.language === 'ar';

    const newPages = document.getElementById('newPages').value;
    const reviewPages = document.getElementById('reviewPages').value;
    const notes = document.getElementById('notes').value;

    if (!newPages && !reviewPages) {
        ui.showError(t.alertEnterPages, isArabic);
        return;
    }

    // Validate newPages format
    const newPagesValidation = validatePages(newPages, isArabic);
    if (!newPagesValidation.valid) {
        ui.showError(newPagesValidation.error, isArabic);
        return;
    }

    // Validate reviewPages format
    const reviewPagesValidation = validatePages(reviewPages, isArabic);
    if (!reviewPagesValidation.valid) {
        ui.showError(reviewPagesValidation.error, isArabic);
        return;
    }

    // DEMO MODE: Show login modal instead of saving
    if (isDemoMode) {
        showLoginModal();
        return;
    }

    const log = {
        date: new Date().toISOString(),
        newPages,
        newRating: data.settings.newRating,
        reviewPages,
        reviewRating: data.settings.reviewRating,
        notes
    };

    try {
        ui.showLoader();

        // Save to API
        const response = await api.post('/logs', log);

        // Update local data
        data.logs.unshift(response.log || log);

        // Clear form
        document.getElementById('newPages').value = '';
        document.getElementById('reviewPages').value = '';
        document.getElementById('notes').value = '';
        document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
        data.settings.newRating = 0;
        data.settings.reviewRating = 0;

        // Reload stats and history
        await loadStats();
        updateStats();
        displayDetailedStats(); // Refresh statistics tab
        displayHistory();

        ui.hideLoader();
        ui.showSuccess(t.saveSuccess, isArabic);
    } catch (error) {
        debug.error('Error saving log:', error);
        ui.hideLoader();
        ui.showError(t.errorSaving, isArabic);
    }
}

// ================================
// JUZ OPERATIONS
// ================================

async function saveJuz() {
    if (!currentJuz) return;

    // DEMO MODE: Show login modal instead of saving
    if (isDemoMode) {
        showLoginModal();
        return;
    }

    const t = trans[data.settings.language];
    const isArabic = data.settings.language === 'ar';

    const juzData = {
        juzNumber: currentJuz,
        status: document.getElementById('juzStatus').value,
        pages: parseInt(document.getElementById('juzPages').value) || 0,
        startDate: document.getElementById('juzStartDate').value || null,
        endDate: document.getElementById('juzEndDate').value || null,
        notes: document.getElementById('juzNotes').value
    };

    try {
        ui.showLoader();

        // Save to API and get the synced response
        const response = await api.put(`/juz/${currentJuz}`, juzData);

        // Update local data with synced values from backend
        const index = data.juz.findIndex(j => j.juzNumber === currentJuz);
        if (index !== -1 && response.juz) {
            // Use the backend response which includes synced status/pages
            data.juz[index] = response.juz;
        }

        // Reload stats and refresh UI
        await loadStats();
        updateStats();
        displayDetailedStats(); // Refresh statistics tab
        displayJuz();
        closeModal();

        ui.hideLoader();
        ui.showSuccess(t.saveJuzSuccess, isArabic);
    } catch (error) {
        debug.error('Error saving juz:', error);
        ui.hideLoader();
        ui.showError(t.errorSaving, isArabic);
    }
}

function displayJuz() {
    const lang = data.settings.language;
    const t = trans[lang];
    const grid = document.getElementById('juzGrid');
    grid.innerHTML = '';

    for (let i = 1; i <= 30; i++) {
        const juz = data.juz.find(j => j.juzNumber === i) || {
            juzNumber: i,
            status: 'not-started',
            pages: 0,
            startDate: null,
            endDate: null,
            notes: ''
        };

        const card = document.createElement('div');
        card.className = 'juz-card' + (juz.status === 'completed' ? ' completed' : '');
        card.onclick = () => openJuzModal(i);

        const statusText = {
            'not-started': t.statusNotStarted,
            'in-progress': t.statusInProgress,
            'completed': t.statusCompleted
        };

        card.innerHTML = `
            <div class="juz-number">${lang === 'ar' ? convertToArabicNumerals(i) : i}</div>
            <div class="juz-name">${juzNames[lang][i-1]}</div>
            <div class="juz-status">${statusText[juz.status]}</div>
        `;
        grid.appendChild(card);
    }
}

function openJuzModal(juzNumber) {
    currentJuz = juzNumber;
    const juz = data.juz.find(j => j.juzNumber === juzNumber) || {
        juzNumber,
        status: 'not-started',
        pages: 0,
        startDate: null,
        endDate: null,
        notes: ''
    };

    const lang = data.settings.language;
    document.getElementById('modalTitle').textContent = (lang === 'ar' ? 'جزء ' : 'Juz ') +
        (lang === 'ar' ? convertToArabicNumerals(juzNumber) : juzNumber);
    document.getElementById('juzStatus').value = juz.status;
    document.getElementById('juzPages').value = juz.pages;

    // Format dates for HTML date input (YYYY-MM-DD)
    document.getElementById('juzStartDate').value = formatDateForInput(juz.startDate);
    document.getElementById('juzEndDate').value = formatDateForInput(juz.endDate);

    document.getElementById('juzNotes').value = juz.notes || '';
    document.getElementById('juzModal').classList.add('active');
}

// Helper function to format date for HTML date input
function formatDateForInput(dateValue) {
    if (!dateValue) return '';

    try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return '';

        // Format as YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    } catch (error) {
        debug.error('Error formatting date:', error);
        return '';
    }
}

function closeModal() {
    document.getElementById('juzModal').classList.remove('active');
    currentJuz = null;
}

// ================================
// DISPLAY FUNCTIONS
// ================================

function displayHistory() {
    const lang = data.settings.language;
    const t = trans[lang];
    const list = document.getElementById('historyList');

    if (data.logs.length === 0) {
        list.innerHTML = `<div class="empty-state"><p>${t.emptyHistory}</p></div>`;
        return;
    }

    list.innerHTML = data.logs.map(log => {
        const date = new Date(log.date);
        const formattedDate = date.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US',
            { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        let content = '';
        if (log.newPages) {
            content += `<strong>${t.newMemorization}:</strong> ${log.newPages} ${t.pages}`;
            if (log.newRating) content += ` (${t.rating}: ${'★'.repeat(log.newRating)})`;
            content += '<br>';
        }
        if (log.reviewPages) {
            content += `<strong>${t.review}:</strong> ${log.reviewPages} ${t.pages}`;
            if (log.reviewRating) content += ` (${t.rating}: ${'★'.repeat(log.reviewRating)})`;
            content += '<br>';
        }
        if (log.notes) content += `<strong>${t.notes}:</strong> ${log.notes}`;

        return `<div class="history-item">
            <div class="history-date">${formattedDate}</div>
            <div class="history-content">${content}</div>
        </div>`;
    }).join('');
}

function updateStats() {
    if (!data.stats || Object.keys(data.stats).length === 0) {
        // Calculate from local data if stats not loaded yet
        calculateLocalStats();
        return;
    }

    // Display Juz-based statistics (primary metrics)
    document.getElementById('totalPages').textContent = data.stats.totalPages || 0;
    document.getElementById('totalJuz').textContent = data.stats.completedJuz || 0;
    document.getElementById('currentStreak').textContent = data.stats.currentStreak || 0;

    // Main progress graph based on Juz completion (primary metric)
    const progress = data.stats.juzCompletionPercentage || 0;
    document.getElementById('progressPercent').textContent = Math.round(progress) + '%';

    const circle = document.getElementById('progressCircle');
    const offset = 339.292 - (progress / 100) * 339.292;
    circle.style.strokeDashoffset = offset;
}

function calculateLocalStats() {
    // Fallback: calculate stats from local Juz data
    let totalPages = 0, completedJuz = 0;
    data.juz.forEach(juz => {
        totalPages += juz.pages || 0;
        if (juz.status === 'completed') completedJuz++;
    });

    document.getElementById('totalPages').textContent = totalPages;
    document.getElementById('totalJuz').textContent = completedJuz;
    document.getElementById('currentStreak').textContent = 0; // Will be calculated by backend

    // Calculate Juz completion percentage for progress graph (primary metric)
    const progress = (completedJuz / 30) * 100;
    document.getElementById('progressPercent').textContent = Math.round(progress) + '%';

    const circle = document.getElementById('progressCircle');
    const offset = 339.292 - (progress / 100) * 339.292;
    circle.style.strokeDashoffset = offset;
}

function displayDetailedStats() {
    const lang = data.settings.language;
    const t = trans[lang];
    const container = document.getElementById('detailedStats');

    const stats = data.stats || {};

    // Juz Progress Section
    const juzSection = lang === 'ar'
        ? `<h3 style="margin-bottom: 1rem;">تقدم الأجزاء</h3>`
        : `<h3 style="margin-bottom: 1rem;">Juz Progress</h3>`;

    const juzCards = `
        <div class="stat-card">
            <div class="stat-number">${stats.completedJuz || 0}/30</div>
            <div class="stat-label">${lang === 'ar' ? 'أجزاء مكتملة' : 'Juz Completed'}</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.inProgressJuz || 0}</div>
            <div class="stat-label">${t.juzInProgress}</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.totalPages || 0}/600</div>
            <div class="stat-label">${lang === 'ar' ? 'صفحات من الأجزاء' : 'Pages from Juz'}</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${Math.round(stats.juzCompletionPercentage || 0)}%</div>
            <div class="stat-label">${lang === 'ar' ? 'نسبة الإنجاز' : 'Completion'}</div>
        </div>
    `;

    // Activity Section
    const activitySection = lang === 'ar'
        ? `<h3 style="margin: 2rem 0 1rem 0;">إحصائيات النشاط</h3>`
        : `<h3 style="margin: 2rem 0 1rem 0;">Activity Statistics</h3>`;

    const activityCards = `
        <div class="stat-card">
            <div class="stat-number">${stats.totalDays || 0}</div>
            <div class="stat-label">${t.totalDays}</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.currentStreak || 0}</div>
            <div class="stat-label">${lang === 'ar' ? 'أيام متتالية' : 'Day Streak'}</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.avgNewQuality || 0}</div>
            <div class="stat-label">${t.avgNewQuality}</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.avgReviewQuality || 0}</div>
            <div class="stat-label">${t.avgReviewQuality}</div>
        </div>
    `;

    container.innerHTML = `
        ${juzSection}
        <div class="stats-grid">${juzCards}</div>
        ${activitySection}
        <div class="stats-grid">${activityCards}</div>
    `;
}

// ================================
// LEADERBOARD OPERATIONS
// ================================

async function loadLeaderboard(forceRefresh = false) {
    const lang = data.settings.language;
    const t = trans[lang];

    try {
        // Load user's rank (with optional force refresh)
        await loadMyRank(forceRefresh);

        // Load top leaderboard (with optional force refresh)
        const url = forceRefresh ? '/leaderboard?limit=25&forceRefresh=true' : '/leaderboard?limit=25';
        const response = await api.get(url);

        if (!response.success || !response.leaderboard) {
            throw new Error('Invalid leaderboard response');
        }

        const leaderboard = response.leaderboard;
        const tbody = document.getElementById('leaderboardBody');

        if (!tbody) return; // Exit if element doesn't exist

        if (leaderboard.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-state">${lang === 'ar' ? 'لا يوجد مستخدمين على لوحة المتصدرين بعد' : 'No users on leaderboard yet'}</td></tr>`;
            return;
        }

        tbody.innerHTML = leaderboard.map(user => {
            // Check if this is the current user
            const isCurrentUser = user.userId === (data.currentUserId || '');
            const highlightClass = isCurrentUser ? ' class="highlight"' : '';

            // Get rank display (top 3 get special styling)
            const rankClass = user.rank <= 3 ? ' class="rank-cell top-3"' : ' class="rank-cell"';

            // Add asterisk if using custom display name
            const displayName = user.name || (lang === 'ar' ? 'طالب' : 'Student');
            const nameWithIndicator = user.isCustomDisplayName ? `${displayName} *` : displayName;

            return `<tr${highlightClass}>
                <td${rankClass}>${lang === 'ar' ? convertToArabicNumerals(user.rank) : user.rank}</td>
                <td>${nameWithIndicator}</td>
                <td>${lang === 'ar' ? convertToArabicNumerals(user.totalPages) : user.totalPages}</td>
                <td>${lang === 'ar' ? convertToArabicNumerals(user.completedJuz) : user.completedJuz}</td>
                <td>${lang === 'ar' ? convertToArabicNumerals(user.streak) : user.streak}</td>
            </tr>`;
        }).join('');

        // Show the leaderboard table
        const lbTable = document.getElementById('leaderboardTable');
        if (lbTable) lbTable.style.display = 'block';

    } catch (error) {
        debug.error('Error loading leaderboard:', error);

        // Check if leaderboard is disabled (403 error)
        if (error.message && error.message.includes('disabled')) {
            const lbDisabled = document.getElementById('leaderboardDisabled');
            const lbTable = document.getElementById('leaderboardTable');
            const myRankSec = document.getElementById('myRankSection');
            const notOnLB = document.getElementById('notOnLeaderboard');

            if (lbDisabled) lbDisabled.style.display = 'block';
            if (lbTable) lbTable.style.display = 'none';
            if (myRankSec) myRankSec.style.display = 'none';
            if (notOnLB) notOnLB.style.display = 'none';
        } else {
            const tbody = document.getElementById('leaderboardBody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="5" class="empty-state">${lang === 'ar' ? 'خطأ في تحميل لوحة المتصدرين' : 'Error loading leaderboard'}</td></tr>`;
            }
        }
    }
}

async function loadMyRank(forceRefresh = false) {
    const lang = data.settings.language;
    const t = trans[lang];

    try {
        const url = forceRefresh ? '/leaderboard/me?forceRefresh=true' : '/leaderboard/me';
        const response = await api.get(url);

        if (!response.success) {
            throw new Error('Invalid rank response');
        }

        // Hide all state sections first
        const lbDisabled = document.getElementById('leaderboardDisabled');
        const notOnLB = document.getElementById('notOnLeaderboard');
        const myRankSec = document.getElementById('myRankSection');

        if (lbDisabled) lbDisabled.style.display = 'none';
        if (notOnLB) notOnLB.style.display = 'none';
        if (myRankSec) myRankSec.style.display = 'none';

        if (!response.onLeaderboard) {
            // User not on leaderboard (opted out or no activity)
            const notOnLB = document.getElementById('notOnLeaderboard');
            const myRankSec = document.getElementById('myRankSection');
            if (notOnLB) notOnLB.style.display = 'block';
            if (myRankSec) myRankSec.style.display = 'none';
        } else {
            // User is on leaderboard, show their rank
            const myRankSec = document.getElementById('myRankSection');
            const myRank = document.getElementById('myRank');
            const myRankTextEl = document.getElementById('myRankText');
            const totalUsers = document.getElementById('totalUsers');
            const myPages = document.getElementById('myPages');
            const myJuz = document.getElementById('myJuz');
            const myStreak = document.getElementById('myStreak');

            if (myRankSec) myRankSec.style.display = 'block';
            if (myRank) myRank.textContent = lang === 'ar' ? convertToArabicNumerals(response.rank) : response.rank;

            // Update rank text and total users dynamically
            const totalUsersValue = lang === 'ar' ? convertToArabicNumerals(response.totalUsers) : response.totalUsers;
            if (totalUsers) totalUsers.textContent = totalUsersValue;
            if (myRankTextEl) {
                myRankTextEl.innerHTML = `${t.myRankText} <span id="totalUsers">${totalUsersValue}</span> ${t.totalUsersText}`;
            }

            if (myPages) myPages.textContent = lang === 'ar' ? convertToArabicNumerals(response.stats.totalPages) : response.stats.totalPages;
            if (myJuz) myJuz.textContent = lang === 'ar' ? convertToArabicNumerals(response.stats.completedJuz) : response.stats.completedJuz;
            if (myStreak) myStreak.textContent = lang === 'ar' ? convertToArabicNumerals(response.stats.streak) : response.stats.streak;
        }

    } catch (error) {
        debug.error('Error loading rank:', error);

        // Check if leaderboard is disabled
        if (error.message && error.message.includes('disabled')) {
            const lbDisabled = document.getElementById('leaderboardDisabled');
            const myRankSec = document.getElementById('myRankSection');
            const notOnLB = document.getElementById('notOnLeaderboard');

            if (lbDisabled) lbDisabled.style.display = 'block';
            if (myRankSec) myRankSec.style.display = 'none';
            if (notOnLB) notOnLB.style.display = 'none';
        }
    }
}

async function showPrivacySettings() {
    const lang = data.settings.language;
    const t = trans[lang];

    // DEMO MODE: Show login modal
    if (isDemoMode) {
        showLoginModal();
        return;
    }

    try {
        // Load current user settings
        const response = await api.get('/user');
        if (response && response.user && response.user.settings) {
            // Populate modal with current settings
            const showOnLeaderboard = response.user.settings.showOnLeaderboard !== false; // Default true
            const displayName = response.user.settings.leaderboardDisplayName || '';

            debug.log('🔍 Frontend: Loading privacy settings into modal:');
            debug.log('   From API - showOnLeaderboard:', response.user.settings.showOnLeaderboard);
            debug.log('   From API - leaderboardDisplayName:', response.user.settings.leaderboardDisplayName);
            debug.log('   Setting toggle to:', showOnLeaderboard);
            debug.log('   Setting display name to:', displayName);

            document.getElementById('showOnLeaderboardToggle').checked = showOnLeaderboard;
            document.getElementById('leaderboardDisplayName').value = displayName;

            // Update placeholder based on language
            const placeholder = lang === 'ar'
                ? 'اترك فارغاً لاستخدام اسمك الحقيقي'
                : 'Leave empty to use your real name';
            document.getElementById('leaderboardDisplayName').placeholder = placeholder;
        }

        // Open modal
        document.getElementById('privacyModal').classList.add('active');

    } catch (error) {
        debug.error('Error loading privacy settings:', error);
        ui.showError(lang === 'ar' ? 'خطأ في تحميل الإعدادات' : 'Error loading settings', lang === 'ar');
    }
}

function closePrivacySettings() {
    document.getElementById('privacyModal').classList.remove('active');
}

async function savePrivacySettings() {
    const lang = data.settings.language;
    const t = trans[lang];
    const isArabic = lang === 'ar';

    const showOnLeaderboard = document.getElementById('showOnLeaderboardToggle').checked;
    const displayName = document.getElementById('leaderboardDisplayName').value.trim();

    // Debug logging
    debug.log('🔍 Frontend: Reading privacy settings from DOM:');
    debug.log('   Toggle element:', document.getElementById('showOnLeaderboardToggle'));
    debug.log('   Toggle checked:', showOnLeaderboard);
    debug.log('   Display name element:', document.getElementById('leaderboardDisplayName'));
    debug.log('   Display name value:', displayName);
    debug.log('   Sending to API:', { showOnLeaderboard, leaderboardDisplayName: displayName || null });

    // Validate display name length
    if (displayName.length > 50) {
        ui.showError(t.privacyNameTooLong, isArabic);
        return;
    }

    try {
        ui.showLoader();

        // Update user settings via API
        await api.put('/user', {
            settings: {
                showOnLeaderboard,
                leaderboardDisplayName: displayName || null
            }
        });

        // Close modal
        closePrivacySettings();

        // Always refresh leaderboard (force refresh to bypass cache)
        // This ensures changes are visible immediately, even if user switches tabs later
        await loadLeaderboard(true);

        ui.hideLoader();
        ui.showSuccess(t.privacySaveSuccess, isArabic);

    } catch (error) {
        debug.error('Error saving privacy settings:', error);
        ui.hideLoader();
        ui.showError(t.errorSaving, isArabic);
    }
}

// ================================
// UI HELPERS
// ================================

function convertToArabicNumerals(num) {
    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().split('').map(d => arabicNumerals[parseInt(d)]).join('');
}

function updateCurrentDate() {
    const lang = data.settings.language;
    const date = new Date();
    const formatted = date.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US',
        { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('currentDate').textContent = formatted;
}

function setRating(type, rating) {
    const container = document.getElementById(type + 'Rating');
    container.querySelectorAll('.star').forEach((star, index) => {
        if (index < rating) star.classList.add('active');
        else star.classList.remove('active');
    });
    data.settings[type + 'Rating'] = rating;
}

// ================================
// LANGUAGE & SETTINGS
// ================================

async function toggleLanguage() {
    data.settings.language = data.settings.language === 'ar' ? 'en' : 'ar';

    // Save to API (skip in demo mode)
    if (!isDemoMode) {
        try {
            await api.put('/user', { settings: { language: data.settings.language } });
            storage.setLanguage(data.settings.language);
        } catch (error) {
            debug.error('Error saving language:', error);
        }
    } else {
        // Demo mode: just save to localStorage
        storage.setLanguage(data.settings.language);
    }

    applyLanguage();
}

function applyLanguage() {
    const lang = data.settings.language;
    const t = trans[lang];
    const isArabic = lang === 'ar';

    document.documentElement.lang = lang;
    document.documentElement.dir = document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';

    // Update all translated elements
    Object.keys(t).forEach(key => {
        const el = document.getElementById(key);
        if (el) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = t[key];
            } else {
                el.textContent = t[key];
            }
        }
    });

    // Update elements with data-translate-placeholder attribute
    document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
        const key = el.getAttribute('data-translate-placeholder');
        if (t[key]) {
            el.placeholder = t[key];
        }
    });

    // Update leaderboard rank text dynamically
    const myRankTextEl = document.getElementById('myRankText');
    const totalUsersEl = document.getElementById('totalUsers');
    if (myRankTextEl && totalUsersEl) {
        const totalUsers = totalUsersEl.textContent || '0';
        myRankTextEl.innerHTML = `${t.myRankText} <span id="totalUsers">${totalUsers}</span> ${t.totalUsersText}`;
    }

    // Update select options
    const statusSelect = document.getElementById('juzStatus');
    if (statusSelect) {
        statusSelect.options[0].text = t.statusNotStarted;
        statusSelect.options[1].text = t.statusInProgress;
        statusSelect.options[2].text = t.statusCompleted;
    }

    // Refresh displays
    displayJuz();
    displayHistory();
    updateCurrentDate();
    if (typeof recitationUI !== 'undefined') recitationUI.onLanguageChange();

    // Reload leaderboard to update rank text if on leaderboard tab
    const leaderboardTab = document.getElementById('leaderboardTab');
    if (leaderboardTab && leaderboardTab.style.display !== 'none') {
        loadMyRank();
    }
}

// ================================
// TAB SWITCHING
// ================================

function switchTab(tab) {
    // Leaving mid-recitation ends the session — confirm first.
    if (typeof recitationUI !== 'undefined' && recitationUI.isSessionActive() && tab !== 'recite') {
        const t = trans[data.settings.language];
        if (!confirm(t.reciteLeaveConfirm)) return;
        recitationUI.abandonSession();
    }

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    ['todayTab', 'juzTab', 'historyTab', 'statsTab', 'leaderboardTab', 'reciteTab'].forEach(t =>
        document.getElementById(t).style.display = 'none'
    );

    if (tab === 'today') {
        document.getElementById('todayTab').style.display = 'block';
    } else if (tab === 'juz') {
        document.getElementById('juzTab').style.display = 'block';
    } else if (tab === 'history') {
        document.getElementById('historyTab').style.display = 'block';
        displayHistory();
    } else if (tab === 'stats') {
        document.getElementById('statsTab').style.display = 'block';
        displayDetailedStats();
    } else if (tab === 'leaderboard') {
        document.getElementById('leaderboardTab').style.display = 'block';

        // DEMO MODE: Show login modal instead of loading leaderboard
        if (isDemoMode) {
            showLoginModal();
        } else {
            loadLeaderboard();
        }
    } else if (tab === 'recite') {
        document.getElementById('reciteTab').style.display = 'block';
        if (typeof recitationUI !== 'undefined') recitationUI.init();
    }
}

// ================================
// HELP MODAL
// ================================

function openHelp() {
    const lang = data.settings.language;
    const helpContent = lang === 'ar' ? `
        <h3 style="color: var(--gold); margin: 25px 0 15px;">مرحباً بك في حافظ! 🌙</h3>
        <p><strong>تطبيق حافظ</strong> هو رفيقك في رحلة حفظ القرآن الكريم. يساعدك على تتبع تقدمك اليومي، إدارة أجزائك، ومراقبة إنجازاتك.</p>

        <h4 style="color: var(--gold); margin: 20px 0 10px;">✍️ تسجيل اليومي</h4>
        <p><strong>تبويب "اليوم":</strong> سجل الصفحات الجديدة والمراجعة. استخدم صيغة: <code>1-5</code> أو <code>1، 3، 5</code></p>
        <p><strong>تقييم الجودة:</strong> قيّم حفظك من 1-5 نجوم (5 = ممتاز، 1 = يحتاج مراجعة)</p>

        <h4 style="color: var(--gold); margin: 20px 0 10px;">📚 إدارة الأجزاء</h4>
        <p><strong>تبويب "الأجزاء":</strong> انقر على أي جزء لتحديث حالته (لم يبدأ / جاري الحفظ / مكتمل)</p>
        <p>كل جزء يحتوي على 20 صفحة. سجل تقدمك وأضف تواريخ البدء والإتمام.</p>

        <h4 style="color: var(--gold); margin: 20px 0 10px;">📊 الإحصائيات</h4>
        <p><strong>البطاقات العلوية:</strong> مجموع الصفحات، الأجزاء المكتملة، الأيام المتتالية، نسبة الإنجاز</p>
        <p><strong>تبويب "الإحصائيات":</strong> إحصائيات مفصلة عن رحلة حفظك</p>

        <h4 style="color: var(--gold); margin: 20px 0 10px;">☁️ المزامنة السحابية</h4>
        <p>جميع بياناتك محفوظة بشكل آمن في السحابة ومتزامنة تلقائياً عبر جميع أجهزتك.</p>

        <h4 style="color: var(--gold); margin: 20px 0 10px;">📱 تثبيت التطبيق</h4>
        <p><strong>iOS:</strong> Safari → زر المشاركة → "إضافة إلى الشاشة الرئيسية"</p>
        <p><strong>Android:</strong> Chrome → القائمة (⋮) → "إضافة إلى الشاشة الرئيسية"</p>
        <p><strong>Desktop:</strong> انقر أيقونة التثبيت (⊕) في شريط العنوان</p>

        <p style="margin-top: 25px; padding: 15px; background: rgba(212, 175, 55, 0.1); border-radius: 10px; border: 1px solid rgba(212, 175, 55, 0.3);">
        📖 <strong>دليل المستخدم الكامل:</strong> راجع ملف USER-GUIDE.md للحصول على تعليمات مفصلة
        </p>

        <p style="text-align: center; margin-top: 20px; color: var(--gold);">
        <strong>جعل الله رحلة حفظك ميسرة وتقبل جهودك</strong>
        </p>
    ` : `
        <h3 style="color: var(--gold); margin: 25px 0 15px;">Welcome to Hafiz! 🌙</h3>
        <p><strong>Hafiz</strong> is your companion in the journey of Quran memorization. It helps you track daily progress, manage your Juz, and monitor your achievements.</p>

        <h4 style="color: var(--gold); margin: 20px 0 10px;">✍️ Daily Logging</h4>
        <p><strong>"Today" Tab:</strong> Log new pages and review pages. Use format: <code>1-5</code> or <code>1, 3, 5</code></p>
        <p><strong>Quality Rating:</strong> Rate your memorization 1-5 stars (5 = excellent, 1 = needs review)</p>

        <h4 style="color: var(--gold); margin: 20px 0 10px;">📚 Juz Management</h4>
        <p><strong>"Juz" Tab:</strong> Click any Juz to update its status (Not Started / In Progress / Completed)</p>
        <p>Each Juz contains 20 pages. Track your progress and add start/completion dates.</p>

        <h4 style="color: var(--gold); margin: 20px 0 10px;">📊 Statistics</h4>
        <p><strong>Top Cards:</strong> Total pages, completed Juz, current streak, completion percentage</p>
        <p><strong>"Statistics" Tab:</strong> Detailed analytics about your memorization journey</p>

        <h4 style="color: var(--gold); margin: 20px 0 10px;">☁️ Cloud Sync</h4>
        <p>All your data is securely saved in the cloud and automatically synced across all your devices.</p>

        <h4 style="color: var(--gold); margin: 20px 0 10px;">📱 Install App</h4>
        <p><strong>iOS:</strong> Safari → Share button → "Add to Home Screen"</p>
        <p><strong>Android:</strong> Chrome → Menu (⋮) → "Add to Home screen"</p>
        <p><strong>Desktop:</strong> Click install icon (⊕) in address bar</p>

        <p style="margin-top: 25px; padding: 15px; background: rgba(212, 175, 55, 0.1); border-radius: 10px; border: 1px solid rgba(212, 175, 55, 0.3);">
        📖 <strong>Full User Guide:</strong> See USER-GUIDE.md for detailed instructions
        </p>

        <p style="text-align: center; margin-top: 20px; color: var(--gold);">
        <strong>May Allah make your memorization journey easy and accept your efforts</strong>
        </p>
    `;

    document.getElementById('helpTitle').textContent = trans[lang].helpTitle;
    document.getElementById('helpContent').innerHTML = helpContent;
    document.getElementById('helpModal').classList.add('active');
}

function closeHelp() {
    document.getElementById('helpModal').classList.remove('active');
}

// ================================
// EVENT LISTENERS
// ================================

// Real-time Juz form sync: status → pages
document.getElementById('juzStatus').addEventListener('change', (e) => {
    const status = e.target.value;
    const pagesInput = document.getElementById('juzPages');

    if (status === 'completed') {
        pagesInput.value = 20;
    } else if (status === 'not-started') {
        pagesInput.value = 0;
    }
    // For 'in-progress', keep current value (user can set 1-19)
});

// Real-time Juz form sync: pages → status
document.getElementById('juzPages').addEventListener('input', (e) => {
    const pages = parseInt(e.target.value) || 0;
    const statusSelect = document.getElementById('juzStatus');

    if (pages >= 20) {
        statusSelect.value = 'completed';
        e.target.value = 20; // Cap at 20
    } else if (pages === 0) {
        statusSelect.value = 'not-started';
    } else if (pages > 0 && pages < 20) {
        statusSelect.value = 'in-progress';
    }
});

document.getElementById('juzModal').addEventListener('click', (e) => {
    if (e.target.id === 'juzModal') closeModal();
});

document.getElementById('helpModal').addEventListener('click', (e) => {
    if (e.target.id === 'helpModal') closeHelp();
});

document.getElementById('privacyModal').addEventListener('click', (e) => {
    if (e.target.id === 'privacyModal') closePrivacySettings();
});

// Initialize app
init();
