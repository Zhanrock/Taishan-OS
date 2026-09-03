let currentUser = null;
let scheduleBlocks = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_BLOCKS)); // mutable, user-editable copy
let nightProtocolItems = JSON.parse(JSON.stringify(NIGHT_CHECKS)); // mutable, user-editable copy
let state = {
  streaks: {
    wake:     { count:0, history:[], last_checked:null },
    morning:  { count:0, history:[], last_checked:null },
    deepWork: { count:0, history:[], last_checked:null },
    noScroll: { count:0, history:[], last_checked:null },
    exercise: { count:0, history:[], last_checked:null },
    review:   { count:0, history:[], last_checked:null },
  },
  tasks:[], events:[], reviews:[], financeTransactions:[], financeUnmatched:[], financeRecurring:[],
  financeSyncState: null,
  nightChecks: { task:false, prep:false, phone:false },
  morningCard: null, sleepLog: null,
  phase:1, prevPhase:1,
};

const today      = () => new Date().toLocaleDateString('en-CA');
const todayLabel = () => new Date().toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
const getHour    = () => new Date().getHours();
const fmtDate    = (iso) => { if (!iso) return ''; const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`; };
const localYesterday = () => { const d = new Date(); d.setDate(d.getDate()-1); return d.toLocaleDateString('en-CA'); };

function setSyncStatus(s) {
  const dot = document.getElementById('syncDot'), lbl = document.getElementById('syncLabel');
  dot.className = 'sync-dot ' + s;
  lbl.textContent = s === 'syncing' ? 'SYNCING...' : s === 'synced' ? 'SYNCED' : 'SYNC ERROR';
}
function notify(title, body, color='var(--accent3)') {
  const n = document.getElementById('notif');
  document.getElementById('notifTitle').style.color = color;
  document.getElementById('notifTitle').textContent = title;
  document.getElementById('notifBody').textContent = body;
  n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 3500);
}

function sleepGraceLevel(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (h >= 18) return 'ok';
  if (h < 2 || (h === 2 && m === 0)) return 'late';
  if (h < 8) return 'grace';
  return 'ok';
}
function sleepDuration(sleepTimeStr) {
  if (!sleepTimeStr) return null;
  const [sh, sm] = sleepTimeStr.split(':').map(Number);
  const wakeMinutes = 8*60, sleepMinutes = sh*60+sm;
  const diff = sh >= 18 ? (24*60 - sleepMinutes) + wakeMinutes : wakeMinutes - sleepMinutes;
  if (diff <= 0 || diff > 16*60) return null;
  const hours = Math.floor(diff/60), minutes = diff%60;
  return minutes > 0 ? `~${hours}h ${minutes}m sleep` : `~${hours}h sleep`;
}
