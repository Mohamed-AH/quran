/**
 * Demo Data for Landing Page
 * Mock data to showcase app features before login
 */

const demoData = {
  // Sample user
  user: {
    name: 'مستخدم تجريبي',
    language: 'ar',
    theme: 'default'
  },

  // Sample Juz progress (30 Juz with various states)
  juz: [
    { juzNumber: 1, status: 'completed', pages: 20, startDate: '2024-01-15', completionDate: '2024-02-10', notes: 'الحمد لله' },
    { juzNumber: 2, status: 'completed', pages: 20, startDate: '2024-02-11', completionDate: '2024-03-05', notes: '' },
    { juzNumber: 3, status: 'completed', pages: 20, startDate: '2024-03-06', completionDate: '2024-03-28', notes: '' },
    { juzNumber: 4, status: 'in-progress', pages: 15, startDate: '2024-03-29', completionDate: null, notes: 'جاري الحفظ' },
    { juzNumber: 5, status: 'in-progress', pages: 8, startDate: '2024-11-15', completionDate: null, notes: '' },
    { juzNumber: 6, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 7, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 8, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 9, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 10, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 11, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 12, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 13, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 14, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 15, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 16, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 17, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 18, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 19, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 20, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 21, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 22, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 23, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 24, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 25, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 26, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 27, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 28, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 29, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' },
    { juzNumber: 30, status: 'not-started', pages: 0, startDate: null, completionDate: null, notes: '' }
  ],

  // Sample daily logs
  logs: [
    {
      date: '2024-12-15',
      newPages: '1-5',
      newRating: 5,
      reviewPages: '10-15',
      reviewRating: 4,
      notes: 'جلسة ممتازة اليوم، الحمد لله'
    },
    {
      date: '2024-12-14',
      newPages: '6-8',
      newRating: 4,
      reviewPages: '1-5',
      reviewRating: 5,
      notes: 'مراجعة الحفظ السابق'
    },
    {
      date: '2024-12-13',
      newPages: '9-12',
      newRating: 4,
      reviewPages: '6-8',
      reviewRating: 4,
      notes: ''
    },
    {
      date: '2024-12-12',
      newPages: '',
      newRating: 0,
      reviewPages: '1-12',
      reviewRating: 5,
      notes: 'يوم مراجعة فقط'
    },
    {
      date: '2024-12-11',
      newPages: '13-15',
      newRating: 3,
      reviewPages: '9-12',
      reviewRating: 4,
      notes: 'بعض الآيات كانت صعبة'
    }
  ],

  // Sample statistics
  stats: {
    totalPages: 83,
    totalJuz: 3,
    currentStreak: 7,
    totalDays: 45,
    avgNewQuality: 4.2,
    avgReviewQuality: 4.5,
    completionPercentage: 10
  },

  // Translations for demo
  translations: {
    ar: {
      title: 'حافظ',
      subtitle: 'رحلة حفظ القرآن الكريم',
      tagline: 'تتبع رحلة حفظك للقرآن الكريم',
      demoTitle: 'جرب التطبيق',
      demoBanner: 'هذه نسخة تجريبية - سجل دخولك لاستخدام بياناتك الخاصة',
      loginTitle: 'سجل دخولك للبدء',
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
      loginToUse: 'سجل دخولك لاستخدام هذه الميزة'
    },
    en: {
      title: 'Hafiz',
      subtitle: 'Quran Memorization Journey',
      tagline: 'Track your Quran memorization journey',
      demoTitle: 'Try the App',
      demoBanner: 'This is a demo - Login to use your own data',
      loginTitle: 'Login to Get Started',
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
      loginToUse: 'Login to use this feature'
    }
  },

  /**
   * Get translation based on language
   */
  t(key, lang = 'ar') {
    return this.translations[lang][key] || key;
  }
};

// Make demoData globally accessible
if (typeof window !== 'undefined') {
  window.demoData = demoData;
}
