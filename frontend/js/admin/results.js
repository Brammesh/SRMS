/**
 * admin/results.js — 3-step result entry wizard
 */

requireAuth();

let currentStudents = [];
let currentSubjects  = [];
let selectedStudent  = null;
let existingResults  = {};

function goStep(n) {
  [1, 2, 3].forEach(i => {
    document.getElementById(`panel-${i}`).classList.toggle('hidden', i !== n);
    const stepEl = document.getElementById(`step-${i}`);
    stepEl.classList.remove('active', 'done');
    if (i < n) stepEl.classList.add('done');
    else if (i === n) stepEl.classList.add('active');
  });
}

// ─── Step 1 ───────────────────────────────────────────────────
async function onDeptChange() { /* reset */ }
async function onSemChange()  { /* reset */ }

async function loadClassStudents() {
  const dept = document.getElementById('sel-dept').value;
  const sem  = document.getElementById('sel-sem').value;
  const year = document.getElementById('sel-year').value.trim();

  if (!dept || !sem || !year) {
    showToast('Please fill in all fields.', 'warning');
    return;
  }

  setLoading('load-class-btn', true, 'Loading...');
  try {
    const [students, subjects] = await Promise.all([
      apiFetch(`/students?department=${dept}&semester=${sem}`),
      apiFetch(`/subjects?department=${dept}&semester=${sem}`),
    ]);

    currentStudents = students || [];
    currentSubjects  = subjects || [];

    if (currentStudents.length === 0) {
      showToast('No students found for this class.', 'warning');
      return;
    }

    document.getElementById('class-label').textContent =
      `${dept} — Semester ${sem} — ${year} (${currentStudents.length} students)`;

    const listEl = document.getElementById('student-list');
    listEl.innerHTML = currentStudents.map(s => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;
           border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;
           background:var(--bg-secondary);cursor:pointer;transition:all .2s;"
           onclick="selectStudent(${s.id})"
           onmouseenter="this.style.borderColor='var(--accent)'"
           onmouseleave="this.style.borderColor='var(--border)'">
        <div>
          <div style="font-weight:600;">${s.name}</div>
          <div class="text-sm text-muted">${s.roll_number} · ${s.class}</div>
        </div>
        <div class="btn btn-primary btn-sm">Enter Marks →</div>
      </div>
    `).join('');

    goStep(2);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    setLoading('load-class-btn', false, 'Load Students →');
  }
}

// ─── Step 2 → 3 ───────────────────────────────────────────────
async function selectStudent(id) {
  selectedStudent = currentStudents.find(s => s.id === id);
  if (!selectedStudent) return;

  const year = document.getElementById('sel-year').value.trim();

  document.getElementById('student-label').textContent = selectedStudent.name;
  document.getElementById('student-meta').textContent =
    `${selectedStudent.roll_number} · ${selectedStudent.department} · Semester ${selectedStudent.semester}`;

  // Load existing results
  try {
    const data = await apiFetch(`/results/student/${id}?academic_year=${year}`);
    existingResults = {};
    (data?.results || []).forEach(r => {
      existingResults[r.subject_id] = r;
    });
  } catch {
    existingResults = {};
  }

  renderMarksGrid(year);
  goStep(3);
}

function renderMarksGrid(year) {
  const grid = document.getElementById('marks-grid');

  if (currentSubjects.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📚</div><h3>No subjects found</h3><p>Add subjects for this department/semester first.</p></div>';
    return;
  }

  grid.innerHTML = currentSubjects.map((sub, i) => {
    const ex = existingResults[sub.id];
    const maxInt = Math.round(sub.max_marks * 0.4); // 40% internal
    const maxExt = sub.max_marks - maxInt;
    return `
      <div class="result-row" id="row-${sub.id}">
        <div style="color:var(--text-muted);font-size:0.8rem;">${i+1}</div>
        <div>
          <div style="font-weight:600;font-size:0.85rem;">${sub.subject_name}</div>
          <div class="text-xs text-muted">${sub.subject_code} · ${sub.subject_type} · Max: ${sub.max_marks}</div>
        </div>
        <div style="text-align:center;">
          <input type="number" class="marks-input" id="int-${sub.id}"
            min="0" max="${maxInt}" step="0.5"
            value="${ex ? ex.internal_marks : ''}"
            placeholder="0–${maxInt}"
            oninput="calcTotal(${sub.id}, ${sub.max_marks}, ${sub.pass_marks})" />
        </div>
        <div style="text-align:center;">
          <input type="number" class="marks-input" id="ext-${sub.id}"
            min="0" max="${maxExt}" step="0.5"
            value="${ex ? ex.external_marks : ''}"
            placeholder="0–${maxExt}"
            oninput="calcTotal(${sub.id}, ${sub.max_marks}, ${sub.pass_marks})" />
        </div>
        <div class="total-cell" style="text-align:center;" id="total-${sub.id}">
          ${ex ? ex.total_marks : '—'}
        </div>
        <div style="text-align:center;" id="status-${sub.id}">
          ${ex ? badgeStatus(ex.status) : '—'}
        </div>
      </div>
    `;
  }).join('');
}

function calcTotal(subId, maxMarks, passMarks) {
  const intVal = parseFloat(document.getElementById(`int-${subId}`).value) || 0;
  const extVal = parseFloat(document.getElementById(`ext-${subId}`).value) || 0;
  const total = intVal + extVal;
  const totalEl = document.getElementById(`total-${subId}`);
  const statusEl = document.getElementById(`status-${subId}`);

  totalEl.textContent = total;

  if (intVal || extVal) {
    const status = total >= passMarks ? 'PASS' : 'FAIL';
    statusEl.innerHTML = badgeStatus(status);
    totalEl.style.color = total >= passMarks ? 'var(--success)' : 'var(--danger)';
  } else {
    statusEl.innerHTML = '—';
    totalEl.style.color = 'var(--accent)';
  }
}

// ─── Save ─────────────────────────────────────────────────────
async function saveResults() {
  const year = document.getElementById('sel-year').value.trim();
  const entries = [];

  for (const sub of currentSubjects) {
    const intInput = document.getElementById(`int-${sub.id}`);
    const extInput = document.getElementById(`ext-${sub.id}`);
    if (!intInput || !extInput) continue;

    const internal = intInput.value.trim();
    const external = extInput.value.trim();
    if (internal === '' && external === '') continue; // skip blank rows

    entries.push({
      student_id: selectedStudent.id,
      subject_id: sub.id,
      internal_marks: parseFloat(internal) || 0,
      external_marks: parseFloat(external) || 0,
      academic_year: year,
    });
  }

  if (entries.length === 0) {
    showToast('No marks entered.', 'warning');
    return;
  }

  setLoading('save-results-btn', true, 'Saving...');
  try {
    const res = await apiFetch('/results/bulk', { method: 'POST', body: { entries } });
    showToast(`✅ ${res.saved} result(s) saved for ${selectedStudent.name}!`, 'success');

    // Refresh existing results
    const data = await apiFetch(`/results/student/${selectedStudent.id}?academic_year=${year}`);
    existingResults = {};
    (data?.results || []).forEach(r => { existingResults[r.subject_id] = r; });
    renderMarksGrid(year);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    setLoading('save-results-btn', false, '💾 Save All Results');
  }
}
