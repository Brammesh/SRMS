/**
 * js/admin/dashboard.js — Load metrics, render SVG insights and logs
 */

if (!requireAuth()) {
  window.location.href = '/index.html';
}

document.addEventListener('DOMContentLoaded', () => {
  loadDashboardData();
});

async function loadDashboardData() {
  try {
    const data = await apiFetch('/dashboard/stats');
    if (!data) return;

    // 1. Populate stats cards with animated counters
    animateCounter(document.getElementById('stat-students'), data.totalStudents);
    animateCounter(document.getElementById('stat-staff'), data.totalStaff);
    animateCounter(document.getElementById('stat-subjects'), data.totalSubjects);
    animateCounter(document.getElementById('stat-results'), data.totalResults);
    
    // Pass/Fail Rates
    animatePercentCounter('stat-pass-rate', data.passRate);
    animatePercentCounter('stat-fail-rate', data.failRate);

    // 2. Fetch academic year
    const years = await apiFetch('/results/academic-years');
    document.getElementById('dash-academic-year').textContent = `📅 ${(years && years[0]) || '2024-25'}`;

    // 3. Render Department Distribution (HTML bars)
    renderDeptChart(data.byDepartment);

    // 4. Render Subject Averages Chart (SVG)
    renderSubjectAverages(data.subjectAverages);

    // 5. Render Monthly Publications Chart (SVG)
    renderMonthlyStats(data.monthlyStats);

    // 6. Render Semester Performance Chart (SVG)
    renderSemesterPerformance(data.semesterPerformance);

    // 7. Render Top Performers List
    renderTopPerformers(data.topPerformers);

    // 8. Render Activity Feed
    renderActivityFeed(data.recentActivity);

  } catch (err) {
    showToast('Failed to load dashboard statistics: ' + err.message, 'error');
  }
}

// Animate percentage text values
function animatePercentCounter(elId, target) {
  const el = document.getElementById(elId);
  if (!el) return;
  let current = 0;
  const duration = 1000;
  const step = (target / duration) * 16;
  const run = () => {
    current = Math.min(current + step, target);
    el.textContent = current.toFixed(1) + '%';
    if (current < target) requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
}

// Render HTML bar chart for departments
function renderDeptChart(items) {
  const container = document.getElementById('dept-chart');
  if (!container || !items || items.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No department data</p></div>';
    return;
  }

  const maxVal = Math.max(...items.map(i => i.count));
  container.innerHTML = items.map(d => `
    <div class="bar-row">
      <div class="bar-label">${d.department}</div>
      <div class="bar-track"><div class="bar-fill" data-width="${(d.count / maxVal) * 100}"></div></div>
      <div class="bar-value">${d.count}</div>
    </div>
  `).join('');

  setTimeout(() => {
    container.querySelectorAll('.bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.width + '%';
    });
  }, 100);
}

// Render Subject Averages SVG horizontal bar chart
function renderSubjectAverages(items) {
  const svg = document.getElementById('subject-averages-svg');
  if (!svg) return;

  if (!items || items.length === 0) {
    svg.innerHTML = `<text x="50%" y="50%" fill="var(--text-secondary)" text-anchor="middle" font-size="12">No subject average data</text>`;
    return;
  }

  svg.setAttribute('viewBox', '0 0 500 240');
  
  const width = 500;
  const height = 240;
  const paddingLeft = 70;
  const paddingRight = 45;
  const chartWidth = width - paddingLeft - paddingRight;
  const rowHeight = 24;
  const gap = 6;

  let content = '';

  items.slice(0, 7).forEach((item, idx) => {
    const y = 15 + idx * (rowHeight + gap);
    const barWidth = (item.avg_marks / 100) * chartWidth;

    // Draw row background track
    content += `<rect x="${paddingLeft}" y="${y}" width="${chartWidth}" height="${rowHeight}" rx="4" fill="var(--bg-hover)" opacity="0.4" />`;
    
    // Draw row progress fill
    content += `<rect x="${paddingLeft}" y="${y}" width="${barWidth}" height="${rowHeight}" rx="4" fill="url(#blueGradient)" style="transition: width 1.2s ease;">
      <animate attributeName="width" from="0" to="${barWidth}" dur="1s" fill="freeze" />
    </rect>`;

    // Label (Subject Code)
    content += `<text x="${paddingLeft - 10}" y="${y + 15}" fill="var(--text-secondary)" font-size="10.5" font-family="Helvetica" font-weight="bold" text-anchor="end">${item.subject_code}</text>`;
    
    // Value (Avg Marks)
    content += `<text x="${paddingLeft + barWidth + 8}" y="${y + 15}" fill="var(--text-secondary)" font-size="10" font-family="Helvetica" font-weight="bold">${item.avg_marks}</text>`;
  });

  // Add gradient definitions
  svg.innerHTML = `
    <defs>
      <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#4F8EF7" />
        <stop offset="100%" stop-color="#2563eb" />
      </linearGradient>
    </defs>
    ${content}
  `;
}

// Render Monthly publications line chart
function renderMonthlyStats(items) {
  const svg = document.getElementById('monthly-publications-svg');
  if (!svg) return;

  if (!items || items.length === 0) {
    svg.innerHTML = `<text x="50%" y="50%" fill="var(--text-secondary)" text-anchor="middle" font-size="12">No monthly publishing stats</text>`;
    return;
  }

  svg.setAttribute('viewBox', '0 0 500 240');
  
  const w = 500;
  const h = 240;
  const padL = 40;
  const padR = 20;
  const padT = 30;
  const padB = 30;
  
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const maxVal = Math.max(...items.map(i => i.count), 5);
  
  // Calculate points
  const points = items.map((item, idx) => {
    const x = padL + (idx / (items.length - 1 || 1)) * chartW;
    const y = padT + chartH - (item.count / maxVal) * chartH;
    return { x, y, label: item.month, val: item.count };
  });

  let content = '';

  // Draw grid lines
  for (let i = 0; i <= 4; i++) {
    const yGrid = padT + (i / 4) * chartH;
    const gridVal = Math.round(maxVal - (i / 4) * maxVal);
    content += `<line x1="${padL}" y1="${yGrid}" x2="${w - padR}" y2="${yGrid}" stroke="var(--border-color)" stroke-width="0.5" stroke-dasharray="3 3" />`;
    content += `<text x="${padL - 8}" y="${yGrid + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end">${gridVal}</text>`;
  }

  // Draw line path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  let areaD = `M ${points[0].x} ${padT + chartH} L ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    pathD += ` L ${points[i].x} ${points[i].y}`;
    areaD += ` L ${points[i].x} ${points[i].y}`;
  }
  areaD += ` L ${points[points.length - 1].x} ${padT + chartH} Z`;

  // Add Area Fill
  content += `<path d="${areaD}" fill="url(#areaGrad)" opacity="0.15" />`;
  
  // Add Line
  content += `<path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="2.5" />`;

  // Draw points & labels
  points.forEach(p => {
    content += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--background)" stroke="var(--accent)" stroke-width="2" />`;
    // Label x-axis
    content += `<text x="${p.x}" y="${h - 10}" fill="var(--text-secondary)" font-size="9" text-anchor="middle">${p.label}</text>`;
    // Value bubble on top of point
    content += `<text x="${p.x}" y="${p.y - 8}" fill="var(--text-secondary)" font-size="8.5" font-weight="bold" text-anchor="middle">${p.val}</text>`;
  });

  svg.innerHTML = `
    <defs>
      <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="var(--accent)" />
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
      </linearGradient>
    </defs>
    ${content}
  `;
}

// Render Semester Average marks vertical bar chart
function renderSemesterPerformance(items) {
  const svg = document.getElementById('semester-performance-svg');
  if (!svg) return;

  if (!items || items.length === 0) {
    svg.innerHTML = `<text x="50%" y="50%" fill="var(--text-secondary)" text-anchor="middle" font-size="12">No semester averages</text>`;
    return;
  }

  svg.setAttribute('viewBox', '0 0 400 220');
  
  const w = 400;
  const h = 220;
  const padL = 40;
  const padR = 20;
  const padT = 30;
  const padB = 35;

  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const maxVal = 100;
  const barWidth = Math.min(30, (chartW / items.length) * 0.5);
  const gap = (chartW - (barWidth * items.length)) / (items.length + 1);

  let content = '';

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const yGrid = padT + (i / 4) * chartH;
    const gridVal = 100 - i * 25;
    content += `<line x1="${padL}" y1="${yGrid}" x2="${w - padR}" y2="${yGrid}" stroke="var(--border-color)" stroke-width="0.5" />`;
    content += `<text x="${padL - 8}" y="${yGrid + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end">${gridVal}</text>`;
  }

  items.forEach((item, idx) => {
    const x = padL + gap + idx * (barWidth + gap);
    const barHeight = (item.avg_marks / maxVal) * chartH;
    const y = padT + chartH - barHeight;

    // Draw bar background track
    content += `<rect x="${x}" y="${padT}" width="${barWidth}" height="${chartH}" rx="3" fill="var(--bg-hover)" opacity="0.3" />`;

    // Draw active filled bar
    content += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="3" fill="var(--success)">
      <animate attributeName="height" from="0" to="${barHeight}" dur="0.8s" fill="freeze" />
      <animate attributeName="y" from="${padT + chartH}" to="${y}" dur="0.8s" fill="freeze" />
    </rect>`;

    // Semester Label (e.g. S4)
    content += `<text x="${x + barWidth/2}" y="${h - 15}" fill="var(--text-secondary)" font-size="9.5" font-family="Helvetica" font-weight="bold" text-anchor="middle">S${item.semester}</text>`;
    
    // Average mark label inside/top of bar
    content += `<text x="${x + barWidth/2}" y="${y - 6}" fill="var(--text-secondary)" font-size="9" font-family="Helvetica" font-weight="bold" text-anchor="middle">${item.avg_marks}</text>`;
  });

  svg.innerHTML = content;
}

// Render Top Performers list
function renderTopPerformers(items) {
  const container = document.getElementById('top-performers');
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No high performers recorded yet</p></div>';
    return;
  }

  const rankClasses = ['gold', 'silver', 'bronze'];
  
  container.innerHTML = items.map((p, idx) => {
    const rankClass = rankClasses[idx] || '';
    return `
      <div class="performer-item">
        <div class="performer-rank ${rankClass}">${idx + 1}</div>
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 0.88rem;">${p.name}</div>
          <div class="text-sm text-muted">${p.roll_number} · ${p.department} (S${p.semester})</div>
        </div>
        <div style="font-weight: 800; color: var(--accent); font-size: 1rem;">${p.cgpa}</div>
      </div>
    `;
  }).join('');
}

// Render Database Activity Feed
function renderActivityFeed(items) {
  const container = document.getElementById('recent-activity');
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No recent system operations logged</p></div>';
    return;
  }

  container.innerHTML = items.map(act => {
    // Format action descriptive tags
    let actionDesc = '';
    const cleanAction = (act.action || '').toUpperCase();
    
    if (cleanAction === 'CREATE') actionDesc = `Added a new ${act.entity_type}`;
    else if (cleanAction === 'UPDATE') actionDesc = `Updated ${act.entity_type} profile`;
    else if (cleanAction === 'DELETE') actionDesc = `Deleted ${act.entity_type}`;
    else if (cleanAction === 'PASSWORD_RESET') actionDesc = `Reset password for staff`;
    else if (cleanAction.startsWith('STATUS_CHANGE')) actionDesc = `Toggled staff status (${cleanAction.split(' ')[1] || ''})`;
    else if (cleanAction === 'BULK_SAVE') actionDesc = `Uploaded bulk result marksheet`;
    else actionDesc = `${act.action} operation on ${act.entity_type}`;

    const dotClass = ['CREATE', 'UPDATE', 'DELETE'].includes(cleanAction) ? cleanAction : 'CREATE';

    return `
      <div class="activity-item">
        <div class="activity-dot ${dotClass}"></div>
        <div style="flex: 1;">
          <div style="font-size: 0.85rem; font-weight: 500;">${actionDesc}</div>
          <div class="activity-time">
            <strong>${act.performed_by_username || 'system'}</strong> · ${new Date(act.created_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short' })}
          </div>
        </div>
      </div>
    `;
  }).join('');
}
