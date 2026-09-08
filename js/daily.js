// ── DAILY PLANNER + AUTO-GENERATOR ──
// Multi-select filter tags. Empty set = no filter (show everything).
// Within a group (status/priority/category) tags are OR'd; across groups AND'd —
// so "Study" + "High" shows high-priority study items, while "Study" + "Work"
// shows either.
let dailyFilters = new Set();
const DAILY_FILTER_GROUPS = {
  status:   ['pending', 'done'],
  priority: ['high'],
  cat:      ['study', 'work', 'health', 'personal', 'leisure', 'chore', 'other'],
};
let domainManagerOpen = false;

// ── DEFAULT DOMAINS ──
// Seeded into Supabase on first login. Edit via the ⚙ DOMAINS panel at runtime.
// To add new interests in the future: use the Domain Manager UI — no code needed.
//
// TEMPLATE (if you ever want to add via code):
// {
//   domain_id: 'unique_id',        // snake_case, no spaces
//   title: 'Display Name',
//   cat: 'work',                   // study | work | health | personal | leisure | chore | other
//   pri: 'medium',                 // high | medium | low
//   time_slot: '14:00',            // 24h
//   duration_mins: 60,
//   freq_days: 2,                  // 1=daily, 2=every 2 days, 7=weekly
//   base_priority: 6,              // 1–10
//   urgency_deadline_days: 7,
//   tags: ['tag1'],                // 'anchor' = always included
//   note: 'What to do'
// }

const DEFAULT_DOMAINS = [
  { domain_id:'morning_anchor',  title:'Morning Anchor',                  cat:'personal', pri:'high',   time_slot:'07:00', duration_mins:15,  freq_days:1, base_priority:9,  urgency_deadline_days:7,  tags:['habit','anchor'],      note:'Water → wash face → review ONE task for today' },
  { domain_id:'night_protocol',  title:'Night Protocol',                  cat:'personal', pri:'high',   time_slot:'23:00', duration_mins:15,  freq_days:1, base_priority:9,  urgency_deadline_days:7,  tags:['habit','anchor'],      note:"Write tomorrow's ONE task → phone away → prep bag" },
  { domain_id:'work_primary',    title:'Primary Job / Internship',        cat:'work',     pri:'high',   time_slot:'09:00', duration_mins:480, freq_days:1, base_priority:10, urgency_deadline_days:14, tags:['career'],              note:'Your main job or internship. Edit this in the Domains panel.' },
  { domain_id:'research',        title:'Research Project',                cat:'work',     pri:'high',   time_slot:'19:00', duration_mins:60,  freq_days:2, base_priority:8,  urgency_deadline_days:7,  tags:['research','career'],   note:'Describe your research thread here.' },
  { domain_id:'part_time_role',  title:'Part-Time / Assistant Role',      cat:'work',     pri:'medium', time_slot:'18:00', duration_mins:90,  freq_days:3, base_priority:7,  urgency_deadline_days:7,  tags:['career'],              note:'Any paid part-time work — pay rate, hours, supervisor.' },
  { domain_id:'finance',         title:'Finance & Stocks Study',          cat:'study',    pri:'medium', time_slot:'21:30', duration_mins:30,  freq_days:3, base_priority:5,  urgency_deadline_days:7,  tags:['wealth','learning'],   note:'Read 1 article or watch 1 video on markets/investing.' },
  { domain_id:'workout',         title:'Workout',                         cat:'health',   pri:'medium', time_slot:'07:15', duration_mins:45,  freq_days:2, base_priority:7,  urgency_deadline_days:7,  tags:['fitness'],             note:'Strength / bodyweight session. Log your sets.' },
  { domain_id:'running',         title:'Running',                         cat:'health',   pri:'medium', time_slot:'07:00', duration_mins:30,  freq_days:3, base_priority:6,  urgency_deadline_days:7,  tags:['fitness','cardio'],    note:'3–5km easy pace. Consistency > speed.' },
  { domain_id:'reading',         title:'Reading / Learning',              cat:'personal', pri:'low',    time_slot:'22:00', duration_mins:20,  freq_days:2, base_priority:4,  urgency_deadline_days:7,  tags:['growth'],              note:'Books, articles, anything that broadens you.' },
  { domain_id:'gaming',          title:'Gaming / Relax Block',            cat:'leisure',  pri:'low',    time_slot:'22:30', duration_mins:60,  freq_days:1, base_priority:3,  urgency_deadline_days:7,  tags:['rest','balance'],      note:'Protected downtime. No guilt. Hard cap 1hr on work days.' },
];

let LIFE_DOMAINS = [];

// ── SUPABASE DOMAIN STORAGE ──

async function loadDomains() {
  const { data, error } = await db
    .from('user_domains')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true });

  if (error || !data || data.length === 0) {
    // First login — seed defaults
    await seedDefaultDomains();
    return;
  }
  LIFE_DOMAINS = data.map(dbRowToDomain);
}

async function seedDefaultDomains() {
  const rows = DEFAULT_DOMAINS.map(d => ({
    user_id:               currentUser.id,
    domain_id:             d.domain_id,
    title:                 d.title,
    cat:                   d.cat,
    pri:                   d.pri,
    time_slot:             d.time_slot,
    duration_mins:         d.duration_mins,
    freq_days:             d.freq_days,
    base_priority:         d.base_priority,
    urgency_deadline_days: d.urgency_deadline_days,
    tags:                  d.tags,
    note:                  d.note || '',
    detail_content:        d.detailContent || [],
  }));
  const { data, error } = await db.from('user_domains').insert(rows).select();
  if (!error && data) {
    LIFE_DOMAINS = data.map(dbRowToDomain);
  } else {
    // Fallback to in-memory defaults if insert fails
    LIFE_DOMAINS = DEFAULT_DOMAINS.map(d => ({ ...d }));
  }
}

function dbRowToDomain(row) {
  return {
    id:                    row.domain_id,
    _db_id:                row.id,         // Supabase UUID PK for deletes
    title:                 row.title,
    cat:                   row.cat,
    pri:                   row.pri,
    time:                  row.time_slot,
    duration:              row.duration_mins,
    freqDays:              row.freq_days,
    basePriority:          row.base_priority,
    urgencyDeadlineDays:   row.urgency_deadline_days,
    tags:                  row.tags || [],
    note:                  row.note || '',
    detailContent:         row.detail_content || [],
    isArchived:            row.is_archived || false,
  };
}

// Archived domains stay in LIFE_DOMAINS (still readable, still holding logs)
// but are excluded from scoring, generation, and the default domain list.
function activeDomains() {
  return LIFE_DOMAINS.filter(d => !d.isArchived);
}

async function setDomainArchived(id, archived) {
  const d = LIFE_DOMAINS.find(x => x.id === id);
  if (!d) return false;
  if (d.tags && d.tags.includes('anchor')) { notify('⚠ Cannot Archive', 'Anchor domains are core to the system', 'var(--accent2)'); return false; }
  if (!d._db_id) { notify('⚠ Error', 'Domain not synced yet — try again shortly', 'var(--accent2)'); return false; }
  setSyncStatus('syncing');
  const { error } = await db.from('user_domains').update({ is_archived: archived }).eq('id', d._db_id);
  if (error) { notify('⚠ Error', 'Could not update domain', 'var(--danger)'); setSyncStatus('error'); return false; }
  d.isArchived = archived;
  setSyncStatus('synced');
  return true;
}

async function addDomainToSupabase(domain) {
  const row = {
    user_id:               currentUser.id,
    domain_id:             domain.id,
    title:                 domain.title,
    cat:                   domain.cat,
    pri:                   domain.pri,
    time_slot:             domain.time,
    duration_mins:         domain.duration,
    freq_days:             domain.freqDays,
    base_priority:         domain.basePriority,
    urgency_deadline_days: domain.urgencyDeadlineDays || 7,
    tags:                  domain.tags || [],
    note:                  domain.note || '',
    detail_content:        domain.detailContent || [],
  };
  const { data, error } = await db.from('user_domains').insert(row).select().single();
  if (error) { notify('⚠ Error', 'Could not save domain', 'var(--danger)'); return false; }
  domain._db_id = data.id;
  return true;
}

async function removeDomainFromSupabase(domain) {
  if (domain._db_id) {
    await db.from('user_domains').delete().eq('id', domain._db_id);
  } else {
    // Fallback: delete by domain_id + user_id
    await db.from('user_domains').delete()
      .eq('user_id', currentUser.id)
      .eq('domain_id', domain.id);
  }
}

// lastDone also moves to Supabase (user_domain_progress table)
async function loadLastDoneMap() {
  const { data } = await db
    .from('user_domain_progress')
    .select('domain_id, last_done')
    .eq('user_id', currentUser.id);
  const map = {};
  if (data) data.forEach(r => { map[r.domain_id] = r.last_done; });
  state.lastDoneMap = map;
  return map;
}

async function recordDomainDone(domainId) {
  if (!domainId || !currentUser) return;
  const todayStr = today();
  // Upsert: update if exists, insert if not
  await db.from('user_domain_progress').upsert(
    { user_id: currentUser.id, domain_id: domainId, last_done: todayStr },
    { onConflict: 'user_id,domain_id' }
  );
  if (!state.lastDoneMap) state.lastDoneMap = {};
  state.lastDoneMap[domainId] = todayStr;
}

// ── SCORING ENGINE ──

const DAILY_CATS = {
  study:    { label: '▸ STUDY',    cls: 'di-cat-study' },
  work:     { label: '▸ WORK',     cls: 'di-cat-work' },
  health:   { label: '▸ HEALTH',   cls: 'di-cat-health' },
  personal: { label: '▸ PERSONAL', cls: 'di-cat-personal' },
  leisure:  { label: '▸ LEISURE',  cls: 'di-cat-leisure' },
  chore:    { label: '▸ CHORE',    cls: 'di-cat-chore' },
  other:    { label: '▸ OTHER',    cls: 'di-cat-other' },
};

function scoreDomain(domain, lastDoneDate, urgencyDays) {
  let score = domain.basePriority * 10;
  if (lastDoneDate) {
    const daysSince = Math.floor((new Date(today()) - new Date(lastDoneDate)) / 86400000);
    score += Math.max(0, daysSince - domain.freqDays) * 8;
  } else {
    score += 20; // never done — bump it up
  }
  const udl = domain.urgencyDeadlineDays || 7;
  if (urgencyDays != null && urgencyDays <= udl) {
    score += Math.max(0, udl - urgencyDays) * 5;
  }
  return score;
}

function buildUrgencyMap() {
  const map = {};
  if (!state.events) return map;
  state.events.forEach(ev => {
    if (!ev.date) return;
    const days = Math.ceil((new Date(ev.date) - new Date(today())) / 86400000);
    if (days < 0) return;
    const tl = (ev.title || '').toLowerCase();
    if (tl.includes('ctf') || tl.includes('hackathon'))
      map['cybersec']     = Math.min(map['cybersec']     ?? 9999, days);
    // Generic match: any domain whose title words appear in the event title
    // gets its urgency bumped — covers every domain, personal or not, without
    // hardcoding anyone's specific employer/project/collaborator names here.
    activeDomains().forEach(d => {
      const words = d.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      if (words.some(w => tl.includes(w)))
        map[d.id] = Math.min(map[d.id] ?? 9999, days);
    });
  });
  return map;
}

// A task/event due soon has no domain to score against, but a deadline
// shouldn't wait for a recurring-habit slot to open up — so these compete
// on the same score scale as domains (4-7 days out) or bypass caps entirely
// (<=3 days out), same as anchors do.
const TASK_CAT_MAP   = { module:'study', research:'study', project:'work', hackathon:'work', career:'work', personal:'personal' };
const EVENT_TYPE_MAP = { exam:'study', class:'study', meeting:'work', deadline:'work', personal:'personal' };

function buildDeadlineCandidates() {
  const t = today();
  const existingSourceIds = new Set(
    (state.dailyTasks || [])
      .filter(dt => dt.date === t && dt.source_id)
      .map(dt => String(dt.source_id))
  );
  const candidates = [];

  // daily_tasks.pri uses the domain vocabulary (high/medium/low — see the
  // manual-add #di-pri dropdown), not tasks.priority's high/med/low.
  const normPri = p => p === 'med' ? 'medium' : (p || 'medium');

  (state.tasks || []).forEach(tk => {
    if (tk.done || !tk.due || existingSourceIds.has(String(tk.id))) return;
    const daysUntil = Math.ceil((new Date(tk.due) - new Date(t)) / 86400000);
    if (daysUntil < 0 || daysUntil > 7) return;
    candidates.push({
      id: 'task_' + tk.id, title: tk.name,
      cat: TASK_CAT_MAP[tk.category] || 'personal',
      pri: normPri(tk.priority), time: null, endTime: null,
      note: tk.note || `Due ${tk.due}`,
      guaranteed: daysUntil <= 3,
      score: (tk.priority === 'high' ? 80 : tk.priority === 'low' ? 30 : 50) + Math.max(0, 7 - daysUntil) * 5,
      sourceType: 'task', sourceId: tk.id,
    });
  });

  (state.events || []).forEach(ev => {
    if (!ev.date || existingSourceIds.has(String(ev.id))) return;
    const daysUntil = Math.ceil((new Date(ev.date) - new Date(t)) / 86400000);
    if (daysUntil < 0 || daysUntil > 7) return;
    const isToday = daysUntil === 0;
    // Today's calendar is a fact, not a suggestion — any event actually
    // happening today (class, exam, meeting, whatever) is guaranteed in
    // with its real time. A class/meeting on a *future* day isn't a
    // deadline and doesn't belong in today's plan at all — only an
    // upcoming exam/deadline is worth surfacing as a heads-up before it
    // arrives (renderCountdowns() already does the passive version of
    // this for every high-priority event, ≤14 days, on another tab).
    if (!isToday && ev.type !== 'exam' && ev.type !== 'deadline') return;
    const isHigh = ev.type === 'exam' || ev.priority === 'high';
    candidates.push({
      id: 'event_' + ev.id, title: ev.title,
      cat: EVENT_TYPE_MAP[ev.type] || 'work',
      pri: isHigh ? 'high' : (ev.priority === 'low' ? 'low' : 'medium'),
      time: isToday ? (ev.time || null) : null,
      endTime: isToday ? (ev.end_time || null) : null,
      note: ev.note || (ev.type ? ev.type.toUpperCase() : ''),
      guaranteed: isToday || daysUntil <= 3,
      score: (isHigh ? 80 : 50) + Math.max(0, 7 - daysUntil) * 5,
      sourceType: 'event', sourceId: ev.id,
    });
  });

  return candidates;
}

function addMinutesToTime(time, mins) {
  if (!time || !mins) return null;
  const [h, m] = time.split(':').map(Number);
  const total = ((h * 60 + m + mins) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function generateDailyPlan(lastDoneMap, urgencyMap, deadlineCandidates) {
  const MAX_STUDY = 2, MAX_WORK = 3;
  const scoredDomains = activeDomains().map(d => ({
    ...d, endTime: addMinutesToTime(d.time, d.duration),
    score: scoreDomain(d, lastDoneMap[d.id] || null, urgencyMap[d.id] ?? null)
  }));
  const guaranteed = (deadlineCandidates || []).filter(c => c.guaranteed);
  const competing  = (deadlineCandidates || []).filter(c => !c.guaranteed);
  const scored = [...scoredDomains, ...competing].sort((a, b) => b.score - a.score);

  const selected = [];
  let studyCount = 0, workCount = 0, physCount = 0, leisureCount = 0;

  // Deadlines within 3 days bypass every cap below, same reasoning as anchors —
  // a due date doesn't care how many study blocks are already scheduled.
  guaranteed.forEach(d => { if (!selected.find(s => s.id === d.id)) selected.push(d); });

  // Anchors always first
  scored.filter(d => d.tags && d.tags.includes('anchor'))
    .forEach(d => { if (!selected.find(s => s.id === d.id)) selected.push(d); });

  for (const d of scored) {
    if (selected.find(s => s.id === d.id)) continue;
    if (d.cat === 'study'   && studyCount   >= MAX_STUDY) continue;
    if (d.cat === 'work'    && workCount    >= MAX_WORK)  continue;
    if (d.cat === 'health'  && physCount    >= 1)         continue;
    selected.push(d);
    if (d.cat === 'study')   studyCount++;
    if (d.cat === 'work')    workCount++;
    if (d.cat === 'health')  physCount++;
    if (d.cat === 'leisure') leisureCount++;
    if (selected.length >= 9) break;
  }

  // Guarantees
  if (physCount === 0) {
    const p = scored.find(d => d.cat === 'health' && !selected.find(s => s.id === d.id));
    if (p) selected.push(p);
  }
  if (leisureCount === 0) {
    const l = scored.find(d => d.cat === 'leisure' && !selected.find(s => s.id === d.id));
    if (l) selected.push(l);
  }

  selected.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  return selected;
}

async function runDayGenerator() {
  const lastDoneMap = state.lastDoneMap || await loadLastDoneMap();
  const urgencyMap  = buildUrgencyMap();
  const deadlineCandidates = buildDeadlineCandidates();
  const plan        = generateDailyPlan(lastDoneMap, urgencyMap, deadlineCandidates);
  const rows = plan.map(d => ({
    user_id: currentUser.id, title: d.title, cat: d.cat, pri: d.pri,
    time: d.time || null, end_time: d.endTime || null, done: false, date: today(),
    note: d.note || null,
    domain_id: d.sourceType ? null : d.id,
    source_type: d.sourceType || null,
    source_id: d.sourceId || null,
  }));
  setSyncStatus('syncing');
  const { data, error } = await db.from('daily_tasks').insert(rows).select();
  if (error) { notify('⚠ Generator Error', 'Could not save plan', 'var(--danger)'); setSyncStatus('error'); return; }
  state.dailyTasks = [...(state.dailyTasks || []), ...data];
  setSyncStatus('synced');
  // Track last-generated date in Supabase too
  await db.from('user_domain_progress').upsert(
    { user_id: currentUser.id, domain_id: '__last_gen__', last_done: today() },
    { onConflict: 'user_id,domain_id' }
  );
  state.lastGenDate = today();
  notify('◈ Day Generated!', `${activeDomains().length} domains + ${deadlineCandidates.length} deadlines scored — ${plan.length} tasks`, 'var(--accent)');
  renderDaily();
}

async function rescoreAndRebuild() {
  const todayAuto   = (state.dailyTasks || []).filter(t => t.date === today() && (t.domain_id || t.source_type));
  const doneAutoIds = todayAuto.filter(t => t.done).map(t => t.domain_id).filter(Boolean);

  // Mark done domains as last-done today in Supabase
  for (const id of doneAutoIds) await recordDomainDone(id);

  // Delete only pending auto-tasks
  const pendingAuto = todayAuto.filter(t => !t.done);
  if (pendingAuto.length > 0) {
    setSyncStatus('syncing');
    for (const t of pendingAuto) await db.from('daily_tasks').delete().eq('id', t.id);
    state.dailyTasks = state.dailyTasks.filter(t => !pendingAuto.find(p => p.id === t.id));
    setSyncStatus('synced');
  }

  // Reset last-gen marker so generator runs fresh
  await db.from('user_domain_progress').upsert(
    { user_id: currentUser.id, domain_id: '__last_gen__', last_done: null },
    { onConflict: 'user_id,domain_id' }
  );
  state.lastGenDate = null;
  await runDayGenerator();
}

function checkAutoGenOffer() {
  const todayItems = (state.dailyTasks || []).filter(t => t.date === today());
  const banner = document.getElementById('di-gen-banner');
  if (!banner) return;
  banner.style.display = (todayItems.length === 0 && state.lastGenDate !== today()) ? 'block' : 'none';
}

// ── DOMAIN MANAGER UI ──

function toggleDomainManager() {
  domainManagerOpen = !domainManagerOpen;
  const panel = document.getElementById('di-domain-panel');
  if (!panel) return;
  panel.style.display = domainManagerOpen ? 'block' : 'none';
  if (domainManagerOpen) renderDomainManager();
}

let domainManagerShowArchived = false;

function toggleDomainManagerArchived() {
  domainManagerShowArchived = !domainManagerShowArchived;
  renderDomainManager();
}

async function archiveDomainFromManager(id) {
  if (!confirm('Archive this domain? It stops scoring and drops out of the day generator, but stays readable with its logs intact.')) return;
  const ok = await setDomainArchived(id, true);
  if (!ok) return;
  notify('🗄 Archived', 'Excluded from day generation', 'var(--muted)');
  renderDomainManager();
}

async function restoreDomainFromManager(id) {
  const ok = await setDomainArchived(id, false);
  if (!ok) return;
  notify('◈ Restored', 'Back in the day generator', 'var(--accent)');
  renderDomainManager();
}

function renderDomainManager() {
  const panel = document.getElementById('di-domain-panel');
  if (!panel) return;
  const catColors = {
    study:'var(--accent3)', work:'var(--accent)', health:'var(--success)',
    personal:'var(--accent4)', leisure:'var(--accent2)', chore:'var(--muted)', other:'var(--muted)'
  };
  const active = activeDomains();
  const archived = LIFE_DOMAINS.filter(d => d.isArchived);
  let html = `
    <div class="dm-header">
      <div class="dm-title">◈ Interest Domains <span style="color:var(--muted);font-size:10px">${active.length} active · synced to cloud</span></div>
      <div class="dm-subtitle">Add new interests anytime — stored in Supabase, synced across all your devices. Core anchors can't be removed.</div>
    </div>
    <div class="dm-list">
      ${active.map(d => `
        <div class="dm-item">
          <div class="dm-item-left">
            <div class="dm-item-title">${esc(d.title)}</div>
            <div class="dm-item-meta">
              <span style="color:${catColors[d.cat]||'var(--muted)'}; font-size:10px; font-family:var(--mono);">${d.cat.toUpperCase()}</span>
              <span class="dm-pill">every ${d.freqDays}d</span>
              <span class="dm-pill">priority ${d.basePriority}/10</span>
              ${d.tags && d.tags.includes('anchor') ? '<span class="dm-pill anchor">ANCHOR</span>' : ''}
            </div>
            ${d.note ? `<div class="dm-note">${esc(d.note)}</div>` : ''}
            <button class="dom-detail-link-btn" onclick="goToDomainsTab('${d.id}')">▸ view details / plan →</button>
          </div>
          ${!d.tags || !d.tags.includes('anchor')
            ? `<button class="dm-del" onclick="archiveDomainFromManager('${d.id}')" title="Archive — stop scoring, keep logs">🗄</button>`
            : '<span style="font-size:10px;color:var(--muted);font-family:var(--mono)">CORE</span>'}
        </div>
      `).join('')}
    </div>
    ${archived.length ? `
      <div class="dm-archived-toggle" onclick="toggleDomainManagerArchived()" style="cursor:pointer;font-size:10px;color:var(--muted);font-family:var(--mono);margin:10px 0">
        ${domainManagerShowArchived ? '▾' : '▸'} ${archived.length} archived
      </div>
      ${domainManagerShowArchived ? `<div class="dm-list">
        ${archived.map(d => `
          <div class="dm-item" style="opacity:.6">
            <div class="dm-item-left">
              <div class="dm-item-title">${esc(d.title)}</div>
              <div class="dm-item-meta">
                <span style="color:${catColors[d.cat]||'var(--muted)'}; font-size:10px; font-family:var(--mono);">${d.cat.toUpperCase()}</span>
                <span class="dm-pill">ARCHIVED</span>
              </div>
              <button class="dom-detail-link-btn" onclick="goToDomainsTab('${d.id}')">▸ view details / plan →</button>
            </div>
            <div style="display:flex;gap:6px">
              <button class="dm-del" onclick="restoreDomainFromManager('${d.id}')" title="Restore">↺</button>
              <button class="dm-del" onclick="removeDomain('${d.id}')" title="Delete permanently">✕</button>
            </div>
          </div>
        `).join('')}
      </div>` : ''}
    ` : ''}
    <div class="dm-add-section">
      <div class="dm-add-title">▸ Add New Interest</div>
      <div class="dm-add-row">
        <input class="form-input" id="dm-new-title" placeholder="e.g. Japanese Study, Guitar, Swimming..." style="flex:2;min-width:140px">
        <select class="form-select" id="dm-new-cat">
          <option value="study">Study</option>
          <option value="work">Work</option>
          <option value="health">Health</option>
          <option value="personal">Personal</option>
          <option value="leisure">Leisure</option>
          <option value="chore">Chore</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div class="dm-add-row" style="margin-top:8px">
        <div style="display:flex;flex-direction:column;gap:3px;flex:1">
          <label style="font-size:9px;color:var(--muted);font-family:var(--mono)">EVERY X DAYS</label>
          <input class="form-input" id="dm-new-freq" type="number" min="1" max="30" value="2" style="width:100%">
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;flex:1">
          <label style="font-size:9px;color:var(--muted);font-family:var(--mono)">PRIORITY (1–10)</label>
          <input class="form-input" id="dm-new-pri" type="number" min="1" max="10" value="5" style="width:100%">
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;flex:1">
          <label style="font-size:9px;color:var(--muted);font-family:var(--mono)">TIME SLOT</label>
          <input class="form-input" id="dm-new-time" type="time" value="16:00" style="width:100%">
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;flex:1">
          <label style="font-size:9px;color:var(--muted);font-family:var(--mono)">DURATION (min)</label>
          <input class="form-input" id="dm-new-dur" type="number" min="5" max="480" value="45" style="width:100%">
        </div>
      </div>
      <input class="form-input" id="dm-new-note" placeholder="What you do during this session (optional)" style="width:100%;margin-top:8px">
      <div class="form-actions" style="margin-top:10px">
        <button class="btn-save" onclick="addNewDomain()">+ ADD TO ALGORITHM</button>
      </div>
    </div>`;
  panel.innerHTML = html;
}

async function addNewDomain() {
  const title = document.getElementById('dm-new-title').value.trim();
  if (!title) { notify('⚠ Error', 'Domain name required', 'var(--accent2)'); return; }
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now();
  const newDomain = {
    id, title,
    cat:                 document.getElementById('dm-new-cat').value,
    pri:                 'medium',
    time:                document.getElementById('dm-new-time').value || '16:00',
    duration:            parseInt(document.getElementById('dm-new-dur').value) || 45,
    freqDays:            parseInt(document.getElementById('dm-new-freq').value) || 2,
    basePriority:        parseInt(document.getElementById('dm-new-pri').value) || 5,
    urgencyDeadlineDays: 7,
    tags:                [],
    note:                document.getElementById('dm-new-note').value.trim() || '',
    detailContent:       [],
  };
  setSyncStatus('syncing');
  const ok = await addDomainToSupabase(newDomain);
  if (!ok) { setSyncStatus('error'); return; }
  LIFE_DOMAINS.push(newDomain);
  setSyncStatus('synced');
  const badge = document.getElementById('di-domain-count');
  if (badge) badge.textContent = activeDomains().length + ' domains';
  notify('◈ Domain Added', `"${title}" saved to cloud`, 'var(--accent)');
  renderDomainManager();
}

async function removeDomain(id) {
  const d = LIFE_DOMAINS.find(x => x.id === id);
  if (!d) return;
  if (d.tags && d.tags.includes('anchor')) { notify('⚠ Cannot Remove', 'Anchor domains are core to the system', 'var(--accent2)'); return; }
  if (!confirm(`Permanently delete "${d.title}"? This also removes its saved links, notes, checklists, and logs — this can't be undone.`)) return;
  setSyncStatus('syncing');
  await removeDomainFromSupabase(d);
  LIFE_DOMAINS = LIFE_DOMAINS.filter(x => x.id !== id);
  setSyncStatus('synced');
  const badge = document.getElementById('di-domain-count');
  if (badge) badge.textContent = activeDomains().length + ' domains';
  notify('◈ Removed', `"${d.title}" deleted from cloud`, 'var(--muted)');
  renderDomainManager();
}

// ── RENDER ──

function renderDaily() {
  const todayItems = (state.dailyTasks || []).filter(t => t.date === today());
  const total = todayItems.length;
  const done  = todayItems.filter(t => t.done).length;
  const high  = todayItems.filter(t => t.pri === 'high' && !t.done).length;
  const pct   = total ? Math.round((done / total) * 100) : 0;

  document.getElementById('di-stat-total').textContent = total;
  document.getElementById('di-stat-done').textContent  = done;
  document.getElementById('di-stat-high').textContent  = high;
  document.getElementById('di-stat-left').textContent  = total - done;

  const circ = 100.5;
  document.getElementById('di-ring-circle').style.strokeDashoffset = circ - (circ * pct / 100);
  document.getElementById('di-ring-text').textContent = pct + '%';

  const badge = document.getElementById('di-domain-count');
  if (badge) badge.textContent = activeDomains().length + ' domains';

  let list = todayItems.filter(dailyItemPassesFilters);
  document.querySelectorAll('.daily-filter-btn').forEach(b => {
    const f = b.dataset.filter;
    b.classList.toggle('active', f === 'all' ? dailyFilters.size === 0 : dailyFilters.has(f));
  });

  const PO = { high:0, medium:1, low:2 };
  list.sort((a,b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1; if (b.time) return 1;
    return (PO[a.pri]||1) - (PO[b.pri]||1);
  });

  const container = document.getElementById('dailyList');
  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state"><div>◈</div>${dailyFilters.size === 0 ? 'Hit ▸ GENERATE MY DAY to auto-plan.' : 'No tasks match this filter.'}</div>`;
    checkAutoGenOffer(); return;
  }
  checkAutoGenOffer();
  const pending  = list.filter(t => !t.done);
  const doneList = list.filter(t => t.done);
  let html = '';
  if (pending.length)  { html += `<div class="daily-section-label">To Do — ${pending.length}</div>`;                         pending.forEach(t => { html += dailyItemHTML(t); }); }
  if (doneList.length) { html += `<div class="daily-section-label" style="margin-top:20px">Completed — ${doneList.length}</div>`; doneList.forEach(t => { html += dailyItemHTML(t); }); }
  container.innerHTML = html;
}

function dailyItemHTML(t) {
  const cc = DAILY_CATS[t.cat] || DAILY_CATS.other;
  const nowMins = new Date().getHours()*60 + new Date().getMinutes();
  const isNow = t.time && (() => { const [h,m] = t.time.split(':').map(Number); return Math.abs(nowMins-(h*60+m)) <= 30; })();
  const timeStr = t.time  ? `<span class="di-time ${isNow?'now':''}">⏰ ${fmt12(t.time)}${t.end_time ? ' – ' + fmt12(t.end_time) : ''}</span>` : '';
  const noteStr = t.note  ? `<span class="di-note">${esc(t.note)}</span>` : '';
  const autoTag = t.domain_id ? `<span class="di-auto-tag">▸ AUTO</span>` : (t.source_type ? `<span class="di-auto-tag">▸ DEADLINE</span>` : '');
  const detailBtn = t.domain_id ? `<button class="dom-detail-link-btn" style="margin-top:4px" onclick="goToDomainsTab('${t.domain_id}')">▸ view details →</button>` : '';
  return `<div class="daily-item ${t.done?'di-done':''}" data-pri="${t.pri}" id="di-${t.id}">
    <div class="di-check ${t.done?'checked':''}" onclick="toggleDaily('${t.id}',${t.done})">${t.done?'✓':''}</div>
    <div class="di-body">
      <div class="di-title">${esc(t.title)}</div>
      <div class="di-meta">
        <span class="di-cat ${cc.cls}">${cc.label}</span>
        ${timeStr}
        <span class="di-pri-label di-pri-${t.pri}">${t.pri}</span>
        ${autoTag}
      </div>
      ${noteStr}
      ${detailBtn}
    </div>
    <div class="di-actions">
      <button class="di-del" onclick="deleteDaily('${t.id}')" title="Delete">✕</button>
    </div>
  </div>`;
}

function fmt12(t) {
  if (!t) return '';
  const [h,m] = t.split(':').map(Number);
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
}
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function toggleDailyFilter(tag) {
  if (tag === 'all') dailyFilters.clear();
  else if (dailyFilters.has(tag)) dailyFilters.delete(tag);
  else dailyFilters.add(tag);
  renderDaily();
}

function dailyItemPassesFilters(t) {
  if (dailyFilters.size === 0) return true;
  return Object.values(DAILY_FILTER_GROUPS).every(tags => {
    const active = tags.filter(tag => dailyFilters.has(tag));
    if (active.length === 0) return true;
    return active.some(tag => {
      if (tag === 'pending') return !t.done;
      if (tag === 'done')    return t.done;
      if (tag === 'high')    return t.pri === 'high';
      return t.cat === tag;
    });
  });
}

async function addDailyTask() {
  const inp = document.getElementById('di-input');
  const title = inp.value.trim();
  if (!title) { notify('⚠ Error', 'Task name required', 'var(--accent2)'); return; }
  const task = {
    user_id: currentUser.id, title,
    time: document.getElementById('di-time').value || null,
    cat:  document.getElementById('di-cat').value,
    pri:  document.getElementById('di-pri').value,
    done: false, date: today(), domain_id: null
  };
  setSyncStatus('syncing');
  const { data, error } = await db.from('daily_tasks').insert(task).select().single();
  if (error) { notify('⚠ Error', 'Could not save', 'var(--danger)'); setSyncStatus('error'); return; }
  if (!state.dailyTasks) state.dailyTasks = [];
  state.dailyTasks.unshift(data);
  setSyncStatus('synced');
  inp.value = ''; document.getElementById('di-time').value = '';
  notify('◈ Added', title, 'var(--accent)');
  renderDaily();
}

async function toggleDaily(id, currentDone) {
  const t = state.dailyTasks.find(x => x.id == id);
  if (!t) return;
  setSyncStatus('syncing');
  const { error } = await db.from('daily_tasks').update({ done: !currentDone }).eq('id', id);
  if (error) { setSyncStatus('error'); return; }
  t.done = !currentDone;
  if (!currentDone) {
    notify('✓ Done!', t.title, 'var(--success)');
    if (t.domain_id) await recordDomainDone(t.domain_id);
    if (t.source_type === 'task' && t.source_id) await markSourceTaskDone(t.source_id);
  }
  setSyncStatus('synced');
  renderDaily();
}

// A completed task-sourced daily item marks the real task done too — single
// source of truth, same reasoning as recordDomainDone for domain-sourced items.
// Event-sourced items have no `done` concept in the events table (no such
// column), so completing one only flips the daily_tasks row, same as a
// manually-added item.
async function markSourceTaskDone(taskId) {
  await db.from('tasks').update({ done: true }).eq('id', taskId);
  const task = (state.tasks || []).find(x => x.id === taskId);
  if (task) task.done = true;
  if (typeof renderTasks === 'function') renderTasks();
}

async function deleteDaily(id) {
  setSyncStatus('syncing');
  await db.from('daily_tasks').delete().eq('id', id);
  state.dailyTasks = (state.dailyTasks || []).filter(x => x.id != id);
  setSyncStatus('synced');
  renderDaily();
}

async function loadDailyTasks() {
  // Load tasks
  const { data: tasks } = await db.from('daily_tasks').select('*')
    .eq('user_id', currentUser.id).eq('date', today())
    .order('created_at', { ascending: false });
  state.dailyTasks = tasks || [];

  // Load domains from Supabase
  await loadDomains();

  // Load last-done map + last-gen date from Supabase
  const { data: progress } = await db.from('user_domain_progress').select('domain_id, last_done').eq('user_id', currentUser.id);
  state.lastDoneMap = {};
  state.lastGenDate = null;
  if (progress) {
    progress.forEach(r => {
      if (r.domain_id === '__last_gen__') state.lastGenDate = r.last_done;
      else state.lastDoneMap[r.domain_id] = r.last_done;
    });
  }

  renderDaily();
  checkAutoGenOffer();
}

document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('di-input');
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') addDailyTask(); });
});
