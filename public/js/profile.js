// ==========================================================================
// SocialHub - Profile Module (Rich Header, Cover, Tabs, Metrics & Edit)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  initProfile();
});

async function initProfile() {
  const urlParams = new URLSearchParams(window.location.search);
  let targetUsername = urlParams.get('username');

  const currentUser = getCurrentUser();

  // If no username provided, default to currently logged-in user
  if (!targetUsername) {
    if (currentUser && currentUser.username) {
      targetUsername = currentUser.username;
    } else {
      window.location.href = '/login.html';
      return;
    }
  }

  await loadUserProfile(targetUsername);
}

// Load and render user profile data
async function loadUserProfile(username) {
  const profileContainer = document.getElementById('profile-content-area');
  const postsContainer = document.getElementById('user-posts-stream');
  if (!profileContainer) return;

  profileContainer.innerHTML = '<div class="center-spinner"><div class="loading-spinner"></div></div>';

  try {
    const res = await apiFetch(`/api/users/${encodeURIComponent(username)}`);

    if (!res.ok || !res.data.success) {
      profileContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted);"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <h3 class="empty-state-title">User Not Found</h3>
          <p class="empty-state-desc">${escapeHtml(res.data.message || 'The user you are looking for does not exist.')}</p>
          <a href="/index.html" class="btn btn-primary btn-sm" style="margin-top: 1rem;">Back to Feed</a>
        </div>
      `;
      return;
    }

    const user = res.data.data;
    const currentUser = getCurrentUser();
    const isMe = user.is_me || (currentUser && currentUser.id === user.id);
    const avatarUrl = user.profile_image || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`;

    profileContainer.innerHTML = `
      <div class="profile-view-wrap">
        <div class="profile-cover-area"></div>
        <div class="profile-header-card">
          <div class="profile-avatar-row">
            <img src="${avatarUrl}" alt="${escapeHtml(user.name)}" class="profile-avatar-large" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=user'">
            <div class="profile-action-btn-wrap">
              ${isMe ? `
                <button id="open-edit-profile-btn" class="btn btn-outline btn-sm">Edit Profile</button>
              ` : currentUser ? `
                <button class="btn btn-follow ${user.is_following ? 'following' : ''}" data-user-id="${user.id}" data-following="${user.is_following ? 'true' : 'false'}">
                  ${user.is_following ? 'Following' : 'Follow'}
                </button>
              ` : `
                <a href="/login.html" class="btn btn-primary btn-sm">Follow</a>
              `}
            </div>
          </div>

          <div class="profile-user-names">
            <h1 class="profile-full-name">${escapeHtml(user.name || user.username)}</h1>
            <div class="profile-user-handle">@${escapeHtml(user.username)}</div>
          </div>

          <p class="profile-bio-text">${escapeHtml(user.bio || 'Passionate developer & creator exploring the modern web.')}</p>

          <div class="profile-metrics-row">
            <div class="profile-metric-item">
              <strong>${user.posts_count || 0}</strong> Posts
            </div>
            <div class="profile-metric-item">
              <strong id="profile-followers-count" data-user-followers="${user.id}">${user.followers_count || 0}</strong> Followers
            </div>
            <div class="profile-metric-item">
              <strong>${user.following_count || 0}</strong> Following
            </div>
          </div>
        </div>

        <nav class="profile-tabs-nav">
          <div class="profile-tab-item active" id="profile-tab-posts">Posts</div>
          <div class="profile-tab-item" id="profile-tab-about">About</div>
        </nav>
      </div>
    `;

    // Handle profile tabs
    const tabPosts = document.getElementById('profile-tab-posts');
    const tabAbout = document.getElementById('profile-tab-about');
    const aboutSection = document.getElementById('user-about-section');

    if (tabPosts && tabAbout) {
      tabPosts.onclick = () => {
        tabPosts.classList.add('active');
        tabAbout.classList.remove('active');
        if (postsContainer) postsContainer.style.display = 'flex';
        if (aboutSection) aboutSection.style.display = 'none';
      };

      tabAbout.onclick = () => {
        tabAbout.classList.add('active');
        tabPosts.classList.remove('active');
        if (postsContainer) postsContainer.style.display = 'none';
        if (aboutSection) {
          aboutSection.style.display = 'block';
          aboutSection.innerHTML = `
            <div style="background-color: var(--surface); padding: 1.5rem; border-bottom: 1px solid var(--border);">
              <h3 style="font-size: 1.1rem; font-weight: 800; margin-bottom: 0.75rem;">Community Information</h3>
              <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 1rem;">
                Member of SocialHub since ${new Date(user.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
              </p>
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <span class="db-status-badge">Member ID #${user.id}</span>
                <span class="db-status-badge">Verified Human</span>
              </div>
            </div>
          `;
        }
      };
    }

    // Bind follow buttons
    if (!isMe && typeof bindFollowButtons === 'function') {
      bindFollowButtons(profileContainer);
    }

    // Bind Edit Profile Modal
    if (isMe) {
      const editBtn = document.getElementById('open-edit-profile-btn');
      if (editBtn) {
        editBtn.onclick = () => openEditProfileModal(user);
      }
    }

    // Load user's posts
    await loadUserPosts(user.username, postsContainer);
  } catch (err) {
    console.error('Error loading profile:', err);
    profileContainer.innerHTML = '<div class="empty-state"><p style="color: var(--danger);">Error loading user profile.</p></div>';
  }
}

// Load user's posts
async function loadUserPosts(username, container) {
  if (!container) return;

  container.innerHTML = typeof renderSkeletonPostsHtml === 'function'
    ? renderSkeletonPostsHtml(2)
    : '<div class="center-spinner"><div class="loading-spinner"></div></div>';

  try {
    const res = await apiFetch(`/api/posts?username=${encodeURIComponent(username)}`);
    if (res.ok && res.data.success) {
      const posts = res.data.data;
      if (posts.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted);"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            </div>
            <h3 class="empty-state-title">No posts yet</h3>
            <p class="empty-state-desc">This user has not published any posts yet.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = posts.map(p => createPostCardHtml(p)).join('');
      bindPostCardEvents(container);
    } else {
      container.innerHTML = '<div class="empty-state"><p style="color: var(--danger);">Failed to load user posts.</p></div>';
    }
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p style="color: var(--danger);">Network error loading posts.</p></div>';
  }
}

// Open Edit Profile Modal
function openEditProfileModal(user) {
  let modal = document.getElementById('edit-profile-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'edit-profile-modal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Edit Profile</h2>
          <button class="modal-close-btn" id="close-profile-modal" aria-label="Close modal">&times;</button>
        </div>
        <form id="edit-profile-form">
          <div class="form-field-group" style="margin-bottom: 1rem;">
            <label class="form-field-label" for="edit-profile-username">Username</label>
            <input type="text" id="edit-profile-username" class="form-field-input" disabled style="opacity: 0.6; cursor: not-allowed;">
          </div>
          <div class="form-field-group" style="margin-bottom: 1rem;">
            <label class="form-field-label" for="edit-profile-name">Full Name</label>
            <input type="text" id="edit-profile-name" class="form-field-input" required>
          </div>
          <div class="form-field-group" style="margin-bottom: 1rem;">
            <label class="form-field-label" for="edit-profile-bio">Bio</label>
            <textarea id="edit-profile-bio" class="form-field-input" rows="3" placeholder="Tell people about yourself..."></textarea>
          </div>
          <div class="form-field-group" style="margin-bottom: 1.25rem;">
            <label class="form-field-label" for="edit-profile-avatar">Profile Picture</label>
            <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
              <input type="file" id="edit-profile-avatar-file" accept="image/*" style="display: none;">
              <button type="button" id="edit-profile-upload-avatar-btn" class="btn btn-outline btn-sm" style="display: inline-flex; align-items: center; gap: 0.4rem;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <span>Upload from Device</span>
              </button>
              <span id="edit-avatar-filename" style="font-size: 0.8rem; color: var(--text-muted);"></span>
            </div>
            <input type="url" id="edit-profile-avatar" class="form-field-input" placeholder="Or paste direct image URL...">
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
            <button type="button" class="btn btn-outline" id="cancel-profile-edit-btn">Cancel</button>
            <button type="submit" class="btn btn-primary" id="save-profile-btn">Save Changes</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('close-profile-modal').onclick = () => modal.classList.remove('open');
    document.getElementById('cancel-profile-edit-btn').onclick = () => modal.classList.remove('open');
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open'); };

    // Avatar file upload handler inside modal
    const avatarFileInput = document.getElementById('edit-profile-avatar-file');
    const uploadAvatarBtn = document.getElementById('edit-profile-upload-avatar-btn');
    const avatarFilename = document.getElementById('edit-avatar-filename');
    let newAvatarBase64 = null;

    if (uploadAvatarBtn && avatarFileInput) {
      uploadAvatarBtn.onclick = () => avatarFileInput.click();
      avatarFileInput.onchange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
          if (!file.type.startsWith('image/')) {
            showToast('Please select an image file.', 'error');
            return;
          }
          if (file.size > 5 * 1024 * 1024) {
            showToast('Image must be smaller than 5 MB.', 'error');
            return;
          }
          const reader = new FileReader();
          reader.onload = (loadEvt) => {
            newAvatarBase64 = loadEvt.target.result;
            avatarFilename.textContent = `✓ ${file.name}`;
            document.getElementById('edit-profile-avatar').value = '';
          };
          reader.readAsDataURL(file);
        }
      };
    }

    document.getElementById('edit-profile-form').onsubmit = async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('save-profile-btn');
      const name = document.getElementById('edit-profile-name').value.trim();
      const bio = document.getElementById('edit-profile-bio').value.trim();
      let profile_image = document.getElementById('edit-profile-avatar').value.trim();

      const currentUser = getCurrentUser();
      if (!currentUser) return;

      if (!name) {
        showToast('Full name is required', 'error');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        // If an avatar file was uploaded from disk, process via /api/upload
        if (newAvatarBase64) {
          const upRes = await apiFetch('/api/upload', {
            method: 'POST',
            body: JSON.stringify({ data: newAvatarBase64, filename: 'avatar.png' })
          });
          if (upRes.ok && upRes.data.success) {
            profile_image = upRes.data.url;
          }
        }

        const res = await apiFetch(`/api/users/${currentUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name, bio, profile_image })
        });

        if (res.ok && res.data.success) {
          const updatedUser = res.data.data;
          setAuthSession(getAuthToken(), updatedUser);
          renderNavigation();
          showToast('Profile updated successfully!', 'success');
          modal.classList.remove('open');
          await loadUserProfile(updatedUser.username);
        } else {
          showToast(res.data.message || 'Failed to update profile', 'error');
        }
      } catch (err) {
        showToast('Error saving profile changes', 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
    };
  }

  // Populate form values
  const usernameInput = document.getElementById('edit-profile-username');
  if (usernameInput) usernameInput.value = `@${user.username}`;
  document.getElementById('edit-profile-name').value = user.name || '';
  document.getElementById('edit-profile-bio').value = user.bio || '';
  document.getElementById('edit-profile-avatar').value = user.profile_image || '';
  modal.classList.add('open');
  document.getElementById('edit-profile-name').focus();
}
