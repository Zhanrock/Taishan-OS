// ── DATA LOADING & SEEDING ──
async function loadAllData() {
  setSyncStatus('syncing');
  try {
    const uid = currentUser.id;
    const { data: habits } = await db.from('habits').select('*').eq('user_id', uid);
    if (habits) {
      habits.forEach(row => {
        if (state.streaks[row.habit_id]) state.streaks[row.habit_id] = { count: row.count ?? 0, history: row.history ?? [], last_checked: row.last_checked ?? null };
        if (row.habit_id === 'nightChecks') { try { state.nightChecks = JSON.parse(row.last_checked || '{}'); } catch(e) {} if (row.count !== today()) state.nightChecks = { task:false, prep:false, phone:false }; }
        if (row.habit_id === 'morningCard') { try { state.morningCard = JSON.parse(row.last_checked); } catch(e) {} }
        if (row.habit_id === 'scheduleBlocks') { loadScheduleBlocksFromRow(row); }
        if (row.habit_id === 'sleepLog') {
          try {
            const sl = JSON.parse(row.last_checked);
            if (sl && (sl.date === today() || sl.date === localYesterday())) {
              sl.graceLevel = sleepGraceLevel(sl.time);
              state.sleepLog = sl;
            }
          } catch(e) {}
        }
      });
    }
    const { data: tasks } = await db.from('tasks').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    state.tasks = (tasks || []).map(t => ({ id:t.id, name:t.name, category:t.category||'personal', due:t.due||'', priority:t.priority||'med', note:t.note||'', done:t.done||false, createdOn:t.created_on||today() }));
    if (state.tasks.length === 0) await seedDefaultTasks();
    const { data: reviews } = await db.from('reviews').select('*').eq('user_id', uid).order('date', { ascending: false });
    state.reviews = reviews || [];
    const { data: events } = await db.from('events').select('*').eq('user_id', uid).order('date', { ascending: true });
    state.events = events || [];
    const { data: financeTransactions } = await db.from('finance_transactions').select('*').eq('user_id', uid).order('txn_date', { ascending: false });
    state.financeTransactions = financeTransactions || [];
    const { data: financeUnmatched } = await db.from('finance_unmatched').select('*').eq('user_id', uid).order('received_at', { ascending: false });
    state.financeUnmatched = financeUnmatched || [];
    const { data: financeRecurring } = await db.from('finance_recurring').select('*').eq('user_id', uid).order('day_of_month', { ascending: true });
    state.financeRecurring = financeRecurring || [];
    setSyncStatus('synced');
  } catch(e) { setSyncStatus('error'); console.error(e); }
  state.prevPhase = state.phase;
  computePhase();
  renderAll();
}
async function seedDefaultTasks() {
  const rows = DEFAULT_TASKS.map(t => ({ user_id: currentUser.id, name: t.name, category: t.category, due: t.due || null, priority: t.priority, note: t.note, done: false, created_on: today() }));
  const { data } = await db.from('tasks').insert(rows).select();
  if (data) state.tasks = data.map(t => ({ ...t, createdOn: t.created_on }));
}
function subscribeRealtime() {
  db.channel('taishan-sync')
    .on('postgres_changes', { event:'*', schema:'public', table:'habits',  filter:`user_id=eq.${currentUser.id}` }, () => loadAllData())
    .on('postgres_changes', { event:'*', schema:'public', table:'tasks',   filter:`user_id=eq.${currentUser.id}` }, () => loadAllData())
    .on('postgres_changes', { event:'*', schema:'public', table:'reviews', filter:`user_id=eq.${currentUser.id}` }, () => loadAllData())
    .on('postgres_changes', { event:'*', schema:'public', table:'events',  filter:`user_id=eq.${currentUser.id}` }, () => loadAllData())
    .on('postgres_changes', { event:'*', schema:'public', table:'finance_transactions', filter:`user_id=eq.${currentUser.id}` }, () => loadAllData())
    .on('postgres_changes', { event:'*', schema:'public', table:'finance_unmatched', filter:`user_id=eq.${currentUser.id}` }, () => loadAllData())
    .on('postgres_changes', { event:'*', schema:'public', table:'finance_recurring', filter:`user_id=eq.${currentUser.id}` }, () => loadAllData())
    .subscribe();
}
