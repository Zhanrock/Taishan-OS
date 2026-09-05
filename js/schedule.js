// ── SCHEDULE + NIGHT PROTOCOL + MORNING CARD + SLEEP LOG ──

async function saveScheduleBlocks() {
  setSyncStatus('syncing');
  await db.from('habits').upsert({
    user_id: currentUser.id, habit_id: 'scheduleBlocks',
    count: today(), last_checked: JSON.stringify(scheduleBlocks), history: []
  }, { onConflict: 'user_id,habit_id' });
  setSyncStatus('synced');
}

function loadScheduleBlocksFromRow(row) {
  try {
    const parsed = JSON.parse(row.last_checked);
    if (Array.isArray(parsed) && parsed.length > 0) scheduleBlocks = parsed;
  } catch(e) {}
}

function timeInputToDisplay(val) {
  if (!val) return '';
  const [h, m] = val.split(':').map(Number);
  return `${h}:${String(m).padStart(2,'0')}`;
}
function displayToTimeInput(val) {
  if (!val) return '';
  const [h, m] = val.split(':').map(Number);
  return `${String(h).padStart(2,'0')}:${String(m||0).padStart(2,'0')}`;
}

// ── FOCUS TIMER ──
let focusTimerInterval = null;
let focusTimerSeconds = 0;
let focusTimerBlockType = null;
const FOCUS_DURATION = 25 * 60; // 25 minutes in seconds

function startFocusTimer(blockType) {
  if (focusTimerInterval) return; // already running
  focusTimerBlockType = blockType;
  focusTimerSeconds = FOCUS_DURATION;
  _renderFocusTimer();
  focusTimerInterval = setInterval(() => {
    focusTimerSeconds--;
    _renderFocusTimer();
    if (focusTimerSeconds <= 0) {
      clearInterval(focusTimerInterval);
      focusTimerInterval = null;
      _onFocusTimerComplete();
    }
  }, 1000);
  notify('\uD83D\uDD34 Focus timer started', '25 minutes. Lock in.', 'var(--accent2)');
}

function stopFocusTimer() {
  clearInterval(focusTimerInterval);
  focusTimerInterval = null;
  focusTimerSeconds = 0;
  focusTimerBlockType = null;
  renderSchedule();
}

function _renderFocusTimer() {
  const el = document.getElementById('focusTimerDisplay');
  if (!el) return;
  const m = Math.floor(focusTimerSeconds / 60), s = focusTimerSeconds % 60;
  const pct = Math.round((1 - focusTimerSeconds / FOCUS_DURATION) * 100);
  const color = focusTimerSeconds < 300 ? 'var(--accent2)' : 'var(--accent3)';
  el.innerHTML = `
    <div class="focus-timer-inner">
      <div class="focus-timer-label">\uD83D\uDD34 DEEP WORK TIMER</div>
      <div class="focus-timer-count" style="color:${color}">${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}</div>
      <div class="focus-timer-bar-bg"><div class="focus-timer-bar" style="width:${pct}%;background:${color}"></div></div>
      <button class="sched-btn danger" onclick="stopFocusTimer()" style="margin-top:8px;width:100%">\u23F9 STOP TIMER</button>
    </div>
  `;
}

async function _onFocusTimerComplete() {
  notify('\u2705 Focus session done!', 'Deep Work checked in automatically.', 'var(--success)');
  await checkStreak('deepWork');
  renderSchedule();
  // Browser notification if permission granted
  if (Notification.permission === 'granted') {
    new Notification('TAISHAN OS', { body: '\u2705 25min focus done. Deep Work streak checked in!', icon: '/favicon.ico' });
  }
}

// ── RENDER ──
function renderSchedule() {
  const grid = document.getElementById('scheduleGrid');
  grid.innerHTML = '';
  const currentHour = getHour();
  const currentMin  = new Date().getMinutes();
  scheduleBlocks.forEach((b, i) => {
    const [bh, bm] = b.time.split(':').map(Number);
    const next = scheduleBlocks[i+1];
    const [nh, nm] = next ? next.time.split(':').map(Number) : [24, 0];
    const nowMins = currentHour * 60 + currentMin;
    const isNow = nowMins >= bh * 60 + bm && nowMins < nh * 60 + nm;
    const isDeep = b.type === 'deep';

    const timeDiv = document.createElement('div');
    timeDiv.className = 'sched-time';
    timeDiv.id = 'sched-time-' + i;
    timeDiv.textContent = b.time;
    if (isNow) timeDiv.style.color = 'var(--accent)';

    const blockDiv = document.createElement('div');
    blockDiv.className = 'sched-block';
    blockDiv.id = 'sched-block-' + i;

    // Show focus timer inside the active deep work block if timer is running
    const showTimer = isDeep && focusTimerInterval !== null && isNow;
    const timerBtn = isDeep && !focusTimerInterval
      ? `<button class="sched-focus-btn" onclick="startFocusTimer('${b.type}')" title="Start 25min focus timer">\u23F1</button>`
      : '';

    blockDiv.innerHTML = `
      <div class="sched-block-inner block-${b.type}">
        <div class="sched-block-name">${b.label}</div>
        <div class="sched-block-sub">${b.sub}</div>
      </div>
      ${isNow ? '<div class="current-marker">NOW</div>' : ''}
      ${timerBtn}
      <button class="task-del" onclick="openEditBlock(${i})" title="Edit">&#9999;</button>
      <button class="task-del" onclick="deleteBlock(${i})">&#10005;</button>
    `;
    grid.appendChild(timeDiv);
    grid.appendChild(blockDiv);

    // Inject timer display as full-width row if this block is active
    if (showTimer) {
      const timerRow = document.createElement('div');
      timerRow.id = 'focusTimerDisplay';
      timerRow.style.cssText = 'grid-column: 1 / -1; padding: 0 0 8px 0;';
      grid.appendChild(timerRow);
      _renderFocusTimer();
    }
  });

  if (editingBlockIndex !== null) _injectBlockEditForm(editingBlockIndex);
  renderNightChecklist();
  renderMorningCard();
  renderSleepLogStatus();
}

// ── ADD BLOCK ──
let addingBlock = false;

function addScheduleBlock() {
  _removeBlockEditForm();
  addingBlock = !addingBlock;
  _renderAddBlockForm();
}

function _renderAddBlockForm() {
  const existing = document.getElementById('addBlockForm');
  if (existing) existing.remove();
  if (!addingBlock) return;
  const container = document.getElementById('scheduleGrid');
  const form = document.createElement('div');
  form.id = 'addBlockForm';
  form.className = 'add-form open';
  form.style.cssText = 'margin-bottom: 16px;';
  form.innerHTML = `
    <div style="font-size:11px;color:var(--muted);font-family:var(--mono);letter-spacing:0.05em;margin-bottom:2px">NEW BLOCK</div>
    <div class="form-row">
      <div style="display:flex;flex-direction:column;gap:3px">
        <label style="font-size:10px;color:var(--muted);font-family:var(--mono)">TIME</label>
        <input type="time" class="form-input" id="abTime" style="width:130px">
      </div>
      <select class="form-select" id="abType">
        <option value="anchor">&#128681; Anchor</option>
        <option value="deep">&#128308; Deep Work</option>
        <option value="reset">&#128994; Reset</option>
        <option value="free">&#128993; Free</option>
      </select>
      <input class="form-input" id="abLabel" placeholder="Block name..." style="flex:2">
    </div>
    <input class="form-input" id="abSub" placeholder="Description (optional)" style="width:100%">
    <div class="form-actions">
      <button class="btn-cancel" onclick="cancelAddBlock()">Cancel</button>
      <button class="btn-save" onclick="submitAddBlock()">SAVE BLOCK</button>
    </div>
  `;
  container.insertAdjacentElement('beforebegin', form);
  document.getElementById('abLabel').focus();
}

function cancelAddBlock() {
  addingBlock = false;
  const f = document.getElementById('addBlockForm');
  if (f) f.remove();
}

async function submitAddBlock() {
  const timeRaw = document.getElementById('abTime').value;
  const label   = document.getElementById('abLabel').value.trim();
  const sub     = document.getElementById('abSub').value.trim();
  const type    = document.getElementById('abType').value;
  if (!timeRaw) { notify('\u26A0 Error', 'Please pick a time', 'var(--accent2)'); return; }
  if (!label)   { notify('\u26A0 Error', 'Block name required', 'var(--accent2)'); return; }
  const displayTime = timeInputToDisplay(timeRaw);
  scheduleBlocks.push({ time: displayTime, label, sub, type });
  scheduleBlocks.sort((a, b) => { const [ah,am]=a.time.split(':').map(Number),[bh,bm]=b.time.split(':').map(Number); return (ah*60+am)-(bh*60+bm); });
  await saveScheduleBlocks();
  cancelAddBlock();
  notify('\u2713 Block added', label, 'var(--accent)');
  renderSchedule();
}

// ── INLINE BLOCK EDIT ──
let editingBlockIndex = null;

function openEditBlock(i) {
  cancelAddBlock();
  const wasOpen = editingBlockIndex === i;
  _removeBlockEditForm();
  if (wasOpen) return;
  editingBlockIndex = i;
  _injectBlockEditForm(i);
}

function _removeBlockEditForm() {
  const old = document.getElementById('inlineBlockEditForm');
  if (old) old.remove();
  editingBlockIndex = null;
}

function _injectBlockEditForm(i) {
  const b = scheduleBlocks[i];
  if (!b) return;
  const blockDiv = document.getElementById('sched-block-' + i);
  if (!blockDiv) return;
  const form = document.createElement('div');
  form.id = 'inlineBlockEditForm';
  form.style.cssText = 'grid-column: 1 / -1; padding: 0 0 8px 0;';
  form.innerHTML = `
    <div class="add-form open" style="margin:0">
      <div style="font-size:11px;color:var(--muted);font-family:var(--mono);letter-spacing:0.05em;margin-bottom:2px">EDIT BLOCK</div>
      <div class="form-row">
        <div style="display:flex;flex-direction:column;gap:3px">
          <label style="font-size:10px;color:var(--muted);font-family:var(--mono)">TIME</label>
          <input type="time" class="form-input" id="ebTime" value="${displayToTimeInput(b.time)}" style="width:130px">
        </div>
        <select class="form-select" id="ebType">
          <option value="anchor" ${b.type==='anchor'?'selected':''}>&#128681; Anchor</option>
          <option value="deep"   ${b.type==='deep'  ?'selected':''}>&#128308; Deep Work</option>
          <option value="reset"  ${b.type==='reset' ?'selected':''}>&#128994; Reset</option>
          <option value="free"   ${b.type==='free'  ?'selected':''}>&#128993; Free</option>
        </select>
        <input class="form-input" id="ebLabel" value="${b.label.replace(/"/g,'&quot;')}" placeholder="Block name..." style="flex:2">
      </div>
      <input class="form-input" id="ebSub" value="${b.sub.replace(/"/g,'&quot;')}" placeholder="Description (optional)" style="width:100%">
      <div class="form-actions">
        <button class="btn-cancel" onclick="_removeBlockEditForm()">Cancel</button>
        <button class="btn-save" onclick="submitEditBlock()">SAVE CHANGES</button>
      </div>
    </div>
  `;
  blockDiv.insertAdjacentElement('afterend', form);
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('ebLabel').focus();
}

async function submitEditBlock() {
  if (editingBlockIndex === null) return;
  const timeRaw = document.getElementById('ebTime').value;
  const label   = document.getElementById('ebLabel').value.trim();
  const sub     = document.getElementById('ebSub').value.trim();
  const type    = document.getElementById('ebType').value;
  if (!timeRaw) { notify('\u26A0 Error', 'Please pick a time', 'var(--accent2)'); return; }
  if (!label)   { notify('\u26A0 Error', 'Block name required', 'var(--accent2)'); return; }
  const displayTime = timeInputToDisplay(timeRaw);
  scheduleBlocks[editingBlockIndex] = { time: displayTime, label, sub, type };
  scheduleBlocks.sort((a, b) => { const [ah,am]=a.time.split(':').map(Number),[bh,bm]=b.time.split(':').map(Number); return (ah*60+am)-(bh*60+bm); });
  await saveScheduleBlocks();
  _removeBlockEditForm();
  notify('\u2713 Block updated', label, 'var(--accent)');
  renderSchedule();
}

async function deleteBlock(i) {
  if (editingBlockIndex === i) _removeBlockEditForm();
  scheduleBlocks.splice(i, 1);
  await saveScheduleBlocks();
  notify('\uD83D\uDDD1 Block removed', '', 'var(--muted)');
  renderSchedule();
}

async function resetSchedule() {
  if (!confirm('Reset schedule to defaults?')) return;
  scheduleBlocks = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_BLOCKS));
  await saveScheduleBlocks();
  _removeBlockEditForm();
  cancelAddBlock();
  notify('\u21BA Schedule reset', 'Back to defaults', 'var(--accent)');
  renderSchedule();
}

// ── NIGHT PROTOCOL ──
function loadNightProtocolItemsFromRow(row) {
  try {
    const parsed = JSON.parse(row.last_checked);
    if (Array.isArray(parsed) && parsed.length > 0) nightProtocolItems = parsed;
  } catch(e) {}
}

async function saveNightProtocolItems() {
  setSyncStatus('syncing');
  await db.from('habits').upsert({
    user_id: currentUser.id, habit_id: 'nightProtocolItems',
    count: today(), last_checked: JSON.stringify(nightProtocolItems), history: []
  }, { onConflict: 'user_id,habit_id' });
  setSyncStatus('synced');
}

function renderNightChecklist() {
  document.getElementById('nightChecklist').innerHTML = nightProtocolItems.map((c, i) => {
    const done = state.nightChecks[c.id];
    return `<div class="task-item ${done?'done':''}" id="nc-item-${i}">
      <div class="task-check ${done?'checked':''}" onclick="toggleNight('${c.id}')">${done?'\u2713':''}</div>
      <div class="task-body"><div class="task-name">${esc(c.label)}</div></div>
      <button class="task-del" onclick="openEditNightCheck(${i})" title="Edit">\u270f</button>
      <button class="task-del" onclick="deleteNightCheck(${i})" title="Delete">\u2715</button>
    </div>`;
  }).join('');
  if (editingNightCheckIndex !== null) _injectNightCheckEditForm(editingNightCheckIndex);
  if (addingNightCheck) _renderAddNightCheckForm();
}

async function toggleNight(id) {
  state.nightChecks[id] = !state.nightChecks[id];
  const allDone = nightProtocolItems.length > 0 && nightProtocolItems.every(c => state.nightChecks[c.id]);
  setSyncStatus('syncing');
  await db.from('habits').upsert({ user_id:currentUser.id, habit_id:'nightChecks', count:today(), last_checked:JSON.stringify(state.nightChecks), history:[] }, { onConflict:'user_id,habit_id' });
  setSyncStatus('synced');
  if (allDone) {
    await checkStreak('review');
    if (!state.morningCard) setTimeout(() => drawMorningCard(), 600);
    // Show tomorrow's briefing
    setTimeout(() => renderTomorrowBriefing(), 900);
    notify('\uD83C\uDF19 Night Protocol Complete!', "Tomorrow's briefing ready.", 'var(--accent)');
  }
  renderNightChecklist();
  renderMorningCard();
}

// ── ADD / EDIT / DELETE NIGHT CHECK ITEMS ──
let addingNightCheck = false;
let editingNightCheckIndex = null;

function toggleAddNightCheck() {
  _removeNightCheckEditForm();
  addingNightCheck = !addingNightCheck;
  renderNightChecklist();
}

function _renderAddNightCheckForm() {
  const existing = document.getElementById('addNightCheckForm');
  if (existing) existing.remove();
  if (!addingNightCheck) return;
  const container = document.getElementById('nightChecklist');
  const form = document.createElement('div');
  form.id = 'addNightCheckForm';
  form.className = 'add-form open';
  form.style.cssText = 'margin-top: 10px;';
  form.innerHTML = [
    '<div style="font-size:11px;color:var(--muted);font-family:var(--mono);letter-spacing:0.05em;margin-bottom:2px">NEW CHECK</div>',
    '<input class="form-input" id="ncNewLabel" placeholder="e.g. Fill water bottle for tomorrow" style="width:100%">',
    '<div class="form-actions">',
    '  <button class="btn-cancel" onclick="cancelAddNightCheck()">Cancel</button>',
    '  <button class="btn-save" onclick="submitAddNightCheck()">SAVE CHECK</button>',
    '</div>'
  ].join('');
  container.insertAdjacentElement('afterend', form);
  document.getElementById('ncNewLabel').focus();
}

function cancelAddNightCheck() {
  addingNightCheck = false;
  const f = document.getElementById('addNightCheckForm');
  if (f) f.remove();
}

async function submitAddNightCheck() {
  const label = document.getElementById('ncNewLabel').value.trim();
  if (!label) { notify('⚠ Error', 'Check text required', 'var(--accent2)'); return; }
  const id = 'nc_' + Date.now();
  nightProtocolItems.push({ id, label });
  state.nightChecks[id] = false;
  await saveNightProtocolItems();
  cancelAddNightCheck();
  notify('✓ Check added', label, 'var(--accent)');
  renderNightChecklist();
}

function openEditNightCheck(i) {
  cancelAddNightCheck();
  const wasOpen = editingNightCheckIndex === i;
  _removeNightCheckEditForm();
  if (wasOpen) return;
  editingNightCheckIndex = i;
  _injectNightCheckEditForm(i);
}

function _removeNightCheckEditForm() {
  const old = document.getElementById('inlineNightCheckEditForm');
  if (old) old.remove();
  editingNightCheckIndex = null;
}

function _injectNightCheckEditForm(i) {
  const c = nightProtocolItems[i];
  if (!c) return;
  const item = document.getElementById('nc-item-' + i);
  if (!item) return;
  const form = document.createElement('div');
  form.id = 'inlineNightCheckEditForm';
  const wrap = document.createElement('div');
  wrap.className = 'add-form open';
  wrap.style.margin = '8px 0';
  wrap.innerHTML = [
    '<div style="font-size:11px;color:var(--muted);font-family:var(--mono);letter-spacing:0.05em;margin-bottom:2px">EDIT CHECK</div>',
    '<input class="form-input" id="ncEditLabel" placeholder="Check text..." style="width:100%">',
    '<div class="form-actions">',
    '  <button class="btn-cancel" onclick="_removeNightCheckEditForm()">Cancel</button>',
    '  <button class="btn-save" onclick="submitEditNightCheck()">SAVE CHANGES</button>',
    '</div>'
  ].join('');
  form.appendChild(wrap);
  item.insertAdjacentElement('afterend', form);
  const inp = document.getElementById('ncEditLabel');
  inp.value = c.label;
  inp.focus();
}

async function submitEditNightCheck() {
  if (editingNightCheckIndex === null) return;
  const label = document.getElementById('ncEditLabel').value.trim();
  if (!label) { notify('⚠ Error', 'Check text required', 'var(--accent2)'); return; }
  nightProtocolItems[editingNightCheckIndex] = Object.assign({}, nightProtocolItems[editingNightCheckIndex], { label });
  await saveNightProtocolItems();
  _removeNightCheckEditForm();
  notify('✓ Check updated', label, 'var(--accent)');
  renderNightChecklist();
}

async function deleteNightCheck(i) {
  const c = nightProtocolItems[i];
  if (!c) return;
  if (editingNightCheckIndex === i) _removeNightCheckEditForm();
  nightProtocolItems.splice(i, 1);
  delete state.nightChecks[c.id];
  await saveNightProtocolItems();
  setSyncStatus('syncing');
  await db.from('habits').upsert({ user_id:currentUser.id, habit_id:'nightChecks', count:today(), last_checked:JSON.stringify(state.nightChecks), history:[] }, { onConflict:'user_id,habit_id' });
  setSyncStatus('synced');
  notify('🗑 Check removed', '', 'var(--muted)');
  renderNightChecklist();
  renderMorningCard();
}

// ── TOMORROW'S BRIEFING ──
function renderTomorrowBriefing() {
  const el = document.getElementById('tomorrowBriefing');
  if (!el) return;

  const tomorrow = (()=>{ const d=new Date(); d.setDate(d.getDate()+1); return d.toLocaleDateString('en-CA'); })();
  const tomorrowLabel = new Date(tomorrow+'T00:00:00').toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'short' });

  // Top priority task (high priority, not done)
  const topTask = state.tasks.filter(t => !t.done && t.priority === 'high')[0]
               || state.tasks.filter(t => !t.done)[0];

  // First schedule block
  const firstBlock = scheduleBlocks[0];

  // Tomorrow's events
  const tomorrowEvents = state.events.filter(e => e.date === tomorrow).sort((a,b) => (a.time||'') < (b.time||'') ? -1 : 1);

  if (!topTask && !firstBlock && !tomorrowEvents.length) {
    el.style.display = 'none';
    return;
  }

  el.style.display = 'block';
  el.innerHTML = `
    <div class="briefing-header">\uD83C\uDF05 TOMORROW — ${tomorrowLabel}</div>
    ${firstBlock ? `<div class="briefing-row"><span class="briefing-icon">\u23F0</span><span class="briefing-text"><b>${firstBlock.time}</b> ${firstBlock.label}</span></div>` : ''}
    ${topTask   ? `<div class="briefing-row"><span class="briefing-icon">\uD83D\uDD34</span><span class="briefing-text"><b>Top task:</b> ${topTask.name}</span></div>` : ''}
    ${tomorrowEvents.map(e => `<div class="briefing-row"><span class="briefing-icon">\uD83D\uDCC5</span><span class="briefing-text">${e.time ? e.time+' ' : ''}${e.title}</span></div>`).join('')}
  `;
}

// ── 11:30PM BROWSER NOTIFICATION ──
function scheduleNightNotification() {
  if (Notification.permission !== 'granted') return;
  const now = new Date();
  const target = new Date();
  target.setHours(23, 30, 0, 0);
  // If already past 23:30 today, skip
  if (now >= target) return;
  const msUntil = target - now;
  setTimeout(() => {
    new Notification('TAISHAN OS — Night Protocol', {
      body: '\uD83C\uDF19 11:30pm. Phone across the room. Start your night protocol.',
      icon: '/favicon.ico'
    });
  }, msUntil);
}

// ── MORNING CARD ──
function drawMorningCard(forceRedraw=false) {
  const card = CARD_DECK[Math.floor(Math.random()*CARD_DECK.length)];
  const tomorrow = (()=>{const d=new Date();d.setDate(d.getDate()+1);return d.toLocaleDateString('en-CA');})();
  const cardData = {...card, date:tomorrow, done:false, drawnAt:today()};
  state.morningCard = cardData; saveMorningCard(cardData); renderMorningCard();
  if (forceRedraw) notify('\uD83C\uDFB4 New card drawn!', card.cat+' \u2014 Card #'+card.num, 'var(--accent3)');
}
async function saveMorningCard(cardData) {
  setSyncStatus('syncing');
  await db.from('habits').upsert({ user_id:currentUser.id, habit_id:'morningCard', count:cardData.date, last_checked:JSON.stringify(cardData), history:[] }, { onConflict:'user_id,habit_id' });
  setSyncStatus('synced');
}
async function markCardDone() {
  if (!state.morningCard) return;
  state.morningCard.done = true;
  await saveMorningCard(state.morningCard);
  notify('\uD83C\uDFB4 Card complete!', 'Morning activation done. Good start.', 'var(--success)');
  renderMorningCard(); await checkStreak('morning');
}
function renderMorningCard() {
  const display=document.getElementById('morningCardDisplay'), drawBtn=document.getElementById('cardDrawBtn'), card=state.morningCard;
  const tomorrow=(()=>{const d=new Date();d.setDate(d.getDate()+1);return d.toLocaleDateString('en-CA');})();
  const nightDone=Object.values(state.nightChecks).every(Boolean);
  drawBtn.style.display = nightDone && !card ? 'block' : 'none';
  if (!card) { display.innerHTML = !nightDone ? `<div style="font-size:11px;color:var(--muted);padding:12px 0;font-family:var(--mono)">Complete the night protocol above to unlock tomorrow's card.</div>` : ''; return; }
  const catKey=CAT_CLASS[card.cat]||'mental', isDone=card.done, isToday=card.date===today(), isTomorrow=card.date===tomorrow;
  display.innerHTML = `<div class="morning-card card-${catKey}">${isDone?`<div class="card-done-stamp" style="border-color:var(--success);color:var(--success)">\u2713 DONE</div>`:''}<div class="card-cat card-col-${catKey}">${card.cat} \u00B7 Card #${card.num}</div><div class="card-task">${card.task}</div><div style="font-size:10px;color:var(--muted);margin-bottom:12px;font-family:var(--mono)">${isToday?"\u25B8 TODAY'S CARD":isTomorrow?"\u25B8 TOMORROW'S CARD":'\u25B8 '+fmtDate(card.date)}</div><div class="card-actions">${!isDone?`<button class="card-done-btn card-col-${catKey}" style="border-color:currentColor" onclick="markCardDone()">\u2713 MARK DONE</button>`:''} ${nightDone?`<button class="card-redraw-btn" onclick="drawMorningCard(true)">&#8635; REDRAW</button>`:''}</div></div>`;
  drawBtn.style.display = 'none';
}

// ── SLEEP LOG ──
async function logSleep() {
  const timeVal = document.getElementById('sleepTimeInput').value;
  if (!timeVal) { notify('\u26A0 Sleep Log', 'Please enter a time', 'var(--accent2)'); return; }
  const grace = sleepGraceLevel(timeVal), logData = { date:today(), time:timeVal, graceLevel:grace };
  state.sleepLog = logData;
  upsertSleepHistoryEntry({ date:today(), time:timeVal, graceLevel:grace, durationMinutes:sleepDurationMinutes(timeVal) });
  setSyncStatus('syncing');
  await db.from('habits').upsert({ user_id:currentUser.id, habit_id:'sleepLog', count:today(), last_checked:JSON.stringify(logData), history:[] }, { onConflict:'user_id,habit_id' });
  setSyncStatus('synced');
  await persistSleepHistory();
  const statusEl=document.getElementById('sleepLogStatus'), dur=sleepDuration(timeVal);
  if (grace==='ok')    { statusEl.className='sleep-log-status ok';    statusEl.textContent='\u2713 Logged '+timeVal+(dur?' \u00B7 '+dur:'')+' \u2014 clean streak tomorrow.'; notify('\uD83D\uDCA4 Sleep logged','Before midnight \u2014 full streak preserved.','var(--success)'); }
  else if (grace==='late') { statusEl.className='sleep-log-status late'; statusEl.textContent='\uD83C\uDF19 LATE NIGHT \u2014 '+timeVal+(dur?' \u00B7 '+dur:'')+'. Streak counts, badge shown.'; notify('\uD83D\uDCA4 LATE NIGHT logged',timeVal+' \u2014 streak preserved, yellow badge.','var(--accent4)'); }
  else { statusEl.className='sleep-log-status grace'; statusEl.textContent='\u26A0 GRACE DAY \u2014 '+timeVal+(dur?' \u00B7 '+dur:'')+'. Streak preserved, badge shown.'; notify('\uD83D\uDCA4 GRACE DAY logged',timeVal+' \u2014 streak preserved, orange badge.','#ff9f6a'); }
  renderStreaks();
  if (document.getElementById('panel-sleep')) renderSleepAnalytics();
}
function renderSleepLogStatus() {
  const statusEl=document.getElementById('sleepLogStatus'), inputEl=document.getElementById('sleepTimeInput');
  if (!statusEl) return;
  if (state.sleepLog) {
    const {time, graceLevel, date} = state.sleepLog, dur = sleepDuration(time), label = date===today()?'today':'yesterday';
    inputEl.value = time;
    if (graceLevel==='ok')   { statusEl.className='sleep-log-status ok';    statusEl.textContent='\u2713 Logged '+time+' ('+label+')'+(dur?' \u00B7 '+dur:'')+' \u2014 clean.'; }
    else if (graceLevel==='late') { statusEl.className='sleep-log-status late'; statusEl.textContent='\uD83C\uDF19 LATE NIGHT \u2014 '+time+' ('+label+')'+(dur?' \u00B7 '+dur:'')+'.'; }
    else { statusEl.className='sleep-log-status grace'; statusEl.textContent='\u26A0 GRACE DAY \u2014 '+time+' ('+label+')'+(dur?' \u00B7 '+dur:''); }
  } else { statusEl.className='sleep-log-status'; statusEl.textContent='No sleep logged yet tonight.'; }
}
