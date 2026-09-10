// ==========================================================================
// SocialHub - Likes Module
// ==========================================================================

function bindLikeButtons(container = document) {
  container.querySelectorAll('.like-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();

      const user = getCurrentUser();
      if (!user) {
        showToast('Please log in to like posts', 'error');
        setTimeout(() => {
          window.location.href = '/login.html';
        }, 1000);
        return;
      }

      const postId = btn.getAttribute('data-post-id');
      const isLiked = btn.getAttribute('data-liked') === 'true';
      const heartSvg = btn.querySelector('.heart-svg');
      const likeLabel = btn.querySelector('.like-label');
      const statLikesEl = document.getElementById(`post-stat-likes-${postId}`);

      btn.disabled = true;

      try {
        const method = isLiked ? 'DELETE' : 'POST';
        const res = await apiFetch(`/api/posts/${postId}/like`, { method });

        if (res.ok && res.data.success) {
          const nowLiked = res.data.data.liked;
          const updatedCount = res.data.data.like_count;

          btn.setAttribute('data-liked', nowLiked ? 'true' : 'false');
          if (nowLiked) {
            btn.classList.add('liked');
            if (heartSvg) heartSvg.setAttribute('fill', 'currentColor');
            if (likeLabel) likeLabel.textContent = 'Liked';
          } else {
            btn.classList.remove('liked');
            if (heartSvg) heartSvg.setAttribute('fill', 'none');
            if (likeLabel) likeLabel.textContent = 'Like';
          }

          if (statLikesEl) {
            statLikesEl.textContent = updatedCount;
          }
        } else {
          showToast(res.data.message || 'Failed to update like status', 'error');
        }
      } catch (err) {
        console.error('Like action error:', err);
        showToast('Network error processing like', 'error');
      } finally {
        btn.disabled = false;
      }
    };
  });
}
