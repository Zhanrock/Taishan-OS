function updateHeader() {
  const h = getHour();
  document.getElementById('timeGreet').textContent  = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const nameEl = document.getElementById('userName');
  if (nameEl) nameEl.textContent = getDisplayName() || 'there';
  document.getElementById('dateDisplay').textContent = '\u25B8 ' + todayLabel();
  // set date subtitle in daily tab
  const sub = document.getElementById('di-date-sub');
  if (sub) sub.textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'short' });
}
function switchTab(tab, el) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  el.classList.add('active');
  el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  if (tab === 'schedule') renderSchedule();
  if (tab === 'review')   renderReviews();
  if (tab === 'calendar') renderCalendar();
  if (tab === 'daily')    renderDaily();
  if (tab === 'domains')  { openDomainId = null; renderDomainLibrary(); }
  if (tab === 'finance')  renderFinance();
  if (tab === 'sleep')    renderSleepAnalytics();
}
function renderAll() {
  updateHeader();
  updatePhaseUI();
  renderStreaks();
  renderWeek();
  renderTasks();
  renderReviews();
  updateStats();
  renderCountdowns();
  renderDaily();
}
function getDisplayName() {
  return currentUser?.user_metadata?.display_name || '';
}

function showNamePrompt() {
  document.getElementById('auth-overlay').style.display = 'none';
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('name-overlay').style.display = 'flex';
  document.getElementById('name-input').focus();
}

async function saveDisplayName() {
  const input = document.getElementById('name-input');
  const errEl = document.getElementById('name-error');
  const name  = input.value.trim();
  errEl.textContent = '';
  if (!name) { errEl.textContent = 'Please enter a name.'; return; }
  const { data, error } = await db.auth.updateUser({ data: { display_name: name } });
  if (error) { errEl.textContent = error.message; return; }
  currentUser = data.user;
  document.getElementById('name-overlay').style.display = 'none';
  await initApp();
}

async function initApp() {
  // First-run: ask the user's name once, then continue.
  if (!getDisplayName()) { showNamePrompt(); return; }
  document.getElementById('auth-overlay').style.display = 'none';
  document.getElementById('name-overlay').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
  updateHeader();
  await loadAllData();
  await loadDailyTasks();
  subscribeRealtime();
}
db.auth.getSession().then(({ data: { session } }) => {
  if (session) { currentUser = session.user; initApp(); }
});
db.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) currentUser = session.user;
  if (event === 'SIGNED_OUT') location.reload();
});
