// ── DOMAIN LIBRARY + DETAIL PAGES ──
// Generic, data-driven detail view for every Life Domain (calisthenics, research,
// study, gaming, whatever gets added later). One rendering engine, many "blocks".
//
// Block types stored in user_domains.detail_content (jsonb array):
//   { type:'link',         label, url }
//   { type:'note',         label?, text }
//   { type:'checklist',    label, items:[{ text, done }] }
//   { type:'progress_log', label, entries:[{ date, note }] }
//   { type:'program',      label, meta?, daily_note?, phases:[{
//        name, timeframe?, subtitle?, note?,
//        days:[{ label, focus?, items:[{ name, detail? }] }],
//        advance_when?
//     }], footer? }
//
// Note: content is stored per-account in Supabase (user_domains.detail_content),
// scoped by row-level security to each user's own rows. Nothing here is hardcoded
// per-user — this file only contains the generic rendering/editing engine.

let openDomainId = null;
let domainLibAddOpen = false;
// Tracks which single entry/item/block currently shows an inline edit form:
// { blockIdx, kind: 'progress'|'checklist'|'note'|'link'|'program', idx? }
let domEditTarget = null;

// ── NAVIGATION ──

function goToDomainsTab(domainId) {
  openDomainId = domainId || null;
  domEditTarget = null;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const panel = document.getElementById('panel-domains');
  if (panel) panel.classList.add('active');
  const tabBtn = document.getElementById('tab-domains-btn');
  if (tabBtn) tabBtn.classList.add('active');
  renderDomainLibrary();
}

function closeDomainDetail() {
  openDomainId = null;
  domEditTarget = null;
  renderDomainLibrary();
}

function cancelDomainEdit() {
  domEditTarget = null;
  renderDomainLibrary();
}

function escAttr(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── LIBRARY (grid of all domains, grouped by category) ──

function renderDomainLibrary() {
  const container = document.getElementById('domains-content');
  if (!container) return;

  if (openDomainId) {
    container.innerHTML = renderDomainDetailHTML(openDomainId);
    container.querySelectorAll('input[id^="dom-pl-date-"]').forEach(el => initDatePicker(el.id));
    return;
  }

  const active = activeDomains();
  const archived = (LIFE_DOMAINS || []).filter(d => d.isArchived);
  const groups = {};
  active.forEach(d => { (groups[d.cat] = groups[d.cat] || []).push(d); });
  const order = ['work', 'study', 'health', 'personal', 'leisure', 'chore', 'other'];

  let html = `<div class="dom-lib-header">
    <div class="dom-lib-intro">Every domain from your Daily Planner, in one place — tap one to see its plans, links, and logs anytime, not just when it shows up in today's tasks.</div>
    <button class="btn-add" onclick="toggleDomainLibAdd()">${domainLibAddOpen ? '✕ CANCEL' : '+ ADD DOMAIN'}</button>
  </div>
  ${domainLibAddFormHTML()}`;

  const catsPresent = order.filter(c => groups[c] && groups[c].length);
  if (catsPresent.length === 0) {
    html += `<div class="empty-state"><div>◈</div>No domains yet. Add one above.</div>`;
  }

  catsPresent.forEach(cat => {
    const cc = DAILY_CATS[cat] || DAILY_CATS.other;
    html += `<div class="dom-lib-section">
      <div class="dom-lib-section-title">${cc.label}</div>
      <div class="dom-lib-grid">
        ${groups[cat].map(d => {
          const blockCt = (d.detailContent || []).length;
          const isAnchor = d.tags && d.tags.includes('anchor');
          const delBtn = isAnchor
            ? `<span class="dom-lib-card-core" title="Core domain — can't be removed">CORE</span>`
            : `<button class="dom-lib-card-del" onclick="archiveDomainFromLibrary('${d.id}', event)" title="Archive — stop scoring, keep logs">🗄</button>`;
          return `<div class="dom-lib-card" onclick="goToDomainsTab('${d.id}')">
            ${delBtn}
            <div class="dom-lib-card-title">${esc(d.title)}</div>
            <div class="dom-lib-card-meta">${blockCt ? blockCt + ' block' + (blockCt === 1 ? '' : 's') : 'no details yet'}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  });

  if (archived.length) {
    html += `<div class="dom-lib-section">
      <div class="dom-lib-section-title" style="cursor:pointer" onclick="toggleDomainLibArchived()">
        ${domainLibShowArchived ? '▾' : '▸'} ARCHIVED (${archived.length})
      </div>
      ${domainLibShowArchived ? `<div class="dom-lib-grid">
        ${archived.map(d => {
          const blockCt = (d.detailContent || []).length;
          return `<div class="dom-lib-card" style="opacity:.6" onclick="goToDomainsTab('${d.id}')">
            <div style="position:absolute;top:6px;right:6px;display:flex;gap:4px">
              <button class="dom-lib-card-del" style="position:static" onclick="restoreDomainFromLibrary('${d.id}', event)" title="Restore">↺</button>
              <button class="dom-lib-card-del" style="position:static" onclick="removeDomainFromLibrary('${d.id}', event)" title="Delete permanently">✕</button>
            </div>
            <div class="dom-lib-card-title">${esc(d.title)}</div>
            <div class="dom-lib-card-meta">${blockCt ? blockCt + ' block' + (blockCt === 1 ? '' : 's') : 'no details yet'}</div>
          </div>`;
        }).join('')}
      </div>` : ''}
    </div>`;
  }

  container.innerHTML = html;
}

function toggleDomainLibArchived() {
  domainLibShowArchived = !domainLibShowArchived;
  renderDomainLibrary();
}

async function archiveDomainFromLibrary(id, evt) {
  if (evt) evt.stopPropagation();
  const d = LIFE_DOMAINS.find(x => x.id === id);
  if (!d) return;
  if (!confirm(`Archive "${d.title}"? It stops scoring and drops out of the day generator, but stays readable with its logs intact.`)) return;
  const ok = await setDomainArchived(id, true);
  if (!ok) return;
  notify('🗄 Archived', `"${d.title}" excluded from day generation`, 'var(--muted)');
  renderDomainLibrary();
  const badge = document.getElementById('di-domain-count');
  if (badge) badge.textContent = activeDomains().length + ' domains';
}

async function restoreDomainFromLibrary(id, evt) {
  if (evt) evt.stopPropagation();
  const d = LIFE_DOMAINS.find(x => x.id === id);
  if (!d) return;
  const ok = await setDomainArchived(id, false);
  if (!ok) return;
  notify('◈ Restored', `"${d.title}" back in the day generator`, 'var(--accent)');
  renderDomainLibrary();
  const badge = document.getElementById('di-domain-count');
  if (badge) badge.textContent = activeDomains().length + ' domains';
}

function toggleDomainLibAdd() {
  domainLibAddOpen = !domainLibAddOpen;
  renderDomainLibrary();
}

function domainLibAddFormHTML() {
  if (!domainLibAddOpen) return '';
  return `<div class="dm-add-section" id="domainLibAddForm" style="margin-bottom:20px">
    <div class="dm-add-title">▸ Add New Domain</div>
    <div class="dm-add-row">
      <input class="form-input" id="dl-new-title" placeholder="e.g. Japanese Study, Guitar, Swimming..." style="flex:2;min-width:140px">
      <select class="form-select" id="dl-new-cat">
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
        <input class="form-input" id="dl-new-freq" type="number" min="1" max="30" value="2" style="width:100%">
      </div>
      <div style="display:flex;flex-direction:column;gap:3px;flex:1">
        <label style="font-size:9px;color:var(--muted);font-family:var(--mono)">PRIORITY (1–10)</label>
        <input class="form-input" id="dl-new-pri" type="number" min="1" max="10" value="5" style="width:100%">
      </div>
      <div style="display:flex;flex-direction:column;gap:3px;flex:1">
        <label style="font-size:9px;color:var(--muted);font-family:var(--mono)">TIME SLOT</label>
        <input class="form-input" id="dl-new-time" type="time" value="16:00" style="width:100%">
      </div>
      <div style="display:flex;flex-direction:column;gap:3px;flex:1">
        <label style="font-size:9px;color:var(--muted);font-family:var(--mono)">DURATION (min)</label>
        <input class="form-input" id="dl-new-dur" type="number" min="5" max="480" value="45" style="width:100%">
      </div>
    </div>
    <input class="form-input" id="dl-new-note" placeholder="What you do during this session (optional)" style="width:100%;margin-top:8px">
    <div class="form-actions" style="margin-top:10px">
      <button class="btn-cancel" onclick="toggleDomainLibAdd()">Cancel</button>
      <button class="btn-save" onclick="addNewDomainFromLibrary()">+ ADD DOMAIN</button>
    </div>
  </div>`;
}

async function addNewDomainFromLibrary() {
  const title = document.getElementById('dl-new-title').value.trim();
  if (!title) { notify('⚠ Error', 'Domain name required', 'var(--accent2)'); return; }
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now();
  const newDomain = {
    id, title,
    cat:                 document.getElementById('dl-new-cat').value,
    pri:                 'medium',
    time:                document.getElementById('dl-new-time').value || '16:00',
    duration:            parseInt(document.getElementById('dl-new-dur').value) || 45,
    freqDays:            parseInt(document.getElementById('dl-new-freq').value) || 2,
    basePriority:        parseInt(document.getElementById('dl-new-pri').value) || 5,
    urgencyDeadlineDays: 7,
    tags:                [],
    note:                document.getElementById('dl-new-note').value.trim() || '',
    detailContent:       [],
  };
  setSyncStatus('syncing');
  const ok = await addDomainToSupabase(newDomain);
  if (!ok) { setSyncStatus('error'); return; }
  LIFE_DOMAINS.push(newDomain);
  setSyncStatus('synced');
  domainLibAddOpen = false;
  notify('◈ Domain Added', `"${title}" saved to cloud`, 'var(--accent)');
  renderDomainLibrary();
  const badge = document.getElementById('di-domain-count');
  if (badge) badge.textContent = activeDomains().length + ' domains';
}

async function removeDomainFromLibrary(id, evt) {
  if (evt) evt.stopPropagation();
  const d = LIFE_DOMAINS.find(x => x.id === id);
  if (!d) return;
  if (d.tags && d.tags.includes('anchor')) { notify('⚠ Cannot Remove', 'Anchor domains are core to the system', 'var(--accent2)'); return; }
  if (!confirm(`Permanently delete "${d.title}"? This also removes its saved links, notes, checklists, and logs — this can't be undone.`)) return;
  setSyncStatus('syncing');
  await removeDomainFromSupabase(d);
  LIFE_DOMAINS = LIFE_DOMAINS.filter(x => x.id !== id);
  setSyncStatus('synced');
  if (openDomainId === id) openDomainId = null;
  notify('◈ Removed', `"${d.title}" deleted from cloud`, 'var(--muted)');
  renderDomainLibrary();
  const badge = document.getElementById('di-domain-count');
  if (badge) badge.textContent = activeDomains().length + ' domains';
}

// ── DETAIL VIEW ──

function renderDomainDetailHTML(id) {
  const d = (LIFE_DOMAINS || []).find(x => x.id === id);
  if (!d) {
    return `<button class="dom-back-btn" onclick="closeDomainDetail()">← All Domains</button>
      <div class="empty-state"><div>◈</div>Domain not found.</div>`;
  }
  const cc = DAILY_CATS[d.cat] || DAILY_CATS.other;
  const blocks = d.detailContent || [];

  return `
    <button class="dom-back-btn" onclick="closeDomainDetail()">← All Domains</button>
    <div class="dom-detail-header">
      <div class="dom-detail-title">${esc(d.title)}</div>
      <div class="dom-detail-meta">
        <span class="di-cat ${cc.cls}">${cc.label}</span>
        <span class="dm-pill">every ${d.freqDays}d</span>
        <span class="dm-pill">priority ${d.basePriority}/10</span>
      </div>
      ${d.note ? `<div class="dom-detail-note">${esc(d.note)}</div>` : ''}
    </div>
    <div class="dom-blocks">
      ${blocks.length
        ? blocks.map((b, i) => renderDomainBlock(d, b, i)).join('')
        : `<div class="empty-state" style="padding:20px 0"><div>◈</div>No details yet. Add a link, note, checklist, or program below.</div>`}
    </div>
    ${renderAddBlockForm(d)}
  `;
}

function renderDomainBlock(d, b, i) {
  const del = `<button class="dom-block-del" onclick="deleteDomainBlock('${d.id}',${i})" title="Remove">✕</button>`;
  if (b.type === 'link') return renderLinkBlock(d, b, i, del);
  if (b.type === 'note') return renderNoteBlock(d, b, i, del);
  if (b.type === 'checklist') return renderChecklistBlock(d, b, i, del);
  if (b.type === 'progress_log') return renderProgressLogBlock(d, b, i, del);
  if (b.type === 'program') return renderProgramBlockWrap(d, b, i, del);
  return '';
}

function renderLinkBlock(d, b, i, del) {
  const edit = `<button class="dom-block-edit" onclick="openEditLinkBlock('${d.id}',${i})" title="Edit">✎</button>`;
  if (domEditTarget && domEditTarget.blockIdx === i && domEditTarget.kind === 'link') {
    return `<div class="dom-block dom-block-link">
      ${del}
      <input class="form-input" id="dom-link-edit-label-${i}" placeholder="Label" value="${escAttr(b.label || '')}" style="margin-bottom:8px">
      <input class="form-input" id="dom-link-edit-url-${i}" placeholder="https://..." value="${escAttr(b.url || '')}">
      <div class="form-actions" style="margin-top:8px">
        <button class="btn-cancel" onclick="cancelDomainEdit()">Cancel</button>
        <button class="btn-save" onclick="submitEditLinkBlock('${d.id}',${i})">SAVE</button>
      </div>
    </div>`;
  }
  return `<div class="dom-block dom-block-link">${del}${edit}<a href="${escAttr(b.url)}" target="_blank" rel="noopener">🔗 ${esc(b.label || b.url)} ↗</a></div>`;
}

function renderNoteBlock(d, b, i, del) {
  const edit = `<button class="dom-block-edit" onclick="openEditNoteBlock('${d.id}',${i})" title="Edit">✎</button>`;
  if (domEditTarget && domEditTarget.blockIdx === i && domEditTarget.kind === 'note') {
    return `<div class="dom-block dom-block-note">
      ${del}
      <input class="form-input" id="dom-note-edit-label-${i}" placeholder="Label (optional)" value="${escAttr(b.label || '')}" style="margin-bottom:8px">
      <textarea class="form-input" id="dom-note-edit-text-${i}" style="min-height:60px">${esc(b.text || '')}</textarea>
      <div class="form-actions" style="margin-top:8px">
        <button class="btn-cancel" onclick="cancelDomainEdit()">Cancel</button>
        <button class="btn-save" onclick="submitEditNoteBlock('${d.id}',${i})">SAVE</button>
      </div>
    </div>`;
  }
  return `<div class="dom-block dom-block-note">${del}${edit}${b.label ? `<div class="dom-block-label">${esc(b.label)}</div>` : ''}<div class="dom-block-text">${esc(b.text)}</div></div>`;
}

function renderChecklistBlock(d, b, i, del) {
  const items = (b.items || []).map((it, idx) => Object.assign({}, it, { _idx: idx }));
  const doneCt = items.filter(it => it.done).length;
  return `<div class="dom-block dom-block-checklist">
    ${del}
    <div class="dom-block-label">${esc(b.label || 'Checklist')} <span class="dom-block-sub">${doneCt}/${items.length}</span></div>
    <div class="dom-checklist-items">
      ${items.map(it => renderChecklistItemRow(d, i, it)).join('')}
    </div>
    <div class="dom-mini-add">
      <input class="form-input" id="dom-cl-input-${i}" placeholder="Add item...">
      <button class="btn-save" onclick="addChecklistItem('${d.id}',${i})">+</button>
    </div>
  </div>`;
}

function renderChecklistItemRow(d, blockIdx, it) {
  if (domEditTarget && domEditTarget.blockIdx === blockIdx && domEditTarget.kind === 'checklist' && domEditTarget.idx === it._idx) {
    return `<div class="dom-check-item-edit">
      <input class="form-input" id="dom-cl-edit-${blockIdx}-${it._idx}" value="${escAttr(it.text)}" style="flex:1;font-size:12px">
      <button class="btn-save" onclick="submitEditChecklistItem('${d.id}',${blockIdx},${it._idx})">SAVE</button>
      <button class="btn-cancel" onclick="cancelDomainEdit()">Cancel</button>
    </div>`;
  }
  return `<div class="dom-check-item ${it.done ? 'done' : ''}">
    <span class="dom-check-box" onclick="toggleChecklistItem('${d.id}',${blockIdx},${it._idx})">${it.done ? '✓' : ''}</span>
    <span class="dom-check-text" onclick="toggleChecklistItem('${d.id}',${blockIdx},${it._idx})">${esc(it.text)}</span>
    <button class="dom-entry-edit" onclick="openEditChecklistItem('${d.id}',${blockIdx},${it._idx})" title="Edit">✎</button>
    <button class="dom-entry-del" onclick="deleteChecklistItem('${d.id}',${blockIdx},${it._idx})" title="Delete">✕</button>
  </div>`;
}

function renderProgressLogBlock(d, b, i, del) {
  const withIdx = (b.entries || []).map((e, idx) => Object.assign({}, e, { _idx: idx }));
  const entries = withIdx.slice().sort((a, c) => (c.date || '').localeCompare(a.date || ''));
  return `<div class="dom-block dom-block-progress">
    ${del}
    <div class="dom-block-label">${esc(b.label || 'Progress Log')}</div>
    <div class="dom-mini-add">
      <input class="form-input" type="text" readonly id="dom-pl-date-${i}" data-iso="${today()}" value="${fmtDate(today())}" style="flex:0 0 150px">
      <input class="form-input" id="dom-pl-note-${i}" placeholder="What happened today...">
      <button class="btn-save" onclick="addProgressEntry('${d.id}',${i})">LOG</button>
    </div>
    <div class="dom-progress-entries">
      ${entries.length
        ? entries.map(e => renderProgressEntryRow(d, i, e)).join('')
        : `<div class="dom-progress-empty">No entries yet.</div>`}
    </div>
  </div>`;
}

function renderProgressEntryRow(d, blockIdx, e) {
  if (domEditTarget && domEditTarget.blockIdx === blockIdx && domEditTarget.kind === 'progress' && domEditTarget.idx === e._idx) {
    return `<div class="dom-progress-entry-edit">
      <input class="form-input" id="dom-pl-edit-date-${blockIdx}-${e._idx}" value="${escAttr(e.date)}" style="flex:0 0 110px;font-size:11px">
      <input class="form-input" id="dom-pl-edit-note-${blockIdx}-${e._idx}" value="${escAttr(e.note)}" style="flex:1;font-size:12px">
      <button class="btn-save" onclick="submitEditProgressEntry('${d.id}',${blockIdx},${e._idx})">SAVE</button>
      <button class="btn-cancel" onclick="cancelDomainEdit()">Cancel</button>
    </div>`;
  }
  return `<div class="dom-progress-entry">
    <span class="dom-progress-date">${esc(e.date)}</span>
    <span class="dom-progress-note">${esc(e.note)}</span>
    <button class="dom-entry-edit" onclick="openEditProgressEntry('${d.id}',${blockIdx},${e._idx})" title="Edit">✎</button>
    <button class="dom-entry-del" onclick="deleteProgressEntry('${d.id}',${blockIdx},${e._idx})" title="Delete">✕</button>
  </div>`;
}

function renderProgramBlockWrap(d, b, i, del) {
  if (domEditTarget && domEditTarget.blockIdx === i && domEditTarget.kind === 'program') {
    return `<div class="dom-block-wrap">
      ${del}
      <textarea class="form-input" id="dom-program-edit-json-${i}" spellcheck="false" style="width:100%;min-height:60vh;font-family:var(--mono);font-size:13px;line-height:1.6;white-space:pre;resize:vertical">${esc(JSON.stringify(b, null, 2))}</textarea>
      <div class="form-actions" style="margin-top:8px">
        <button class="btn-cancel" onclick="cancelDomainEdit()">Cancel</button>
        <button class="btn-save" onclick="submitEditProgramBlock('${d.id}',${i})">SAVE</button>
      </div>
    </div>`;
  }
  const edit = `<button class="dom-block-edit" onclick="openEditProgramBlock('${d.id}',${i})" title="Edit JSON">✎</button>`;
  return `<div class="dom-block-wrap">${del}${edit}${renderProgramBlock(b)}</div>`;
}

function renderProgramBlock(block) {
  return `<div class="dom-block dom-program">
    <div class="dom-program-header">
      <div class="dom-program-title">${esc(block.label || 'Program')}</div>
      ${block.meta ? `<div class="dom-program-meta">${esc(block.meta)}</div>` : ''}
    </div>
    ${block.daily_note ? `<div class="dom-program-daily"><span class="dom-program-daily-tag">▸ DAILY</span> ${esc(block.daily_note)}</div>` : ''}
    <div class="dom-program-phases">
      ${(block.phases || []).map((ph, pi) => `
        <details class="dom-phase" ${pi === 0 ? 'open' : ''}>
          <summary class="dom-phase-summary">
            <span class="dom-phase-name">${esc(ph.name)}</span>
            <span class="dom-phase-time">${esc(ph.timeframe || '')}</span>
          </summary>
          ${ph.subtitle ? `<div class="dom-phase-subtitle">${esc(ph.subtitle)}</div>` : ''}
          ${ph.note ? `<div class="dom-phase-note">${esc(ph.note)}</div>` : ''}
          <div class="dom-phase-days">
            ${(ph.days || []).map(day => `
              <div class="dom-day">
                <div class="dom-day-head">
                  <span class="dom-day-label">${esc(day.label)}</span>
                  ${day.focus ? `<span class="dom-day-focus">${esc(day.focus)}</span>` : ''}
                </div>
                ${(day.items || []).length ? `<ul class="dom-day-items">
                  ${day.items.map(it => `<li><span class="dom-item-name">${esc(it.name)}</span>${it.detail ? `<span class="dom-item-detail">${esc(it.detail)}</span>` : ''}</li>`).join('')}
                </ul>` : ''}
              </div>
            `).join('')}
          </div>
          ${ph.advance_when ? `<div class="dom-phase-advance">→ MOVE ON WHEN: ${esc(ph.advance_when)}</div>` : ''}
        </details>
      `).join('')}
    </div>
    ${block.footer ? `<div class="dom-program-footer">${esc(block.footer)}</div>` : ''}
  </div>`;
}

// ── ADD / EDIT BLOCKS ──

function renderAddBlockForm(d) {
  return `<div class="dom-add-block">
    <div class="dom-add-block-title">▸ Add Block</div>
    <select class="form-select" id="dom-new-block-type" onchange="onBlockTypeChange()">
      <option value="link">🔗 Link</option>
      <option value="note">📝 Note</option>
      <option value="checklist">☑ Checklist</option>
      <option value="progress_log">📈 Progress Log</option>
      <option value="program">▤ Program (advanced, JSON)</option>
    </select>
    <div id="dom-add-block-fields" style="margin-top:8px;display:flex;flex-direction:column;gap:8px">${addBlockFieldsHTML('link')}</div>
    <div class="form-actions" style="margin-top:10px">
      <button class="btn-save" onclick="submitNewBlock('${d.id}')">ADD BLOCK</button>
    </div>
  </div>`;
}

function addBlockFieldsHTML(type) {
  if (type === 'link') return `<input class="form-input" id="dom-nb-label" placeholder="Label (e.g. Overleaf)"><input class="form-input" id="dom-nb-url" placeholder="https://...">`;
  if (type === 'note') return `<input class="form-input" id="dom-nb-label" placeholder="Label (optional)"><textarea class="form-input" id="dom-nb-text" placeholder="Note text..." style="min-height:60px"></textarea>`;
  if (type === 'checklist') return `<input class="form-input" id="dom-nb-label" placeholder="Checklist name (e.g. Modules to finish)">`;
  if (type === 'progress_log') return `<input class="form-input" id="dom-nb-label" placeholder="Log name (e.g. Workout Log)">`;
  if (type === 'program') return `<textarea class="form-input" id="dom-nb-json" spellcheck="false" placeholder='Paste program JSON — { "label", "meta", "phases":[{"name","days":[{"label","items":[{"name","detail"}]}]}] }' style="width:100%;min-height:50vh;font-family:var(--mono);font-size:13px;line-height:1.6;white-space:pre;resize:vertical"></textarea>`;
  return '';
}

function onBlockTypeChange() {
  const type = document.getElementById('dom-new-block-type').value;
  document.getElementById('dom-add-block-fields').innerHTML = addBlockFieldsHTML(type);
}

async function submitNewBlock(domainId) {
  const d = LIFE_DOMAINS.find(x => x.id === domainId);
  if (!d) return;
  const type = document.getElementById('dom-new-block-type').value;
  let block = null;

  if (type === 'link') {
    const url = document.getElementById('dom-nb-url').value.trim();
    if (!url) { notify('⚠ Error', 'URL required', 'var(--accent2)'); return; }
    block = { type: 'link', label: document.getElementById('dom-nb-label').value.trim() || url, url };
  } else if (type === 'note') {
    const text = document.getElementById('dom-nb-text').value.trim();
    if (!text) { notify('⚠ Error', 'Note text required', 'var(--accent2)'); return; }
    block = { type: 'note', label: document.getElementById('dom-nb-label').value.trim(), text };
  } else if (type === 'checklist') {
    block = { type: 'checklist', label: document.getElementById('dom-nb-label').value.trim() || 'Checklist', items: [] };
  } else if (type === 'progress_log') {
    block = { type: 'progress_log', label: document.getElementById('dom-nb-label').value.trim() || 'Progress Log', entries: [] };
  } else if (type === 'program') {
    const raw = document.getElementById('dom-nb-json').value.trim();
    try { block = JSON.parse(raw); block.type = 'program'; }
    catch (e) { notify('⚠ Error', 'Invalid JSON', 'var(--danger)'); return; }
  }
  if (!block) return;

  const content = [...(d.detailContent || []), block];
  const ok = await saveDomainDetail(d, content);
  if (!ok) return;
  renderDomainLibrary();
  notify('◈ Block Added', d.title, 'var(--accent)');
}

async function deleteDomainBlock(domainId, idx) {
  const d = LIFE_DOMAINS.find(x => x.id === domainId);
  if (!d) return;
  const content = (d.detailContent || []).filter((_, i) => i !== idx);
  domEditTarget = null;
  const ok = await saveDomainDetail(d, content);
  if (!ok) return;
  renderDomainLibrary();
}

async function toggleChecklistItem(domainId, blockIdx, itemIdx) {
  const d = LIFE_DOMAINS.find(x => x.id === domainId);
  if (!d) return;
  const content = [...(d.detailContent || [])];
  const block = { ...content[blockIdx] };
  block.items = (block.items || []).map((it, i) => i === itemIdx ? { ...it, done: !it.done } : it);
  content[blockIdx] = block;
  const ok = await saveDomainDetail(d, content);
  if (!ok) return;
  renderDomainLibrary();
}

async function addChecklistItem(domainId, blockIdx) {
  const input = document.getElementById('dom-cl-input-' + blockIdx);
  const text = input ? input.value.trim() : '';
  if (!text) return;
  const d = LIFE_DOMAINS.find(x => x.id === domainId);
  if (!d) return;
  const content = [...(d.detailContent || [])];
  const block = { ...content[blockIdx] };
  block.items = [...(block.items || []), { text, done: false }];
  content[blockIdx] = block;
  const ok = await saveDomainDetail(d, content);
  if (!ok) return;
  renderDomainLibrary();
}

async function addProgressEntry(domainId, blockIdx) {
  const dateEl = document.getElementById('dom-pl-date-' + blockIdx);
  const noteEl = document.getElementById('dom-pl-note-' + blockIdx);
  const date = (dateEl && dateEl.dataset.iso) || today();
  const note = noteEl ? noteEl.value.trim() : '';
  if (!note) { notify('⚠ Error', 'Entry text required', 'var(--accent2)'); return; }
  const d = LIFE_DOMAINS.find(x => x.id === domainId);
  if (!d) return;
  const content = [...(d.detailContent || [])];
  const block = { ...content[blockIdx] };
  block.entries = [...(block.entries || []), { date, note }];
  content[blockIdx] = block;
  const ok = await saveDomainDetail(d, content);
  if (!ok) return;
  // This progress log is the signal people actually keep day to day — logging
  // here counts as "did it today" for the day generator's overdue scoring,
  // instead of relying on ticking off the separate generated daily task.
  if (date === today()) await recordDomainDone(d.id);
  renderDomainLibrary();
  notify('◈ Logged', d.title, 'var(--accent)');
}

// ── EDIT / DELETE INDIVIDUAL ENTRIES ──

function openEditProgressEntry(domainId, blockIdx, entryIdx) {
  domEditTarget = { blockIdx, kind: 'progress', idx: entryIdx };
  renderDomainLibrary();
}

async function submitEditProgressEntry(domainId, blockIdx, entryIdx) {
  const dateEl = document.getElementById(`dom-pl-edit-date-${blockIdx}-${entryIdx}`);
  const noteEl = document.getElementById(`dom-pl-edit-note-${blockIdx}-${entryIdx}`);
  const note = noteEl ? noteEl.value.trim() : '';
  if (!note) { notify('⚠ Error', 'Entry text required', 'var(--accent2)'); return; }
  const d = LIFE_DOMAINS.find(x => x.id === domainId);
  if (!d) return;
  const content = [...(d.detailContent || [])];
  const block = { ...content[blockIdx] };
  block.entries = (block.entries || []).map((e, idx) => idx === entryIdx
    ? { date: (dateEl && dateEl.value.trim()) || e.date, note }
    : e);
  content[blockIdx] = block;
  const ok = await saveDomainDetail(d, content);
  if (!ok) return;
  domEditTarget = null;
  renderDomainLibrary();
  notify('✓ Entry updated', d.title, 'var(--accent)');
}

async function deleteProgressEntry(domainId, blockIdx, entryIdx) {
  const d = LIFE_DOMAINS.find(x => x.id === domainId);
  if (!d) return;
  const content = [...(d.detailContent || [])];
  const block = { ...content[blockIdx] };
  block.entries = (block.entries || []).filter((_, idx) => idx !== entryIdx);
  content[blockIdx] = block;
  if (domEditTarget && domEditTarget.blockIdx === blockIdx && domEditTarget.kind === 'progress' && domEditTarget.idx === entryIdx) domEditTarget = null;
  const ok = await saveDomainDetail(d, content);
  if (!ok) return;
  renderDomainLibrary();
  notify('🗑 Entry removed', '', 'var(--muted)');
}

function openEditChecklistItem(domainId, blockIdx, itemIdx) {
  domEditTarget = { blockIdx, kind: 'checklist', idx: itemIdx };
  renderDomainLibrary();
}

async function submitEditChecklistItem(domainId, blockIdx, itemIdx) {
  const input = document.getElementById(`dom-cl-edit-${blockIdx}-${itemIdx}`);
  const text = input ? input.value.trim() : '';
  if (!text) { notify('⚠ Error', 'Item text required', 'var(--accent2)'); return; }
  const d = LIFE_DOMAINS.find(x => x.id === domainId);
  if (!d) return;
  const content = [...(d.detailContent || [])];
  const block = { ...content[blockIdx] };
  block.items = (block.items || []).map((it, idx) => idx === itemIdx ? { ...it, text } : it);
  content[blockIdx] = block;
  const ok = await saveDomainDetail(d, content);
  if (!ok) return;
  domEditTarget = null;
  renderDomainLibrary();
  notify('✓ Item updated', d.title, 'var(--accent)');
}

async function deleteChecklistItem(domainId, blockIdx, itemIdx) {
  const d = LIFE_DOMAINS.find(x => x.id === domainId);
  if (!d) return;
  const content = [...(d.detailContent || [])];
  const block = { ...content[blockIdx] };
  block.items = (block.items || []).filter((_, idx) => idx !== itemIdx);
  content[blockIdx] = block;
  if (domEditTarget && domEditTarget.blockIdx === blockIdx && domEditTarget.kind === 'checklist' && domEditTarget.idx === itemIdx) domEditTarget = null;
  const ok = await saveDomainDetail(d, content);
  if (!ok) return;
  renderDomainLibrary();
  notify('🗑 Item removed', '', 'var(--muted)');
}

function openEditNoteBlock(domainId, blockIdx) {
  domEditTarget = { blockIdx, kind: 'note' };
  renderDomainLibrary();
}

async function submitEditNoteBlock(domainId, blockIdx) {
  const labelEl = document.getElementById(`dom-note-edit-label-${blockIdx}`);
  const textEl = document.getElementById(`dom-note-edit-text-${blockIdx}`);
  const text = textEl ? textEl.value.trim() : '';
  if (!text) { notify('⚠ Error', 'Note text required', 'var(--accent2)'); return; }
  const d = LIFE_DOMAINS.find(x => x.id === domainId);
  if (!d) return;
  const content = [...(d.detailContent || [])];
  content[blockIdx] = { ...content[blockIdx], label: labelEl ? labelEl.value.trim() : '', text };
  const ok = await saveDomainDetail(d, content);
  if (!ok) return;
  domEditTarget = null;
  renderDomainLibrary();
  notify('✓ Note updated', d.title, 'var(--accent)');
}

function openEditLinkBlock(domainId, blockIdx) {
  domEditTarget = { blockIdx, kind: 'link' };
  renderDomainLibrary();
}

async function submitEditLinkBlock(domainId, blockIdx) {
  const labelEl = document.getElementById(`dom-link-edit-label-${blockIdx}`);
  const urlEl = document.getElementById(`dom-link-edit-url-${blockIdx}`);
  const url = urlEl ? urlEl.value.trim() : '';
  if (!url) { notify('⚠ Error', 'URL required', 'var(--accent2)'); return; }
  const d = LIFE_DOMAINS.find(x => x.id === domainId);
  if (!d) return;
  const content = [...(d.detailContent || [])];
  content[blockIdx] = { ...content[blockIdx], label: (labelEl && labelEl.value.trim()) || url, url };
  const ok = await saveDomainDetail(d, content);
  if (!ok) return;
  domEditTarget = null;
  renderDomainLibrary();
  notify('✓ Link updated', d.title, 'var(--accent)');
}

function openEditProgramBlock(domainId, blockIdx) {
  domEditTarget = { blockIdx, kind: 'program' };
  renderDomainLibrary();
}

async function submitEditProgramBlock(domainId, blockIdx) {
  const el = document.getElementById(`dom-program-edit-json-${blockIdx}`);
  const raw = el ? el.value.trim() : '';
  let block;
  try { block = JSON.parse(raw); block.type = 'program'; }
  catch (e) { notify('⚠ Error', 'Invalid JSON', 'var(--danger)'); return; }
  const d = LIFE_DOMAINS.find(x => x.id === domainId);
  if (!d) return;
  const content = [...(d.detailContent || [])];
  content[blockIdx] = block;
  const ok = await saveDomainDetail(d, content);
  if (!ok) return;
  domEditTarget = null;
  renderDomainLibrary();
  notify('✓ Program updated', d.title, 'var(--accent)');
}

// ── PERSISTENCE ──

async function saveDomainDetail(domain, content) {
  domain.detailContent = content;
  if (!domain._db_id) { notify('⚠ Error', 'Domain not synced yet — try again shortly', 'var(--accent2)'); return false; }
  setSyncStatus('syncing');
  const { error } = await db.from('user_domains').update({ detail_content: content }).eq('id', domain._db_id);
  if (error) { notify('⚠ Error', 'Could not save details', 'var(--danger)'); setSyncStatus('error'); return false; }
  setSyncStatus('synced');
  return true;
}
