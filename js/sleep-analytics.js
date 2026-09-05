// ── SLEEP ANALYTICS ──
// Reads state.sleepHistory (built up nightly by logSleep(), see schedule.js)
// and renders the Sleep tab: this week's nights, week-over-week deltas, a
// weekly bedtime chart, and an 8-week trend. Pure read/render — logging
// itself still happens from the Schedule tab's Sleep Log box.

function shiftDate(dateStr, deltaDays) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + deltaDays);
  return d.toLocaleDateString('en-CA');
}

// `days` date strings ending at (and including) endDate, oldest first.
function sleepDateRange(endDate, days) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) dates.push(shiftDate(endDate, -i));
  return dates;
}

// Aligns history entries to a list of dates; null where nothing was logged.
function sleepWindowEntries(history, dates) {
  const byDate = Object.fromEntries(history.map(e => [e.date, e]));
  return dates.map(d => byDate[d] || null);
}

function computeSleepStats(entries) {
  const logged = entries.filter(Boolean);
  const counts = { ok: 0, late: 0, grace: 0 };
  if (!logged.length) return { nightsLogged: 0, avgClock: null, avgDuration: null, stdevClock: null, counts };
  logged.forEach(e => { if (counts[e.graceLevel] !== undefined) counts[e.graceLevel]++; });
  const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
  const clocks = logged.map(e => sleepClockMinutes(e.time)).filter(v => v != null);
  const durations = logged.map(e => e.durationMinutes).filter(v => v != null);
  const avgClock = avg(clocks);
  const avgDuration = avg(durations);
  const stdevClock = (avgClock != null && clocks.length)
    ? Math.sqrt(clocks.reduce((s, v) => s + Math.pow(v - avgClock, 2), 0) / clocks.length)
    : null;
  return { nightsLogged: logged.length, avgClock, avgDuration, stdevClock, counts };
}

function sleepConsistencyLabel(stdev) {
  if (stdev == null) return { label: '—', color: 'var(--muted)' };
  if (stdev <= 20) return { label: 'Very consistent', color: 'var(--success)' };
  if (stdev <= 45) return { label: 'Consistent', color: 'var(--accent3)' };
  if (stdev <= 75) return { label: 'Somewhat irregular', color: 'var(--accent4)' };
  return { label: 'Irregular', color: 'var(--danger)' };
}

function graceLevelColor(level) {
  return level === 'ok' ? 'var(--success)' : level === 'late' ? 'var(--accent4)' : '#ff9f6a';
}

function renderSleepAnalytics() {
  const emptyEl = document.getElementById('sleep-analytics-empty');
  const bodyEl = document.getElementById('sleep-analytics-body');
  if (!emptyEl || !bodyEl) return;
  const history = state.sleepHistory || [];
  if (!history.length) { emptyEl.style.display = ''; bodyEl.style.display = 'none'; return; }
  emptyEl.style.display = 'none';
  bodyEl.style.display = '';

  const thisWeekDates = sleepDateRange(today(), 7);
  const prevWeekDates = sleepDateRange(shiftDate(today(), -7), 7);
  const thisWeekEntries = sleepWindowEntries(history, thisWeekDates);
  const prevWeekEntries = sleepWindowEntries(history, prevWeekDates);
  const thisStats = computeSleepStats(thisWeekEntries);
  const prevStats = computeSleepStats(prevWeekEntries);

  renderSleepStatCards(thisStats, prevStats);
  renderSleepWeekList(thisWeekDates, thisWeekEntries);
  renderSleepWeeklyChart(thisWeekDates, thisWeekEntries);
  renderSleepTrendChart(history);
}

function renderSleepStatCards(thisStats, prevStats) {
  const el = document.getElementById('sleep-stats-grid');
  if (!el) return;

  const avgBedtimeLabel = thisStats.avgClock != null ? sleepClockMinutesToTimeLabel(Math.round(thisStats.avgClock)) : '—';

  let deltaLabel = 'not enough data', deltaColor = 'var(--muted)';
  if (thisStats.avgClock != null && prevStats.avgClock != null) {
    const deltaMin = Math.round(thisStats.avgClock - prevStats.avgClock);
    if (deltaMin === 0) deltaLabel = 'same as last week';
    else if (deltaMin < 0) { deltaLabel = `${Math.abs(deltaMin)}m earlier than last week`; deltaColor = 'var(--success)'; }
    else { deltaLabel = `${deltaMin}m later than last week`; deltaColor = 'var(--accent2)'; }
  }

  const avgDurationLabel = thisStats.avgDuration != null ? fmtMinutesAsHM(Math.round(thisStats.avgDuration)) : '—';
  const consistency = sleepConsistencyLabel(thisStats.stdevClock);

  let debtLabel = '—', debtColor = 'var(--muted)';
  if (thisStats.avgDuration != null && thisStats.nightsLogged > 0) {
    const totalSlept = thisStats.avgDuration * thisStats.nightsLogged;
    const target = thisStats.nightsLogged * 7 * 60;
    const debt = totalSlept - target;
    debtLabel = (debt >= 0 ? '+' : '') + fmtMinutesAsHM(Math.round(debt));
    debtColor = debt >= 0 ? 'var(--success)' : 'var(--danger)';
  }

  el.innerHTML = `
    <div class="stat-card"><div class="stat-label">Avg Bedtime</div><div class="stat-value" style="color:var(--accent3)">${avgBedtimeLabel}</div><div class="stat-sub" style="color:${deltaColor}">${deltaLabel}</div></div>
    <div class="stat-card"><div class="stat-label">Avg Duration</div><div class="stat-value" style="color:var(--accent)">${avgDurationLabel}</div><div class="stat-sub">last 7 nights</div></div>
    <div class="stat-card"><div class="stat-label">Consistency</div><div class="stat-value" style="color:${consistency.color}">${consistency.label}</div><div class="stat-sub">${thisStats.stdevClock != null ? '±' + Math.round(thisStats.stdevClock) + 'm spread' : 'not enough data'}</div></div>
    <div class="stat-card"><div class="stat-label">Sleep Debt</div><div class="stat-value" style="color:${debtColor}">${debtLabel}</div><div class="stat-sub">vs 7h/night target</div></div>
    <div class="stat-card"><div class="stat-label">Nights Logged</div><div class="stat-value" style="color:var(--accent4)">${thisStats.nightsLogged}</div><div class="stat-sub">out of 7</div></div>
  `;
}

function renderSleepWeekList(dates, entries) {
  const el = document.getElementById('sleep-week-list');
  if (!el) return;
  const rows = dates.map((d, i) => ({ date: d, entry: entries[i] })).reverse();
  el.innerHTML = rows.map(({ date, entry }) => {
    const dayLabel = new Date(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    if (!entry) return `<div class="sleep-night-row"><span class="sleep-night-date">${dayLabel}</span><span class="sleep-night-empty">not logged</span></div>`;
    const durLabel = entry.durationMinutes != null ? fmtMinutesAsHM(entry.durationMinutes) : '';
    const badgeClass = entry.graceLevel === 'ok' ? 'ok' : entry.graceLevel === 'late' ? 'late' : 'grace';
    const badgeText = entry.graceLevel === 'ok' ? 'CLEAN' : entry.graceLevel === 'late' ? 'LATE' : 'GRACE';
    return `<div class="sleep-night-row">
      <span class="sleep-night-date">${dayLabel}</span>
      <span class="sleep-night-time">${esc(entry.time)}</span>
      <span class="sleep-night-dur">${durLabel}</span>
      <span class="sleep-night-badge ${badgeClass}">${badgeText}</span>
    </div>`;
  }).join('');
}

function renderSleepWeeklyChart(dates, entries) {
  const el = document.getElementById('sleep-week-chart');
  if (!el) return;
  const clocks = entries.map(e => e ? sleepClockMinutes(e.time) : null);
  const maxVal = Math.max(120, ...clocks.filter(v => v != null));
  el.innerHTML = dates.map((d, i) => {
    const e = entries[i], cm = clocks[i];
    const dayLabel = new Date(d).toLocaleDateString('en-GB', { weekday: 'short' });
    if (!e || cm == null) {
      return `<div class="sleep-chart-col" title="${dayLabel}: not logged">
        <div class="sleep-chart-bar-wrap"><div class="sleep-chart-bar sleep-chart-bar-empty"></div></div>
        <div class="sleep-chart-label">${dayLabel}</div>
      </div>`;
    }
    const heightPct = Math.round((cm / maxVal) * 100);
    return `<div class="sleep-chart-col" title="${dayLabel}: ${esc(e.time)}">
      <div class="sleep-chart-bar-wrap"><div class="sleep-chart-bar" style="height:${heightPct}%;background:${graceLevelColor(e.graceLevel)}"></div></div>
      <div class="sleep-chart-label">${dayLabel}</div>
    </div>`;
  }).join('');
}

function renderSleepTrendChart(history) {
  const el = document.getElementById('sleep-trend');
  if (!el) return;
  const weeks = [];
  for (let w = 7; w >= 0; w--) {
    const endDate = shiftDate(today(), -7 * w);
    const dates = sleepDateRange(endDate, 7);
    const stats = computeSleepStats(sleepWindowEntries(history, dates));
    weeks.push({ label: fmtDate(endDate).slice(0, 5), stats });
  }
  const maxDuration = Math.max(60, ...weeks.map(w => w.stats.avgDuration || 0));
  const maxClock = Math.max(120, ...weeks.map(w => w.stats.avgClock || 0));
  const bars = weeks.map(w => {
    const durH = w.stats.avgDuration != null ? Math.round((w.stats.avgDuration / maxDuration) * 100) : 0;
    const clockH = w.stats.avgClock != null ? Math.round((w.stats.avgClock / maxClock) * 100) : 0;
    const title = w.stats.nightsLogged
      ? `${w.label}: avg bedtime ${sleepClockMinutesToTimeLabel(Math.round(w.stats.avgClock))}, avg sleep ${fmtMinutesAsHM(Math.round(w.stats.avgDuration))}`
      : `${w.label}: no data`;
    return `<div class="sleep-trend-col" title="${title}">
      <div class="sleep-trend-bar-pair">
        <div class="sleep-trend-bar sleep-trend-bar-duration" style="height:${durH}%"></div>
        <div class="sleep-trend-bar sleep-trend-bar-bedtime" style="height:${clockH}%"></div>
      </div>
      <div class="sleep-trend-label">${w.label}</div>
    </div>`;
  }).join('');
  el.innerHTML = `<div class="sleep-trend-legend">Duration (left) vs bedtime lateness (right) — 8-week rolling</div><div class="sleep-trend-bars">${bars}</div>`;
}
