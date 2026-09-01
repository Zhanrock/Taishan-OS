// ── FINANCE: STATEMENT RECONCILIATION (Phase 5) ──
// One-time, client-side only: parses a bank-exported CSV/XLSX (via the
// SheetJS `XLSX` global) and lets the user map its columns to our fields.
// Bank export formats vary and there's no confirmed DBS CSV sample, so
// mapping sidesteps guessing a template -- the user tells us which column
// is which for *their* file. Matches each statement row against the
// transactions already in state to surface anything email capture missed
// silently. Nothing about the import is persisted; only "Add" on a missed
// row writes a real transaction.

let reconcileParsedRows = null;
let reconcileHeaders = [];
let reconcileMatchResults = null; // { matched, missed, statementCount }

function toggleReconcilePanel() {
  const el = document.getElementById('fi-reconcile-panel');
  el.classList.toggle('open');
  if (!el.classList.contains('open')) resetReconcile();
}

function resetReconcile() {
  reconcileParsedRows = null;
  reconcileHeaders = [];
  reconcileMatchResults = null;
  document.getElementById('fi-reconcile-file').value = '';
  document.getElementById('fi-reconcile-preview').innerHTML = '';
  document.getElementById('fi-reconcile-mapping').style.display = 'none';
  document.getElementById('fi-reconcile-results').innerHTML = '';
}

function handleReconcileFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!rows.length) { notify('⚠ Error', 'No rows found in that file', 'var(--accent2)'); return; }
      reconcileParsedRows = rows;
      reconcileHeaders = Object.keys(rows[0]);
      renderReconcileMapping();
    } catch (err) {
      notify('⚠ Error', 'Could not read that file -- is it a CSV or XLSX export?', 'var(--danger)');
    }
  };
  reader.readAsArrayBuffer(file);
}

function reconcileGuessColumn(patterns) {
  return reconcileHeaders.find(h => patterns.some(p => h.toLowerCase().includes(p))) || '';
}

function renderReconcileMapping() {
  const opts = (selected) => '<option value="">-- none --</option>' + reconcileHeaders.map(h =>
    `<option value="${financeEscape(h)}" ${h === selected ? 'selected' : ''}>${financeEscape(h)}</option>`).join('');

  document.getElementById('fi-reconcile-col-date').innerHTML = opts(reconcileGuessColumn(['date']));
  document.getElementById('fi-reconcile-col-desc').innerHTML = opts(reconcileGuessColumn(['description', 'narrative', 'details', 'transaction ref']));
  document.getElementById('fi-reconcile-col-debit').innerHTML = opts(reconcileGuessColumn(['debit', 'withdrawal']));
  document.getElementById('fi-reconcile-col-credit').innerHTML = opts(reconcileGuessColumn(['credit', 'deposit']));
  document.getElementById('fi-reconcile-col-ref').innerHTML = opts(reconcileGuessColumn(['reference', 'ref no', 'ref#']));

  const previewRows = reconcileParsedRows.slice(0, 3);
  document.getElementById('fi-reconcile-preview').innerHTML =
    `<div class="fi-reconcile-preview-note">${reconcileParsedRows.length} row(s) found -- confirm the column mapping below, first 3 rows shown:</div>` +
    '<div class="fi-reconcile-preview-table">' + previewRows.map(r =>
      `<div class="fi-reconcile-preview-row">${reconcileHeaders.map(h => `<span>${financeEscape(String(r[h]).slice(0, 24))}</span>`).join('')}</div>`
    ).join('') + '</div>';

  document.getElementById('fi-reconcile-mapping').style.display = '';
  document.getElementById('fi-reconcile-results').innerHTML = '';
}

function parseReconcileDate(v) {
  if (v instanceof Date) return v.toLocaleDateString('en-CA');
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

function parseReconcileAmount(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(/[,$]/g, ''));
  return isNaN(n) || n === 0 ? null : Math.abs(n);
}

function reconcileNormalize(s) { return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

function runReconcileMatch() {
  const dateCol = document.getElementById('fi-reconcile-col-date').value;
  const descCol = document.getElementById('fi-reconcile-col-desc').value;
  const debitCol = document.getElementById('fi-reconcile-col-debit').value;
  const creditCol = document.getElementById('fi-reconcile-col-credit').value;
  const refCol = document.getElementById('fi-reconcile-col-ref').value;
  if (!dateCol || (!debitCol && !creditCol)) {
    notify('⚠ Error', 'Map at least a date column and a debit or credit amount column', 'var(--accent2)');
    return;
  }

  const statementTxns = [];
  reconcileParsedRows.forEach(row => {
    const txn_date = parseReconcileDate(row[dateCol]);
    if (!txn_date) return;
    const debit = debitCol ? parseReconcileAmount(row[debitCol]) : null;
    const credit = creditCol ? parseReconcileAmount(row[creditCol]) : null;
    if (debit === null && credit === null) return;
    statementTxns.push({
      txn_date,
      amount: debit !== null ? debit : credit,
      direction: debit !== null ? 'debit' : 'credit',
      merchant: descCol ? String(row[descCol]).trim() : '',
      ref: refCol ? String(row[refCol]).trim() : '',
    });
  });

  if (!statementTxns.length) {
    notify('⚠ Error', 'No usable rows after mapping -- check the column choices', 'var(--accent2)');
    return;
  }

  const existing = state.financeTransactions;
  const matched = [];
  const missed = [];
  statementTxns.forEach(st => {
    const stDate = new Date(st.txn_date);
    const found = existing.find(t => {
      if (t.direction !== st.direction) return false;
      if (Math.abs(Number(t.amount) - st.amount) > 0.005) return false;
      if (st.ref && t.txn_ref && st.ref === t.txn_ref) return true;
      const dayDiff = Math.abs((new Date(t.txn_date) - stDate) / 86400000);
      if (dayDiff > 3) return false;
      const a = reconcileNormalize(t.merchant), b = reconcileNormalize(st.merchant);
      if (!a || !b) return true; // no merchant text on one side -- amount+date+direction is enough
      return a.includes(b.slice(0, 8)) || b.includes(a.slice(0, 8));
    });
    (found ? matched : missed).push(st);
  });

  reconcileMatchResults = { matched, missed, statementCount: statementTxns.length };
  renderReconcileResults();
}

function renderReconcileResults() {
  const { matched, missed, statementCount } = reconcileMatchResults;
  const el = document.getElementById('fi-reconcile-results');
  const summary = `<div class="fi-reconcile-summary">${statementCount} statement row(s) &middot; <span style="color:var(--success)">${matched.length} matched</span> &middot; <span style="color:var(--accent2)">${missed.length} missed</span></div>`;
  if (!missed.length) {
    el.innerHTML = summary + '<div class="empty-state" style="padding:16px"><div>✓</div>Everything on the statement is already in your transactions.</div>';
    return;
  }
  el.innerHTML = summary + '<div class="fi-reconcile-missed-list">' + missed.map((st, i) => `
    <div class="fi-unmatched-item">
      <div class="fi-unmatched-body">
        <div class="fi-unmatched-subject">${financeEscape(st.merchant || '(no description)')}</div>
        <div class="fi-unmatched-meta">${fmtDate(st.txn_date)} &middot; ${st.direction === 'credit' ? '+' : '−'}${st.amount.toFixed(2)} SGD</div>
      </div>
      <div class="fi-unmatched-actions">
        <button class="btn-save" onclick="addReconcileMissedTxn(${i})">Add</button>
      </div>
    </div>`).join('') + '</div>';
}

async function addReconcileMissedTxn(index) {
  const st = reconcileMatchResults.missed[index];
  if (!st) return;
  const row = {
    user_id: currentUser.id,
    external_id: `reconcile-${Date.now()}-${index}`,
    bank: 'statement-import',
    txn_date: st.txn_date,
    amount: st.amount,
    currency: 'SGD',
    direction: st.direction,
    merchant: st.merchant || 'Unknown',
    category: 'uncategorized',
    raw_subject: null,
    status: 'posted',
    payment_method: 'unspecified',
  };
  setSyncStatus('syncing');
  const { data, error } = await db.from('finance_transactions').insert(row).select().single();
  if (error) { notify('⚠ Error', 'Could not add transaction', 'var(--danger)'); setSyncStatus('error'); return; }
  state.financeTransactions.unshift(data);
  reconcileMatchResults.missed.splice(index, 1);
  setSyncStatus('synced');
  notify('✇ Added', st.merchant || 'Transaction');
  renderReconcileResults();
  renderFinance();
}
