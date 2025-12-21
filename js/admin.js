/**
 * Admin Panel JavaScript
 * Handles admin-specific functionality
 */

// Translations
const translations = {
  ar: {
    backToAppText: 'العودة للتطبيق',
    adminBadgeText: 'مدير',
    adminTitle: 'لوحة التحكم',
    adminSubtitle: 'إدارة المستخدمين والإعدادات',
    settingsTitle: '⚙️ الإعدادات العامة',
    signupControlTitle: 'التحكم في التسجيل',
    signupControlDesc: 'تفعيل نظام رموز الدعوة للتسجيل',
    leaderboardTitle: 'لوحة المتصدرين',
    leaderboardDesc: 'إظهار أو إخفاء لوحة المتصدرين للطلاب',
    statsTitle: '📊 الإحصائيات',
    labelTotalUsers: 'إجمالي المستخدمين',
    labelActiveUsers: 'نشط (7 أيام)',
    labelTotalPages: 'صفحات محفوظة',
    labelCompletedJuz: 'أجزاء مكتملة',
    usersTitle: '👥 إدارة المستخدمين',
    thName: 'الاسم',
    thEmail: 'البريد الإلكتروني',
    thRole: 'الدور',
    thJoined: 'تاريخ التسجيل',
    thActions: 'إجراءات',
    loadingText: 'جاري التحميل...',
    inviteCodesTitle: '🎟️ رموز الدعوة',
    btnCreateInvite: '+ إنشاء رمز جديد',
    loadingInvites: 'جاري التحميل...',
    modalTitle: 'إنشاء رمز دعوة جديد',
    labelMaxUses: 'عدد الاستخدامات:',
    labelExpires: 'تاريخ الانتهاء (اختياري):',
    labelDescription: 'الوصف (اختياري):',
    btnCreate: 'إنشاء',
    btnCancel: 'إلغاء',
    userDetailsTitle: 'تفاصيل المستخدم',
    roleUser: 'مستخدم',
    roleAdmin: 'مدير',
    btnView: 'عرض',
    btnDelete: 'حذف',
    btnPromote: 'ترقية',
    btnDemote: 'تخفيض',
    btnCopy: 'نسخ',
    btnDeactivate: 'تعطيل',
    statusActive: 'نشط',
    statusInactive: 'معطل',
    confirmDelete: 'هل أنت متأكد من حذف هذا المستخدم؟ سيتم حذف جميع بياناته.',
    confirmPromote: 'هل تريد ترقية هذا المستخدم إلى مدير؟',
    confirmDemote: 'هل تريد تخفيض هذا المستخدم إلى مستخدم عادي؟',
    confirmDeactivate: 'هل تريد تعطيل هذا الرمز؟',
    successCopied: 'تم نسخ الرمز!',
    errorLoad: 'خطأ في تحميل البيانات',
  },
  en: {
    backToAppText: 'Back to App',
    adminBadgeText: 'Admin',
    adminTitle: 'Admin Panel',
    adminSubtitle: 'Manage Users and Settings',
    settingsTitle: '⚙️ General Settings',
    signupControlTitle: 'Signup Control',
    signupControlDesc: 'Enable invite code system for registration',
    leaderboardTitle: 'Leaderboard',
    leaderboardDesc: 'Show or hide leaderboard for students',
    statsTitle: '📊 Statistics',
    labelTotalUsers: 'Total Users',
    labelActiveUsers: 'Active (7 days)',
    labelTotalPages: 'Pages Memorized',
    labelCompletedJuz: 'Juz Completed',
    usersTitle: '👥 User Management',
    thName: 'Name',
    thEmail: 'Email',
    thRole: 'Role',
    thJoined: 'Joined',
    thActions: 'Actions',
    loadingText: 'Loading...',
    inviteCodesTitle: '🎟️ Invite Codes',
    btnCreateInvite: '+ Create New Code',
    loadingInvites: 'Loading...',
    modalTitle: 'Create New Invite Code',
    labelMaxUses: 'Max Uses:',
    labelExpires: 'Expires (optional):',
    labelDescription: 'Description (optional):',
    btnCreate: 'Create',
    btnCancel: 'Cancel',
    userDetailsTitle: 'User Details',
    roleUser: 'User',
    roleAdmin: 'Admin',
    btnView: 'View',
    btnDelete: 'Delete',
    btnPromote: 'Promote',
    btnDemote: 'Demote',
    btnCopy: 'Copy',
    btnDeactivate: 'Deactivate',
    statusActive: 'Active',
    statusInactive: 'Inactive',
    confirmDelete: 'Are you sure you want to delete this user? All their data will be removed.',
    confirmPromote: 'Do you want to promote this user to admin?',
    confirmDemote: 'Do you want to demote this user to regular user?',
    confirmDeactivate: 'Do you want to deactivate this code?',
    successCopied: 'Code copied!',
    errorLoad: 'Error loading data',
  },
};

// State
let currentLanguage = storage.getLanguage() || 'ar';
let currentPage = 1;
let searchQuery = '';
let allUsers = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is admin
  if (!auth.requireAuth()) return;

  const user = await auth.getCurrentUser();
  if (!user || user.user.role !== 'admin') {
    alert('Access denied. Admin only.');
    window.location.href = '/app.html';
    return;
  }

  applyLanguage();
  await loadDashboard();
});

// Language
function toggleLanguage() {
  currentLanguage = currentLanguage === 'ar' ? 'en' : 'ar';
  storage.setLanguage(currentLanguage);
  applyLanguage();
}

function applyLanguage() {
  const t = translations[currentLanguage];
  const isArabic = currentLanguage === 'ar';

  // Update direction
  document.documentElement.setAttribute('lang', currentLanguage);
  document.documentElement.setAttribute('dir', isArabic ? 'rtl' : 'ltr');

  // Update language button
  document.getElementById('langBtn').textContent = isArabic ? 'English' : 'العربية';

  // Update all text elements
  Object.keys(t).forEach((key) => {
    const element = document.getElementById(key);
    if (element) {
      element.textContent = t[key];
    }
  });
}

// Load Dashboard
async function loadDashboard() {
  try {
    await Promise.all([
      loadSettings(),
      loadStats(),
      loadUsers(),
      loadInviteCodes(),
    ]);
  } catch (error) {
    console.error('Error loading dashboard:', error);
    const t = translations[currentLanguage];
    alert(t.errorLoad);
  }
}

// Settings
async function loadSettings() {
  try {
    const response = await api.get('/admin/settings');
    if (response.success) {
      document.getElementById('toggleSignupControl').checked = response.settings.requireInviteCode;
      document.getElementById('toggleLeaderboard').checked = response.settings.leaderboardEnabled;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function updateSettings() {
  try {
    const requireInviteCode = document.getElementById('toggleSignupControl').checked;
    const leaderboardEnabled = document.getElementById('toggleLeaderboard').checked;

    await api.patch('/admin/settings', {
      requireInviteCode,
      leaderboardEnabled,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    alert('Failed to update settings');
  }
}

// Stats
async function loadStats() {
  try {
    const response = await api.get('/admin/stats');
    if (response.success) {
      const stats = response.stats;
      document.getElementById('totalUsers').textContent = stats.totalUsers;
      document.getElementById('activeUsers').textContent = stats.activeUsers;
      document.getElementById('totalPages').textContent = stats.totalPagesMemorized;
      document.getElementById('completedJuz').textContent = stats.completedJuz;
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Users
async function loadUsers(page = 1) {
  try {
    const response = await api.get(`/admin/users?page=${page}&limit=20&search=${searchQuery}`);
    if (response.success) {
      allUsers = response.users;
      renderUsers(response.users);
      renderPagination(response.pagination);
    }
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

function renderUsers(users) {
  const tbody = document.getElementById('usersTableBody');
  const t = translations[currentLanguage];

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading">${t.loadingText}</td></tr>`;
    return;
  }

  tbody.innerHTML = users
    .map((user) => {
      const roleClass = user.role === 'admin' ? 'admin' : 'user';
      const roleText = user.role === 'admin' ? t.roleAdmin : t.roleUser;
      const joinedDate = new Date(user.createdAt).toLocaleDateString(currentLanguage === 'ar' ? 'ar-SA' : 'en-US');

      return `
        <tr>
          <td>${user.name}</td>
          <td>${user.email}</td>
          <td><span class="role-badge ${roleClass}">${roleText}</span></td>
          <td>${joinedDate}</td>
          <td>
            <div class="action-buttons">
              <button class="action-btn view" onclick="viewUser('${user.id}')">${t.btnView}</button>
              ${user.role === 'user' ? `<button class="action-btn promote" onclick="toggleUserRole('${user.id}', 'admin')">${t.btnPromote}</button>` : ''}
              ${user.role === 'admin' ? `<button class="action-btn promote" onclick="toggleUserRole('${user.id}', 'user')">${t.btnDemote}</button>` : ''}
              <button class="action-btn delete" onclick="deleteUser('${user.id}')">${t.btnDelete}</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function renderPagination(pagination) {
  const container = document.getElementById('usersPagination');
  const t = translations[currentLanguage];

  if (pagination.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <button onclick="loadUsers(${pagination.currentPage - 1})" ${pagination.currentPage === 1 ? 'disabled' : ''}>
      ${currentLanguage === 'ar' ? '→' : '←'}
    </button>
    <span class="page-info">${pagination.currentPage} / ${pagination.totalPages}</span>
    <button onclick="loadUsers(${pagination.currentPage + 1})" ${!pagination.hasMore ? 'disabled' : ''}>
      ${currentLanguage === 'ar' ? '←' : '→'}
    </button>
  `;
}

function searchUsers() {
  searchQuery = document.getElementById('userSearch').value;
  loadUsers(1);
}

async function viewUser(userId) {
  try {
    const response = await api.get(`/admin/users/${userId}`);
    if (response.success) {
      showUserDetailsModal(response.user, response.stats);
    }
  } catch (error) {
    console.error('Error loading user details:', error);
  }
}

function showUserDetailsModal(user, stats) {
  const modal = document.getElementById('userDetailsModal');
  const content = document.getElementById('userDetailsContent');
  const t = translations[currentLanguage];

  content.innerHTML = `
    <div class="user-detail-section">
      <h3>${t.thName}</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <div class="detail-label">${t.thName}</div>
          <div class="detail-value">${user.name}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">${t.thEmail}</div>
          <div class="detail-value">${user.email}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">${t.thRole}</div>
          <div class="detail-value">${user.role === 'admin' ? t.roleAdmin : t.roleUser}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">${t.thJoined}</div>
          <div class="detail-value">${new Date(user.createdAt).toLocaleDateString()}</div>
        </div>
      </div>
    </div>
    <div class="user-detail-section">
      <h3>${t.statsTitle}</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <div class="detail-label">${t.labelTotalPages}</div>
          <div class="detail-value">${stats.totalPages}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">${t.labelCompletedJuz}</div>
          <div class="detail-value">${stats.completedJuz}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">${t.thJoined}</div>
          <div class="detail-value">${stats.totalLogs}</div>
        </div>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
}

function closeUserDetailsModal() {
  document.getElementById('userDetailsModal').style.display = 'none';
}

async function toggleUserRole(userId, newRole) {
  const t = translations[currentLanguage];
  const confirmMsg = newRole === 'admin' ? t.confirmPromote : t.confirmDemote;

  if (!confirm(confirmMsg)) return;

  try {
    await api.patch(`/admin/users/${userId}/role`, { role: newRole });
    await loadUsers(currentPage);
  } catch (error) {
    console.error('Error updating user role:', error);
    alert('Failed to update role');
  }
}

async function deleteUser(userId) {
  const t = translations[currentLanguage];

  if (!confirm(t.confirmDelete)) return;

  try {
    await api.delete(`/admin/users/${userId}`);
    await loadUsers(currentPage);
    await loadStats(); // Refresh stats
  } catch (error) {
    console.error('Error deleting user:', error);
    alert('Failed to delete user');
  }
}

// Invite Codes
async function loadInviteCodes() {
  try {
    const response = await api.get('/admin/invite-codes');
    if (response.success) {
      renderInviteCodes(response.inviteCodes);
    }
  } catch (error) {
    console.error('Error loading invite codes:', error);
  }
}

function renderInviteCodes(codes) {
  const grid = document.getElementById('inviteCodesGrid');
  const t = translations[currentLanguage];

  if (codes.length === 0) {
    grid.innerHTML = `<p class="loading">${t.loadingInvites}</p>`;
    return;
  }

  grid.innerHTML = codes
    .map((code) => {
      const statusClass = code.isActive ? 'active' : 'inactive';
      const statusText = code.isActive ? t.statusActive : t.statusInactive;
      const cardClass = code.isActive ? '' : 'inactive';

      return `
        <div class="invite-code-card ${cardClass}">
          <div class="code-header">
            <div class="code-value">${code.code}</div>
            <span class="code-status ${statusClass}">${statusText}</span>
          </div>
          <div class="code-info">
            <p>${t.labelMaxUses} ${code.usedCount} / ${code.maxUses}</p>
            ${code.description ? `<p>${code.description}</p>` : ''}
            ${code.expiresAt ? `<p>${t.labelExpires} ${new Date(code.expiresAt).toLocaleDateString()}</p>` : ''}
          </div>
          <div class="code-actions">
            <button class="copy-btn" onclick="copyCode('${code.code}')">${t.btnCopy}</button>
            ${code.isActive ? `<button class="deactivate-btn" onclick="deactivateCode('${code._id}')">${t.btnDeactivate}</button>` : ''}
          </div>
        </div>
      `;
    })
    .join('');
}

function showCreateInviteModal() {
  document.getElementById('createInviteModal').style.display = 'flex';
}

function closeCreateInviteModal() {
  document.getElementById('createInviteModal').style.display = 'none';
  document.getElementById('inviteMaxUses').value = '1';
  document.getElementById('inviteExpires').value = '';
  document.getElementById('inviteDescription').value = '';
}

async function createInviteCode() {
  try {
    const maxUses = parseInt(document.getElementById('inviteMaxUses').value);
    const expires = document.getElementById('inviteExpires').value;
    const description = document.getElementById('inviteDescription').value;

    const data = { maxUses };
    if (expires) data.expiresAt = expires;
    if (description) data.description = description;

    await api.post('/admin/invite-codes', data);
    closeCreateInviteModal();
    await loadInviteCodes();
  } catch (error) {
    console.error('Error creating invite code:', error);
    alert('Failed to create invite code');
  }
}

async function deactivateCode(codeId) {
  const t = translations[currentLanguage];

  if (!confirm(t.confirmDeactivate)) return;

  try {
    await api.patch(`/admin/invite-codes/${codeId}/deactivate`);
    await loadInviteCodes();
  } catch (error) {
    console.error('Error deactivating code:', error);
    alert('Failed to deactivate code');
  }
}

function copyCode(code) {
  navigator.clipboard.writeText(code);
  const t = translations[currentLanguage];
  alert(t.successCopied);
}
