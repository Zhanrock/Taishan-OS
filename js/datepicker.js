// ── CUSTOM DATE PICKER ──
// Native <input type="date"> renders in whatever format the browser/OS locale
// dictates (mm/dd/yyyy on many setups) with no reliable cross-browser override.
// This widget keeps a real popup calendar but always displays dd/mm/yyyy,
// storing the underlying ISO value in the input's dataset.iso. Drill-down
// levels: days -> months -> years, navigated via the header label/arrows.
let dpOpenInput = null, dpViewYear = 0, dpViewMonth = 0, dpLevel = 'days', dpYearsBase = 0;

function dpSet(id, iso) {
  const input = document.getElementById(id);
  if (!input) return;
  input.dataset.iso = iso || '';
  input.value = iso ? fmtDate(iso) : '';
}
function dpClear(id) { dpSet(id, ''); }

function initDatePicker(id) {
  const input = document.getElementById(id);
  if (!input || input._dpBound) return;
  input._dpBound = true;
  input.readOnly = true;
  input.classList.add('date-input');
  if (!input.placeholder) input.placeholder = 'dd/mm/yyyy';
  input.addEventListener('click', () => dpOpen(input));
}

function dpOpen(input) {
  if (dpOpenInput === input) { dpClose(); return; }
  dpOpenInput = input;
  const iso = input.dataset.iso;
  const base = iso ? new Date(iso + 'T00:00:00') : new Date();
  dpViewYear = base.getFullYear();
  dpViewMonth = base.getMonth();
  dpLevel = 'days';
  dpRender();
  const pop = document.getElementById('dpPopup');
  pop.style.display = 'block';
  const r = input.getBoundingClientRect();
  pop.style.top = (r.bottom + window.scrollY + 4) + 'px';
  pop.style.left = (r.left + window.scrollX) + 'px';
}
function dpClose() {
  dpOpenInput = null;
  const pop = document.getElementById('dpPopup');
  if (pop) pop.style.display = 'none';
}
function dpNav(dir) {
  if (dpLevel === 'years') { dpYearsBase += dir * 12; dpRender(); return; }
  if (dpLevel === 'months') { dpViewYear += dir; dpRender(); return; }
  dpViewMonth += dir;
  if (dpViewMonth > 11) { dpViewMonth = 0; dpViewYear++; }
  if (dpViewMonth < 0)  { dpViewMonth = 11; dpViewYear--; }
  dpRender();
}
function dpHeaderClick() {
  if (dpLevel === 'days') { dpLevel = 'months'; dpRender(); return; }
  if (dpLevel === 'months') { dpYearsBase = dpViewYear - 5; dpLevel = 'years'; dpRender(); }
}
function dpPickYear(y) { dpViewYear = y; dpLevel = 'months'; dpRender(); }
function dpPickMonth(m) { dpViewMonth = m; dpLevel = 'days'; dpRender(); }
function dpPick(iso) {
  dpSet(dpOpenInput.id, iso);
  dpOpenInput.dispatchEvent(new Event('change'));
  dpClose();
}

function dpRenderDays() {
  const iso = dpOpenInput.dataset.iso;
  const firstDay = new Date(dpViewYear, dpViewMonth, 1).getDay();
  const daysInMonth = new Date(dpViewYear, dpViewMonth + 1, 0).getDate();
  let cells = '';
  for (let i = 0; i < firstDay; i++) cells += `<div class="dp-cell dp-empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${dpViewYear}-${String(dpViewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isSel = dateStr === iso, isToday = dateStr === today();
    cells += `<div class="dp-cell${isSel ? ' dp-sel' : ''}${isToday ? ' dp-today' : ''}" onclick="dpPick('${dateStr}')">${d}</div>`;
  }
  return `
    <div class="dp-dow-row">${DOW_NAMES.map(d => `<div class="dp-dow">${d}</div>`).join('')}</div>
    <div class="dp-grid">${cells}</div>
  `;
}
function dpRenderMonths() {
  const iso = dpOpenInput.dataset.iso;
  const selYear = iso ? Number(iso.slice(0, 4)) : null, selMonth = iso ? Number(iso.slice(5, 7)) - 1 : null;
  const now = new Date();
  let cells = '';
  for (let m = 0; m < 12; m++) {
    const isSel = dpViewYear === selYear && m === selMonth;
    const isCurrent = dpViewYear === now.getFullYear() && m === now.getMonth();
    cells += `<div class="dp-cell-lg${isSel ? ' dp-sel' : ''}${isCurrent ? ' dp-today' : ''}" onclick="dpPickMonth(${m})">${MONTH_NAMES[m].slice(0, 3)}</div>`;
  }
  return `<div class="dp-grid-lg">${cells}</div>`;
}
function dpRenderYears() {
  const iso = dpOpenInput.dataset.iso;
  const selYear = iso ? Number(iso.slice(0, 4)) : null;
  const nowYear = new Date().getFullYear();
  let cells = '';
  for (let y = dpYearsBase; y < dpYearsBase + 12; y++) {
    const isSel = y === selYear, isCurrent = y === nowYear;
    cells += `<div class="dp-cell-lg${isSel ? ' dp-sel' : ''}${isCurrent ? ' dp-today' : ''}" onclick="dpPickYear(${y})">${y}</div>`;
  }
  return `<div class="dp-grid-lg">${cells}</div>`;
}

function dpRender() {
  const pop = document.getElementById('dpPopup');
  const label = dpLevel === 'days' ? `${MONTH_NAMES[dpViewMonth]} ${dpViewYear}`
    : dpLevel === 'months' ? `${dpViewYear}`
    : `${dpYearsBase} – ${dpYearsBase + 11}`;
  const body = dpLevel === 'days' ? dpRenderDays() : dpLevel === 'months' ? dpRenderMonths() : dpRenderYears();
  const showFooter = dpLevel === 'days';
  pop.innerHTML = `
    <div class="dp-header">
      <button type="button" class="dp-nav" onclick="dpNav(-1)">&#8249;</button>
      <span class="dp-header-label" onclick="dpHeaderClick()">${label}</span>
      <button type="button" class="dp-nav" onclick="dpNav(1)">&#8250;</button>
    </div>
    ${body}
    ${showFooter ? `
    <div class="dp-footer">
      <button type="button" class="dp-today-btn" onclick="dpPick('${today()}')">Today</button>
      ${dpOpenInput.dataset.optional === '1' ? `<button type="button" class="dp-clear-btn" onclick="dpPick('')">Clear</button>` : ''}
    </div>` : ''}
  `;
}

document.addEventListener('click', (e) => {
  if (!dpOpenInput) return;
  const pop = document.getElementById('dpPopup');
  // dpRender() replaces the popup's children on every nav/level click, detaching
  // the clicked node before this bubbles up -- pop.contains(e.target) would
  // then be false even for clicks inside the popup, so use the dispatch-time
  // path instead of the (possibly now-detached) target.
  if (e.composedPath().includes(pop) || e.target === dpOpenInput) return;
  dpClose();
});
document.addEventListener('DOMContentLoaded', () => {
  ['taskDueInput', 'evDate', 'evRecurEnd', 'fi-date-input'].forEach(initDatePicker);
});
