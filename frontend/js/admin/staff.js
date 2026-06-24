/**
 * js/admin/staff.js — Handle Staff CRUD client actions
 */

// Verify authorization
if (!requireAuth()) {
  window.location.href = '/index.html';
}

// Redirect if not admin
const currentUser = getUser();
if (currentUser.role !== 'admin') {
  window.location.href = '/admin/dashboard.html';
}

document.addEventListener('DOMContentLoaded', () => {
  loadStaffs();
});

// Load staff list from API
async function loadStaffs() {
  const search = document.getElementById('search-staff').value;
  const dept = document.getElementById('f-dept').value;

  const loadingEl = document.getElementById('staff-loading');
  const tableWrap = document.getElementById('staff-table-wrap');
  const emptyEl = document.getElementById('staff-empty');
  const tbody = document.getElementById('staff-tbody');
  const countEl = document.getElementById('staff-count');

  loadingEl.style.display = 'block';
  tableWrap.style.display = 'none';
  emptyEl.style.display = 'none';

  try {
    let url = '/staffs';
    const params = [];
    if (search) params.push(`search=${encodeURIComponent(search)}`);
    if (dept) params.push(`department=${encodeURIComponent(dept)}`);
    if (params.length > 0) url += '?' + params.join('&');

    const data = await apiFetch(url);
    if (!data) return;

    loadingEl.style.display = 'none';
    countEl.textContent = `Total Staff: ${data.length}`;

    if (data.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }

    tbody.innerHTML = '';
    data.forEach((st, idx) => {
      const isStatusActive = st.status === 'Active';
      const statusBadge = isStatusActive 
        ? `<span class="badge badge-pass" style="cursor:pointer" onclick="toggleStatus(${st.id}, 'Inactive')">Active</span>`
        : `<span class="badge badge-fail" style="cursor:pointer" onclick="toggleStatus(${st.id}, 'Active')">Inactive</span>`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${st.staff_id}</strong></td>
        <td>${st.name}</td>
        <td>${st.email}</td>
        <td>${st.phone || '—'}</td>
        <td><span class="badge badge-dept">${st.department}</span></td>
        <td>${st.designation}</td>
        <td><code>${st.username}</code></td>
        <td>${statusBadge}</td>
        <td>${formatDate(st.created_at)}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-sm" onclick="openEditModal(${st.id})" title="Edit Details">✏️</button>
            <button class="btn btn-sm btn-secondary" onclick="openResetPasswordModal(${st.id})" title="Reset Password">🔑</button>
            <button class="btn btn-sm btn-danger" onclick="deleteStaff(${st.id})" title="Delete Staff">🗑️</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tableWrap.style.display = 'block';
  } catch (err) {
    loadingEl.style.display = 'none';
    showToast('Failed to load staffs: ' + err.message, 'error');
  }
}

// Open modal to add staff
function openAddModal() {
  document.getElementById('edit-staff-id').value = '';
  document.getElementById('staff-form').reset();
  
  // Enable IDs and Username fields
  document.getElementById('staff-code').disabled = false;
  document.getElementById('staff-uname').disabled = false;
  document.getElementById('pass-group').style.display = 'block';
  document.getElementById('staff-pass').setAttribute('required', 'true');

  document.getElementById('staff-modal-title').textContent = 'Add Staff Member';
  openModal('staff-modal');
}

// Open modal to edit staff
async function openEditModal(id) {
  document.getElementById('staff-form').reset();
  
  try {
    const data = await apiFetch(`/staffs/${id}`);
    if (!data) return;

    document.getElementById('edit-staff-id').value = data.id;
    document.getElementById('staff-code').value = data.staff_id;
    document.getElementById('staff-code').disabled = true; // cannot change staff id
    document.getElementById('staff-name').value = data.name;
    document.getElementById('staff-email').value = data.email;
    document.getElementById('staff-phone').value = data.phone || '';
    document.getElementById('staff-dept').value = data.department;
    document.getElementById('staff-desg').value = data.designation;
    document.getElementById('staff-uname').value = data.username;
    document.getElementById('staff-uname').disabled = true; // cannot change username

    // Hide password fields on edit (has its own reset password function)
    document.getElementById('pass-group').style.display = 'none';
    document.getElementById('staff-pass').removeAttribute('required');

    document.getElementById('staff-modal-title').textContent = 'Edit Staff Member';
    openModal('staff-modal');
  } catch (err) {
    showToast('Failed to load staff details: ' + err.message, 'error');
  }
}

// Save Staff Action (Create or Update)
async function saveStaff() {
  const form = document.getElementById('staff-form');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const id = document.getElementById('edit-staff-id').value;
  const staff_id = document.getElementById('staff-code').value;
  const name = document.getElementById('staff-name').value;
  const email = document.getElementById('staff-email').value;
  const phone = document.getElementById('staff-phone').value;
  const department = document.getElementById('staff-dept').value;
  const designation = document.getElementById('staff-desg').value;
  const username = document.getElementById('staff-uname').value;
  
  const payload = { staff_id, name, email, phone, department, designation, username };

  setLoading('save-staff-btn', true, 'Saving...');

  try {
    if (id) {
      // Edit
      await apiFetch(`/staffs/${id}`, { method: 'PUT', body: payload });
      showToast('Staff details updated successfully.', 'success');
    } else {
      // Create
      const password = document.getElementById('staff-pass').value;
      await apiFetch('/staffs', { method: 'POST', body: { ...payload, password } });
      showToast('Staff member added successfully.', 'success');
    }
    closeModal('staff-modal');
    loadStaffs();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setLoading('save-staff-btn', false, '💾 Save Staff');
  }
}

// Toggle status active/inactive
async function toggleStatus(id, newStatus) {
  try {
    await apiFetch(`/staffs/${id}/status`, { method: 'PUT', body: { status: newStatus } });
    showToast(`Staff account status updated to ${newStatus}.`, 'success');
    loadStaffs();
  } catch (err) {
    showToast('Failed to toggle status: ' + err.message, 'error');
  }
}

// Open password reset modal
function openResetPasswordModal(id) {
  document.getElementById('reset-staff-target-id').value = id;
  document.getElementById('reset-pass-val').value = '';
  openModal('reset-password-modal');
}

// Perform password reset action
async function resetPasswordAction() {
  const id = document.getElementById('reset-staff-target-id').value;
  const password = document.getElementById('reset-pass-val').value;

  if (!password || password.length < 6) {
    showToast('Password must be at least 6 characters.', 'warning');
    return;
  }

  setLoading('reset-pass-btn', true, 'Resetting...');
  try {
    await apiFetch(`/staffs/${id}/reset-password`, { method: 'PUT', body: { password } });
    showToast('Password updated successfully.', 'success');
    closeModal('reset-password-modal');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setLoading('reset-pass-btn', false, 'Reset Password');
  }
}

// Delete Staff
function deleteStaff(id) {
  confirmAction('Are you sure you want to permanently delete this staff member? This action is irreversible.', async () => {
    try {
      await apiFetch(`/staffs/${id}`, { method: 'DELETE' });
      showToast('Staff member permanently deleted.', 'success');
      loadStaffs();
    } catch (err) {
      showToast('Deletion failed: ' + err.message, 'error');
    }
  });
}
