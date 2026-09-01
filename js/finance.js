// ── FINANCE ──
let financeViewMonth = today().slice(0, 7);
let financeSearchQuery = '';
let financeFilterCategory = 'all';
let financeEditingId = null;
let financeConfirmDeleteId = null;
let financeUnmatchedOpen = false;

function financeMonthKey(dateStr) { return (dateStr || '').slice(0, 7); }

function financeMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function changeFinanceMonth(delta) {
  const [y, m] = financeViewMonth.split('-').map(Number);
  const next = new Date(y, m - 1 + delta, 1).toLocaleDateString('en-CA').slice(0, 7);
  if (next > today().slice(0, 7)) return; // never navigate into the future
  financeViewMonth = next;
  financeEditingId = null;
  financeConfirmDeleteId = null;
  renderFinance();
}

function setFinanceSearch(v) { financeSearchQuery = v.trim().toLowerCase(); renderFinanceTxnList(financeCurrentMonthTxns()); }
function setFinanceCategoryFilter(v) { financeFilterCategory = v; renderFinanceTxnList(financeCurrentMonthTxns()); }
function financeCurrentMonthTxns() { return state.financeTransactions.filter(t => financeMonthKey(t.txn_date) === financeViewMonth); }

function renderFinance() {
  const monthTxns = financeCurrentMonthTxns();

  document.getElementById('fi-month-label').textContent = financeMonthLabel(financeViewMonth);
  document.getElementById('fi-month-next').disabled = financeViewMonth >= today().slice(0, 7);

  // Never sum across currencies -- group first, then show the currency with
  // the most activity this month as the headline; list the rest separately
  // rather than silently mixing THB into an SGD total.
  const byCurrency = {};
  monthTxns.forEach(t => {
    const cur = t.currency || 'SGD';
    const bucket = byCurrency[cur] || (byCurrency[cur] = { spent: 0, income: 0, count: 0 });
    const amt = Number(t.amount) || 0;
    if (t.direction === 'credit') bucket.income += amt; else bucket.spent += amt;
    bucket.count++;
  });
  const currencies = Object.keys(byCurrency).sort((a, b) => byCurrency[b].count - byCurrency[a].count);
  const primary = currencies[0] || 'SGD';
  const p = byCurrency[primary] || { spent: 0, income: 0, count: 0 };

  document.getElementById('fi-stat-spent').textContent = `${p.spent.toFixed(2)} ${primary}`;
  document.getElementById('fi-stat-income').textContent = `${p.income.toFixed(2)} ${primary}`;
  document.getElementById('fi-stat-net').textContent = `${(p.income - p.spent).toFixed(2)} ${primary}`;
  document.getElementById('fi-stat-count').textContent = monthTxns.length;
  const savingsRate = p.income > 0 ? ((p.income - p.spent) / p.income) * 100 : null;
  document.getElementById('fi-stat-savings').textContent = savingsRate === null ? '—' : `${savingsRate.toFixed(0)}%`;

  const otherEl = document.getElementById('fi-stat-other-currencies');
  const others = currencies.slice(1);
  if (others.length) {
    otherEl.textContent = 'Also this month (not converted): ' + others.map(c => {
      const b = byCurrency[c];
      return `${(b.income - b.spent).toFixed(2)} ${c} net`;
    }).join(', ');
    otherEl.style.display = '';
  } else {
    otherEl.style.display = 'none';
  }

  renderFinanceCategoryBreakdown(monthTxns);
  renderFinancePaymentMethodBreakdown(monthTxns);
  renderFinanceTrend();
  renderFinanceTxnList(monthTxns);
  renderFinanceUnmatched();
  renderFinanceRecurring();
}

function renderFinanceCategoryBreakdown(monthTxns) {
  const byCat = {};
  monthTxns.filter(t => t.direction === 'debit').forEach(t => {
    byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount);
  });
  const total = Object.values(byCat).reduce((s, v) => s + v, 0);
  const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const el = document.getElementById('fi-cat-breakdown');
  if (!rows.length) { el.innerHTML = '<div class="empty-state"><div>◈</div>No spending this month yet.</div>'; return; }
  el.innerHTML = rows.map(([cat, amt]) => {
    const pct = total ? Math.round((amt / total) * 100) : 0;
    const color = FINANCE_CATEGORY_COLORS[cat] || FINANCE_CATEGORY_COLORS.other;
    return `<div class="fi-cat-row">
      <div class="fi-cat-label"><span class="fi-cat-dot" style="background:${color}"></span>${cat}</div>
      <div class="fi-cat-bar-bg"><div class="fi-cat-bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="fi-cat-amt">${amt.toFixed(2)}</div>
    </div>`;
  }).join('');
}

const FINANCE_METHOD_LABELS = {
  paynow: 'PayNow', nets_qr: 'NETS QR', nets_card: 'NETS Card', card: 'Card',
  contactless: 'Contactless', giro: 'GIRO', fast: 'FAST Transfer', atm: 'ATM',
  manual: 'Manual entry', recurring: 'Recurring',
};
function financeMethodLabel(method) { return FINANCE_METHOD_LABELS[method] || 'Unspecified'; }

function renderFinancePaymentMethodBreakdown(monthTxns) {
  const byMethod = {};
  monthTxns.filter(t => t.direction === 'debit').forEach(t => {
    const method = t.payment_method || 'unspecified';
    byMethod[method] = (byMethod[method] || 0) + Number(t.amount);
  });
  const total = Object.values(byMethod).reduce((s, v) => s + v, 0);
  const rows = Object.entries(byMethod).sort((a, b) => b[1] - a[1]);
  const el = document.getElementById('fi-method-breakdown');
  if (!rows.length) { el.innerHTML = '<div class="empty-state"><div>◈</div>No spending this month yet.</div>'; return; }
  el.innerHTML = rows.map(([method, amt]) => {
    const pct = total ? Math.round((amt / total) * 100) : 0;
    return `<div class="fi-cat-row">
      <div class="fi-cat-label">${financeMethodLabel(method)}</div>
      <div class="fi-cat-bar-bg"><div class="fi-cat-bar-fill" style="width:${pct}%;background:var(--accent3)"></div></div>
      <div class="fi-cat-amt">${amt.toFixed(2)}</div>
    </div>`;
  }).join('');
}

function renderFinanceTrend() {
  const el = document.getElementById('fi-trend');
  const [vy, vm] = financeViewMonth.split('-').map(Number);
  const months = [];
  for (let i = 5; i >= 0; i--) months.push(new Date(vy, vm - 1 - i, 1).toLocaleDateString('en-CA').slice(0, 7));

  // Six months of a possible currency switch can't be summed together either
  // -- use whichever currency dominates this window rather than mixing.
  const currCounts = {};
  state.financeTransactions.forEach(t => {
    if (!months.includes(financeMonthKey(t.txn_date))) return;
    const cur = t.currency || 'SGD';
    currCounts[cur] = (currCounts[cur] || 0) + 1;
  });
  const trendCurrency = Object.keys(currCounts).sort((a, b) => currCounts[b] - currCounts[a])[0] || 'SGD';

  const byMonth = {};
  months.forEach(m => byMonth[m] = { spent: 0, income: 0 });
  state.financeTransactions.forEach(t => {
    const mk = financeMonthKey(t.txn_date);
    if (!(mk in byMonth) || (t.currency || 'SGD') !== trendCurrency) return;
    const amt = Number(t.amount) || 0;
    if (t.direction === 'credit') byMonth[mk].income += amt; else byMonth[mk].spent += amt;
  });
  const maxVal = Math.max(1, ...months.map(m => Math.max(byMonth[m].spent, byMonth[m].income)));

  const bars = months.map(m => {
    const b = byMonth[m];
    const label = new Date(m + '-01').toLocaleDateString('en-GB', { month: 'short' });
    const spentH = Math.round((b.spent / maxVal) * 100);
    const incomeH = Math.round((b.income / maxVal) * 100);
    return `<div class="fi-trend-col" title="${label}: ${b.income.toFixed(2)} in, ${b.spent.toFixed(2)} out (${trendCurrency})">
      <div class="fi-trend-bar-pair">
        <div class="fi-trend-bar fi-trend-bar-income" style="height:${incomeH}%"></div>
        <div class="fi-trend-bar fi-trend-bar-spent" style="height:${spentH}%"></div>
      </div>
      <div class="fi-trend-label">${label}${m === financeViewMonth ? ' •' : ''}</div>
    </div>`;
  }).join('');
  el.innerHTML = `<div class="fi-trend-currency">${trendCurrency} &mdash; income (left) vs spent (right) per month</div><div class="fi-trend-bars">${bars}</div>`;
}

function ensureFinanceCategoryFilterOptions() {
  const sel = document.getElementById('fi-filter-cat');
  if (sel.options.length <= 1) {
    sel.innerHTML = '<option value="all">All categories</option>' + FINANCE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
  }
  sel.value = financeFilterCategory;
}

function renderFinanceTxnList(monthTxns) {
  ensureFinanceCategoryFilterOptions();
  const el = document.getElementById('fi-txn-list');
  let txns = monthTxns;
  if (financeFilterCategory !== 'all') txns = txns.filter(t => t.category === financeFilterCategory);
  if (financeSearchQuery) txns = txns.filter(t => (t.merchant || '').toLowerCase().includes(financeSearchQuery));
  if (!txns.length) { el.innerHTML = '<div class="empty-state"><div>✦</div>No matching transactions.</div>'; return; }
  el.innerHTML = txns.map(financeTxnHTML).join('');
}

function financeTxnHTML(t) {
  if (financeEditingId === t.id) return financeTxnEditHTML(t);
  const color = FINANCE_CATEGORY_COLORS[t.category] || FINANCE_CATEGORY_COLORS.other;
  const sign = t.direction === 'credit' ? '+' : '−';
  const amtColor = t.direction === 'credit' ? 'var(--success)' : 'var(--text)';
  const catOptions = FINANCE_CATEGORIES.map(c => `<option value="${c}" ${c === t.category ? 'selected' : ''}>${c}</option>`).join('');
  const pendingBadge = t.status === 'pending' ? '<span class="fi-pending-badge">PENDING</span>' : '';
  const estimatedBadge = t.is_estimated ? '<span class="fi-pending-badge fi-estimated-badge" title="Declared under Recurring, not confirmed by a bank alert">ESTIMATED</span>' : '';
  const actions = financeConfirmDeleteId === t.id
    ? `<div class="fi-txn-confirm"><span>Delete?</span><button class="fi-txn-confirm-yes" onclick="deleteFinanceTxn('${t.id}')">Yes</button><button class="fi-txn-confirm-no" onclick="cancelFinanceDelete()">No</button></div>`
    : `<button class="fi-txn-del" title="Delete" onclick="requestFinanceDelete('${t.id}')">&#10005;</button>`;
  return `<div class="fi-txn-item">
    <div class="fi-txn-body" onclick="startFinanceEdit('${t.id}')">
      <div class="fi-txn-merchant">${t.merchant || 'Unknown'} ${pendingBadge}${estimatedBadge}</div>
      <div class="fi-txn-meta">
        <span style="font-family:var(--mono);font-size:10px;color:var(--muted)">${fmtDate(t.txn_date)}</span>
        <span style="font-family:var(--mono);font-size:10px;color:var(--muted)">${t.bank}${t.account_mask ? ' ••' + t.account_mask : ''}</span>
      </div>
    </div>
    <select class="form-select fi-cat-select" style="border-color:${color};color:${color}" onchange="updateFinanceCategory('${t.id}', this.value)" onclick="event.stopPropagation()">${catOptions}</select>
    <div class="fi-txn-amt" style="color:${amtColor}">${sign}${Number(t.amount).toFixed(2)} <span style="font-size:10px;color:var(--muted)">${t.currency}</span></div>
    ${actions}
  </div>`;
}

function financeTxnEditHTML(t) {
  const catOptions = FINANCE_CATEGORIES.map(c => `<option value="${c}" ${c === t.category ? 'selected' : ''}>${c}</option>`).join('');
  const merchant = (t.merchant || '').replace(/"/g, '&quot;');
  return `<div class="fi-txn-item fi-txn-item-edit">
    <div class="fi-txn-edit-fields">
      <div class="form-row">
        <input class="form-input" id="fi-edit-merchant-${t.id}" value="${merchant}" style="flex:2">
        <input class="form-input" id="fi-edit-amount-${t.id}" type="number" step="0.01" value="${t.amount}" style="flex:1">
      </div>
      <div class="form-row">
        <input class="form-input" id="fi-edit-date-${t.id}" type="date" value="${t.txn_date}" style="flex:1">
        <select class="form-select" id="fi-edit-direction-${t.id}">
          <option value="debit" ${t.direction === 'debit' ? 'selected' : ''}>Debit</option>
          <option value="credit" ${t.direction === 'credit' ? 'selected' : ''}>Credit</option>
        </select>
        <select class="form-select" id="fi-edit-cat-${t.id}">${catOptions}</select>
      </div>
      <div class="form-actions"><button class="btn-cancel" onclick="cancelFinanceEdit()">Cancel</button><button class="btn-save" onclick="saveFinanceEdit('${t.id}')">SAVE</button></div>
    </div>
  </div>`;
}

function startFinanceEdit(id) { financeEditingId = id; financeConfirmDeleteId = null; renderFinanceTxnList(financeCurrentMonthTxns()); }
function cancelFinanceEdit() { financeEditingId = null; renderFinanceTxnList(financeCurrentMonthTxns()); }

async function saveFinanceEdit(id) {
  const merchant = document.getElementById(`fi-edit-merchant-${id}`).value.trim();
  const amount = parseFloat(document.getElementById(`fi-edit-amount-${id}`).value);
  const txn_date = document.getElementById(`fi-edit-date-${id}`).value;
  const direction = document.getElementById(`fi-edit-direction-${id}`).value;
  const category = document.getElementById(`fi-edit-cat-${id}`).value;
  if (!merchant || !amount || !txn_date) { notify('⚠ Error', 'Merchant, amount and date are required', 'var(--accent2)'); return; }
  setSyncStatus('syncing');
  const { error } = await db.from('finance_transactions').update({ merchant, amount, txn_date, direction, category }).eq('id', id);
  if (error) { notify('⚠ Error', 'Could not save changes', 'var(--danger)'); setSyncStatus('error'); return; }
  const t = state.financeTransactions.find(x => x.id === id);
  if (t) Object.assign(t, { merchant, amount, txn_date, direction, category });
  financeEditingId = null;
  setSyncStatus('synced');
  renderFinance();
}

function requestFinanceDelete(id) { financeConfirmDeleteId = id; financeEditingId = null; renderFinanceTxnList(financeCurrentMonthTxns()); }
function cancelFinanceDelete() { financeConfirmDeleteId = null; renderFinanceTxnList(financeCurrentMonthTxns()); }

async function deleteFinanceTxn(id) {
  setSyncStatus('syncing');
  const { error } = await db.from('finance_transactions').delete().eq('id', id);
  if (error) { notify('⚠ Error', 'Could not delete transaction', 'var(--danger)'); setSyncStatus('error'); return; }
  state.financeTransactions = state.financeTransactions.filter(x => x.id !== id);
  financeConfirmDeleteId = null;
  setSyncStatus('synced');
  renderFinance();
}

async function updateFinanceCategory(id, category) {
  setSyncStatus('syncing');
  const { error } = await db.from('finance_transactions').update({ category }).eq('id', id);
  if (error) { notify('⚠ Error', 'Could not update category', 'var(--danger)'); setSyncStatus('error'); return; }
  const t = state.financeTransactions.find(x => x.id === id);
  if (t) t.category = category;
  setSyncStatus('synced');
  renderFinance();
}

function renderFinanceUnmatched() {
  const list = (state.financeUnmatched || []).filter(u => !u.resolved);
  const badge = document.getElementById('fi-unmatched-badge');
  badge.textContent = list.length;
  badge.style.display = list.length ? '' : 'none';
  document.getElementById('fi-unmatched-toggle').textContent = financeUnmatchedOpen ? '▸' : '▾';

  const el = document.getElementById('fi-unmatched-list');
  el.style.display = financeUnmatchedOpen ? '' : 'none';
  if (!financeUnmatchedOpen) return;

  if (!list.length) { el.innerHTML = '<div class="empty-state" style="padding:16px"><div>✓</div>Nothing unmatched.</div>'; return; }
  el.innerHTML = list.map(u => `<div class="fi-unmatched-item">
    <div class="fi-unmatched-body">
      <div class="fi-unmatched-subject">${financeEscape(u.subject || '(no subject)')}</div>
      <div class="fi-unmatched-meta">${u.received_at ? fmtDate(u.received_at.slice(0, 10)) : ''} &middot; ${financeEscape(u.reason || '')}</div>
      <div class="fi-unmatched-snippet">${financeEscape((u.snippet || '').slice(0, 160))}</div>
    </div>
    <div class="fi-unmatched-actions">
      <button class="btn-cancel" onclick="useFinanceUnmatchedForManual('${u.id}')">Add as manual</button>
      <button class="btn-save" onclick="resolveFinanceUnmatched('${u.id}')">Resolve</button>
    </div>
  </div>`).join('');
}

function financeEscape(s) { return String(s).replace(/</g, '&lt;'); }

function toggleFinanceUnmatched() { financeUnmatchedOpen = !financeUnmatchedOpen; renderFinanceUnmatched(); }

async function resolveFinanceUnmatched(id) {
  setSyncStatus('syncing');
  const { error } = await db.from('finance_unmatched').update({ resolved: true }).eq('id', id);
  if (error) { notify('⚠ Error', 'Could not resolve item', 'var(--danger)'); setSyncStatus('error'); return; }
  const u = state.financeUnmatched.find(x => x.id === id);
  if (u) u.resolved = true;
  setSyncStatus('synced');
  renderFinanceUnmatched();
}

function useFinanceUnmatchedForManual(id) {
  const u = state.financeUnmatched.find(x => x.id === id);
  if (!u) return;
  toggleFinanceAddForm(true);
  document.getElementById('fi-merchant-input').value = extractLikelyMerchant(u.snippet || '') || u.subject || '';
  const amt = extractLikelyAmount(u.snippet || '');
  if (amt) document.getElementById('fi-amount-input').value = amt;
  document.getElementById('fi-currency-input').value = extractLikelyCurrency(u.snippet || '');
  if (u.received_at) document.getElementById('fi-date-input').value = u.received_at.slice(0, 10);
  document.getElementById('fi-merchant-input').focus();
}

// ── Paste-an-alert (best-effort client-side extraction; the real parsing
// lives in finance-sync/parsers -- this is only meant to save typing for a
// manual entry, never to silently create a transaction on its own) ──
function extractLikelyAmount(text) {
  const m = (text || '').match(/(?:SGD|S\$|THB|฿)\s?([\d,]+\.\d{2})/i) || (text || '').match(/([\d,]+\.\d{2})\s?(?:SGD|THB)/i);
  return m ? parseFloat(m[1].replace(/,/g, '')) : null;
}
function extractLikelyCurrency(text) {
  if (/THB|฿/i.test(text)) return 'THB';
  return 'SGD';
}
function extractLikelyMerchant(text) {
  const m = (text || '').match(/(?:to|at|from)\s+([A-Z][A-Za-z0-9&.,'\- ]{2,40})/);
  return m ? m[1].trim() : '';
}

function toggleFinancePasteBox() {
  document.getElementById('fi-paste-box').classList.toggle('open');
}
function cancelFinancePasteBox() {
  document.getElementById('fi-paste-box').classList.remove('open');
  document.getElementById('fi-paste-input').value = '';
}
function extractFinancePaste() {
  const raw = document.getElementById('fi-paste-input').value;
  if (!raw.trim()) return;
  toggleFinanceAddForm(true);
  const amount = extractLikelyAmount(raw);
  if (amount) document.getElementById('fi-amount-input').value = amount;
  document.getElementById('fi-currency-input').value = extractLikelyCurrency(raw);
  document.getElementById('fi-merchant-input').value = extractLikelyMerchant(raw);
  cancelFinancePasteBox();
  notify('✇ Extracted', 'Best-effort guess -- check the fields before saving', 'var(--accent3)');
  document.getElementById('fi-merchant-input').focus();
}

function exportFinanceCsv() {
  const txns = financeCurrentMonthTxns();
  const cols = ['txn_date', 'merchant', 'amount', 'currency', 'direction', 'category', 'payment_method', 'status', 'bank'];
  const csvEscape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [cols.join(',')].concat(txns.map(t => cols.map(c => csvEscape(t[c])).join(',')));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finance-${financeViewMonth}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toggleFinanceAddForm(skipReset) {
  const f = document.getElementById('fi-add-form');
  const catSelect = document.getElementById('fi-cat-input');
  if (!catSelect.options.length) catSelect.innerHTML = FINANCE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
  if (skipReset) { f.classList.add('open'); return; }
  f.classList.toggle('open');
  if (f.classList.contains('open')) {
    ['fi-merchant-input', 'fi-amount-input'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('fi-date-input').value = today();
    document.getElementById('fi-direction-input').value = 'debit';
    document.getElementById('fi-currency-input').value = 'SGD';
    catSelect.value = 'uncategorized';
    document.getElementById('fi-merchant-input').focus();
  }
}
function cancelFinanceForm() { document.getElementById('fi-add-form').classList.remove('open'); }

async function saveManualTransaction() {
  const merchant = document.getElementById('fi-merchant-input').value.trim();
  const amount = parseFloat(document.getElementById('fi-amount-input').value);
  const txnDate = document.getElementById('fi-date-input').value;
  if (!merchant || !amount || !txnDate) { notify('⚠ Error', 'Merchant, amount and date are required', 'var(--accent2)'); return; }
  const row = {
    user_id: currentUser.id,
    external_id: `manual-${Date.now()}`,
    bank: 'manual',
    txn_date: txnDate,
    amount,
    currency: document.getElementById('fi-currency-input').value,
    direction: document.getElementById('fi-direction-input').value,
    merchant,
    category: document.getElementById('fi-cat-input').value,
    raw_subject: null,
    status: 'posted',
    payment_method: 'manual',
  };
  setSyncStatus('syncing');
  const { data, error } = await db.from('finance_transactions').insert(row).select().single();
  if (error) { notify('⚠ Error', 'Could not save transaction', 'var(--danger)'); setSyncStatus('error'); return; }
  state.financeTransactions.unshift(data);
  setSyncStatus('synced');
  cancelFinanceForm();
  notify('✇ Transaction Added', merchant);
  renderFinance();
}

// ── Recurring declarations (DBS never alerts on these -- see README's "DBS
// alerting rules" -- so finance-sync/recurring.py materializes an
// is_estimated=true finance_transactions row for each one, once per month,
// on sync. This section is only the declaration CRUD; materialization
// itself runs server-side on schedule, not from the browser.) ──
function renderFinanceRecurring() {
  const el = document.getElementById('fi-recurring-list');
  const list = state.financeRecurring || [];
  if (!list.length) {
    el.innerHTML = '<div class="empty-state" style="padding:16px"><div>&#8635;</div>No recurring items declared. DBS can\'t see these -- declare them here.</div>';
    return;
  }
  el.innerHTML = list.map(financeRecurringHTML).join('');
}

function financeRecurringHTML(r) {
  const sign = r.direction === 'credit' ? '+' : '−';
  const amtColor = r.direction === 'credit' ? 'var(--success)' : 'var(--text)';
  return `<div class="fi-txn-item${r.active ? '' : ' fi-recurring-inactive'}">
    <div class="fi-txn-body">
      <div class="fi-txn-merchant">${financeEscape(r.name)}</div>
      <div class="fi-txn-meta">
        <span style="font-family:var(--mono);font-size:10px;color:var(--muted)">day ${r.day_of_month} of month</span>
        <span style="font-family:var(--mono);font-size:10px;color:var(--muted);text-transform:capitalize">${r.category}${r.active ? '' : ' &middot; paused'}</span>
      </div>
    </div>
    <div class="fi-txn-amt" style="color:${amtColor}">${sign}${Number(r.amount).toFixed(2)} <span style="font-size:10px;color:var(--muted)">${r.currency}</span></div>
    <button class="fi-recurring-toggle" onclick="toggleFinanceRecurringActive('${r.id}', ${!r.active})">${r.active ? 'Pause' : 'Resume'}</button>
    <button class="fi-txn-del" title="Delete" onclick="deleteFinanceRecurring('${r.id}')">&#10005;</button>
  </div>`;
}

function toggleFinanceRecurringForm() {
  const f = document.getElementById('fi-recurring-form');
  const catSelect = document.getElementById('fi-rec-cat-input');
  if (!catSelect.options.length) catSelect.innerHTML = FINANCE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
  f.classList.toggle('open');
  if (f.classList.contains('open')) {
    document.getElementById('fi-rec-name-input').value = '';
    document.getElementById('fi-rec-amount-input').value = '';
    document.getElementById('fi-rec-day-input').value = '';
    document.getElementById('fi-rec-direction-input').value = 'debit';
    document.getElementById('fi-rec-currency-input').value = 'SGD';
    catSelect.value = 'bills';
    document.getElementById('fi-rec-name-input').focus();
  }
}
function cancelFinanceRecurringForm() { document.getElementById('fi-recurring-form').classList.remove('open'); }

async function saveFinanceRecurring() {
  const name = document.getElementById('fi-rec-name-input').value.trim();
  const amount = parseFloat(document.getElementById('fi-rec-amount-input').value);
  const day = parseInt(document.getElementById('fi-rec-day-input').value, 10);
  if (!name || !amount || !day || day < 1 || day > 28) {
    notify('⚠ Error', 'Name, amount and a day of month (1-28) are required', 'var(--accent2)');
    return;
  }
  const row = {
    user_id: currentUser.id,
    name,
    amount,
    currency: document.getElementById('fi-rec-currency-input').value,
    direction: document.getElementById('fi-rec-direction-input').value,
    category: document.getElementById('fi-rec-cat-input').value,
    day_of_month: day,
    active: true,
  };
  setSyncStatus('syncing');
  const { data, error } = await db.from('finance_recurring').insert(row).select().single();
  if (error) { notify('⚠ Error', 'Could not save recurring item', 'var(--danger)'); setSyncStatus('error'); return; }
  state.financeRecurring.push(data);
  state.financeRecurring.sort((a, b) => a.day_of_month - b.day_of_month);
  setSyncStatus('synced');
  cancelFinanceRecurringForm();
  notify('↻ Recurring Added', name);
  renderFinanceRecurring();
}

async function toggleFinanceRecurringActive(id, active) {
  setSyncStatus('syncing');
  const { error } = await db.from('finance_recurring').update({ active }).eq('id', id);
  if (error) { notify('⚠ Error', 'Could not update recurring item', 'var(--danger)'); setSyncStatus('error'); return; }
  const r = state.financeRecurring.find(x => x.id === id);
  if (r) r.active = active;
  setSyncStatus('synced');
  renderFinanceRecurring();
}

async function deleteFinanceRecurring(id) {
  setSyncStatus('syncing');
  const { error } = await db.from('finance_recurring').delete().eq('id', id);
  if (error) { notify('⚠ Error', 'Could not delete recurring item', 'var(--danger)'); setSyncStatus('error'); return; }
  state.financeRecurring = state.financeRecurring.filter(x => x.id !== id);
  setSyncStatus('synced');
  renderFinanceRecurring();
}
