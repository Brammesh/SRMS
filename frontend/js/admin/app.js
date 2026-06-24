/**
 * admin/app.js — Shared utilities for all admin pages
 */

// ─── Auth Helpers ─────────────────────────────────────────────
const API = '/api';

function getToken() { return localStorage.getItem('srms_token'); }
function getUser()  { return JSON.parse(localStorage.getItem('srms_user') || 'null'); }

function requireAuth() {
  const token = getToken();
  const user  = getUser();
  if (!token || !user || user.role === 'student') {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

function logout() {
  localStorage.removeItem('srms_token');
  localStorage.removeItem('srms_user');
  window.location.href = '/index.html';
}

// ─── API Fetch Helper ─────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
  });

  if (res.status === 401 || res.status === 403) {
    logout();
    return null;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── Toast Notifications ──────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ─── Modal Helpers ────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
  }
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
  }
});

// ─── UI Helpers ───────────────────────────────────────────────
function setLoading(elementId, loading, text = '') {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (loading) {
    el.disabled = true;
    el._originalText = el.innerHTML;
    el.innerHTML = `<span class="spinner"></span> ${text || 'Loading...'}`;
  } else {
    el.disabled = false;
    el.innerHTML = el._originalText || text;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function gradeClass(grade) {
  const map = { 'O':'grade-O', 'A+':'grade-Ap', 'A':'grade-A', 'B+':'grade-Bp', 'B':'grade-B', 'C':'grade-C', 'F':'grade-F' };
  return map[grade] || '';
}

function badgeStatus(status) {
  const map = { 'PASS': 'badge-pass', 'FAIL': 'badge-fail', 'ABSENT': 'badge-absent' };
  return `<span class="badge ${map[status] || ''}">${status}</span>`;
}

// ─── Sidebar init ─────────────────────────────────────────────
function initSidebar() {
  const user = getUser();
  if (!user) return;

  // Avatar + name
  const avatar = document.getElementById('user-avatar');
  const nameEl = document.getElementById('user-name');
  const roleEl = document.getElementById('user-role');

  if (avatar) avatar.textContent = (user.username || 'A')[0].toUpperCase();
  if (nameEl) nameEl.textContent = user.username || 'User';
  if (roleEl) roleEl.textContent = user.role || 'staff';

  // Active nav
  const current = window.location.pathname.split('/').pop();
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    if (item.dataset.page === current) item.classList.add('active');
  });

  // Hide admin-only items for staff
  if (user.role !== 'admin') {
    document.querySelectorAll('[data-admin-only]').forEach(el => el.style.display = 'none');
  }
}

// ─── Animated counter ─────────────────────────────────────────
function animateCounter(el, target, duration = 1200) {
  const start = 0;
  const step  = (target / duration) * 16;
  let current = start;
  const run = () => {
    current = Math.min(current + step, target);
    el.textContent = Number.isInteger(target) ? Math.floor(current) : current.toFixed(1);
    if (current < target) requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
}

// ─── Confirm Dialog ───────────────────────────────────────────
function confirmAction(message, onConfirm) {
  const modal = document.getElementById('confirm-modal');
  if (!modal) {
    if (confirm(message)) onConfirm();
    return;
  }
  document.getElementById('confirm-msg').textContent = message;
  modal.classList.remove('hidden');
  document.getElementById('confirm-yes').onclick = () => {
    modal.classList.add('hidden');
    onConfirm();
  };
  document.getElementById('confirm-no').onclick = () => modal.classList.add('hidden');
}

// Initialize sidebar on load
document.addEventListener('DOMContentLoaded', initSidebar);
