// ============================================================
//  ClickSafe — dashboard.js
//  Features 15–20: Overview, Heatmap, Pie, Timeline,
//                  Top Domains, Feature Status, Dark Pattern Log
// ============================================================

const CIRCUMFERENCE = 282.74; // 2π × 45

let donutChart    = null;
let timelineChart = null;
let allDpLog      = [];
let activeFilter  = 'all';

// ── Boot ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadAll();
  initFilterButtons();
  document.getElementById('btn-clear').addEventListener('click', clearAllData);
});

// ── Load everything from chrome.storage ─────────────────────
function loadAll() {
  chrome.storage.local.get(null, data => {
    renderOverview(data);
    renderHeatmap(data);
    renderDonut(data);
    renderTimeline(data);
    renderTopDomains(data);
    renderFeatureStatus(data);
    renderDarkPatternLog(data);
    document.getElementById('last-updated').textContent =
      'Updated ' + new Date().toLocaleTimeString();
  });
}

// ── FEATURE 15: Overview Stats ───────────────────────────────
function renderOverview(data) {
  const cookieTrackers  = data.totalCookieTrackersFound || 0;
  const trackerScripts  = data.totalTrackersFound       || 0;
  const mixedContent    = data.totalMixedContent        || 0;
  const linksChecked    = data.totalLinksChecked         || 0;
  const darkPatterns    = data.totalDarkPatterns         || 0;
  const downloads       = data.totalDownloadsScanned     || 0;
  const httpsRedirects  = data.totalHttpsRedirects       || 0;
  const blocked         = data.totalThreatsBlocked       || 0;

  setText('dash-cookie-trackers', cookieTrackers);
  setText('dash-tracker-scripts', trackerScripts);
  setText('dash-mixed',           mixedContent);
  setText('dash-links',           linksChecked);
  setText('dash-dark-patterns',   darkPatterns);
  setText('dash-downloads',       downloads);
  setText('dash-https',           httpsRedirects);
  setText('dash-blocked',         blocked);

  // FIX F11: detect current tab's HTTPS status from stored tabUrl keys so the
  // dashboard score matches the side panel (which applies a -30 HTTP penalty).
  const tabUrlKeys = Object.keys(data).filter(k => k.startsWith('tabUrl_'));
  let isHttps = true; // default safe — penalise only when we know it's HTTP
  if (tabUrlKeys.length > 0) {
    // Use the most-recently-set tabUrl key (highest tabId as rough proxy)
    const latestKey = tabUrlKeys.sort((a, b) => {
      const idA = parseInt(a.split('_')[1]) || 0;
      const idB = parseInt(b.split('_')[1]) || 0;
      return idB - idA;
    })[0];
    isHttps = (data[latestKey] || '').startsWith('https://');
  }

  const score = computeScore({ isHttps, cookieTrackers, trackerScripts, mixedContent });
  renderGauge(score);
}

function computeScore({ isHttps = true, cookieTrackers, trackerScripts, mixedContent }) {
  let s = 100;
  if (!isHttps)  s -= 30;                             // FIX F11: apply HTTP penalty
  s -= Math.min(cookieTrackers * 5, 30);
  s -= Math.min(trackerScripts * 4, 20);
  s -= Math.min(mixedContent   * 5, 20);
  return Math.max(0, Math.min(100, Math.round(s)));
}

function renderGauge(score) {
  const arc     = document.getElementById('dash-gauge-arc');
  const num     = document.getElementById('dash-score');
  const label   = document.getElementById('dash-score-label');
  const verdict = document.getElementById('dash-score-verdict');
  const bar     = document.getElementById('dash-score-bar');

  let color, lbl, desc;
  if (score >= 80) {
    color = '#16a34a'; lbl = 'Safe';          desc = 'Your browsing looks clean!';
  } else if (score >= 50) {
    color = '#d97706'; lbl = 'Moderate Risk'; desc = 'Some trackers detected.';
  } else {
    color = '#dc2626'; lbl = 'High Risk';     desc = 'Significant threats found.';
  }

  arc.style.strokeDashoffset = CIRCUMFERENCE * (1 - score / 100);
  arc.style.stroke = color;
  num.textContent  = score;
  num.style.color  = color;
  label.textContent   = lbl;
  label.style.color   = color;
  verdict.textContent = desc;
  bar.style.width     = score + '%';
  bar.style.background = color;
}


// ── FEATURE 16: 7-Day Heatmap ────────────────────────────────
function renderHeatmap(data) {
  const grid = document.getElementById('heatmap-grid');
  grid.innerHTML = '';

  // Build day buckets for last 7 days
  const days = [];
  const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({
      date: d,
      label: dayLabels[d.getDay()],
      dateStr: d.toDateString(),
      count: 0
    });
  }

  // Set day labels
  days.forEach((d, i) => {
    const el = document.getElementById(`hm-d${i}`);
    if (el) el.textContent = d.label;
  });

  // Count threats per day from logs
  const logs = [
    ...(data.trackerLog      || []),
    ...(data.darkPatternLog  || []),
  ];

  logs.forEach(entry => {
    const ts = entry.timestamp || entry.data?.timestamp;
    if (!ts) return;
    const entryDate = new Date(ts).toDateString();
    const day = days.find(d => d.dateStr === entryDate);
    if (day) {
      day.count += (entry.trackers?.length || entry.patterns?.length || entry.count || 1);
    }
  });

  // Also count from mixedContent
  if (data.mixedContentLog) {
    data.mixedContentLog.forEach(entry => {
      const entryDate = new Date(entry.timestamp).toDateString();
      const day = days.find(d => d.dateStr === entryDate);
      if (day) day.count += (entry.resources?.length || 1);
    });
  }

  // FIX F16: also count cookie tracker events (previously missing from heatmap)
  if (data.cookieTrackerLog) {
    data.cookieTrackerLog.forEach(entry => {
      const entryDate = new Date(entry.timestamp).toDateString();
      const day = days.find(d => d.dateStr === entryDate);
      if (day) day.count += (entry.count || 1);
    });
  }

  const max = Math.max(...days.map(d => d.count), 1);

  days.forEach(day => {
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';

    const intensity = day.count / max;
    if (day.count === 0) {
      cell.style.background = '#f3f4f6';
      cell.style.border = '1px solid #e5e7eb';
    } else if (intensity < 0.25) {
      cell.style.background = 'rgba(239,68,68,0.2)';
    } else if (intensity < 0.5) {
      cell.style.background = 'rgba(239,68,68,0.45)';
    } else if (intensity < 0.75) {
      cell.style.background = 'rgba(239,68,68,0.7)';
    } else {
      cell.style.background = 'rgba(239,68,68,1)';
    }

    const tip = document.createElement('div');
    tip.className = 'tooltip';
    tip.textContent = `${day.label} — ${day.count} threat${day.count !== 1 ? 's' : ''}`;
    cell.appendChild(tip);
    grid.appendChild(cell);
  });
}


// ── FEATURE 17: Threat Breakdown Donut ───────────────────────
function renderDonut(data) {
  const cookieTrackers = data.totalCookieTrackersFound || 0;
  const trackerScripts = data.totalTrackersFound       || 0;
  const mixedContent   = data.totalMixedContent        || 0;
  const darkPatterns   = data.totalDarkPatterns        || 0;
  const linksBlocked   = data.totalThreatsBlocked      || 0;

  const total = cookieTrackers + trackerScripts + mixedContent + darkPatterns + linksBlocked;
  setText('donut-total', total);

  const labels = ['Cookie Trackers', 'Tracker Scripts', 'Mixed Content', 'Dark Patterns', 'Links Blocked'];
  const values = [cookieTrackers, trackerScripts, mixedContent, darkPatterns, linksBlocked];
  const colors = ['#dc2626', '#ea580c', '#0891b2', '#7c3aed', '#ec4899'];

  const ctx = document.getElementById('donut-chart').getContext('2d');

  if (donutChart) donutChart.destroy();

  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.map(c => c + 'cc'),
        borderColor: colors,
        borderWidth: 1.5,
        hoverOffset: 6
      }]
    },
    options: {
      cutout: '72%',
      plugins: { legend: { display: false }, tooltip: {
        callbacks: {
          label: ctx => ` ${ctx.label}: ${ctx.raw}`
        }
      }},
      animation: { animateRotate: true, duration: 800 }
    }
  });

  // Legend
  const legend = document.getElementById('donut-legend');
  legend.innerHTML = labels.map((l, i) => `
    <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#374151;">
      <div style="width:8px;height:8px;border-radius:2px;background:${colors[i]};flex-shrink:0;"></div>
      ${l}
    </div>
  `).join('');
}


// ── FEATURE 19: 24h Timeline Line Chart ─────────────────────
function renderTimeline(data) {
  // Build 24 hourly buckets
  const buckets = Array(24).fill(0);
  const now = new Date();

  const allLogs = [
    ...(data.trackerLog        || []),
    ...(data.darkPatternLog    || []),
    ...(data.mixedContentLog   || []),
    ...(data.cookieTrackerLog  || []),  // FIX F16/F19: cookie events now in timeline too
  ];

  allLogs.forEach(entry => {
    const ts = entry.timestamp || entry.data?.timestamp;
    if (!ts) return;
    const entryDate = new Date(ts);
    const diffHours = (now - entryDate) / (1000 * 60 * 60);
    if (diffHours <= 24) {
      const hour = Math.floor(diffHours);
      buckets[23 - hour] += (
        entry.trackers?.length ||
        entry.patterns?.length ||
        entry.resources?.length ||
        entry.count || 1
      );
    }
  });

  const labels = Array(24).fill(0).map((_, i) => {
    const h = new Date(now - (23 - i) * 3600000);
    return h.getHours() + ':00';
  });

  const ctx = document.getElementById('timeline-chart').getContext('2d');
  if (timelineChart) timelineChart.destroy();

  timelineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Threats',
        data: buckets,
        borderColor: '#1e40af',
        backgroundColor: 'rgba(30,64,175,0.07)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#1e40af',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: '#9ca3af', font: { size: 9 }, maxTicksLimit: 8 },
          grid: { color: 'rgba(0,0,0,0.06)' }
        },
        y: {
          ticks: { color: '#9ca3af', font: { size: 9 } },
          grid: { color: 'rgba(0,0,0,0.06)' },
          beginAtZero: true
        }
      }
    }
  });
}


// ── FEATURE 18: Top Tracking Domains ────────────────────────
function renderTopDomains(data) {
  const container = document.getElementById('domain-list');
  const domainCounts = {};

  // Count from tracker log (script trackers)
  (data.trackerLog || []).forEach(entry => {
    (entry.trackers || []).forEach(t => {
      const domain = t.tracker || t.domain || 'unknown';
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    });
  });

  // FIX F18: count from persistent cookieTrackerLog instead of ephemeral
  // cookieData_* keys (those are wiped when a tab closes, so closed-tab
  // cookie domains were lost from this chart).
  (data.cookieTrackerLog || []).forEach(entry => {
    (entry.trackers || []).forEach(t => {
      const domain = (t.domain || '').replace(/^\./, '');
      if (domain) domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    });
  });

  // Also include any still-open tabs (cookieData_* keys still present)
  Object.keys(data).forEach(key => {
    if (key.startsWith('cookieData_')) {
      const cookieData = data[key];
      (cookieData.trackers || []).forEach(t => {
        const domain = (t.cookie?.domain || '').replace(/^\./, '');
        if (domain) domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      });
    }
  });

  const sorted = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        No tracker data yet — browse some sites!
      </div>`;
    return;
  }

  const max = sorted[0][1];
  const colors = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#a855f7','#ec4899','#64748b','#94a3b8'];

  container.innerHTML = sorted.map(([domain, count], i) => `
    <div class="domain-row">
      <div class="domain-name" title="${domain}">${domain}</div>
      <div class="domain-bar-wrap">
        <div class="domain-bar-fill" style="width:${(count/max*100).toFixed(1)}%;background:${colors[i % colors.length]};"></div>
      </div>
      <div class="domain-count">${count}</div>
    </div>
  `).join('');
}


// ── Feature Status ───────────────────────────────────────────
function renderFeatureStatus(data) {
  const settings = data.settings || {};

  const isOn = key => settings[key] !== false;

  setStatusDot('fs-https',        isOn('httpsEnabled'));
  setStatusDot('fs-cookies',      isOn('cookiesEnabled'));
  setStatusDot('fs-links',        isOn('linksEnabled'));
  setStatusDot('fs-downloads',    isOn('downloadsEnabled'));
  setStatusDot('fs-darkpatterns', isOn('darkPatternsEnabled'));

  setText('fs-https-count',     (data.totalHttpsRedirects   || 0) + ' redirects');
  setText('fs-cookies-count',   (data.totalCookieTrackersFound || 0) + ' caught');
  setText('fs-links-count',     (data.totalLinksChecked      || 0) + ' checked');
  setText('fs-downloads-count', (data.totalDownloadsScanned  || 0) + ' scanned');
  setText('fs-dp-count',        (data.totalDarkPatterns      || 0) + ' caught');
  setText('fs-mixed-count',     (data.totalMixedContent      || 0) + ' found');
}

function setStatusDot(id, isOn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'status-dot ' + (isOn ? 'on' : 'off');
}


// ── FEATURE 20: Dark Pattern Log ────────────────────────────
function renderDarkPatternLog(data) {
  allDpLog = [];

  (data.darkPatternLog || []).forEach(entry => {
    const pageUrl = entry.pageUrl || '—';
    const ts      = entry.timestamp || '';
    (entry.patterns || []).forEach(p => {
      allDpLog.push({ type: p.type, text: p.text, url: pageUrl, timestamp: ts });
    });
  });

  // newest first
  allDpLog.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  renderDpTable();
}

function renderDpTable() {
  const tbody = document.getElementById('dp-log-body');

  const filtered = activeFilter === 'all'
    ? allDpLog
    : allDpLog.filter(r => r.type === activeFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4">
      <div class="empty-state">
        <div class="empty-icon">✨</div>
        No dark patterns logged yet
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.slice(0, 100).map(row => {
    const tag   = getPatternTag(row.type);
    const site  = (() => { try { return new URL(row.url).hostname; } catch { return row.url || '—'; } })();
    const time  = row.timestamp ? new Date(row.timestamp).toLocaleString() : '—';
    const text  = (row.text || '').substring(0, 60);

    return `<tr>
      <td><span class="pattern-tag ${tag.cls}">${row.type || 'Unknown'}</span></td>
      <td style="font-family:'Courier New',monospace;font-size:11px;color:#6b7280;">${site}</td>
      <td style="color:#6b7280;font-size:11px;">${text}${row.text?.length > 60 ? '…' : ''}</td>
      <td style="font-family:'Courier New',monospace;font-size:10px;color:#9ca3af;white-space:nowrap;">${time}</td>
    </tr>`;
  }).join('');
}

function getPatternTag(type) {
  if (!type) return { cls: 'tag-unknown' };
  if (type.includes('Urgency'))    return { cls: 'tag-urgency' };
  if (type.includes('Shaming'))    return { cls: 'tag-shaming' };
  if (type.includes('Countdown'))  return { cls: 'tag-countdown' };
  if (type.includes('Checkbox'))   return { cls: 'tag-checkbox' };
  if (type.includes('Cookie'))     return { cls: 'tag-cookie' };
  return { cls: 'tag-unknown' };
}

function initFilterButtons() {
  document.getElementById('dp-filters').addEventListener('click', e => {
    const btn = e.target.closest('.dp-filter');
    if (!btn) return;
    document.querySelectorAll('.dp-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.type;
    renderDpTable();
  });
}


// ── Clear all data ───────────────────────────────────────────
function clearAllData() {
  if (!confirm('Clear all ClickSafe stats? This cannot be undone.')) return;
  chrome.storage.local.clear(() => {
    loadAll();
    alert('All data cleared!');
  });
}


// ── Helpers ──────────────────────────────────────────────────
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}