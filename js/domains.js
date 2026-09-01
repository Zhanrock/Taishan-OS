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

// ── NAVIGATION ──

function goToDomainsTab(domainId) {
  openDomainId = domainId || null;
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

  const groups = {};
  (LIFE_DOMAINS || []).forEach(d => { (groups[d.cat] = groups[d.cat] || []).push(d); });
  const order = ['work', 'study', 'health', 'personal', 'leisure', 'chore', 'other'];

  let html = `<div class="dom-lib-intro">Every domain from your Daily Planner, in one place — tap one to see its plans, links, and logs anytime, not just when it shows up in today's tasks.</div>`;

  const catsPresent = order.filter(c => groups[c] && groups[c].length);
  if (catsPresent.length === 0) {
    html += `<div class="empty-state"><div>◈</div>No domains yet. Add some in the Daily tab's ⚙ Domains panel first.</div>`;
  }

  catsPresent.forEach(cat => {
    const cc = DAILY_CATS[cat] || DAILY_CATS.other;
    html += `<div class="dom-lib-section">
      <div class="dom-lib-section-title">${cc.label}</div>
      <div class="dom-lib-grid">
        ${groups[cat].map(d => {
          const blockCt = (d.detailContent || []).length;
          return `<div class="dom-lib-card" onclick="goToDomainsTab('${d.id}')">
            <div class="dom-lib-card-title">${esc(d.title)}</div>
            <div class="dom-lib-card-meta">${blockCt ? blockCt + ' block' + (blockCt === 1 ? '' : 's') : 'no details yet'}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  });

  container.innerHTML = html;
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
  if (b.type === 'link') {
    return `<div class="dom-block dom-block-link">${del}<a href="${escAttr(b.url)}" target="_blank" rel="noopener">🔗 ${esc(b.label || b.url)} ↗</a></div>`;
  }
  if (b.type === 'note') {
    return `<div class="dom-block dom-block-note">${del}${b.label ? `<div class="dom-block-label">${esc(b.label)}</div>` : ''}<div class="dom-block-text">${esc(b.text)}</div></div>`;
  }
  if (b.type === 'checklist') return renderChecklistBlock(d, b, i, del);
  if (b.type === 'progress_log') return renderProgressLogBlock(d, b, i, del);
  if (b.type === 'program') return `<div class="dom-block-wrap">${del}${renderProgramBlock(b)}</div>`;
  return '';
}

function renderChecklistBlock(d, b, i, del) {
  const items = b.items || [];
  const doneCt = items.filter(it => it.done).length;
  return `<div class="dom-block dom-block-checklist">
    ${del}
    <div class="dom-block-label">${esc(b.label || 'Checklist')} <span class="dom-block-sub">${doneCt}/${items.length}</span></div>
    <div class="dom-checklist-items">
      ${items.map((it, ii) => `
        <div class="dom-check-item ${it.done ? 'done' : ''}" onclick="toggleChecklistItem('${d.id}',${i},${ii})">
          <span class="dom-check-box">${it.done ? '✓' : ''}</span><span class="dom-check-text">${esc(it.text)}</span>
        </div>`).join('')}
    </div>
    <div class="dom-mini-add">
      <input class="form-input" id="dom-cl-input-${i}" placeholder="Add item...">
      <button class="btn-save" onclick="addChecklistItem('${d.id}',${i})">+</button>
    </div>
  </div>`;
}

function renderProgressLogBlock(d, b, i, del) {
  const entries = (b.entries || []).slice().sort((a, c) => (c.date || '').localeCompare(a.date || ''));
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
        ? entries.map(e => `<div class="dom-progress-entry"><span class="dom-progress-date">${esc(e.date)}</span><span class="dom-progress-note">${esc(e.note)}</span></div>`).join('')
        : `<div class="dom-progress-empty">No entries yet.</div>`}
    </div>
  </div>`;
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
  if (type === 'program') return `<textarea class="form-input" id="dom-nb-json" placeholder='Paste program JSON — { "label", "meta", "phases":[{"name","days":[{"label","items":[{"name","detail"}]}]}] }' style="min-height:100px;font-family:var(--mono);font-size:11px"></textarea>`;
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
  renderDomainLibrary();
  notify('◈ Logged', d.title, 'var(--accent)');
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
