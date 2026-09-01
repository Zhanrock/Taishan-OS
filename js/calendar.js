// ── CALENDAR & EVENTS ──
let calYear=new Date().getFullYear(), calMonth=new Date().getMonth(), calSelectedDate=today(), editingEventId=null;

function calNav(dir){calMonth+=dir;if(calMonth>11){calMonth=0;calYear++;}if(calMonth<0){calMonth=11;calYear--;}renderCalendar();}
function calGoToday(){const now=new Date();calYear=now.getFullYear();calMonth=now.getMonth();calSelectedDate=today();renderCalendar();}
function onEvTypeChange(){const type=document.getElementById('evType').value,isClass=type==='class';document.getElementById('evRecurringSection').style.display=isClass?'block':'none';document.getElementById('evDateLabel').textContent=isClass?'SEMESTER START':'DATE';}
function toggleEventForm(){_removeEventEditForm();editingEventId=null;const f=document.getElementById('eventAddForm');f.classList.toggle('open');if(f.classList.contains('open')){dpSet('evDate',calSelectedDate);['evTitle','evNote'].forEach(id=>document.getElementById(id).value='');['evTime','evEndTime'].forEach(id=>document.getElementById(id).value='');document.getElementById('evType').value='meeting';document.getElementById('evPriority').value='normal';document.getElementById('evRecurringSection').style.display='none';document.getElementById('evWeekPattern').value='all';document.getElementById('evTitle').focus();}}
function cancelEventForm(){document.getElementById('eventAddForm').classList.remove('open');}
function selectCalDay(dateStr){calSelectedDate=dateStr;renderCalendar();}

// ── INLINE EVENT EDIT ──
function openEditEvent(id) {
  const wasOpen = editingEventId === id;
  _removeEventEditForm();
  if (wasOpen) return;
  editingEventId = id;
  _injectEventEditForm(id);
}
function _removeEventEditForm() {
  const old = document.getElementById('inlineEventEditForm');
  if (old) old.remove();
  editingEventId = null;
}
function _injectEventEditForm(id) {
  const e = state.events.find(x => x.id === id);
  if (!e) return;
  const anchor = document.getElementById('event-' + id);
  if (!anchor) return;
  const form = document.createElement('div');
  form.className = 'add-form open';
  form.id = 'inlineEventEditForm';
  form.style.margin = '4px 0';
  form.innerHTML = `
    <div style="font-size:11px;color:var(--muted);font-family:var(--mono);letter-spacing:0.05em;margin-bottom:2px">EDIT EVENT</div>
    <div class="form-row">
      <input class="form-input" id="eeTitle" value="${e.title.replace(/"/g,'&quot;')}" placeholder="Title..." style="flex:2">
      <select class="form-select" id="eeType">
        <option value="meeting" ${e.type==='meeting'?'selected':''}>&#128203; Meeting</option>
        <option value="class" ${e.type==='class'?'selected':''}>&#128218; Class</option>
        <option value="exam" ${e.type==='exam'?'selected':''}>&#127919; Exam</option>
        <option value="deadline" ${e.type==='deadline'?'selected':''}>&#128308; Deadline</option>
        <option value="personal" ${e.type==='personal'?'selected':''}>&#11088; Personal</option>
      </select>
      <select class="form-select" id="eePriority">
        <option value="normal" ${(e.priority||'normal')==='normal'?'selected':''}>Normal</option>
        <option value="high" ${e.priority==='high'?'selected':''}>&#128308; High Priority</option>
      </select>
    </div>
    <div class="form-row">
      <div style="display:flex;flex-direction:column;gap:3px;flex:1"><label style="font-size:10px;color:var(--muted);font-family:var(--mono)">DATE</label><input class="form-input" id="eeDate" type="text" readonly data-iso="${e.date}" value="${fmtDate(e.date)}"></div>
      <div style="display:flex;flex-direction:column;gap:3px;flex:1"><label style="font-size:10px;color:var(--muted);font-family:var(--mono)">START</label><input class="form-input" id="eeTime" type="time" value="${e.time||''}"></div>
      <div style="display:flex;flex-direction:column;gap:3px;flex:1"><label style="font-size:10px;color:var(--muted);font-family:var(--mono)">END</label><input class="form-input" id="eeEndTime" type="time" value="${e.end_time||''}"></div>
    </div>
    <input class="form-input" id="eeNote" placeholder="Notes / location / link..." value="${(e.note||'').replace(/"/g,'&quot;')}" style="width:100%">
    <div class="form-actions">
      <button class="btn-cancel" onclick="_removeEventEditForm()">Cancel</button>
      <button class="btn-save" onclick="submitEditEvent()">SAVE CHANGES</button>
    </div>
  `;
  anchor.insertAdjacentElement('afterend', form);
  form.scrollIntoView({ behavior:'smooth', block:'nearest' });
  initDatePicker('eeDate');
  document.getElementById('eeTitle').focus();
}
async function submitEditEvent() {
  if (!editingEventId) return;
  const updates = { title:document.getElementById('eeTitle').value.trim(), type:document.getElementById('eeType').value, priority:document.getElementById('eePriority').value, date:document.getElementById('eeDate').dataset.iso, time:document.getElementById('eeTime').value||null, end_time:document.getElementById('eeEndTime').value||null, note:document.getElementById('eeNote').value.trim()||null };
  if (!updates.title||!updates.date) { notify('\u26A0 Error','Title and date required','var(--accent2)'); return; }
  setSyncStatus('syncing');
  await db.from('events').update(updates).eq('id', editingEventId);
  const ev = state.events.find(e => e.id === editingEventId);
  if (ev) Object.assign(ev, updates);
  setSyncStatus('synced');
  _removeEventEditForm();
  notify('\u270F Event Updated', updates.title, 'var(--accent)');
  const d = new Date(updates.date+'T00:00:00');
  calYear=d.getFullYear(); calMonth=d.getMonth();
  renderCalendar(); renderCountdowns();
}
async function deleteEvent(id) {
  setSyncStatus('syncing');
  await db.from('events').delete().eq('id',id);
  state.events=state.events.filter(e=>e.id!==id);
  setSyncStatus('synced');
  if (editingEventId===id) _removeEventEditForm();
  renderCalendar(); renderCountdowns();
  notify('\uD83D\uDDD1 Deleted','Event removed','var(--muted)');
}
// ── WEEK PARITY (odd/even week classes; week 1 = the week containing the semester start) ──
const WEEK_PATTERN_LABELS={all:'every week',odd:'odd weeks',even:'even weeks'};
function _dayNumber(d){return Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000);}
function _mondayOf(d){const m=new Date(d.getFullYear(),d.getMonth(),d.getDate());m.setDate(m.getDate()-((m.getDay()+6)%7));return m;}
function semesterWeekNumber(weekOneMonday,d){return Math.floor((_dayNumber(d)-_dayNumber(weekOneMonday))/7)+1;}
function matchesWeekPattern(pattern,weekOneMonday,d){if(pattern!=='odd'&&pattern!=='even')return true;const wk=semesterWeekNumber(weekOneMonday,d);return pattern==='odd'?wk%2===1:wk%2===0;}
async function saveEvent(){const title=document.getElementById('evTitle').value.trim(),date=document.getElementById('evDate').dataset.iso,type=document.getElementById('evType').value,priority=document.getElementById('evPriority').value;if(!title||!date){notify('\u26A0 Error','Title and date required','var(--accent2)');return;}const baseEv={user_id:currentUser.id,title,type,priority,time:document.getElementById('evTime').value||null,end_time:document.getElementById('evEndTime').value||null,note:document.getElementById('evNote').value.trim()||null};setSyncStatus('syncing');if(type==='class'){const recurEnd=document.getElementById('evRecurEnd').dataset.iso,checkedDays=[document.getElementById('evMon').checked?1:-1,document.getElementById('evTue').checked?2:-1,document.getElementById('evWed').checked?3:-1,document.getElementById('evThu').checked?4:-1,document.getElementById('evFri').checked?5:-1].filter(d=>d>=0),weekPattern=document.getElementById('evWeekPattern').value;if(recurEnd&&checkedDays.length>0){const rows=[],start=new Date(date+'T00:00:00'),end=new Date(recurEnd+'T00:00:00'),recurrId=Date.now().toString();const weekOneMonday=_mondayOf(start);for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){if(!checkedDays.includes(d.getDay()))continue;if(!matchesWeekPattern(weekPattern,weekOneMonday,d))continue;rows.push({...baseEv,date:d.toLocaleDateString('en-CA'),recur_id:recurrId});}if(rows.length>0){const{data}=await db.from('events').insert(rows).select();if(data)data.forEach(ev=>state.events.push(ev));notify('\uD83D\uDCDA Class Added',`${rows.length} sessions created \u00B7 ${WEEK_PATTERN_LABELS[weekPattern]}`,'var(--accent3)');}else{notify('\u26A0 No Sessions','No dates matched those days and week pattern','var(--accent2)');setSyncStatus('synced');return;}}else{const{data}=await db.from('events').insert({...baseEv,date}).select().single();if(data)state.events.push(data);notify('\uD83D\uDCC5 Event Saved!',title,'var(--accent3)');}}else{const{data,error}=await db.from('events').insert({...baseEv,date}).select().single();if(error){notify('\u26A0 Error','Could not save','var(--danger)');setSyncStatus('error');return;}state.events.push(data);notify('\uD83D\uDCC5 Event Saved!',title,'var(--accent3)');}setSyncStatus('synced');cancelEventForm();calSelectedDate=date;const d=new Date(date+'T00:00:00');calYear=d.getFullYear();calMonth=d.getMonth();renderCalendar();renderCountdowns();}

// ── HEATMAP: compute deadline intensity per date ──
function _buildHeatmap(year, month) {
  const map = {};
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`;
  // Count tasks with deadlines this month
  state.tasks.filter(t => t.due && t.due.startsWith(monthStr) && !t.done).forEach(t => {
    const w = t.priority === 'high' ? 3 : t.priority === 'med' ? 2 : 1;
    map[t.due] = (map[t.due] || 0) + w;
  });
  // Count urgent events this month
  state.events.filter(e => e.date.startsWith(monthStr) && (e.type==='exam'||e.priority==='high')).forEach(e => {
    map[e.date] = (map[e.date] || 0) + 3;
  });
  return map;
}

function _heatColor(intensity) {
  if (!intensity) return null;
  if (intensity >= 6) return 'rgba(255,68,68,0.25)';   // hot — red
  if (intensity >= 4) return 'rgba(255,159,106,0.22)';  // warm — orange
  if (intensity >= 2) return 'rgba(255,211,106,0.2)';   // mild — yellow
  return 'rgba(124,106,255,0.12)';                       // cool — purple
}

function renderCalendar(){
  document.getElementById('calMonthLabel').textContent=MONTH_NAMES[calMonth]+' '+calYear;
  const grid=document.getElementById('calGrid');grid.innerHTML='';
  DOW_NAMES.forEach(d=>{const el=document.createElement('div');el.className='cal-dow';el.textContent=d;grid.appendChild(el);});
  const firstDay=new Date(calYear,calMonth,1).getDay(),daysInMonth=new Date(calYear,calMonth+1,0).getDate(),prevDays=new Date(calYear,calMonth,0).getDate();
  const evMap={}, heatMap=_buildHeatmap(calYear, calMonth);
  state.events.forEach(e=>{if(!evMap[e.date])evMap[e.date]=[];evMap[e.date].push(e);});
  for(let i=firstDay-1;i>=0;i--){const cell=document.createElement('div');cell.className='cal-cell other-month';cell.innerHTML=`<div class="cal-cell-num">${prevDays-i}</div>`;grid.appendChild(cell);}
  for(let d=1;d<=daysInMonth;d++){
    const dateStr=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,isToday=dateStr===today(),isSel=dateStr===calSelectedDate,evs=evMap[dateStr]||[],hasExam=evs.some(e=>e.type==='exam'),hasHigh=evs.some(e=>e.priority==='high');
    const cell=document.createElement('div');cell.className='cal-cell'+(isToday?' today':'')+(isSel?' selected':'');
    // Heatmap background
    const heat = _heatColor(heatMap[dateStr]);
    if (heat) cell.style.background = heat;
    if(hasExam)cell.style.borderColor='#ff9f6a';else if(hasHigh)cell.style.borderColor='rgba(255,106,106,0.5)';
    cell.onclick=()=>selectCalDay(dateStr);
    let evHTML=evs.slice(0,3).map(e=>`<div class="cal-event-dot"><div class="cal-event-pip type-${e.type}"></div><div class="cal-event-label">${e.title}</div></div>`).join('');
    if(evs.length>3)evHTML+=`<div style="font-size:8px;color:var(--muted);font-family:var(--mono)">+${evs.length-3}</div>`;
    cell.innerHTML=`<div class="cal-cell-num">${d}</div>${evHTML}`;
    grid.appendChild(cell);
  }
  const totalCells=firstDay+daysInMonth,remaining=totalCells%7===0?0:7-(totalCells%7);
  for(let d=1;d<=remaining;d++){const cell=document.createElement('div');cell.className='cal-cell other-month';cell.innerHTML=`<div class="cal-cell-num">${d}</div>`;grid.appendChild(cell);}
  renderDayPanel();renderUpcoming();
}

function renderDayPanel(){
  const panel=document.getElementById('calDayPanel'),titleEl=document.getElementById('calDayTitle'),evEl=document.getElementById('calDayEvents'),emptyEl=document.getElementById('calDayEmpty');
  const d=new Date(calSelectedDate+'T00:00:00'),label=d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  titleEl.innerHTML=label+(calSelectedDate===today()?' <span>TODAY</span>':'');panel.style.display='block';
  const dayEvs=state.events.filter(e=>e.date===calSelectedDate).sort((a,b)=>(a.time||'')<(b.time||'')?-1:1);
  if(!dayEvs.length){evEl.innerHTML='';emptyEl.style.display='block';return;}emptyEl.style.display='none';
  evEl.innerHTML=dayEvs.map(e=>{
    const isHigh=e.priority==='high';
    return `<div class="event-item" id="event-${e.id}"><div class="event-color-bar type-${e.type}" style="background:${EVENT_COLORS[e.type]||'#666'}"></div><div class="event-body"><div class="event-title">${e.title} ${isHigh?'<span class="event-high-badge">HIGH PRIORITY</span>':''}</div><div class="event-meta">${e.time?`<span class="event-time">${e.time}${e.end_time?' \u2192 '+e.end_time:''}</span>`:''}<span class="event-type-tag event-type-${e.type}">${e.type}</span></div>${e.note?`<div class="event-note">${e.note}</div>`:''}</div><button class="event-del" onclick="openEditEvent('${e.id}')" title="Edit" style="font-size:12px">&#9999;</button><button class="event-del" onclick="deleteEvent('${e.id}')">&#10005;</button></div>`;
  }).join('');
  if (editingEventId) _injectEventEditForm(editingEventId);
}

function renderUpcoming(){const el=document.getElementById('calUpcoming'),t=today(),cutoff=new Date();cutoff.setDate(cutoff.getDate()+14);const cutoffStr=cutoff.toLocaleDateString('en-CA'),upcoming=state.events.filter(e=>e.date>=t&&e.date<=cutoffStr).sort((a,b)=>(a.date+(a.time||''))<(b.date+(b.time||''))?-1:1);if(!upcoming.length){el.innerHTML='<div style="font-family:var(--mono);font-size:11px;color:var(--muted);padding:12px 0">No upcoming events in the next 14 days.</div>';return;}el.innerHTML=upcoming.map(e=>{const d=new Date(e.date+'T00:00:00'),diff=Math.ceil((d-new Date(t+'T00:00:00'))/86400000),label=diff===0?'Today':diff===1?'Tomorrow':d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}),isSoon=diff<=2,isHighAlert=e.type==='exam'||e.priority==='high';return`<div class="upcoming-item"><div class="upcoming-date ${isSoon||isHighAlert?'soon':''}">${label}</div><div style="flex:1"><div style="display:flex;align-items:center;gap:6px"><div style="width:6px;height:6px;border-radius:50%;background:${EVENT_COLORS[e.type]||'#666'};flex-shrink:0"></div><div class="upcoming-title">${e.title}</div>${e.priority==='high'?'<span class="event-high-badge">HIGH</span>':''}</div><div class="upcoming-sub">${e.time?e.time+' \u00B7 ':''}${e.type}${e.note?' \u00B7 '+e.note:''}</div></div></div>`;}).join('');}
