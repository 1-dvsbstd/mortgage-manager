(() => {
  const HISTORY_KEY = 'mortgage-manager-mortgage-history-v1';
  const SUMMARY_KEY = 'mortgage-manager-mortgage-history-summary-v1';
  const $ = (id) => document.getElementById(id);
  const money = (value) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(Math.max(0, Number(value) || 0));

  const defaultData = () => ({ purchaseDate:'', purchasePrice:'', originalMortgage:'', ownership:'', deals:[], lumpSums:[] });

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || 'null');
      return parsed && typeof parsed === 'object'
        ? { ...defaultData(), ...parsed, deals:Array.isArray(parsed.deals)?parsed.deals:[], lumpSums:Array.isArray(parsed.lumpSums)?parsed.lumpSums:[] }
        : defaultData();
    } catch (_) { return defaultData(); }
  }

  function monthIndex(value) {
    if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
    const [y,m] = value.split('-').map(Number);
    return y * 12 + (m - 1);
  }

  function currentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  function activeDeal(deals, month) {
    const idx = monthIndex(month);
    if (idx === null) return null;
    return deals.find((deal) => {
      const start = monthIndex(deal.start);
      const end = monthIndex(deal.end);
      if (start === null || idx < start) return false;
      return end === null ? true : idx < end;
    }) || null;
  }

  function addMonths(month, amount) {
    const idx = monthIndex(month);
    if (idx === null) return '';
    const next = idx + amount;
    const y = Math.floor(next / 12);
    const m = (next % 12) + 1;
    return `${y}-${String(m).padStart(2,'0')}`;
  }

  function estimateHistory(data) {
    const original = Math.max(0, Number(data.originalMortgage) || 0);
    const purchaseMonth = data.purchaseDate ? data.purchaseDate.slice(0,7) : '';
    const startIndex = monthIndex(purchaseMonth);
    const endIndex = monthIndex(currentMonthKey());
    if (!original || startIndex === null || endIndex === null || endIndex < startIndex) {
      return { historicalInterest:0, historicalPayments:0, coveredMonths:0, totalMonths:0, complete:false, estimatedBalance:original || 0 };
    }

    const lumpMap = new Map();
    data.lumpSums.forEach((item) => {
      const month = (item.date || '').slice(0,7);
      const amount = Math.max(0, Number(item.amount) || 0);
      if (month && amount) lumpMap.set(month, (lumpMap.get(month) || 0) + amount);
    });

    let balance = original;
    let interestPaid = 0;
    let paymentsMade = 0;
    let coveredMonths = 0;
    const totalMonths = Math.max(0, endIndex - startIndex + 1);

    for (let i = 0; i < totalMonths && balance > 0.005; i += 1) {
      const month = addMonths(purchaseMonth, i);
      const deal = activeDeal(data.deals, month);
      if (deal) {
        const rate = Math.max(0, Number(deal.rate) || 0);
        const scheduled = Math.max(0, Number(deal.payment) || 0);
        const overpay = Math.max(0, Number(deal.overpayment) || 0);
        if (scheduled > 0) {
          coveredMonths += 1;
          const interest = balance * (rate / 100 / 12);
          const due = Math.min(balance + interest, scheduled + overpay);
          interestPaid += interest;
          paymentsMade += due;
          balance = Math.max(0, balance + interest - due);
        }
      }
      const lump = Math.min(balance, lumpMap.get(month) || 0);
      if (lump > 0) {
        balance -= lump;
        paymentsMade += lump;
      }
    }

    return {
      historicalInterest: interestPaid,
      historicalPayments: paymentsMade,
      coveredMonths,
      totalMonths,
      complete: totalMonths > 0 && coveredMonths / totalMonths >= 0.95,
      estimatedBalance: balance,
    };
  }

  function save(data) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(data));
    const estimate = estimateHistory(data);
    const actualBalance = Math.max(0, Number($('balance')?.value) || 0);
    const summary = {
      purchasePrice: Math.max(0, Number(data.purchasePrice) || 0),
      originalMortgage: Math.max(0, Number(data.originalMortgage) || 0),
      purchaseDate: data.purchaseDate || '',
      ownership: Math.min(100, Math.max(0, Number(data.ownership) || 0)),
      ...estimate,
      actualBalance,
      balanceDifference: actualBalance ? estimate.estimatedBalance - actualBalance : 0,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SUMMARY_KEY, JSON.stringify(summary));
    document.dispatchEvent(new CustomEvent('mortgage-history-updated', { detail: summary }));
    return summary;
  }

  function syncPurchaseToHome(summary) {
    if (!summary.purchasePrice) return;
    try {
      const key = 'mortgage-manager-home-projection-v4';
      const settings = JSON.parse(localStorage.getItem(key) || '{}');
      if (!Number(settings.purchasePrice)) settings.purchasePrice = summary.purchasePrice;
      if (!settings.purchaseMonth && summary.purchaseDate) settings.purchaseMonth = summary.purchaseDate;
      localStorage.setItem(key, JSON.stringify(settings));
    } catch (_) {}
  }

  function escape(value) {
    return String(value ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function dealRow(deal = {}) {
    return `<div class="history-row history-deal-row" data-history-deal>
      <label>From<input type="month" data-history="start" value="${escape(deal.start)}"></label>
      <label>To<input type="month" data-history="end" value="${escape(deal.end)}"></label>
      <label>Rate (%)<input type="number" inputmode="decimal" step="0.01" data-history="rate" value="${escape(deal.rate)}"></label>
      <label>Payment (£/mo)<input type="number" inputmode="decimal" step="0.01" data-history="payment" value="${escape(deal.payment)}"></label>
      <label>Overpay (£/mo)<input type="number" inputmode="decimal" step="0.01" data-history="overpayment" value="${escape(deal.overpayment)}"></label>
      <button type="button" class="history-remove" data-remove-history aria-label="Remove deal">Remove</button>
    </div>`;
  }

  function lumpRow(item = {}) {
    return `<div class="history-row history-lump-row" data-history-lump>
      <label>Date<input type="month" data-history="date" value="${escape((item.date || '').slice(0,7))}"></label>
      <label>Amount (£)<input type="number" inputmode="decimal" step="0.01" data-history="amount" value="${escape(item.amount)}"></label>
      <label class="history-note-label">Note<input type="text" data-history="note" value="${escape(item.note)}" placeholder="Optional"></label>
      <button type="button" class="history-remove" data-remove-history aria-label="Remove lump sum">Remove</button>
    </div>`;
  }

  function readFromSection(section) {
    const data = defaultData();
    section.querySelectorAll('[data-history-root]').forEach((field) => { data[field.dataset.historyRoot] = field.value; });
    data.deals = [...section.querySelectorAll('[data-history-deal]')].map((row) => {
      const out = {};
      row.querySelectorAll('[data-history]').forEach((field) => { out[field.dataset.history] = field.value; });
      return out;
    }).filter((row) => row.start || row.end || row.rate || row.payment || row.overpayment);
    data.lumpSums = [...section.querySelectorAll('[data-history-lump]')].map((row) => {
      const out = {};
      row.querySelectorAll('[data-history]').forEach((field) => { out[field.dataset.history] = field.value; });
      return out;
    }).filter((row) => row.date || row.amount || row.note);
    return data;
  }

  function renderSummary(section, data = load()) {
    const target = section.querySelector('[data-history-summary]');
    if (!target) return;
    const estimate = estimateHistory(data);
    if (!Number(data.originalMortgage) || !data.purchaseDate) {
      target.innerHTML = '<span>Add purchase date and original mortgage to start reconstructing your history.</span>';
      return;
    }
    const coverage = estimate.totalMonths ? Math.round((estimate.coveredMonths / estimate.totalMonths) * 100) : 0;
    const actualBalance = Math.max(0, Number($('balance')?.value) || 0);
    const difference = actualBalance ? estimate.estimatedBalance - actualBalance : 0;
    const diffText = !actualBalance ? 'Current balance unavailable' : Math.abs(difference) < 1 ? 'Matches current balance' : `${money(Math.abs(difference))} ${difference > 0 ? 'above' : 'below'} current balance`;
    target.innerHTML = `
      <div><span>Estimated past interest</span><strong>${money(estimate.historicalInterest)}</strong></div>
      <div><span>Estimated payments made</span><strong>${money(estimate.historicalPayments)}</strong></div>
      <div><span>History coverage</span><strong>${coverage}%</strong></div>
      <div><span>Reconstructed balance</span><strong>${money(estimate.estimatedBalance)}</strong></div>
      <small>${diffText}. ${estimate.complete ? 'The entered deal periods substantially cover the mortgage history.' : 'Add missing deal periods for a more complete estimate.'}</small>`;
  }

  function persistSection(section, flash = false) {
    if (!section?.isConnected) return null;
    const data = readFromSection(section);
    const summary = save(data);
    syncPurchaseToHome(summary);
    renderSummary(section, data);
    const state = section.querySelector('[data-history-save-state]');
    if (state) {
      state.textContent = flash ? 'Saved' : 'Saved automatically';
      clearTimeout(state._clearTimer);
      state._clearTimer = setTimeout(() => { if (state.isConnected) state.textContent = 'Saved automatically'; }, 1200);
    }
    return summary;
  }

  function mount() {
    const modal = document.querySelector('.personal-modal');
    if (!modal || modal.querySelector('#mortgageHistorySection')) return;
    const data = load();
    const section = document.createElement('details');
    section.id = 'mortgageHistorySection';
    section.className = 'personal-section mortgage-history-section';
    section.innerHTML = `<summary><span><strong>Mortgage history</strong><small>Purchase, previous fixed deals and lump-sum overpayments</small></span><span class="history-summary-chevron">+</span></summary>
      <div class="mortgage-history-body">
        <p class="history-intro">Use the actual completion price rather than the estate-agent listing price. For each deal, Payment is the lender's normal required payment and Overpay is the extra paid on top. “To” is treated as the month the next deal starts.</p>
        <div class="history-purchase-grid">
          <label>Purchase / completion date<input type="month" data-history-root="purchaseDate" value="${escape((data.purchaseDate || '').slice(0,7))}"></label>
          <label>Actual purchase price (£)<input type="number" inputmode="decimal" step="100" data-history-root="purchasePrice" value="${escape(data.purchasePrice)}"></label>
          <label>Original mortgage (£)<input type="number" inputmode="decimal" step="100" data-history-root="originalMortgage" value="${escape(data.originalMortgage)}"></label>
          <label>Share owned at purchase (%)<input type="number" inputmode="decimal" step="1" min="0" max="100" data-history-root="ownership" value="${escape(data.ownership)}"></label>
        </div>
        <div class="history-subsection"><div class="history-subhead"><div><strong>Mortgage deals</strong><small>Add each fixed/variable period you can reconstruct.</small></div><button type="button" class="personal-button" data-add-deal>Add deal</button></div><div data-deal-list>${data.deals.map(dealRow).join('') || dealRow()}</div></div>
        <div class="history-subsection"><div class="history-subhead"><div><strong>One-off overpayments</strong><small>Optional — regular monthly overpayments belong on the relevant deal.</small></div><button type="button" class="personal-button" data-add-lump>Add lump sum</button></div><div data-lump-list>${data.lumpSums.map(lumpRow).join('')}</div></div>
        <div class="history-calculation" data-history-summary></div>
        <div class="history-actions"><span data-history-save-state>Saved automatically</span><button type="button" class="personal-button primary" data-save-history>Save mortgage history</button></div>
      </div>`;

    const monthlySection = [...modal.querySelectorAll('.personal-section')].find((node) => node.querySelector('h3')?.textContent.trim() === 'Monthly history');
    if (monthlySection) monthlySection.insertAdjacentElement('beforebegin', section); else modal.querySelector('.personal-footer-actions')?.insertAdjacentElement('beforebegin', section);

    let autosaveTimer = null;
    const scheduleAutosave = () => {
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(() => persistSection(section, false), 250);
    };

    section.addEventListener('click', (event) => {
      event.stopPropagation();
      if (event.target.closest('[data-add-deal]')) {
        section.querySelector('[data-deal-list]')?.insertAdjacentHTML('beforeend', dealRow());
        scheduleAutosave();
      }
      if (event.target.closest('[data-add-lump]')) {
        section.querySelector('[data-lump-list]')?.insertAdjacentHTML('beforeend', lumpRow());
        scheduleAutosave();
      }
      const remove = event.target.closest('[data-remove-history]');
      if (remove) {
        remove.closest('.history-row')?.remove();
        scheduleAutosave();
      }
      if (event.target.closest('[data-save-history]')) persistSection(section, true);
    });

    section.addEventListener('input', () => {
      const current = readFromSection(section);
      renderSummary(section, current);
      const state = section.querySelector('[data-history-save-state]');
      if (state) state.textContent = 'Saving…';
      scheduleAutosave();
    });
    section.addEventListener('change', () => persistSection(section, false));

    // The main Setup & data “Save changes” button must save the history too.
    // Capture phase runs before personal-070 removes the modal.
    modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-action="save"]')) persistSection(section, true);
    }, true);

    renderSummary(section, data);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('#personalDataButton')) setTimeout(mount, 0);
  });
  setTimeout(mount, 550);

  window.MortgageHistory = { load, save, estimateHistory };
})();
