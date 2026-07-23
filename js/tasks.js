// \u2500\u2500 TASKS \u2500\u2500
let editingTaskId = null;

function renderTasks() {
  const tasks = state.tasks, pending = tasks.filter(t => !t.done).length;
  document.getElementById('taskCount').textContent = pending + ' pending';
  const hp = tasks.filter(t => !t.done && t.priority==='high')[0] || tasks.filter(t => !t.done)[0];
  document.getElementById('pinnedTask').innerHTML = hp ? taskHTML(hp) : '<div class="empty-state"><div>\u2713</div>No pending tasks!</div>';
  const sorted = [...tasks].sort((a,b) => {
    if (a.done!==b.done) return a.done?1:-1;
    const po={high:0,med:1,low:2};
    if (po[a.priority]!==po[b.priority]) return po[a.priority]-po[b.priority];
    return (a.due||'z')<(b.due||'z')?-1:1;
  });
  document.getElementById('taskList').innerHTML = sorted.length
    ? sorted.map(taskHTML).join('')
    : '<div class="empty-state"><div>\u2736</div>No tasks yet. Add one above.</div>';
  updateStats();
  if (editingTaskId) _injectTaskEditForm(editingTaskId);
}

function taskHTML(t) {
  const pClass = t.priority==='high'?'p-high':t.priority==='med'?'p-med':'p-low';
  let dueStr = '';
  if (t.due) {
    const diff = Math.ceil((new Date(t.due)-new Date(today()))/86400000);
    if(diff<0) dueStr=`<span class="task-due urgent">OVERDUE</span>`;
    else if(diff===0) dueStr=`<span class="task-due urgent">DUE TODAY</span>`;
    else if(diff<=3) dueStr=`<span class="task-due urgent">${diff}d left</span>`;
    else dueStr=`<span class="task-due">due ${fmtDate(t.due)}</span>`;
  }
  return `<div class="task-item ${t.done?'done':''}" id="task-${t.id}">
    <div class="task-check ${t.done?'checked':''}" onclick="toggleTask('${t.id}',${t.done})">${t.done?'\u2713':''}</div>
    <div class="task-body">
      <div class="task-name">${t.name}</div>
      <div class="task-meta">
        <span class="tag tag-${t.category}">${t.category}</span>
        ${dueStr}
        ${t.note?`<span style="font-size:10px;color:var(--muted);font-family:var(--mono);word-break:break-all">${t.note}</span>`:''}
      </div>
    </div>
    <div class="task-actions">
      <div class="task-priority ${pClass}"></div>
      <div class="task-action-btns">
        <button class="task-del" onclick="openEditTask('${t.id}')" title="Edit">&#9999;</button>
        <button class="task-del" onclick="deleteTask('${t.id}')">&#10005;</button>
      </div>
    </div>
  </div>`;
}

function openEditTask(id) {
  const wasOpen = editingTaskId === id;
  _removeTaskEditForm();
  if (wasOpen) return;
  editingTaskId = id;
  _injectTaskEditForm(id);
}

function _removeTaskEditForm() {
  const old = document.getElementById('inlineTaskEditForm');
  if (old) old.remove();
  editingTaskId = null;
}

function _injectTaskEditForm(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  const anchor = document.getElementById('task-' + id);
  if (!anchor) return;
  const form = document.createElement('div');
  form.className = 'add-form open';
  form.id = 'inlineTaskEditForm';
  form.innerHTML = `
    <div style="font-size:11px;color:var(--muted);font-family:var(--mono);letter-spacing:0.05em;margin-bottom:2px">EDIT TASK</div>
    <input class="form-input" id="etName" value="${t.name.replace(/"/g,'&quot;')}" placeholder="Task name..." style="width:100%">
    <div class="form-row">
      <select class="form-select" id="etCat">
        <option value="module" ${t.category==='module'?'selected':''}>&#128218; Module</option>
        <option value="research" ${t.category==='research'?'selected':''}>&#128300; Research</option>
        <option value="hackathon" ${t.category==='hackathon'?'selected':''}>&#9889; Hackathon</option>
        <option value="personal" ${t.category==='personal'?'selected':''}>&#11088; Personal</option>
      </select>
      <select class="form-select" id="etPrio">
        <option value="high" ${t.priority==='high'?'selected':''}>&#128308; High</option>
        <option value="med" ${t.priority==='med'?'selected':''}>&#128993; Medium</option>
        <option value="low" ${t.priority==='low'?'selected':''}>&#128994; Low</option>
      </select>
    </div>
    <div style="display:flex;flex-direction:column;gap:3px">
      <label style="font-size:10px;color:var(--muted);font-family:var(--mono)">DEADLINE DATE (dd/mm/yyyy)</label>
      <input class="form-input" id="etDue" type="text" placeholder="27/03/2026" maxlength="10" value="${fmtDate(t.due)||''}" style="width:100%">
    </div>
    <input class="form-input" id="etNote" placeholder="Notes..." value="${(t.note||'').replace(/"/g,'&quot;')}" style="width:100%">
    <div class="form-actions">
      <button class="btn-cancel" onclick="_removeTaskEditForm()">Cancel</button>
      <button class="btn-save" onclick="submitEditTask()">SAVE CHANGES</button>
    </div>
  `;
  anchor.insertAdjacentElement('afterend', form);
  form.scrollIntoView({ behavior:'smooth', block:'nearest' });
  document.getElementById('etName').focus();
  document.getElementById('etDue').addEventListener('input', autoDate);
}

async function submitEditTask() {
  if (!editingTaskId) return;
  const updates = {
    name:     document.getElementById('etName').value.trim(),
    category: document.getElementById('etCat').value,
    priority: document.getElementById('etPrio').value,
    due:      parseDate(document.getElementById('etDue').value.trim()) || null,
    note:     document.getElementById('etNote').value.trim()
  };
  if (!updates.name) { notify('\u26A0 Error','Task name required','var(--accent2)'); return; }
  setSyncStatus('syncing');
  await db.from('tasks').update(updates).eq('id', editingTaskId);
  const t = state.tasks.find(x => x.id === editingTaskId);
  if (t) Object.assign(t, updates);
  setSyncStatus('synced');
  _removeTaskEditForm();
  notify('\u270F Task Updated', updates.name, 'var(--accent)');
  renderTasks();
}

function toggleAddForm() {
  _removeTaskEditForm();
  const f = document.getElementById('addForm');
  f.classList.toggle('open');
  if (f.classList.contains('open')) {
    ['taskNameInput','taskDueInput','taskNoteInput'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('taskCatInput').value = 'module';
    document.getElementById('taskPrioInput').value = 'med';
    document.getElementById('taskNameInput').focus();
  }
}
function cancelTaskForm() { document.getElementById('addForm').classList.remove('open'); }

async function saveTask() {
  const name = document.getElementById('taskNameInput').value.trim();
  if (!name) { notify('\u26A0 Error','Task name required','var(--accent2)'); return; }
  const task = { user_id:currentUser.id, name, category:document.getElementById('taskCatInput').value, due:parseDate(document.getElementById('taskDueInput').value.trim())||null, priority:document.getElementById('taskPrioInput').value, note:document.getElementById('taskNoteInput').value.trim(), done:false, created_on:today() };
  setSyncStatus('syncing');
  const {data,error} = await db.from('tasks').insert(task).select().single();
  if (error) { notify('\u26A0 Error','Could not save task','var(--danger)'); setSyncStatus('error'); return; }
  state.tasks.unshift({...data, createdOn:data.created_on});
  setSyncStatus('synced');
  document.getElementById('addForm').classList.remove('open');
  ['taskNameInput','taskDueInput','taskNoteInput'].forEach(id => document.getElementById(id).value = '');
  notify('\u2736 Task Added', name);
  renderTasks();
}

async function toggleTask(id, currentDone) {
  setSyncStatus('syncing');
  const {error} = await db.from('tasks').update({done:!currentDone}).eq('id',id);
  if (error) { setSyncStatus('error'); return; }
  const t = state.tasks.find(x => x.id===id);
  if (t) { t.done = !currentDone; if (!currentDone) notify('\u2713 Completed!', t.name, 'var(--success)'); }
  setSyncStatus('synced');
  if (editingTaskId === id) _removeTaskEditForm();
  renderTasks();
}

async function deleteTask(id) {
  setSyncStatus('syncing');
  await db.from('tasks').delete().eq('id',id);
  state.tasks = state.tasks.filter(x => x.id!==id);
  setSyncStatus('synced');
  if (editingTaskId === id) _removeTaskEditForm();
  renderTasks();
}
