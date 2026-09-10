// ==========================================================================
// SocialHub - Comments Module
// ==========================================================================

function bindCommentActions(container = document) {
  // Toggle comments container & load
  container.querySelectorAll('.comment-toggle-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const postId = btn.getAttribute('data-post-id');
      const commentsContainer = document.getElementById(`comments-container-${postId}`);
      if (!commentsContainer) return;

      if (commentsContainer.style.display === 'none' || !commentsContainer.style.display) {
        commentsContainer.style.display = 'block';
        loadCommentsForPost(postId);
      } else {
        commentsContainer.style.display = 'none';
      }
    };
  });

  // Comment submission forms
  container.querySelectorAll('.comment-form').forEach(form => {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const postId = form.getAttribute('data-post-id');
      const input = form.querySelector('.comment-input-field');
      const submitBtn = form.querySelector('.comment-submit-btn');
      const content = input.value.trim();

      const user = getCurrentUser();
      if (!user) {
        showToast('Please log in to leave a comment', 'error');
        setTimeout(() => {
          window.location.href = '/login.html';
        }, 1200);
        return;
      }

      if (!content) return;

      submitBtn.disabled = true;
      submitBtn.textContent = '...';

      try {
        const res = await apiFetch(`/api/posts/${postId}/comments`, {
          method: 'POST',
          body: JSON.stringify({ content })
        });

        if (res.ok && res.data.success) {
          input.value = '';
          const newComment = res.data.data.comment;
          const updatedCount = res.data.data.comment_count;

          // Update comment counter in UI
          const countEl = document.getElementById(`post-stat-comments-${postId}`);
          if (countEl) countEl.textContent = updatedCount;

          // Append new comment to list
          const listEl = document.getElementById(`comments-list-${postId}`);
          if (listEl) {
            const emptyEl = listEl.querySelector('.empty-comments');
            if (emptyEl) emptyEl.remove();

            const commentNode = document.createElement('div');
            commentNode.innerHTML = renderCommentItemHtml(newComment);
            const renderedItem = commentNode.firstElementChild;
            listEl.appendChild(renderedItem);
            bindCommentItemEvents(renderedItem, postId);
          }

          showToast('Comment added', 'success');
        } else {
          showToast(res.data.message || 'Failed to post comment', 'error');
        }
      } catch (err) {
        console.error('Comment submit error:', err);
        showToast('Network error adding comment', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post';
      }
    };
  });
}

// Load comments from backend
async function loadCommentsForPost(postId) {
  const listEl = document.getElementById(`comments-list-${postId}`);
  if (!listEl) return;

  listEl.innerHTML = '<div class="center-spinner" style="padding: 1rem;"><div class="loading-spinner"></div></div>';

  try {
    const res = await apiFetch(`/api/posts/${postId}/comments`);
    if (res.ok && res.data.success) {
      const comments = res.data.data;
      if (comments.length === 0) {
        listEl.innerHTML = '<p class="empty-comments">No comments yet. Start the conversation!</p>';
        return;
      }

      listEl.innerHTML = comments.map(c => renderCommentItemHtml(c)).join('');
      listEl.querySelectorAll('.comment-item').forEach(item => {
        bindCommentItemEvents(item, postId);
      });
    } else {
      listEl.innerHTML = '<p class="empty-comments" style="color: var(--danger);">Failed to load comments.</p>';
    }
  } catch (err) {
    listEl.innerHTML = '<p class="empty-comments" style="color: var(--danger);">Error loading comments.</p>';
  }
}

// Render individual comment HTML
function renderCommentItemHtml(c) {
  if (!c) return '';
  const user = getCurrentUser();
  const author = c.author || {};
  const isOwner = Boolean(c.is_owner || (user && author.id && user.id === author.id));
  const avatarUrl = author.profile_image || `https://api.dicebear.com/7.x/bottts/svg?seed=${author.username || 'user'}`;

  return `
    <div class="comment-item" id="comment-${c.id}" data-comment-id="${c.id}">
      <img src="${avatarUrl}" alt="${escapeHtml(author.name || author.username || 'User')}" class="comment-user-avatar" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=user'">
      <div class="comment-bubble">
        <div class="comment-item-header">
          <a href="/profile.html?username=${encodeURIComponent(author.username || '')}" class="comment-author-name">
            ${escapeHtml(author.name || author.username || 'User')}
          </a>
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <span class="comment-time">${timeAgo(c.created_at)}</span>
            ${isOwner ? `
              <button class="comment-delete-btn" data-comment-id="${c.id}" title="Delete comment">✕</button>
            ` : ''}
          </div>
        </div>
        <div class="comment-text">${escapeHtml(c.content)}</div>
      </div>
    </div>
  `;
}

// Bind delete button on comment item
function bindCommentItemEvents(commentEl, postId) {
  const deleteBtn = commentEl.querySelector('.comment-delete-btn');
  if (deleteBtn) {
    deleteBtn.onclick = async (e) => {
      e.stopPropagation();
      const commentId = deleteBtn.getAttribute('data-comment-id');
      if (!confirm('Delete this comment?')) return;

      try {
        const res = await apiFetch(`/api/comments/${commentId}`, { method: 'DELETE' });
        if (res.ok && res.data.success) {
          commentEl.style.opacity = '0';
          setTimeout(() => {
            commentEl.remove();
            const countEl = document.getElementById(`post-stat-comments-${postId}`);
            if (countEl && res.data.data && res.data.data.comment_count !== undefined) {
              countEl.textContent = res.data.data.comment_count;
            }
          }, 200);
          showToast('Comment deleted', 'success');
        } else {
          showToast(res.data.message || 'Failed to delete comment', 'error');
        }
      } catch (err) {
        showToast('Error deleting comment', 'error');
      }
    };
  }
}
