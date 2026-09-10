// ==========================================================================
// SocialHub - Feed & Post Composer System
// ==========================================================================

let currentFilter = 'all'; // 'all' | 'following'
let selectedImageFile = null;
let selectedImageDataUri = null;

// Initialize Feed & Composer on page load
document.addEventListener('DOMContentLoaded', () => {
  initPostComposer();
  initFeedFilters();
  loadFeed();
  loadSuggestedPeople();

  // Focus composer if URL has ?focus=composer
  if (window.location.search.includes('focus=composer')) {
    const textarea = document.getElementById('composer-textarea');
    if (textarea) {
      setTimeout(() => {
        textarea.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 300);
    }
  }
});

// --------------------------------------------------------------------------
// Post Composer (Modern File Picker & Instant Preview UX)
// --------------------------------------------------------------------------
function initPostComposer() {
  const form = document.getElementById('create-post-form');
  const textarea = document.getElementById('composer-textarea');
  const fileInput = document.getElementById('post-image-file');
  const addPhotoBtn = document.getElementById('composer-add-photo-btn');
  const previewWrap = document.getElementById('composer-image-preview-wrap');
  const previewImg = document.getElementById('composer-preview-img');
  const previewFilename = document.getElementById('composer-preview-filename');
  const removeImgBtn = document.getElementById('composer-remove-img-btn');
  const replaceImgBtn = document.getElementById('composer-replace-img-btn');
  const submitBtn = document.getElementById('composer-submit-btn');
  const charCountEl = document.getElementById('composer-char-count');
  const composerAvatar = document.getElementById('composer-user-avatar');

  const user = getCurrentUser();

  // Update composer avatar if logged in
  if (user && composerAvatar) {
    composerAvatar.src = user.profile_image || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`;
  }

  function updateSubmitButtonState() {
    if (!submitBtn || !textarea) return;
    const hasText = textarea.value.trim().length > 0;
    const hasImage = !!selectedImageFile;
    submitBtn.disabled = !hasText && !hasImage;
  }

  // Textarea auto-resize & character count
  if (textarea) {
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(85, textarea.scrollHeight)}px`;

      const len = textarea.value.length;
      if (charCountEl) {
        charCountEl.textContent = `${len} / 500`;
        charCountEl.classList.toggle('warning', len > 400 && len <= 500);
        charCountEl.classList.toggle('danger', len > 500);
      }
      updateSubmitButtonState();
    });

    // Enter key hint: Ctrl/Cmd + Enter to submit
    textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (!submitBtn.disabled) {
          form?.requestSubmit();
        }
      }
    });
  }

  // Trigger file selection on clicking "Add Photo"
  if (addPhotoBtn && fileInput) {
    addPhotoBtn.onclick = (e) => {
      e.preventDefault();
      fileInput.click();
    };
  }

  // Replace photo button
  if (replaceImgBtn && fileInput) {
    replaceImgBtn.onclick = (e) => {
      e.preventDefault();
      fileInput.click();
    };
  }

  // Remove photo button
  if (removeImgBtn) {
    removeImgBtn.onclick = (e) => {
      e.preventDefault();
      clearSelectedImage();
    };
  }

  function clearSelectedImage() {
    selectedImageFile = null;
    selectedImageDataUri = null;
    if (fileInput) fileInput.value = '';
    if (previewWrap) previewWrap.style.display = 'none';
    if (previewImg) previewImg.src = '';
    if (previewFilename) previewFilename.textContent = '';
    updateSubmitButtonState();
  }

  // File input change handler (Gallery / Camera selection)
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        showToast('Please select an image file.', 'error');
        fileInput.value = '';
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be smaller than 5 MB.', 'error');
        fileInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        selectedImageFile = file;
        selectedImageDataUri = loadEvent.target.result;

        if (previewImg) previewImg.src = selectedImageDataUri;
        if (previewFilename) {
          const sizeKb = Math.round(file.size / 1024);
          const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
          previewFilename.textContent = `${file.name} (${sizeStr})`;
        }
        if (previewWrap) previewWrap.style.display = 'flex';
        updateSubmitButtonState();
      };
      reader.readAsDataURL(file);
    });
  }

  // Drag & drop image upload onto composer
  const composerCard = document.querySelector('.composer-card');
  if (composerCard) {
    ['dragenter', 'dragover'].forEach(eventName => {
      composerCard.addEventListener(eventName, (e) => {
        e.preventDefault();
        composerCard.style.outline = '2px dashed var(--primary)';
        composerCard.style.outlineOffset = '-4px';
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      composerCard.addEventListener(eventName, (e) => {
        e.preventDefault();
        composerCard.style.outline = 'none';
      });
    });

    composerCard.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        if (fileInput) {
          fileInput.files = dataTransfer.files;
          fileInput.dispatchEvent(new Event('change'));
        }
      }
    });
  }

  // Form submit handler
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();

      if (!requireAuthOrRedirect()) return;

      const content = textarea.value.trim();
      if (!content && !selectedImageFile) {
        showToast('Please enter some text or attach an image', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="loading-spinner" style="width: 14px; height: 14px; border-width: 2px;"></span>
          <span>Posting...</span>
        </span>
      `;

      let finalImageUrl = '';

      try {
        // Step 1: If image attached, upload via /api/upload
        if (selectedImageDataUri && selectedImageFile) {
          const uploadRes = await apiFetch('/api/upload', {
            method: 'POST',
            body: JSON.stringify({
              data: selectedImageDataUri,
              filename: selectedImageFile.name
            })
          });

          if (uploadRes.ok && uploadRes.data.success) {
            finalImageUrl = uploadRes.data.url;
          } else {
            showToast('Warning: Image upload failed, posting text only', 'info');
          }
        }

        // Step 2: Create post
        const postRes = await apiFetch('/api/posts', {
          method: 'POST',
          body: JSON.stringify({
            content,
            image_url: finalImageUrl
          })
        });

        if (postRes.ok && postRes.data.success) {
          // Reset composer state
          textarea.value = '';
          textarea.style.height = '85px';
          if (charCountEl) charCountEl.textContent = '0 / 500';
          clearSelectedImage();

          // Prepend newly created post
          const newPost = postRes.data?.data?.post || postRes.data?.data || postRes.data?.post;
          const stream = document.getElementById('posts-stream');
          const emptyState = document.getElementById('feed-empty-state');
          if (emptyState) emptyState.remove();

          if (stream && newPost) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = createPostCardHtml(newPost);
            const postCard = tempDiv.firstElementChild;
            if (postCard) {
              postCard.style.opacity = '0';
              postCard.style.transform = 'translateY(-10px)';
              stream.prepend(postCard);
              bindPostCardEvents(postCard);

              setTimeout(() => {
                postCard.style.transition = 'all 0.3s ease';
                postCard.style.opacity = '1';
                postCard.style.transform = 'translateY(0)';
              }, 50);
            }
          }

          showToast('Post published successfully!', 'success');
        } else {
          showToast(postRes.data.message || 'Failed to publish post', 'error');
        }
      } catch (err) {
        console.error('Error creating post:', err);
        showToast('Network error while publishing post', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post';
        updateSubmitButtonState();
      }
    };
  }
}

// --------------------------------------------------------------------------
// Feed Filters (All Posts vs Following)
// --------------------------------------------------------------------------
function initFeedFilters() {
  const tabs = document.querySelectorAll('.feed-filter-tab');
  tabs.forEach(tab => {
    tab.onclick = () => {
      const filter = tab.getAttribute('data-filter');
      if (filter === currentFilter) return;

      if (filter === 'following' && !isAuthenticated()) {
        showToast('Please log in to view posts from people you follow', 'info');
        setTimeout(() => { window.location.href = '/login.html'; }, 1000);
        return;
      }

      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = filter;
      loadFeed();
    };
  });
}

// --------------------------------------------------------------------------
// Load Feed Stream
// --------------------------------------------------------------------------
async function loadFeed() {
  const stream = document.getElementById('posts-stream');
  if (!stream) return;

  stream.innerHTML = renderSkeletonPostsHtml(3);

  const endpoint = currentFilter === 'following' ? '/api/posts/following' : '/api/posts';

  try {
    const res = await apiFetch(endpoint);

    if (res.ok && res.data.success) {
      const posts = res.data.data;

      if (!posts || posts.length === 0) {
        const emptyMsg = currentFilter === 'following'
          ? 'You are not following anyone with posts yet. Discover people in Explore!'
          : 'No posts yet. Share something with the community!';
        
        stream.innerHTML = `
          <div class="empty-state" id="feed-empty-state">
            <div class="empty-state-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted);"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <h3 class="empty-state-title">No posts here yet</h3>
            <p class="empty-state-desc">${escapeHtml(emptyMsg)}</p>
            ${currentFilter === 'following' ? `
              <a href="/explore.html" class="btn btn-primary btn-sm" style="margin-top: 1rem;">Explore People</a>
            ` : ''}
          </div>
        `;
        return;
      }

      stream.innerHTML = posts.map(post => createPostCardHtml(post)).join('');
      bindPostCardEvents(stream);
    } else {
      stream.innerHTML = `
        <div class="empty-state">
          <p style="color: var(--danger);">Failed to load posts. Please try again.</p>
          <button class="btn btn-outline btn-sm" onclick="loadFeed()" style="margin-top: 0.75rem;">Retry</button>
        </div>
      `;
    }
  } catch (err) {
    console.error('Feed error:', err);
    stream.innerHTML = '<div class="empty-state"><p style="color: var(--danger);">Error loading feed.</p></div>';
  }
}

// --------------------------------------------------------------------------
// Suggested People for Right Sidebar
// --------------------------------------------------------------------------
async function loadSuggestedPeople() {
  const container = document.getElementById('who-to-follow-list');
  if (!container) return;

  const user = getCurrentUser();

  try {
    const res = await apiFetch('/api/users/explore?limit=4');
    if (res.ok && res.data.success) {
      const users = res.data.data.filter(u => !user || u.id !== user.id).slice(0, 4);

      if (users.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No suggestions available right now.</p>';
        return;
      }

      container.innerHTML = users.map(u => {
        const avatarUrl = u.profile_image || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`;
        return `
          <div class="user-mini-card">
            <a href="/profile.html?username=${encodeURIComponent(u.username)}" class="user-mini-link">
              <img src="${avatarUrl}" alt="${escapeHtml(u.name)}" class="user-mini-avatar" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=user'">
              <div class="user-mini-details">
                <div class="user-mini-name">${escapeHtml(u.name || u.username)}</div>
                <div class="user-mini-handle">@${escapeHtml(u.username)}</div>
              </div>
            </a>
            <button class="btn-follow ${u.is_following ? 'following' : ''}" data-user-id="${u.id}" data-following="${u.is_following ? 'true' : 'false'}">
              ${u.is_following ? 'Following' : 'Follow'}
            </button>
          </div>
        `;
      }).join('');

      bindFollowButtons(container);
    }
  } catch (err) {
    console.warn('Could not load suggested people:', err);
  }
}
