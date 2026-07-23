function updateHeader() {
  const h = getHour();
  document.getElementById('timeGreet').textContent  = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
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
  if (tab === 'schedule') renderSchedule();
  if (tab === 'review')   renderReviews();
  if (tab === 'calendar') renderCalendar();
  if (tab === 'daily')    renderDaily();
  if (tab === 'domains')  { openDomainId = null; renderDomainLibrary(); }
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
async function initApp() {
  document.getElementById('auth-overlay').style.display = 'none';
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
