// Habit time windows (static for now — will be editable later)
// Morning Routine shares Wake Up's window: check-in only opens once you're
// actually up, so it should be gated by the same hours.
const WAKE_TARGET_HOUR = 8;
const WAKE_CUTOFF_HOUR = 9;

// ── SYSTEM INTEGRITY SCORE ──
// Weighted % based on active habits checked in over the last 7 days.
// Drops when anchors are missed, rises with consistency.
function computeIntegrityScore() {
  const activeHabits = HABITS.filter(h => h.unlockPhase <= state.phase);
  const weights = { wake: 35, morning: 25, deepWork: 15, noScroll: 10, exercise: 8, review: 7 };
  const totalWeight = activeHabits.reduce((sum, h) => sum + (weights[h.id] || 10), 0);
  let earned = 0;
  const days = Array.from({length: 7}, (_, i) => { const d = new Date(); d.setDate(d.getDate()-i); return d.toLocaleDateString('en-CA'); });
  activeHabits.forEach(h => {
    const st = state.streaks[h.id];
    const checkedDays = days.filter(d => st.history.includes(d)).length;
    const ratio = checkedDays / 7;
    earned += (weights[h.id] || 10) * ratio;
  });
  return Math.round((earned / totalWeight) * 100);
}

function updateIntegrityUI() {
  const score = computeIntegrityScore();
  const el = document.getElementById('integrityScore');
  const bar = document.getElementById('integrityBar');
  const label = document.getElementById('integrityLabel');
  if (!el) return;
  const color = score >= 80 ? 'var(--success)' : score >= 50 ? 'var(--accent4)' : 'var(--danger)';
  const status = score >= 80 ? 'OPTIMAL' : score >= 60 ? 'STABLE' : score >= 40 ? 'DEGRADED' : 'CRITICAL';
  el.textContent = score + '%';
  el.style.color = color;
  bar.style.width = score + '%';
  bar.style.background = color;
  label.textContent = status;
  label.style.color = color;
}

async function checkStreak(id) {
  const hour = getHour();
  if (id === 'wake' || id === 'morning') {
    const label = id === 'wake' ? 'Wake Up' : 'Morning Routine';
    if (hour < WAKE_TARGET_HOUR) { notify('\u23F0 Too early!', label + ' check-in opens at ' + WAKE_TARGET_HOUR + ':00.', 'var(--muted)'); return; }
    if (hour >= WAKE_CUTOFF_HOUR) { notify('\u274C Missed it.', label + ' window closed at ' + WAKE_CUTOFF_HOUR + ':00.' + (id === 'wake' ? ' Sleep on time tonight.' : ''), 'var(--danger)'); return; }
  }
  const st = state.streaks[id], t = today();
  if (st.last_checked === t) return;
  const yStr = localYesterday();
  if (st.last_checked === yStr) st.count++;
  else if (!st.last_checked) st.count = 1;
  else st.count = 1;
  st.last_checked = t;
  if (!st.history.includes(t)) st.history.push(t);
  setSyncStatus('syncing');
  await db.from('habits').upsert({ user_id:currentUser.id, habit_id:id, count:st.count, last_checked:st.last_checked, history:st.history }, { onConflict:'user_id,habit_id' });
  setSyncStatus('synced');
  const h = HABITS.find(x => x.id === id);
  if (id === 'wake') {
    const grace = state.sleepLog ? state.sleepLog.graceLevel : null;
    const dur   = state.sleepLog ? sleepDuration(state.sleepLog.time) : null;
    if (grace === 'late')  notify('\uD83D\uDD25 Wake! LATE NIGHT',  st.count + ' days \u2014 streak counts.' + (dur?' '+dur:''), 'var(--accent4)');
    else if (grace === 'grace') notify('\uD83D\uDD25 Wake! GRACE DAY', st.count + ' days \u2014 preserved.' + (dur?' '+dur:''), '#ff9f6a');
    else notify('\uD83D\uDD25 Streak Updated!', h.label + ' \u2014 ' + st.count + ' days!', h.color);
  } else { notify('\uD83D\uDD25 Streak Updated!', h.label + ' \u2014 ' + st.count + ' days!', h.color); }
  state.prevPhase = state.phase;
  computePhase(); renderStreaks(); renderWeek(); updatePhaseUI(); updateStats(); updateIntegrityUI();
}

function computePhase() {
  const w = state.streaks.wake.count;
  state.phase = w >= 14 ? 3 : w >= 7 ? 2 : 1;
  if (state.phase > state.prevPhase) {
    document.getElementById('unlockBanner').classList.add('visible');
    document.getElementById('unlockTitle').textContent = PHASES[state.phase-1].name + ' \u2014 UNLOCKED!';
    document.getElementById('unlockDesc').textContent = 'You hit the streak threshold. New habits are now active.';
    notify('\uD83C\uDFAF Phase Unlock!', PHASES[state.phase-1].name + ' is now active.', 'var(--accent3)');
  }
}

function updatePhaseUI() {
  const p = PHASES[state.phase-1], w = state.streaks.wake.count;
  document.getElementById('phaseName').textContent    = 'PHASE ' + state.phase;
  document.getElementById('phaseXP').textContent      = w + ' / ' + p.nextAt + ' days anchored';
  document.getElementById('phaseBar').style.width     = Math.min(100, Math.round(w/p.nextAt*100)) + '%';
  document.getElementById('phaseTitle').textContent   = p.name;
  document.getElementById('phaseDesc').textContent    = p.desc;
  document.getElementById('phaseHabitsText').textContent = p.habits;
  document.getElementById('phaseBarFill').style.width = Math.min(100, Math.round(w/p.nextAt*100)) + '%';
  document.getElementById('phaseDayCount').textContent = 'Day ' + state.streaks.wake.history.length;
  document.getElementById('phaseNext').textContent    = state.phase < 3 ? 'Phase '+(state.phase+1)+' unlocks at '+p.nextAt+'-day streak' : '\uD83C\uDFC6 Full system unlocked';
  updateIntegrityUI();
}

function updateStats() {
  const best = Math.max(...HABITS.map(h => state.streaks[h.id].count));
  document.getElementById('statBest').textContent   = best;
  document.getElementById('statPhase').textContent  = state.phase;
  document.getElementById('statHabits').textContent = HABITS.filter(h => h.unlockPhase <= state.phase).length;
  const todayTasks = state.tasks.filter(t => t.createdOn === today());
  document.getElementById('statTasks').textContent      = todayTasks.filter(t => t.done).length;
  document.getElementById('statTasksTotal').textContent = todayTasks.length;
}

function renderStreaks() {
  const grid = document.getElementById('streakGrid'); grid.innerHTML = '';
  const hour = getHour();
  HABITS.forEach(h => {
    const st = state.streaks[h.id], active = h.unlockPhase <= state.phase, checked = st.last_checked === today();
    const card = document.createElement('div');
    card.className = 'streak-card' + (active ? '' : ' locked');
    if (!active) card.setAttribute('data-unlock', 'PHASE ' + h.unlockPhase);
    let dots = '';
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const ds = d.toLocaleDateString('en-CA'), isToday = ds === today(), done = st.history.includes(ds);
      const cls = isToday ? (checked ? 'done today' : 'today') : (done ? 'done' : '');
      dots += `<div class="dot ${cls}"></div>`;
    }
    let btn;
    if (checked) {
      btn = `<button class="streak-btn done-btn" disabled>\u2713 DONE TODAY</button>`;
    } else if ((h.id === 'wake' || h.id === 'morning') && hour < WAKE_TARGET_HOUR) {
      btn = `<button class="streak-btn done-btn" disabled style="opacity:0.5">\u23F0 OPENS AT ${WAKE_TARGET_HOUR}:00</button>`;
    } else if ((h.id === 'wake' || h.id === 'morning') && hour >= WAKE_CUTOFF_HOUR) {
      btn = `<button class="streak-btn done-btn" disabled style="opacity:0.5;border-color:var(--danger);color:var(--danger)">\u274C MISSED \u2014 closed at ${WAKE_CUTOFF_HOUR}:00</button>`;
    } else {
      btn = `<button class="streak-btn check" onclick="checkStreak('${h.id}')">CHECK IN \u2713</button>`;
    }
    let graceBadge = '', durationLine = '';
    if (h.id === 'wake' && state.sleepLog) {
      const gl = state.sleepLog.graceLevel, dur = sleepDuration(state.sleepLog.time);
      if (gl === 'late')  graceBadge = `<span class="sleep-badge late-night">\uD83C\uDF19 LATE NIGHT</span><br>`;
      if (gl === 'grace') graceBadge = `<span class="sleep-badge grace-day">\u26A0 GRACE DAY</span><br>`;
      if (dur) durationLine = `<div class="sleep-duration">\uD83D\uDCA4 ${dur}</div>`;
    }
    card.innerHTML = `<div class="streak-card-glow" style="background:${h.color}"></div><div class="streak-top"><div class="streak-label">${h.label}</div><div class="streak-emoji">${h.emoji}</div></div><div class="streak-count" style="color:${h.color}">${st.count}</div><div class="streak-unit">day streak</div>${graceBadge}${durationLine}<div class="streak-dots">${dots}</div><div class="streak-tip">${h.tip}</div>${btn}`;
    grid.appendChild(card);
  });
}

function renderWeek() {
  const grid = document.getElementById('weekGrid'); grid.innerHTML = '';
  const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'], now = new Date(), start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  const activeHabits = HABITS.filter(h => h.unlockPhase <= state.phase);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(start.getDate()+i);
    const ds = d.toLocaleDateString('en-CA'), isToday = ds === today(), isPast = ds < today();
    const dotHtml = activeHabits.slice(0,4).map(h => `<div class="wday-dot" style="background:${state.streaks[h.id].history.includes(ds) ? h.color : 'var(--border)'}"></div>`).join('');
    const div = document.createElement('div');
    div.className = 'week-day' + (isToday ? ' today' : '') + (isPast ? ' past' : '');
    div.innerHTML = `<div class="wday-name">${days[d.getDay()]}</div><div class="wday-num">${d.getDate()}</div><div class="wday-dots">${dotHtml}</div>`;
    grid.appendChild(div);
  }
}

function renderCountdowns() {
  const el = document.getElementById('countdownBanners'); if (!el) return;
  const t = today(), cutoff = new Date(); cutoff.setDate(cutoff.getDate()+14);
  const cutoffStr = cutoff.toLocaleDateString('en-CA');
  const urgentEvents = state.events
    .filter(e => (e.type==='exam' || e.priority==='high') && e.date >= t && e.date <= cutoffStr)
    .map(e => ({ date:e.date, title:e.title, sub:e.type.toUpperCase()+(e.time?' \u00B7 '+e.time:'')+(e.note?' \u00B7 '+e.note:''), icon:e.type==='exam'?'\uD83C\uDFAF':'\u26A0\uFE0F', color:e.type==='exam'?'var(--accent2)':'var(--accent4)' }));
  const urgentTasks = state.tasks
    .filter(t2 => t2.due && !t2.done && t2.due >= t && t2.due <= cutoffStr)
    .map(t2 => ({ date:t2.due, title:t2.name, sub:t2.category.toUpperCase()+(t2.priority==='high'?' \u00B7 HIGH PRIORITY':'')+(t2.note?' \u00B7 '+t2.note:''), icon:t2.priority==='high'?'\uD83D\uDD34':'\uD83D\uDCCB', color:t2.priority==='high'?'var(--accent2)':'var(--accent4)' }));
  const all = [...urgentEvents, ...urgentTasks].sort((a,b) => a.date < b.date ? -1 : 1);
  if (!all.length) { el.innerHTML = ''; return; }
  el.innerHTML = all.map(item => {
    const d = new Date(item.date+'T00:00:00'), diff = Math.ceil((d-new Date(t+'T00:00:00'))/86400000);
    const dayLabel = diff===0?'TODAY':diff===1?'TOMORROW':`IN ${diff} DAYS`;
    return `<div class="countdown-banner"><div class="cd-icon">${item.icon}</div><div class="cd-text"><div class="cd-title" style="color:${item.color}">${item.title}</div><div class="cd-sub">${item.sub}</div></div><div class="cd-days" style="color:${item.color}">${dayLabel}</div></div>`;
  }).join('');
}
