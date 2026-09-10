// ==========================================================================
// SocialHub - Client Authentication, Session & Theme System
// ==========================================================================

const TOKEN_KEY = 'socialhub_token';
const USER_KEY = 'socialhub_user';
const THEME_KEY = 'socialhub_theme';

// --------------------------------------------------------------------------
// Theme System (Light, Dark, Midnight, Ocean, Lavender, Forest & System)
// --------------------------------------------------------------------------
const THEMES_CONFIG = [
  { id: 'light', name: 'Light', desc: 'Clean daylight neutral', bg: '#f8fafc', primary: '#4f46e5' },
  { id: 'dark', name: 'Dark', desc: 'Obsidian & deep charcoal', bg: '#090d16', primary: '#6366f1' },
  { id: 'midnight', name: 'Midnight', desc: 'Deep navy sky & celestial cyan', bg: '#070d1d', primary: '#38bdf8' },
  { id: 'ocean', name: 'Ocean', desc: 'Abyssal deep sea & vibrant teal', bg: '#041417', primary: '#14b8a6' },
  { id: 'lavender', name: 'Lavender', desc: 'Royal plum & electric violet', bg: '#0f0919', primary: '#a855f7' },
  { id: 'forest', name: 'Forest', desc: 'Woodland pine & emerald foliage', bg: '#05140e', primary: '#10b981' }
];

function getSavedTheme() {
  return localStorage.getItem(THEME_KEY) || 'system';
}

function applyTheme(theme) {
  const root = document.documentElement;
  let effectiveTheme = theme;
  
  if (theme === 'system') {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    effectiveTheme = prefersDark ? 'dark' : 'light';
  }

  root.setAttribute('data-theme', effectiveTheme);

  // Update inline sidebar theme card options
  document.querySelectorAll('.theme-card-option').forEach(btn => {
    const mode = btn.getAttribute('data-theme-name');
    if (mode === theme || (theme === 'system' && mode === effectiveTheme)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update modal theme cards
  document.querySelectorAll('.theme-picker-card').forEach(card => {
    const mode = card.getAttribute('data-theme-id');
    if (mode === theme) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  // Update system toggle row
  const systemRow = document.getElementById('theme-system-toggle-btn');
  if (systemRow) {
    if (theme === 'system') {
      systemRow.classList.add('active');
    } else {
      systemRow.classList.remove('active');
    }
  }

  // Update any text labels
  document.querySelectorAll('.current-theme-label').forEach(el => {
    const cfg = THEMES_CONFIG.find(t => t.id === effectiveTheme);
    el.textContent = cfg ? cfg.name : effectiveTheme;
  });
}

function setThemeMode(mode) {
  localStorage.setItem(THEME_KEY, mode);
  applyTheme(mode);
  const cfg = THEMES_CONFIG.find(t => t.id === mode);
  const displayName = cfg ? cfg.name : (mode === 'system' ? 'Device preference' : mode);
  showToast(`Theme set to ${displayName}`, 'info');
}

function openThemePickerModal() {
  let modal = document.getElementById('theme-picker-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'theme-picker-modal';
    modal.className = 'theme-modal-backdrop';
    modal.innerHTML = `
      <div class="theme-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="theme-modal-title">
        <div class="theme-modal-header">
          <div>
            <h2 id="theme-modal-title" class="theme-modal-title">Appearance & Themes</h2>
            <p class="theme-modal-subtitle">Choose a visual theme tailored to your environment.</p>
          </div>
          <button type="button" class="theme-modal-close" id="theme-modal-close-btn" aria-label="Close dialog">&times;</button>
        </div>
        <div class="theme-modal-body">
          <div class="theme-modal-grid">
            ${THEMES_CONFIG.map(t => `
              <button type="button" class="theme-picker-card" data-theme-id="${t.id}" aria-label="Select ${t.name} theme">
                <div class="theme-swatch-circle theme-swatch-${t.id}">
                  <div class="theme-swatch-dot"></div>
                </div>
                <div class="theme-picker-card-info">
                  <span class="theme-picker-card-name">${t.name}</span>
                  <span class="theme-picker-card-desc">${t.desc}</span>
                </div>
                <div class="theme-picker-card-indicator">✓</div>
              </button>
            `).join('')}
          </div>

          <div class="theme-system-toggle-row" id="theme-system-toggle-row">
            <div>
              <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 0.45rem;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                <span>Match Device Theme</span>
              </div>
              <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 0.15rem;">Automatically synchronize with system dark/light mode</div>
            </div>
            <button type="button" id="theme-system-toggle-btn" class="btn btn-outline btn-sm">Use System</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('theme-modal-close-btn').onclick = closeThemePickerModal;
    modal.onclick = (e) => { if (e.target === modal) closeThemePickerModal(); };

    modal.querySelectorAll('.theme-picker-card').forEach(card => {
      card.onclick = () => {
        const themeId = card.getAttribute('data-theme-id');
        if (themeId) {
          setThemeMode(themeId);
          setTimeout(closeThemePickerModal, 180);
        }
      };
    });

    const systemBtn = document.getElementById('theme-system-toggle-btn');
    if (systemBtn) {
      systemBtn.onclick = () => {
        setThemeMode('system');
        setTimeout(closeThemePickerModal, 180);
      };
    }
  }

  // Update cards based on current state before showing
  const currentSaved = getSavedTheme();
  modal.querySelectorAll('.theme-picker-card').forEach(card => {
    card.classList.toggle('active', card.getAttribute('data-theme-id') === currentSaved);
  });
  const sysBtn = document.getElementById('theme-system-toggle-btn');
  if (sysBtn) {
    sysBtn.textContent = currentSaved === 'system' ? '✓ Active' : 'Use System';
  }

  modal.classList.add('open');
  document.querySelectorAll('#mobile-bottom-theme-btn, #mobile-top-theme-btn').forEach(btn => {
    btn.classList.add('active');
  });
}

function closeThemePickerModal() {
  const modal = document.getElementById('theme-picker-modal');
  if (modal) {
    modal.classList.remove('open');
  }
  document.querySelectorAll('#mobile-bottom-theme-btn, #mobile-top-theme-btn').forEach(btn => {
    btn.classList.remove('active');
  });
}

// Global listeners for theme picker accessibility and cross-tab sync
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeThemePickerModal();
  }
});

window.addEventListener('storage', (e) => {
  if (e.key === THEME_KEY) {
    applyTheme(e.newValue || 'system');
  }
});

// Universal delegated click listener for any theme trigger element
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.theme-toggle-action, .theme-picker-open-btn, .theme-picker-trigger, #mobile-bottom-theme-btn, #mobile-top-theme-btn');
  if (btn) {
    e.preventDefault();
    openThemePickerModal();
  }
});

function initTheme() {
  const saved = getSavedTheme();
  applyTheme(saved);

  // Listen to system preference changes if in system mode
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getSavedTheme() === 'system') {
        applyTheme('system');
      }
    });
  }

  // Bind inline sidebar theme cards
  document.querySelectorAll('.theme-card-option').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const mode = btn.getAttribute('data-theme-name');
      if (mode) setThemeMode(mode);
    };
  });
}

// --------------------------------------------------------------------------
// Universal Image Lightbox System
// --------------------------------------------------------------------------
function initLightbox() {
  let lightbox = document.getElementById('lightbox-modal');
  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.id = 'lightbox-modal';
    lightbox.className = 'lightbox-modal';
    lightbox.innerHTML = `
      <button class="lightbox-close-btn" id="lightbox-close-btn" aria-label="Close image">&times;</button>
      <img src="" alt="Expanded media" class="lightbox-img" id="lightbox-img">
    `;
    document.body.appendChild(lightbox);

    const closeBtn = document.getElementById('lightbox-close-btn');
    if (closeBtn) {
      closeBtn.onclick = () => lightbox.classList.remove('open');
    }

    lightbox.onclick = (e) => {
      if (e.target === lightbox || e.target === closeBtn) {
        lightbox.classList.remove('open');
      }
    };

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightbox.classList.contains('open')) {
        lightbox.classList.remove('open');
      }
    });
  }

  // Delegate click on any post media image
  document.addEventListener('click', (e) => {
    const img = e.target.closest('.post-media-image');
    if (img && img.src) {
      const modalImg = document.getElementById('lightbox-img');
      if (modalImg) modalImg.src = img.src;
      lightbox.classList.add('open');
    }
  });
}

// --------------------------------------------------------------------------
// Session Management
// --------------------------------------------------------------------------
function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setAuthSession(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function isAuthenticated() {
  return !!getAuthToken() && !!getCurrentUser();
}

function requireAuthOrRedirect(redirectUrl = '/login.html') {
  if (!isAuthenticated()) {
    window.location.href = `${redirectUrl}?returnUrl=${encodeURIComponent(window.location.pathname)}`;
    return false;
  }
  return true;
}

// --------------------------------------------------------------------------
// API Fetch Wrapper
// --------------------------------------------------------------------------
async function apiFetch(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = { success: response.ok, message: await response.text() };
    }

    if (response.status === 401 && !endpoint.includes('/api/auth/login')) {
      clearAuthSession();
      renderNavigation();
    }

    return {
      ok: response.ok,
      status: response.status,
      data
    };
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    return {
      ok: false,
      status: 0,
      data: { success: false, message: 'Network connection failed' }
    };
  }
}

// --------------------------------------------------------------------------
// Toast Notification Engine
// --------------------------------------------------------------------------
function showToast(message, type = 'info', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// --------------------------------------------------------------------------
// Text Utilities
// --------------------------------------------------------------------------
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function timeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (minutes < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

// --------------------------------------------------------------------------
// Logout Handler
// --------------------------------------------------------------------------
async function handleLogout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {
    console.error('Logout error:', e);
  }
  clearAuthSession();
  showToast('Signed out', 'success');
  setTimeout(() => {
    window.location.href = '/login.html';
  }, 400);
}

// --------------------------------------------------------------------------
// Dynamic Navigation Renderer for Desktop Sidebar & Mobile Bottom Nav
// --------------------------------------------------------------------------
function renderNavigation() {
  const user = getCurrentUser();
  const path = window.location.pathname;

  const isHome = path === '/' || path.endsWith('index.html');
  const isExplore = path.includes('explore');
  const isProfile = path.includes('profile') && !window.location.search;

  // Render Desktop Left Sidebar Navigation Links
  const sidebarNav = document.getElementById('sidebar-nav');
  if (sidebarNav) {
    sidebarNav.innerHTML = `
      <li class="sidebar-nav-item">
        <a href="/index.html" class="${isHome ? 'active' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>Home</span>
        </a>
      </li>
      <li class="sidebar-nav-item">
        <a href="/explore.html" class="${isExplore ? 'active' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
          </svg>
          <span>Explore</span>
        </a>
      </li>
      <li class="sidebar-nav-item">
        <a href="${user ? '/profile.html' : '/login.html'}" class="${isProfile ? 'active' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span>Profile</span>
        </a>
      </li>
    `;
  }

  // Render Sidebar User Pill or Login Prompt
  const userPill = document.getElementById('sidebar-user-pill');
  if (userPill) {
    if (user) {
      const avatarUrl = user.profile_image || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`;
      userPill.innerHTML = `
        <div class="sidebar-user-card">
          <a href="/profile.html" class="sidebar-user-link">
            <img src="${avatarUrl}" alt="${escapeHtml(user.name)}" class="sidebar-user-avatar" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=user'">
            <div class="sidebar-user-meta">
              <div class="sidebar-user-name">${escapeHtml(user.name || user.username)}</div>
              <div class="sidebar-user-handle">@${escapeHtml(user.username)}</div>
            </div>
          </a>
          <button id="logout-btn" class="sidebar-logout-btn" title="Sign out">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      `;
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) logoutBtn.onclick = handleLogout;
    } else {
      userPill.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <a href="/login.html" class="btn btn-primary btn-block btn-sm">Log In</a>
          <a href="/register.html" class="btn btn-outline btn-block btn-sm">Create Account</a>
        </div>
      `;
    }
  }

  // Render Mobile Bottom Navigation Bar
  const mobileBottomNav = document.getElementById('mobile-bottom-nav');
  if (mobileBottomNav) {
    mobileBottomNav.innerHTML = `
      <a href="/index.html" class="mobile-nav-link ${isHome ? 'active' : ''}" aria-label="Home" title="Home">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        <span>Home</span>
      </a>
      <a href="/explore.html" class="mobile-nav-link ${isExplore ? 'active' : ''}" aria-label="Explore" title="Explore">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
        </svg>
        <span>Explore</span>
      </a>
      <button type="button" class="mobile-nav-create-btn" id="mobile-create-post-btn" aria-label="Create Post" title="Create Post">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      <a href="${user ? '/profile.html' : '/login.html'}" class="mobile-nav-link ${isProfile ? 'active' : ''}" aria-label="Profile" title="Profile">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span>Profile</span>
      </a>
      <button type="button" class="mobile-nav-link theme-toggle-action" id="mobile-bottom-theme-btn" aria-label="Appearance & Themes" title="Theme">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="13.5" cy="6.5" r="1" fill="currentColor"></circle>
          <circle cx="17.5" cy="10.5" r="1" fill="currentColor"></circle>
          <circle cx="8.5" cy="7.5" r="1" fill="currentColor"></circle>
          <circle cx="6.5" cy="12.5" r="1" fill="currentColor"></circle>
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C22 6.5 17.5 2 12 2z"></path>
        </svg>
        <span>Theme</span>
      </button>
    `;

    const createBtn = document.getElementById('mobile-create-post-btn');
    if (createBtn) {
      createBtn.onclick = (e) => {
        e.preventDefault();
        if (!user) {
          window.location.href = '/login.html';
          return;
        }
        if (window.location.pathname === '/' || window.location.pathname.endsWith('index.html')) {
          const textarea = document.getElementById('composer-textarea');
          if (textarea) {
            textarea.focus();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        } else {
          window.location.href = '/index.html?focus=composer';
        }
      };
    }

    const bottomThemeBtn = document.getElementById('mobile-bottom-theme-btn');
    if (bottomThemeBtn) {
      bottomThemeBtn.onclick = (e) => {
        e.preventDefault();
        openThemePickerModal();
      };
    }
  }

  // Update mobile top header controls
  document.querySelectorAll('#mobile-top-account-btn').forEach(btn => {
    if (user) {
      btn.href = '/profile.html';
      btn.setAttribute('aria-label', `Profile (@${user.username})`);
      btn.setAttribute('title', `Profile (@${user.username})`);
      const avatarUrl = user.profile_image || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`;
      btn.innerHTML = `
        <img src="${avatarUrl}" alt="${user.username}" class="mobile-header-avatar current-user-avatar">
      `;
    } else {
      btn.href = '/login.html';
      btn.setAttribute('aria-label', 'Log In to SocialHub');
      btn.setAttribute('title', 'Log In');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      `;
    }
  });

  const topThemeBtn = document.getElementById('mobile-top-theme-btn');
  if (topThemeBtn) {
    topThemeBtn.onclick = (e) => {
      e.preventDefault();
      openThemePickerModal();
    };
  }

  // Update header avatars if present
  if (user) {
    const avatarUrl = user.profile_image || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`;
    document.querySelectorAll('.current-user-avatar').forEach(img => {
      img.src = avatarUrl;
    });
  }
}

// --------------------------------------------------------------------------
// Initialization
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  renderNavigation();
  initLightbox();

  // Validate and refresh session silently if token exists
  const token = getAuthToken();
  if (token) {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok && res.data.success) {
        setAuthSession(token, res.data.data.user);
        renderNavigation();
      }
    } catch (e) {
      console.warn('Session refresh check failed:', e);
    }
  }
});
