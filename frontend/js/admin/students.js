/**
 * admin/students.js — Students list, add, edit, delete
 */

requireAuth();

let allStudents = [];

async function loadStudents() {
  document.getElementById('students-loading').style.display = 'flex';
  document.getElementById('students-table-wrap').style.display = 'none';
  document.getElementById('students-empty').style.display = 'none';

  try {
    allStudents = await apiFetch('/students');
    if (!allStudents) return;

    // Populate department filter
    const depts = [...new Set(allStudents.map(s => s.department))].sort();
    const deptSelect = document.getElementById('filter-dept');
    deptSelect.innerHTML = '<option value="">All Departments</option>' +
      depts.map(d => `<option value="${d}">${d}</option>`).join('');

    renderTable(allStudents);
  } catch (err) {
    showToast('Failed to load students: ' + err.message, 'error');
  } finally {
    document.getElementById('students-loading').style.display = 'none';
  }
}

function renderTable(students) {
  const tbody = document.getElementById('students-tbody');
  document.getElementById('result-count').textContent = `${students.length} student${students.length !== 1 ? 's' : ''}`;

  if (students.length === 0) {
    document.getElementById('students-table-wrap').style.display = 'none';
    document.getElementById('students-empty').style.display = 'block';
    return;
  }

  document.getElementById('students-table-wrap').style.display = 'block';
  document.getElementById('students-empty').style.display = 'none';

  const user = getUser();
  const isAdmin = user && user.role === 'admin';

  tbody.innerHTML = students.map((s, i) => `
    <tr>
      <td style="color:var(--text-muted);font-size:0.8rem;">${i + 1}</td>
      <td>
        <div style="font-weight:600;">${s.name}</div>
        <div class="text-sm text-muted">${s.email || '—'}</div>
      </td>
      <td><code style="background:var(--bg-hover);padding:2px 8px;border-radius:4px;font-size:0.8rem;">${s.roll_number}</code></td>
      <td style="color:var(--text-secondary);font-size:0.85rem;">${s.register_number}</td>
      <td><span class="badge badge-admin">${s.department}</span></td>
      <td>${s.class}</td>
      <td style="text-align:center;font-weight:600;">${s.semester}</td>
      <td style="color:var(--text-secondary);font-size:0.85rem;">${s.batch}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-secondary btn-sm" onclick="openEditModal(${s.id})">✏️ Edit</button>
          ${isAdmin ? `<button class="btn btn-danger btn-sm" onclick="deleteStudent(${s.id}, '${s.name.replace(/'/g, "\\'")}')">🗑</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function filterStudents() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const dept   = document.getElementById('filter-dept').value;
  const sem    = document.getElementById('filter-sem').value;

  const filtered = allStudents.filter(s => {
    const matchSearch = !search || [s.name, s.roll_number, s.register_number, s.email].some(f => (f || '').toLowerCase().includes(search));
    const matchDept   = !dept || s.department === dept;
    const matchSem    = !sem  || s.semester === Number(sem);
    return matchSearch && matchDept && matchSem;
  });

  renderTable(filtered);
}

function clearFilters() {
  document.getElementById('search-input').value = '';
  document.getElementById('filter-dept').value = '';
  document.getElementById('filter-sem').value = '';
  renderTable(allStudents);
}

// ─── Modal ─────────────────────────────────────────────────────
function openAddModal() {
  document.getElementById('modal-title').textContent = 'Add Student';
  document.getElementById('student-form').reset();
  document.getElementById('edit-id').value = '';
  openModal('student-modal');
}

function openEditModal(id) {
  const s = allStudents.find(s => s.id === id);
  if (!s) return;

  document.getElementById('modal-title').textContent = 'Edit Student';
  document.getElementById('edit-id').value = s.id;
  document.getElementById('s-name').value    = s.name;
  document.getElementById('s-gender').value  = s.gender || '';
  document.getElementById('s-roll').value    = s.roll_number;
  document.getElementById('s-reg').value     = s.register_number;
  document.getElementById('s-dob').value     = s.date_of_birth || '';
  document.getElementById('s-email').value   = s.email || '';
  document.getElementById('s-phone').value   = s.phone || '';
  document.getElementById('s-dept').value    = s.department;
  document.getElementById('s-class').value   = s.class;
  document.getElementById('s-sem').value     = s.semester;
  document.getElementById('s-batch').value   = s.batch;
  document.getElementById('s-address').value = s.address || '';

  openModal('student-modal');
}

async function saveStudent(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('edit-id').value;
  const payload = {
    name: document.getElementById('s-name').value.trim(),
    gender: document.getElementById('s-gender').value,
    roll_number: document.getElementById('s-roll').value.trim(),
    register_number: document.getElementById('s-reg').value.trim(),
    date_of_birth: document.getElementById('s-dob').value,
    email: document.getElementById('s-email').value.trim(),
    phone: document.getElementById('s-phone').value.trim(),
    department: document.getElementById('s-dept').value,
    class: document.getElementById('s-class').value.trim(),
    semester: document.getElementById('s-sem').value,
    batch: document.getElementById('s-batch').value.trim(),
    address: document.getElementById('s-address').value.trim(),
  };

  setLoading('save-student-btn', true, 'Saving...');

  try {
    if (id) {
      await apiFetch(`/students/${id}`, { method: 'PUT', body: payload });
      showToast('Student updated successfully!', 'success');
    } else {
      await apiFetch('/students', { method: 'POST', body: payload });
      showToast('Student added successfully!', 'success');
    }
    closeModal('student-modal');
    loadStudents();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    setLoading('save-student-btn', false, '💾 Save Student');
  }
}

async function deleteStudent(id, name) {
  confirmAction(`Delete student "${name}"? This will also delete all their results.`, async () => {
    try {
      await apiFetch(`/students/${id}`, { method: 'DELETE' });
      showToast(`Student "${name}" deleted.`, 'success');
      loadStudents();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });
}

// Initialize
loadStudents();
