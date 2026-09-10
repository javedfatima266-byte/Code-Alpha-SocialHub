// ==========================================================================
// SocialHub - Posts Module (Rendering, Editing, Deleting, Sharing)
// ==========================================================================

function formatPostContent(text) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  return escaped
    .replace(/(^|\s)#([a-zA-Z0-9_]+)/g, '$1<a href="/explore.html?q=$2" class="post-tag-link" style="color:var(--primary); font-weight:600;">#$2</a>')
    .replace(/(^|\s)@([a-zA-Z0-9_]+)/g, '$1<a href="/profile.html?username=$2" class="post-tag-link" style="color:var(--primary); font-weight:600;">@$2</a>');
}

function createPostCardHtml(post) {
  if (!post) return '';
  const user = getCurrentUser();
  const author = post.author || {};
  const isOwner = Boolean(post.is_owner || (user && author.id && user.id === author.id));
  const avatarUrl = author.profile_image || `https://api.dicebear.com/7.x/bottts/svg?seed=${author.username || 'user'}`;

  return `
    <article class="post-card" id="post-${post.id}" data-post-id="${post.id}">
      <header class="post-header">
        <a href="/profile.html?username=${encodeURIComponent(author.username || '')}" class="post-author-link">
          <img src="${avatarUrl}" alt="${escapeHtml(author.name || author.username || 'User')}" class="post-avatar" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=user'">
          <div class="post-author-meta">
            <span class="post-author-name">${escapeHtml(author.name || author.username || 'User')}</span>
            <span class="post-author-handle">@${escapeHtml(author.username || 'user')} <span class="post-time-dot">·</span> <span class="post-time">${timeAgo(post.created_at)}</span></span>
          </div>
        </a>

        ${isOwner ? `
          <div class="post-menu-wrap">
            <button class="post-menu-btn" data-post-id="${post.id}" aria-label="Post actions" title="Post options">•••</button>
            <div class="post-dropdown-menu" id="post-dropdown-${post.id}">
              <button type="button" class="post-dropdown-item edit-post-btn" data-post-id="${post.id}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                <span>Edit Post</span>
              </button>
              <button type="button" class="post-dropdown-item danger delete-post-btn" data-post-id="${post.id}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                <span>Delete</span>
              </button>
            </div>
          </div>
        ` : ''}
      </header>

      <div class="post-body" id="post-content-${post.id}">${formatPostContent(post.content)}</div>

      ${post.image_url ? `
        <div class="post-media-box">
          <img src="${escapeHtml(post.image_url)}" alt="Post image" class="post-media-image" loading="lazy" onerror="this.parentElement.style.display='none'">
        </div>
      ` : ''}

      <div class="post-stats-row">
        <span><strong id="post-stat-likes-${post.id}">${post.like_count || 0}</strong> likes</span>
        <span>·</span>
        <span><strong id="post-stat-comments-${post.id}">${post.comment_count || 0}</strong> comments</span>
      </div>

      <div class="post-actions-row">
        <button class="post-action-btn like-btn ${post.is_liked ? 'liked' : ''}" data-post-id="${post.id}" data-liked="${post.is_liked ? 'true' : 'false'}" aria-label="${post.is_liked ? 'Unlike post' : 'Like post'}">
          <svg class="heart-svg" width="18" height="18" viewBox="0 0 24 24" fill="${post.is_liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          <span class="like-label">${post.is_liked ? 'Liked' : 'Like'}</span>
        </button>

        <button class="post-action-btn comment-btn comment-toggle-btn" data-post-id="${post.id}" aria-label="Toggle comments">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>Comment</span>
        </button>

        <button class="post-action-btn share-btn share-post-btn" data-post-id="${post.id}" aria-label="Share post">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
          <span>Share</span>
        </button>
      </div>

      <!-- Nested Comments Section -->
      <section class="comments-section" id="comments-container-${post.id}" style="display: none;">
        <div class="comment-composer-wrap">
          <img src="${user?.profile_image || (user ? `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}` : 'https://api.dicebear.com/7.x/bottts/svg?seed=guest')}" class="comment-user-avatar current-user-avatar" alt="You">
          <form class="comment-form" data-post-id="${post.id}">
            <input type="text" class="comment-input-field" placeholder="Write a comment..." required>
            <button type="submit" class="comment-submit-btn">Post</button>
          </form>
        </div>

        <div class="comments-list" id="comments-list-${post.id}">
          <div class="center-spinner" style="padding: 1rem;"><div class="loading-spinner"></div></div>
        </div>
      </section>
    </article>
  `;
}

// Generate loading skeletons
function renderSkeletonPostsHtml(count = 3) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton-card">
        <div style="display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1rem;">
          <div class="skeleton-box" style="width: 44px; height: 44px; border-radius: 50%;"></div>
          <div style="flex: 1;">
            <div class="skeleton-box" style="width: 130px; height: 14px; margin-bottom: 6px;"></div>
            <div class="skeleton-box" style="width: 80px; height: 10px;"></div>
          </div>
        </div>
        <div class="skeleton-box" style="width: 100%; height: 16px; margin-bottom: 8px;"></div>
        <div class="skeleton-box" style="width: 85%; height: 16px; margin-bottom: 8px;"></div>
        <div class="skeleton-box" style="width: 50%; height: 16px; margin-bottom: 1rem;"></div>
        <div style="display: flex; gap: 1rem; border-top: 1px solid var(--border); padding-top: 0.75rem;">
          <div class="skeleton-box" style="width: 70px; height: 26px;"></div>
          <div class="skeleton-box" style="width: 80px; height: 26px;"></div>
        </div>
      </div>
    `;
  }
  return html;
}

// Bind all interactive events on post cards
function bindPostCardEvents(container = document) {
  // Toggle post options dropdown menu
  container.querySelectorAll('.post-menu-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const postId = btn.getAttribute('data-post-id');
      const menu = document.getElementById(`post-dropdown-${postId}`);
      if (menu) {
        const isOpen = menu.classList.contains('open');
        document.querySelectorAll('.post-dropdown-menu.open').forEach(m => m.classList.remove('open'));
        if (!isOpen) menu.classList.add('open');
      }
    };
  });

  // Delete post buttons
  container.querySelectorAll('.delete-post-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const postId = btn.getAttribute('data-post-id');
      if (!confirm('Are you sure you want to delete this post?')) return;

      try {
        const res = await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
        if (res.ok && res.data.success) {
          showToast('Post deleted', 'success');
          const postElement = document.getElementById(`post-${postId}`);
          if (postElement) {
            postElement.style.opacity = '0';
            postElement.style.transform = 'scale(0.97)';
            setTimeout(() => postElement.remove(), 200);
          }
        } else {
          showToast(res.data.message || 'Failed to delete post', 'error');
        }
      } catch (err) {
        showToast('Error deleting post', 'error');
      }
    };
  });

  // Edit post buttons
  container.querySelectorAll('.edit-post-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      document.querySelectorAll('.post-dropdown-menu.open').forEach(m => m.classList.remove('open'));
      const postId = btn.getAttribute('data-post-id');
      openEditPostModal(postId);
    };
  });

  // Share post button
  container.querySelectorAll('.share-post-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const postId = btn.getAttribute('data-post-id');
      const shareUrl = `${window.location.origin}/index.html#post-${postId}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(() => {
          showToast('Post link copied to clipboard!', 'success');
        }).catch(() => {
          showToast('Link: ' + shareUrl, 'info');
        });
      } else {
        showToast('Link: ' + shareUrl, 'info');
      }
    };
  });

  // Like buttons
  if (typeof bindLikeButtons === 'function') {
    bindLikeButtons(container);
  }

  // Comment actions
  if (typeof bindCommentActions === 'function') {
    bindCommentActions(container);
  }
}

// Close dropdowns on outside click
document.addEventListener('click', () => {
  document.querySelectorAll('.post-dropdown-menu.open').forEach(m => m.classList.remove('open'));
});

// Open Edit Post Modal
async function openEditPostModal(postId) {
  let modal = document.getElementById('edit-post-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'edit-post-modal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Edit Post</h2>
          <button class="modal-close-btn" id="close-edit-modal">&times;</button>
        </div>
        <form id="edit-post-form">
          <input type="hidden" id="edit-post-id">
          <div class="form-field-group" style="margin-bottom: 1.25rem;">
            <label class="form-field-label" for="edit-post-content">Post Content</label>
            <textarea id="edit-post-content" class="form-field-input" rows="4" required style="resize: vertical; line-height: 1.5;"></textarea>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button type="button" class="btn btn-outline" id="cancel-edit-post">Cancel</button>
            <button type="submit" class="btn btn-primary" id="save-edit-post">Save Changes</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('close-edit-modal').onclick = () => modal.classList.remove('open');
    document.getElementById('cancel-edit-post').onclick = () => modal.classList.remove('open');

    document.getElementById('edit-post-form').onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-post-id').value;
      const content = document.getElementById('edit-post-content').value.trim();
      const saveBtn = document.getElementById('save-edit-post');

      if (!content) return;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        const res = await apiFetch(`/api/posts/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ content })
        });

        if (res.ok && res.data.success) {
          showToast('Post updated successfully', 'success');
          modal.classList.remove('open');
          const contentEl = document.getElementById(`post-content-${id}`);
          if (contentEl) contentEl.innerHTML = formatPostContent(content);
        } else {
          showToast(res.data.message || 'Failed to update post', 'error');
        }
      } catch (err) {
        showToast('Error updating post', 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
    };
  }

  // Pre-fill content
  const contentEl = document.getElementById(`post-content-${postId}`);
  document.getElementById('edit-post-id').value = postId;
  document.getElementById('edit-post-content').value = contentEl ? contentEl.innerText : '';

  modal.classList.add('open');
}
