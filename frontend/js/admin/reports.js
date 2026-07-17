/**
 * admin/reports.js — Class-wise result reports
 */

requireAuth();

let reportData = [];

async function loadReport() {
  const dept = document.getElementById('r-dept').value;
  const sem  = document.getElementById('r-sem').value;
  const year = document.getElementById('r-year').value.trim();

  if (!dept || !sem || !year) {
    showToast('Please select department, semester, and year.', 'warning');
    return;
  }

  document.getElementById('report-empty').classList.add('hidden');
  document.getElementById('report-table-wrap').classList.add('hidden');
  document.getElementById('report-loading').classList.remove('hidden');
  document.getElementById('report-summary').classList.add('hidden');

  setLoading('load-report-btn', true, 'Loading...');

  try {
    reportData = await apiFetch(`/results/class?department=${dept}&semester=${sem}&academic_year=${year}`);

    if (!reportData || reportData.length === 0) {
      document.getElementById('report-empty').classList.remove('hidden');
      document.getElementById('report-empty').querySelector('h3').textContent = 'No Results Found';
      document.getElementById('report-empty').querySelector('p').textContent = 'No results found for the selected filters.';
      return;
    }

    // Summary
    const passAll = reportData.filter(s => s.overall_status === 'PASS').length;
    const failSome = reportData.filter(s => s.overall_status === 'FAIL').length;
    const avgCGPA = reportData.filter(s => s.cgpa > 0).reduce((sum, s) => sum + s.cgpa, 0) / (reportData.filter(s => s.cgpa > 0).length || 1);

    document.getElementById('rpt-total').textContent = reportData.length;
    document.getElementById('rpt-pass').textContent  = passAll;
    document.getElementById('rpt-fail').textContent  = failSome;
    document.getElementById('rpt-avgcgpa').textContent = avgCGPA.toFixed(2);
    document.getElementById('report-summary').classList.remove('hidden');

    document.getElementById('report-title').textContent = `${dept} — Sem ${sem} — ${year}`;

    // Render rows
    const rowsEl = document.getElementById('report-rows');
    rowsEl.innerHTML = reportData.map((s, i) => `
      <div class="class-result-row">
        <div style="color:var(--text-muted);font-size:.8rem;">${i+1}</div>
        <div>
          <div style="font-weight:600;font-size:.875rem;">${s.name}</div>
          <div class="text-xs text-muted">${s.class} · ${s.batch}</div>
        </div>
        <div style="text-align:center;">
          <code style="background:var(--bg-hover);padding:2px 6px;border-radius:4px;font-size:.78rem;">${s.roll_number}</code>
        </div>
        <div style="text-align:center;color:var(--text-secondary);">${s.results.length}</div>
        <div style="text-align:center;">
          <span class="cgpa-badge">${s.cgpa}</span>
        </div>
        <div style="text-align:center;">${badgeStatus(s.overall_status)}</div>
        <div style="text-align:center;">
          <a href="/api/pdf/marksheet/${s.id}?academic_year=${year}"
             target="_blank"
             class="btn btn-secondary btn-sm"
             onclick="downloadPDF(event, ${s.id}, '${year}')">📄 PDF</a>
        </div>
      </div>
    `).join('');

    document.getElementById('report-table-wrap').classList.remove('hidden');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
    document.getElementById('report-empty').classList.remove('hidden');
  } finally {
    document.getElementById('report-loading').classList.add('hidden');
    setLoading('load-report-btn', false, '📊 Generate Report');
  }
}

async function downloadPDF(e, studentId, year) {
  e.preventDefault();
  const token = getToken();
  const url   = `/api/pdf/marksheet/${studentId}?academic_year=${year}`;

  try {
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) { showToast('PDF generation failed.', 'error'); return; }

    const blob = await res.blob();
    const fileURL = URL.createObjectURL(blob);

    // Open PDF in a new tab for inline viewing
    window.open(fileURL, '_blank');

    // Programmatically trigger download
    const link = document.createElement('a');
    link.href = fileURL;
    link.download = `marksheet_${studentId}_${year}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('PDF opened and downloaded successfully!', 'success');
    setTimeout(() => URL.revokeObjectURL(fileURL), 1000);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

function printReport() {
  window.print();
}
