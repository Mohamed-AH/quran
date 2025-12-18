/**
 * Demo Data for Landing Page
 * Matches Phase 5 Juz-based progress tracking exactly
 */

const demoData = {
  // Sample user
  user: {
    name: 'أحمد المحمد',
    email: 'demo@hafiz.app',
    language: 'ar'
  },

  // Juz: Match actual Phase 5 structure exactly
  juz: [
    // 5 completed Juz (realistic timeline over 3 months)
    {
      juzNumber: 1,
      status: 'completed',
      pages: 20,
      startDate: new Date('2024-09-01').toISOString(),
      endDate: new Date('2024-09-15').toISOString(),
      notes: 'الحمد لله، بداية موفقة في رحلة الحفظ',
      createdAt: new Date('2024-09-01').toISOString(),
      updatedAt: new Date('2024-09-15').toISOString()
    },
    {
      juzNumber: 2,
      status: 'completed',
      pages: 20,
      startDate: new Date('2024-09-16').toISOString(),
      endDate: new Date('2024-09-30').toISOString(),
      notes: 'سورة البقرة - آيات عظيمة',
      createdAt: new Date('2024-09-16').toISOString(),
      updatedAt: new Date('2024-09-30').toISOString()
    },
    {
      juzNumber: 3,
      status: 'completed',
      pages: 20,
      startDate: new Date('2024-10-01').toISOString(),
      endDate: new Date('2024-10-20').toISOString(),
      notes: 'آيات التوبة والرحمة',
      createdAt: new Date('2024-10-01').toISOString(),
      updatedAt: new Date('2024-10-20').toISOString()
    },
    {
      juzNumber: 4,
      status: 'completed',
      pages: 20,
      startDate: new Date('2024-10-21').toISOString(),
      endDate: new Date('2024-11-08').toISOString(),
      notes: 'سورة آل عمران والنساء',
      createdAt: new Date('2024-10-21').toISOString(),
      updatedAt: new Date('2024-11-08').toISOString()
    },
    {
      juzNumber: 5,
      status: 'completed',
      pages: 20,
      startDate: new Date('2024-11-09').toISOString(),
      endDate: new Date('2024-11-28').toISOString(),
      notes: 'آيات الأحكام في سورة النساء',
      createdAt: new Date('2024-11-09').toISOString(),
      updatedAt: new Date('2024-11-28').toISOString()
    },

    // 2 in-progress Juz
    {
      juzNumber: 6,
      status: 'in-progress',
      pages: 12,
      startDate: new Date('2024-11-29').toISOString(),
      endDate: null,
      notes: 'جاري الحفظ الآن، تقدم جيد',
      createdAt: new Date('2024-11-29').toISOString(),
      updatedAt: new Date('2024-12-17').toISOString()
    },
    {
      juzNumber: 7,
      status: 'in-progress',
      pages: 5,
      startDate: new Date('2024-12-10').toISOString(),
      endDate: null,
      notes: 'بداية الجزء السابع',
      createdAt: new Date('2024-12-10').toISOString(),
      updatedAt: new Date('2024-12-17').toISOString()
    },

    // Remaining 23 not-started (8-30)
    ...Array.from({ length: 23 }, (_, i) => ({
      juzNumber: i + 8,
      status: 'not-started',
      pages: 0,
      startDate: null,
      endDate: null,
      notes: '',
      createdAt: new Date('2024-09-01').toISOString(),
      updatedAt: new Date('2024-09-01').toISOString()
    }))
  ],

  // Daily logs: Match actual structure with recent dates
  logs: [
    {
      _id: 'demo-log-1',
      date: new Date('2024-12-17').toISOString(),
      newPages: '1-3',
      newRating: 5,
      reviewPages: '10-15, 20-25',
      reviewRating: 4,
      notes: 'جلسة ممتازة اليوم، الحمد لله. ركزت على الآيات الصعبة ومراجعة الحفظ السابق.',
      createdAt: new Date('2024-12-17').toISOString(),
      updatedAt: new Date('2024-12-17').toISOString()
    },
    {
      _id: 'demo-log-2',
      date: new Date('2024-12-16').toISOString(),
      newPages: '4-6',
      newRating: 4,
      reviewPages: '1-3',
      reviewRating: 5,
      notes: 'مراجعة الحفظ السابق بإتقان، والحمد لله',
      createdAt: new Date('2024-12-16').toISOString(),
      updatedAt: new Date('2024-12-16').toISOString()
    },
    {
      _id: 'demo-log-3',
      date: new Date('2024-12-15').toISOString(),
      newPages: '7-9',
      newRating: 4,
      reviewPages: '4-6, 10-12',
      reviewRating: 4,
      notes: 'بعض الآيات تحتاج مراجعة إضافية',
      createdAt: new Date('2024-12-15').toISOString(),
      updatedAt: new Date('2024-12-15').toISOString()
    },
    {
      _id: 'demo-log-4',
      date: new Date('2024-12-14').toISOString(),
      newPages: '',
      newRating: 0,
      reviewPages: '1-15',
      reviewRating: 5,
      notes: 'يوم مراجعة شاملة فقط للتثبيت',
      createdAt: new Date('2024-12-14').toISOString(),
      updatedAt: new Date('2024-12-14').toISOString()
    },
    {
      _id: 'demo-log-5',
      date: new Date('2024-12-13').toISOString(),
      newPages: '10-12',
      newRating: 5,
      reviewPages: '7-9',
      reviewRating: 4,
      notes: 'تقدم جيد والحمد لله، استمرار السلسلة',
      createdAt: new Date('2024-12-13').toISOString(),
      updatedAt: new Date('2024-12-13').toISOString()
    },
    {
      _id: 'demo-log-6',
      date: new Date('2024-12-12').toISOString(),
      newPages: '13-15',
      newRating: 3,
      reviewPages: '10-12',
      reviewRating: 4,
      notes: 'يوم صعب قليلاً، لكن أكملت الهدف بفضل الله',
      createdAt: new Date('2024-12-12').toISOString(),
      updatedAt: new Date('2024-12-12').toISOString()
    },
    {
      _id: 'demo-log-7',
      date: new Date('2024-12-11').toISOString(),
      newPages: '16-18',
      newRating: 4,
      reviewPages: '13-15, 1-5',
      reviewRating: 5,
      notes: 'ماشاء الله، تحسن ملحوظ في الحفظ والمراجعة',
      createdAt: new Date('2024-12-11').toISOString(),
      updatedAt: new Date('2024-12-11').toISOString()
    }
  ],

  // Stats: Match Phase 5 architecture EXACTLY
  stats: {
    // Juz Progress (primary metrics - from Juz tracking)
    totalPages: 117,                // 5*20 + 12 + 5 = 117 pages
    completedJuz: 5,                // Juz 1-5
    inProgressJuz: 2,               // Juz 6-7
    notStartedJuz: 23,              // Juz 8-30
    juzCompletionPercentage: 16.7,  // (5/30)*100 = 16.67%
    pageProgressPercentage: 19.5,   // (117/600)*100 = 19.5%

    // Activity Statistics (from daily logs)
    totalDays: 7,                   // Number of logs
    currentStreak: 7,               // Consecutive days
    avgNewQuality: 4.1,             // Average of newRating (29/7 ≈ 4.14)
    avgReviewQuality: 4.4           // Average of reviewRating (31/7 ≈ 4.43)
  },

  // Translations for demo (same as main app)
  translations: {
    ar: {
      title: 'حافظ',
      subtitle: 'رحلة حفظ القرآن الكريم',
      tagline: 'تتبع رحلة حفظك للقرآن الكريم بطريقة منظمة وفعالة',
      demoTitle: 'جرب التطبيق',
      demoBanner: '📊 جرب التطبيق الآن - البيانات المعروضة للتوضيح فقط',
      loginTitle: 'ابدأ رحلتك الآن',
      loginSubtitle: 'سجّل دخولك لحفظ تقدمك ومزامنته عبر جميع أجهزتك',
      loginGoogle: 'تسجيل الدخول بحساب Google',
      loginGithub: 'تسجيل الدخول بحساب GitHub',
      featuresTitle: 'المميزات',
      feature1: 'تسجيل يومي لحفظك',
      feature1desc: 'سجل صفحات الحفظ والمراجعة يومياً',
      feature2: 'تتبع 30 جزء',
      feature2desc: 'راقب تقدمك في جميع الأجزاء',
      feature3: 'إحصائيات مفصلة',
      feature3desc: 'تصور تقدمك وسلسلة أيامك',
      feature4: 'المزامنة السحابية',
      feature4desc: 'بياناتك محفوظة عبر جميع أجهزتك',
      secure: 'آمن',
      cloudBased: 'قائم على السحابة',
      free: 'مجاني للأبد',
      todayTab: 'اليوم',
      juzTab: 'الأجزاء',
      statsTab: 'الإحصائيات',
      pagesMemorized: 'صفحات محفوظة',
      juzCompleted: 'أجزاء مكتملة',
      currentStreak: 'أيام متتالية',
      progress: 'نسبة الإنجاز',
      completedJuz: 'أجزاء مكتملة',
      inProgressJuz: 'أجزاء قيد الحفظ',
      notStartedJuz: 'أجزاء لم تبدأ',
      juzProgress: 'تقدم الأجزاء',
      activityStats: 'إحصائيات النشاط',
      totalPages: 'إجمالي الصفحات',
      avgNewQuality: 'متوسط جودة الحفظ',
      avgReviewQuality: 'متوسط جودة المراجعة',
      totalDays: 'إجمالي أيام التسجيل',
      statusCompleted: 'مكتمل',
      statusInProgress: 'جاري الحفظ',
      statusNotStarted: 'لم يبدأ'
    },
    en: {
      title: 'Hafiz',
      subtitle: 'Quran Memorization Journey',
      tagline: 'Track your Quran memorization journey efficiently and effectively',
      demoTitle: 'Try the App',
      demoBanner: '📊 Try the App Now - Demo Data for Illustration Only',
      loginTitle: 'Start Your Journey Now',
      loginSubtitle: 'Login to save your progress and sync across all your devices',
      loginGoogle: 'Login with Google',
      loginGithub: 'Login with GitHub',
      featuresTitle: 'Features',
      feature1: 'Daily Logs',
      feature1desc: 'Track daily memorization and review',
      feature2: 'Track 30 Juz',
      feature2desc: 'Monitor progress across all Juz',
      feature3: 'Detailed Statistics',
      feature3desc: 'Visualize your progress and streaks',
      feature4: 'Cloud Sync',
      feature4desc: 'Your data synced across all devices',
      secure: 'Secure',
      cloudBased: 'Cloud-based',
      free: 'Free Forever',
      todayTab: 'Today',
      juzTab: 'Juz',
      statsTab: 'Statistics',
      pagesMemorized: 'Pages Memorized',
      juzCompleted: 'Juz Completed',
      currentStreak: 'Current Streak',
      progress: 'Progress',
      completedJuz: 'Juz Completed',
      inProgressJuz: 'Juz In Progress',
      notStartedJuz: 'Not Started',
      juzProgress: 'Juz Progress',
      activityStats: 'Activity Statistics',
      totalPages: 'Total Pages',
      avgNewQuality: 'Avg New Quality',
      avgReviewQuality: 'Avg Review Quality',
      totalDays: 'Total Days Logged',
      statusCompleted: 'Completed',
      statusInProgress: 'In Progress',
      statusNotStarted: 'Not Started'
    }
  },

  /**
   * Get translation based on language
   */
  t(key, lang = 'ar') {
    return this.translations[lang][key] || key;
  },

  /**
   * Calculate demo statistics (matches backend getProgressSummary exactly)
   */
  calculateStats() {
    const juzList = this.juz;

    let totalPages = 0;
    let completedJuz = 0;
    let inProgressJuz = 0;
    let notStartedJuz = 0;

    juzList.forEach(juz => {
      totalPages += juz.pages;
      if (juz.status === 'completed') completedJuz++;
      else if (juz.status === 'in-progress') inProgressJuz++;
      else notStartedJuz++;
    });

    const juzCompletionPercentage = ((completedJuz / 30) * 100).toFixed(1);
    const pageProgressPercentage = ((totalPages / 600) * 100).toFixed(1);

    return {
      totalPages,
      completedJuz,
      inProgressJuz,
      notStartedJuz,
      juzCompletionPercentage: parseFloat(juzCompletionPercentage),
      pageProgressPercentage: parseFloat(pageProgressPercentage)
    };
  }
};

// Make demoData globally accessible
if (typeof window !== 'undefined') {
  window.demoData = demoData;
}
