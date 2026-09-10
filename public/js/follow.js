// ==========================================================================
// Follow System Module - PostgreSQL-backed Following Mechanism
// ==========================================================================

function bindFollowButtons(container = document) {
  container.querySelectorAll('.btn-follow').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();

      const user = getCurrentUser();
      if (!user) {
        showToast('Please log in to follow users', 'error');
        setTimeout(() => {
          window.location.href = '/login.html';
        }, 1200);
        return;
      }

      const targetUserId = btn.getAttribute('data-user-id');
      const isFollowing = btn.getAttribute('data-following') === 'true';

      if (parseInt(targetUserId) === user.id) {
        showToast('You cannot follow yourself', 'error');
        return;
      }

      btn.disabled = true;

      try {
        const method = isFollowing ? 'DELETE' : 'POST';
        const res = await apiFetch(`/api/users/${targetUserId}/follow`, { method });

        if (res.ok && res.data.success) {
          const nowFollowing = res.data.data.following;
          const updatedFollowersCount = res.data.data.followers_count;

          btn.setAttribute('data-following', nowFollowing ? 'true' : 'false');

          if (nowFollowing) {
            btn.classList.add('following');
            btn.textContent = 'Following';
          } else {
            btn.classList.remove('following');
            btn.textContent = 'Follow';
          }

          // Update follower count elements if available in DOM
          const followerCountEls = document.querySelectorAll(`[data-user-followers="${targetUserId}"]`);
          followerCountEls.forEach(el => {
            el.textContent = updatedFollowersCount;
          });

          const profileFollowerCount = document.getElementById('profile-followers-count');
          if (profileFollowerCount) {
            profileFollowerCount.textContent = updatedFollowersCount;
          }

          showToast(nowFollowing ? 'User followed' : 'User unfollowed', 'success');
        } else {
          showToast(res.data.message || 'Follow action failed', 'error');
        }
      } catch (err) {
        console.error('Follow action error:', err);
        showToast('Network error while processing follow', 'error');
      } finally {
        btn.disabled = false;
      }
    };
  });
}
