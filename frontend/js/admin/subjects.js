/**
 * admin/subjects.js — Subject list and CRUD
 */

requireAuth();

let allSubjects = [];

async function loadSubjects() {
  document.getElementById('subj-loading').style.display = 'flex';
  document.getElementById('subj-table-wrap').style.display = 'none';
  document.getElementById('subj-empty').style.display = 'none';

  const dept = document.getElementById('f-dept').value;
  const sem  = document.getElementById('f-sem').value;

  let url = '/subjects';
  const params = [];
  if (dept) params.push(`department=${dept}`);
  if (sem)  params.push(`semester=${sem}`);
  if (params.length) url += '?' + params.join('&');

  try {
    allSubjects = await apiFetch(url) || [];
    renderTable(allSubjects);
  } catch (err) {
    showToast('Failed to load subjects: ' + err.message, 'error');
  } finally {
    document.getElementById('subj-loading').style.display = 'none';
  }
}

function renderTable(subjects) {
  document.getElementById('subj-count').textContent = `${subjects.length} subject${subjects.length !== 1 ? 's' : ''}`;

  if (subjects.length === 0) {
    document.getElementById('subj-table-wrap').style.display = 'none';
    document.getElementById('subj-empty').style.display = 'block';
    return;
  }

  document.getElementById('subj-table-wrap').style.display = 'block';
  document.getElementById('subj-empty').style.display = 'none';

  const typeColors = { Theory: 'badge-admin', Practical: 'badge-staff', Lab: 'badge-student' };

  const user = getUser();
  const isAdmin = user && user.role === 'admin';

  document.getElementById('subj-tbody').innerHTML = subjects.map((s, i) => `
    <tr>
      <td style="color:var(--text-muted);font-size:.8rem;">${i+1}</td>
      <td><code style="background:var(--bg-hover);padding:2px 8px;border-radius:4px;font-size:.8rem;">${s.subject_code}</code></td>
      <td style="font-weight:600;">${s.subject_name}</td>
      <td><span class="badge badge-admin">${s.department}</span></td>
      <td style="text-align:center;font-weight:600;">${s.semester}</td>
      <td><span class="badge ${typeColors[s.subject_type] || ''}">${s.subject_type}</span></td>
      <td style="text-align:center;">${s.credits}</td>
      <td style="text-align:center;">${s.max_marks}</td>
      <td style="text-align:center;">${s.pass_marks}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-secondary btn-sm" onclick="openEditModal(${s.id})">✏️</button>
          ${isAdmin ? `<button class="btn btn-danger btn-sm" onclick="deleteSubject(${s.id}, '${s.subject_name.replace(/'/g,"\\'")}')">🗑</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddModal() {
  document.getElementById('subj-modal-title').textContent = 'Add Subject';
  document.getElementById('subj-form').reset();
  document.getElementById('edit-subj-id').value = '';
  document.getElementById('subj-credits').value = 3;
  document.getElementById('subj-max').value    = 100;
  document.getElementById('subj-pass').value   = 40;
  openModal('subj-modal');
}

function openEditModal(id) {
  const s = allSubjects.find(s => s.id === id);
  if (!s) return;
  document.getElementById('subj-modal-title').textContent = 'Edit Subject';
  document.getElementById('edit-subj-id').value = s.id;
  document.getElementById('subj-code').value    = s.subject_code;
  document.getElementById('subj-name').value    = s.subject_name;
  document.getElementById('subj-dept').value    = s.department;
  document.getElementById('subj-sem').value     = s.semester;
  document.getElementById('subj-credits').value = s.credits;
  document.getElementById('subj-max').value     = s.max_marks;
  document.getElementById('subj-pass').value    = s.pass_marks;
  document.getElementById('subj-type').value    = s.subject_type;
  openModal('subj-modal');
}

async function saveSubject() {
  const id = document.getElementById('edit-subj-id').value;
  const payload = {
    subject_code: document.getElementById('subj-code').value.trim(),
    subject_name: document.getElementById('subj-name').value.trim(),
    department:   document.getElementById('subj-dept').value,
    semester:     document.getElementById('subj-sem').value,
    credits:      document.getElementById('subj-credits').value,
    max_marks:    document.getElementById('subj-max').value,
    pass_marks:   document.getElementById('subj-pass').value,
    subject_type: document.getElementById('subj-type').value,
  };

  setLoading('save-subj-btn', true, 'Saving...');
  try {
    if (id) {
      await apiFetch(`/subjects/${id}`, { method: 'PUT', body: payload });
      showToast('Subject updated!', 'success');
    } else {
      await apiFetch('/subjects', { method: 'POST', body: payload });
      showToast('Subject added!', 'success');
    }
    closeModal('subj-modal');
    loadSubjects();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    setLoading('save-subj-btn', false, '💾 Save');
  }
}

async function deleteSubject(id, name) {
  confirmAction(`Delete subject "${name}"? Results linked to this subject will also be deleted.`, async () => {
    try {
      await apiFetch(`/subjects/${id}`, { method: 'DELETE' });
      showToast(`Subject "${name}" deleted.`, 'success');
      loadSubjects();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });
}

loadSubjects();
