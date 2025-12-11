# 🌙 Hafiz - Quran Memorization Tracker

> **حافظ** - Your personal companion for tracking Quran memorization journey

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status: Beta](https://img.shields.io/badge/Status-Beta-blue.svg)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()

A beautiful, bilingual (Arabic/English) web application for tracking your Quran memorization progress. Built with vanilla JavaScript, fully functional offline, and installable as a Progressive Web App.

## ✨ Features

### 📊 Core Functionality
- **Daily Logging**: Track new pages memorized and pages reviewed
- **Quality Ratings**: Rate your memorization and review quality (1-5 stars)
- **30 Juz Management**: Individual tracking for all 30 Juz with accurate Arabic names
- **Progress Visualization**: Real-time progress ring and statistics
- **Streak Tracking**: Monitor consecutive days of practice
- **Comprehensive History**: View all past entries with dates and details

### 👥 Profile Management
- **Multiple Profiles**: Create separate profiles for family members
- **Easy Switching**: Quick profile switching from dropdown
- **Export/Import**: Backup and restore profiles as JSON files
- **Profile Metadata**: Track creation date, last activity, and total logs

### 🌐 User Experience
- **Bilingual Interface**: Full Arabic and English support with RTL/LTR layouts
- **Responsive Design**: Beautiful UI on mobile, tablet, and desktop
- **Offline-First**: Works completely offline using localStorage
- **PWA Support**: Installable as a native-like app
- **No Backend Required**: All data stored locally in browser

### 📈 Statistics & Analytics
- **Total Pages**: Track overall memorization progress
- **Completion Percentage**: Visual progress toward completing all 604 pages
- **Average Quality**: Monitor memorization and review quality trends
- **Active Juz**: See how many Juz are in progress

## 🚀 Quick Start

### Option 1: Direct Use
1. Download `index.html`
2. Open in any modern web browser
3. Start tracking immediately!

### Option 2: Serve Locally
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server

# Then open http://localhost:8000
```

### Option 3: Deploy to Web
- **Vercel**: Drag and drop `index.html`
- **Netlify**: Deploy via GitHub or manual upload
- **GitHub Pages**: Push to `gh-pages` branch

## 📱 Installation as PWA

### Mobile (iOS/Android)
1. Open the app in Safari/Chrome
2. Tap the Share button
3. Select "Add to Home Screen"
4. App will work offline!

### Desktop (Chrome/Edge)
1. Open the app
2. Click the install icon in address bar
3. Click "Install"
4. Launch from desktop like a native app

## 🎯 How to Use

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

### Profile Management
1. Go to **"الملف الشخصي" (Profile)** tab
2. Create new profiles for family members
3. Switch between profiles using dropdown
4. **Export**: Download backup as JSON
5. **Import**: Upload previously exported file
6. **Rename**: Change profile name
7. **Delete**: Remove unwanted profiles

### Viewing Progress
- **History Tab**: See all past entries chronologically
- **Statistics Tab**: View detailed analytics
- **Dashboard Cards**: Quick overview at the top

## 💾 Data Storage

### Current Implementation (v1.0)
- **Storage**: Browser localStorage
- **Capacity**: ~5-10MB (thousands of entries)
- **Persistence**: Data stays on device
- **Privacy**: 100% local, no server communication
- **Sync**: Manual export/import between devices

### Important Notes
⚠️ **Clearing browser data will delete your logs!**
💡 **Export regularly as backup**
📱 **Each browser/device has separate data**

## 🔄 Export/Import Guide

### To Backup:
1. Profile Tab → "تصدير الملف" (Export Profile)
2. JSON file downloads with format: `hafiz_ProfileName_YYYY-MM-DD.json`
3. Save to cloud storage (Google Drive, Dropbox, etc.)

### To Restore:
1. Profile Tab → "استيراد ملف" (Import Profile)
2. Select previously exported JSON file
3. New profile created with "(imported)" suffix
4. All data restored!

## 🏗️ Technical Details

### Tech Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Storage**: localStorage API
- **Fonts**: Google Fonts (Cairo, Amiri, Rakkas, Crimson Pro)
- **No Dependencies**: Zero external libraries
- **File Size**: Single file, ~85KB

### Browser Compatibility
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Android)

### Data Structure
```javascript
{
  profiles: {
    "profile_id": {
      name: "Profile Name",
      data: {
        logs: [...],      // Daily entries
        juz: {...},       // 30 Juz tracking
        settings: {...},  // Language, ratings
        metadata: {...}   // Created, modified dates
      }
    }
  }
}
```

## 🗺️ Roadmap

### v1.0 - Current (LocalStorage Version) ✅
- [x] Daily logging
- [x] Juz management
- [x] Multiple profiles
- [x] Export/Import
- [x] Bilingual support
- [x] Statistics
- [x] PWA support

### v2.0 - Cloud Version (In Planning) 🚧
- [ ] User authentication (Google, GitHub)
- [ ] Cloud database (MongoDB Atlas)
- [ ] Multi-device sync
- [ ] Real-time updates
- [ ] Enhanced analytics
- [ ] Email notifications
- [ ] Collaborative features

See [ROADMAP.md](./ROADMAP.md) for detailed production plan.

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Areas for Contribution
- 🐛 Bug reports and fixes
- 💡 Feature suggestions
- 🌍 Translations to other languages
- 📱 UI/UX improvements
- 📚 Documentation enhancements
- ✨ Code optimization

### How to Contribute
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines
- Keep code clean and well-commented
- Test on multiple browsers
- Maintain bilingual support
- Follow existing code style
- Update documentation

## 🐛 Known Issues

- [ ] Large export files (1000+ entries) may be slow to process
- [ ] localStorage quota (~5-10MB) may limit very large datasets
- [ ] No automatic backup reminders yet
- [ ] Statistics don't show charts/graphs yet

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Mohamed A Hameed**
- GitHub: [@Mohamed-ah](https://github.com/mohamed-ah)
- Email: emah84@gmail.com

## 🙏 Acknowledgments

- Quran verse references and Juz names
- Islamic design inspiration
- Arabic typography experts
- Open source community
- All beta testers and contributors

## 📞 Support

- 🐛 **Bug Reports**: [Open an issue](https://github.com/yourusername/hafiz/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/yourusername/hafiz/discussions)
- 📧 **Email**: support@hafiz.app
- 📖 **Documentation**: [Wiki](https://github.com/yourusername/hafiz/wiki)

## 🌟 Star History

If you find this project helpful, please consider giving it a star! ⭐

## 📊 Project Stats

![GitHub stars](https://img.shields.io/github/stars/yourusername/hafiz?style=social)
![GitHub forks](https://img.shields.io/github/forks/yourusername/hafiz?style=social)
![GitHub watchers](https://img.shields.io/github/watchers/yourusername/hafiz?style=social)

---

<div align="center">

**جعل الله رحلة حفظك ميسرة وتقبل جهودك**

*May Allah make your memorization journey easy and accept your efforts*

Made with ❤️ for the Muslim Ummah

</div>
