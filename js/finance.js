// ── FINANCE ──
function financeMonthKey(dateStr) { return (dateStr || '').slice(0, 7); }

function renderFinance() {
  const txns = state.financeTransactions;
  const thisMonth = today().slice(0, 7);
  const monthTxns = txns.filter(t => financeMonthKey(t.txn_date) === thisMonth);

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
  renderFinanceTxnList(monthTxns);
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

function renderFinanceTxnList(txns) {
  const el = document.getElementById('fi-txn-list');
  if (!txns.length) { el.innerHTML = '<div class="empty-state"><div>✇</div>No transactions synced yet. Set up finance-sync to start pulling from Gmail.</div>'; return; }
  el.innerHTML = txns.map(financeTxnHTML).join('');
}

function financeTxnHTML(t) {
  const color = FINANCE_CATEGORY_COLORS[t.category] || FINANCE_CATEGORY_COLORS.other;
  const sign = t.direction === 'credit' ? '+' : '−';
  const amtColor = t.direction === 'credit' ? 'var(--success)' : 'var(--text)';
  const catOptions = FINANCE_CATEGORIES.map(c => `<option value="${c}" ${c === t.category ? 'selected' : ''}>${c}</option>`).join('');
  return `<div class="fi-txn-item">
    <div class="fi-txn-body">
      <div class="fi-txn-merchant">${t.merchant || 'Unknown'}</div>
      <div class="fi-txn-meta">
        <span style="font-family:var(--mono);font-size:10px;color:var(--muted)">${fmtDate(t.txn_date)}</span>
        <span style="font-family:var(--mono);font-size:10px;color:var(--muted)">${t.bank}${t.account_mask ? ' ••' + t.account_mask : ''}</span>
      </div>
    </div>
    <select class="form-select fi-cat-select" style="border-color:${color};color:${color}" onchange="updateFinanceCategory('${t.id}', this.value)">${catOptions}</select>
    <div class="fi-txn-amt" style="color:${amtColor}">${sign}${Number(t.amount).toFixed(2)} <span style="font-size:10px;color:var(--muted)">${t.currency}</span></div>
  </div>`;
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

function toggleFinanceAddForm() {
  const f = document.getElementById('fi-add-form');
  f.classList.toggle('open');
  if (f.classList.contains('open')) {
    ['fi-merchant-input', 'fi-amount-input'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('fi-date-input').value = today();
    document.getElementById('fi-direction-input').value = 'debit';
    document.getElementById('fi-currency-input').value = 'SGD';
    const catSelect = document.getElementById('fi-cat-input');
    catSelect.innerHTML = FINANCE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
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
