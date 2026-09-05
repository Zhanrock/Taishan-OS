// ── SLEEP GRACE SYSTEM ──
// Rules:
//   18:00-23:59 -> ok    (before midnight, full streak)
//   00:00-02:00 -> late  (LATE NIGHT, yellow badge, streak counts)
//   02:01-07:59 -> grace (GRACE DAY, orange badge, streak preserved)
//   08:00-17:59 -> ok    (daytime nap edge case)
function sleepGraceLevel(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (h >= 18) return 'ok';
  if (h < 2 || (h === 2 && m === 0)) return 'late';
  if (h < 8) return 'grace';
  return 'ok';
}

function sleepDurationMinutes(sleepTimeStr) {
  if (!sleepTimeStr) return null;
  const [sh, sm] = sleepTimeStr.split(':').map(Number);
  const wakeMinutes = 8 * 60, sleepMinutes = sh * 60 + sm;
  const diff = sh >= 18 ? (24 * 60 - sleepMinutes) + wakeMinutes : wakeMinutes - sleepMinutes;
  if (diff <= 0 || diff > 16 * 60) return null;
  return diff;
}

function sleepDuration(sleepTimeStr) {
  const diff = sleepDurationMinutes(sleepTimeStr);
  if (diff == null) return null;
  const hours = Math.floor(diff / 60), minutes = diff % 60;
  return minutes > 0 ? `~${hours}h ${minutes}m sleep` : `~${hours}h sleep`;
}

// Monotonic bedtime scale for averaging/charting: 18:00 -> 0, running forward
// through midnight to 17:59 the next day -> 1439. Lower = earlier bedtime.
function sleepClockMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return (h * 60 + m - 18 * 60 + 1440) % 1440;
}

function sleepClockMinutesToTimeLabel(cm) {
  if (cm == null) return '';
  const total = (cm + 18 * 60) % 1440;
  const h = Math.floor(total / 60), m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function fmtMinutesAsHM(mins) {
  if (mins == null) return '—';
  const sign = mins < 0 ? '-' : '';
  const h = Math.floor(Math.abs(mins) / 60), m = Math.round(Math.abs(mins) % 60);
  return m ? `${sign}${h}h ${m}m` : `${sign}${h}h`;
}

// ── SLEEP HISTORY (per-night log, unlike sleepLog which only keeps last night) ──
function upsertSleepHistoryEntry(entry) {
  const idx = state.sleepHistory.findIndex(e => e.date === entry.date);
  if (idx >= 0) state.sleepHistory[idx] = entry; else state.sleepHistory.push(entry);
  state.sleepHistory.sort((a, b) => a.date.localeCompare(b.date));
}

async function persistSleepHistory() {
  setSyncStatus('syncing');
  await db.from('habits').upsert({
    user_id: currentUser.id, habit_id: 'sleepHistory',
    count: today(), last_checked: JSON.stringify(state.sleepHistory), history: []
  }, { onConflict: 'user_id,habit_id' });
  setSyncStatus('synced');
}

function loadSleepHistoryFromRow(row) {
  try {
    const parsed = JSON.parse(row.last_checked);
    if (Array.isArray(parsed)) state.sleepHistory = parsed;
  } catch (e) {}
}

async function logSleep() {
  const timeVal = document.getElementById('sleepTimeInput').value;
  if (!timeVal) { notify('\u26A0 Sleep Log', 'Please enter a time', 'var(--accent2)'); return; }
  const grace = sleepGraceLevel(timeVal), logData = { date: today(), time: timeVal, graceLevel: grace };
  state.sleepLog = logData;
  setSyncStatus('syncing');
  await db.from('habits').upsert({ user_id: currentUser.id, habit_id: 'sleepLog', count: today(), last_checked: JSON.stringify(logData), history: [] }, { onConflict: 'user_id,habit_id' });
  setSyncStatus('synced');
  const statusEl = document.getElementById('sleepLogStatus'), dur = sleepDuration(timeVal);
  if (grace === 'ok')    { statusEl.className = 'sleep-log-status ok';    statusEl.textContent = '\u2713 Logged ' + timeVal + (dur ? ' \u00B7 ' + dur : '') + ' \u2014 clean streak tomorrow.'; notify('\uD83D\uDCA4 Sleep logged', 'Before midnight \u2014 full streak preserved.', 'var(--success)'); }
  else if (grace === 'late')  { statusEl.className = 'sleep-log-status late';  statusEl.textContent = '\uD83C\uDF19 LATE NIGHT \u2014 ' + timeVal + (dur ? ' \u00B7 ' + dur : '') + '. Streak counts, badge shown.'; notify('\uD83D\uDCA4 LATE NIGHT logged', timeVal + ' \u2014 streak preserved, yellow badge.', 'var(--accent4)'); }
  else { statusEl.className = 'sleep-log-status grace'; statusEl.textContent = '\u26A0 GRACE DAY \u2014 ' + timeVal + (dur ? ' \u00B7 ' + dur : '') + '. Streak preserved, badge shown.'; notify('\uD83D\uDCA4 GRACE DAY logged', timeVal + ' \u2014 streak preserved, orange badge.', '#ff9f6a'); }
  renderStreaks();
}

function renderSleepLogStatus() {
  const statusEl = document.getElementById('sleepLogStatus'), inputEl = document.getElementById('sleepTimeInput');
  if (!statusEl) return;
  if (state.sleepLog) {
    const { time, graceLevel, date } = state.sleepLog, dur = sleepDuration(time), label = date === today() ? 'today' : 'yesterday';
    inputEl.value = time;
    if (graceLevel === 'ok')   { statusEl.className = 'sleep-log-status ok';    statusEl.textContent = '\u2713 Logged ' + time + ' (' + label + ')' + (dur ? ' \u00B7 ' + dur : '') + ' \u2014 clean.'; }
    else if (graceLevel === 'late') { statusEl.className = 'sleep-log-status late';  statusEl.textContent = '\uD83C\uDF19 LATE NIGHT \u2014 ' + time + ' (' + label + ')' + (dur ? ' \u00B7 ' + dur : '') + '.'; }
    else { statusEl.className = 'sleep-log-status grace'; statusEl.textContent = '\u26A0 GRACE DAY \u2014 ' + time + ' (' + label + ')' + (dur ? ' \u00B7 ' + dur : ''); }
  } else { statusEl.className = 'sleep-log-status'; statusEl.textContent = 'No sleep logged yet tonight.'; }
}
