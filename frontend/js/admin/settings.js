/**
 * js/admin/settings.js — Handle admin/staff profile updates and password updates
 */

if (!requireAuth()) {
  window.location.href = '/index.html';
}

document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
});

// Fetch user profile and fill forms
async function loadProfile() {
  try {
    const data = await apiFetch('/auth/me');
    if (!data) return;

    document.getElementById('prof-uname').value = data.username;
    
    const emailEl = document.getElementById('prof-email');
    if (data.role === 'admin') {
      // Admin doesn't have an email in schema, can hide or disable email input
      emailEl.value = 'admin@srms.edu';
      emailEl.disabled = true;
    } else {
      emailEl.value = data.email || '';
    }
  } catch (err) {
    showToast('Failed to load profile: ' + err.message, 'error');
  }
}

// Update profile details
async function saveProfile(event) {
  event.preventDefault();

  const username = document.getElementById('prof-uname').value;
  const email = document.getElementById('prof-email').value;

  const btn = document.getElementById('btn-save-prof');
  setLoading('btn-save-prof', true, 'Saving...');

  try {
    await apiFetch('/auth/update-profile', {
      method: 'PUT',
      body: { username, email }
    });

    showToast('Profile details updated successfully.', 'success');

    // Update localStorage user values
    const user = getUser();
    user.username = username;
    localStorage.setItem('srms_user', JSON.stringify(user));

    // Reload layout headers
    initSidebar();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setLoading('btn-save-prof', false, 'Save Profile');
  }
}

// Check password strength and update UI
function checkPasswordStrength(val) {
  const meter = document.getElementById('strength-meter');
  const bar = document.getElementById('strength-bar');
  const text = document.getElementById('strength-text');

  if (!val) {
    meter.style.display = 'none';
    text.textContent = '';
    return;
  }

  meter.style.display = 'block';

  let score = 0;
  if (val.length >= 6) score += 1;
  if (val.length >= 10) score += 1;
  if (/[0-9]/.test(val)) score += 1;
  if (/[A-Z]/.test(val)) score += 1;
  if (/[^A-Za-z0-9]/.test(val)) score += 1;

  let pct = '0%';
  let color = '#ef4444';
  let desc = 'Too Weak';

  if (score <= 1) {
    pct = '25%';
    color = '#ef4444';
    desc = 'Weak';
  } else if (score <= 3) {
    pct = '60%';
    color = '#f59e0b';
    desc = 'Medium';
  } else {
    pct = '100%';
    color = '#10b981';
    desc = 'Strong';
  }

  bar.style.width = pct;
  bar.style.background = color;
  text.textContent = `Strength: ${desc}`;
  text.style.color = color;
}

// Change account password
async function changePassword(event) {
  event.preventDefault();

  const currentPassword = document.getElementById('pass-curr').value;
  const newPassword = document.getElementById('pass-new').value;
  const confirmPassword = document.getElementById('pass-conf').value;

  if (newPassword.length < 6) {
    showToast('New password must be at least 6 characters long.', 'warning');
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('New passwords do not match.', 'error');
    return;
  }

  setLoading('btn-change-pass', true, 'Updating...');

  try {
    await apiFetch('/auth/change-password', {
      method: 'PUT',
      body: { currentPassword, newPassword }
    });

    showToast('Password changed successfully.', 'success');
    document.getElementById('password-form').reset();
    document.getElementById('strength-meter').style.display = 'none';
    document.getElementById('strength-text').textContent = '';
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setLoading('btn-change-pass', false, 'Change Password');
  }
}
