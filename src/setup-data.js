(() => {
  const SNAPSHOT_KEY = 'mortgage-manager-history-v1';
  const SETUP_KEY = 'mortgage-manager-personal-setup-v1';
  const BACKUP_VERSION = '0.9.11';
  const STORAGE_PREFIX = 'mortgage-manager';
  const $ = (id) => document.getElementById(id);
  const money = (value) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(Number(value) || 0);
  const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  const monthLabel = (key) => {
    const [year, month] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('en-GB', { month:'short', year:'numeric' }).format(new Date(year, month-1, 1));
  };
  const toast = (text) => {
    document.querySelector('.personal-toast')?.remove();
    const el = document.createElement('div');
    el.className = 'personal-toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  };

  function currentState() {
    if (window.MortgageStore) return window.MortgageStore.get();
    const readNum = (id) => Math.max(0, Number($(id)?.value) || 0);
    return {
      balance: readNum('balance'),
      homeValue: readNum('homeValue'),
      ownership: Math.min(100, readNum('ownership')),
      rate: readNum('rate'),
      payment: readNum('payment'),
      currentOverpayment: readNum('currentOverpayment'),
      fixedEnd: $('fixedEnd')?.value || '',
    };
  }

  function currentSnapshot() {
    const state = currentState();
    const balance = Math.max(0, Number(state.balance) || 0);
    const homeValue = Math.max(0, Number(state.homeValue) || 0);
    const ownership = Math.min(100, Math.max(0, Number(state.ownership) || 0));
    const shareValue = homeValue * (ownership / 100);
    const equity = shareValue - balance;
    return {
      month: monthKey(),
      savedAt: new Date().toISOString(),
      balance,
      homeValue,
      ownership,
      equity,
      rate: Math.max(0, Number(state.rate) || 0),
      payment: Math.max(0, Number(state.payment) || 0),
      currentOverpayment: Math.max(0, Number(state.currentOverpayment) || 0),
      fixedEnd: state.fixedEnd || '',
      payoffText: $('payoffDate')?.textContent || '',
      remainingText: $('yearsRemaining')?.textContent || '',
    };
  }

  function loadHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  }

  function saveHistory(history) {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(history.slice(-120)));
  }

  function recordSnapshot(showToast = false) {
    const snapshot = currentSnapshot();
    if (!snapshot.balance) return;
    const history = loadHistory();
    const index = history.findIndex((row) => row.month === snapshot.month);
    if (index >= 0) history[index] = snapshot; else history.push(snapshot);
    history.sort((a,b) => a.month.localeCompare(b.month));
    saveHistory(history);
    renderProgress();
    if (showToast) toast(`Saved ${monthLabel(snapshot.month)} snapshot`);
  }

  function deltaText(value) {
    if (!Number.isFinite(value) || Math.abs(value) < .5) return 'No change yet';
    const sign = value > 0 ? '+' : '−';
    return `${sign}${money(Math.abs(value))}`;
  }

  function ensureProgressCard() {
    if ($('personalProgress')) return;
    const trajectory = document.querySelector('[data-expandable-card="trajectory"]');
    if (!trajectory) return;
    const section = document.createElement('section');
    section.id = 'personalProgress';
    section.className = 'panel progress-panel';
    section.innerHTML = `
      <div class="progress-heading">
        <div class="progress-heading-copy"><p class="eyebrow">Your progress</p><h2>Since you started tracking</h2><p id="progressContext">Your first snapshot becomes the baseline for real progress.</p></div>
        <button type="button" id="recordSnapshot" class="progress-action">Save this month</button>
      </div>
      <div class="progress-grid">
        <div class="progress-stat"><span>Mortgage reduced</span><strong id="progressDebt">—</strong><small id="progressDebtNote">—</small></div>
        <div class="progress-stat"><span>Equity gained</span><strong id="progressEquity">—</strong><small id="progressEquityNote">—</small></div>
        <div class="progress-stat"><span>Home value change</span><strong id="progressHome">—</strong><small id="progressHomeNote">—</small></div>
      </div>
      <div class="progress-history" id="progressHistory"></div>`;
    trajectory.insertAdjacentElement('beforebegin', section);
    $('recordSnapshot')?.addEventListener('click', (event) => { event.stopPropagation(); recordSnapshot(true); });
  }

  function renderProgress() {
    ensureProgressCard();
    const history = loadHistory();
    const current = currentSnapshot();
    if (!history.length) {
      $('progressDebt').textContent = 'Tracking starts now';
      $('progressDebtNote').textContent = 'Save this month to create your baseline.';
      $('progressEquity').textContent = '—';
      $('progressEquityNote').textContent = 'Equity change will appear after a later snapshot.';
      $('progressHome').textContent = '—';
      $('progressHomeNote').textContent = 'Home-value changes stay separate from mortgage repayment.';
      $('progressHistory').innerHTML = '<div class="progress-history-empty">No monthly history yet.</div>';
      return;
    }
    const first = history[0];
    const latest = history[history.length - 1];
    const debtReduced = first.balance - current.balance;
    const equityGained = current.equity - first.equity;
    const homeChange = current.homeValue - first.homeValue;
    $('progressContext').textContent = `Tracking from ${monthLabel(first.month)} · ${history.length} monthly snapshot${history.length === 1 ? '' : 's'} saved.`;
    $('progressDebt').textContent = debtReduced > .5 ? money(debtReduced) : '—';
    $('progressDebtNote').textContent = debtReduced > .5 ? `Balance ${money(first.balance)} → ${money(current.balance)}` : 'Your current month is still the baseline.';
    $('progressEquity').textContent = Math.abs(equityGained) > .5 ? deltaText(equityGained) : '—';
    $('progressEquityNote').textContent = `Current estimated equity ${money(current.equity)}`;
    $('progressHome').textContent = Math.abs(homeChange) > .5 ? deltaText(homeChange) : '—';
    $('progressHomeNote').textContent = `Current property value ${money(current.homeValue)}`;
    const recent = history.slice(-6).reverse();
    $('progressHistory').innerHTML = recent.map((row) => `
      <div class="progress-history-row"><span>${monthLabel(row.month)}</span><strong>${money(row.balance)}</strong><span>Equity ${money(row.equity)}</span><span>${row.payoffText || ''}</span></div>`).join('');
    if (latest.month !== current.month) {
      $('progressHistory').insertAdjacentHTML('afterbegin','<div class="progress-history-empty">This month has not been saved yet.</div>');
    }
  }

  function monthsUntil(monthValue) {
    if (!monthValue) return null;
    const [year, month] = monthValue.split('-').map(Number);
    if (!year || !month) return null;
    const now = new Date();
    return (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());
  }

  function ensureDealGuidance() {
    const panel = document.querySelector('.next-panel');
    if (!panel || $('dealActionHint')) return;
    const timeline = panel.querySelector('.timeline-labels');
    if (!timeline) return;
    const box = document.createElement('div');
    box.id = 'dealActionHint';
    box.className = 'deal-action-hint';
    timeline.insertAdjacentElement('afterend', box);
  }

  function renderDealGuidance() {
    ensureDealGuidance();
    const box = $('dealActionHint');
    if (!box) return;
    const months = monthsUntil(currentState().fixedEnd || '');
    let title = 'Add your fixed-rate end date';
    let detail = 'Once it is set, this card will tell you when action is actually useful.';
    if (months !== null) {
      if (months < 0) { title = 'Update your mortgage deal'; detail = 'Your saved fixed-rate end has passed, so the rate and payment details may now be out of date.'; }
      else if (months <= 3) { title = 'Time to compare your next deal'; detail = 'You are inside the period where getting real remortgage/product-transfer options is useful.'; }
      else if (months <= 6) { title = 'Start watching rates now'; detail = 'You are close enough to deal end that rate movements and projected LTV are worth monitoring.'; }
      else if (months <= 12) { title = 'Keep an eye on the market'; detail = 'No urgent action, but this is a useful window to watch your projected deal-end balance and LTV.'; }
      else { title = 'Nothing you need to do yet'; detail = 'Keep reducing the balance. The app will make this milestone more prominent as the end date gets closer.'; }
    }
    box.innerHTML = `<span>Action</span><strong>${title}</strong><small>${detail}</small>`;
  }

  function setupButton() {
    const topbar = document.querySelector('.topbar');
    const save = $('saveStatus');
    if (!topbar || $('personalDataButton')) return;
    const wrap = document.createElement('div');
    wrap.className = 'topbar-actions';
    const button = document.createElement('button');
    button.id = 'personalDataButton';
    button.className = 'personal-data-button';
    button.type = 'button';
    button.textContent = 'Setup & data';
    wrap.append(save, button);
    topbar.appendChild(wrap);
    button.addEventListener('click', openSetup);
  }

  function inputMarkup(id, label, type='number', step='1') {
    const value = currentState()[id] ?? '';
    return `<label>${label}<input data-personal-field="${id}" type="${type}" ${type==='number' ? `step="${step}" inputmode="decimal"` : ''} value="${String(value).replace(/"/g,'&quot;')}" /></label>`;
  }

  function openSetup() {
    document.querySelector('.personal-backdrop')?.remove();
    const backdrop = document.createElement('div');
    backdrop.className = 'personal-backdrop';
    backdrop.innerHTML = `
      <section class="personal-modal" role="dialog" aria-modal="true" aria-labelledby="personalModalTitle">
        <div class="personal-modal-head"><div><p class="eyebrow">Your mortgage</p><h2 id="personalModalTitle">Setup & data</h2><p>These are the numbers the whole dashboard uses. Changes save to this device.</p></div><button class="personal-close" type="button" aria-label="Close setup and data">Close</button></div>
        <div class="personal-form">
          ${inputMarkup('balance','Current mortgage balance (£)','number','100')}
          ${inputMarkup('payment','Scheduled monthly payment (£)','number','1')}
          ${inputMarkup('rate','Interest rate (%)','number','0.01')}
          ${inputMarkup('currentOverpayment','Regular overpayment (£/month)','number','1')}
          ${inputMarkup('fixedEnd','Fixed rate ends','month')}
          ${inputMarkup('homeValue','Current property value (£)','number','1000')}
          ${inputMarkup('ownership','Property share owned (%)','number','1')}
        </div>
        <div class="personal-section"><h3>Monthly history</h3><p>The app stores one snapshot per month on this device. Saving again in the same month updates that month rather than creating duplicates.</p><div class="personal-actions"><button type="button" class="personal-button" data-action="snapshot">Save this month</button><button type="button" class="personal-button danger" data-action="reset-history">Reset history</button></div></div>
        <div class="personal-footer-actions"><button type="button" class="personal-button" data-action="cancel">Cancel</button><button type="button" class="personal-button primary" data-action="save">Save changes</button></div>
      </section>`;
    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
    backdrop.querySelector('.personal-close')?.addEventListener('click', close);
    backdrop.querySelector('[data-action="cancel"]')?.addEventListener('click', close);
    backdrop.querySelector('[data-action="save"]')?.addEventListener('click', () => {
      const patch = {};
      backdrop.querySelectorAll('[data-personal-field]').forEach((field) => {
        const key = field.dataset.personalField;
        patch[key] = key === 'fixedEnd' ? field.value : Number(field.value);
      });
      if (window.MortgageStore) window.MortgageStore.set(patch);
      else {
        Object.entries(patch).forEach(([key, value]) => {
          const source = $(key);
          if (!source) return;
          source.value = value;
          source.dispatchEvent(new Event('input', { bubbles:true }));
          source.dispatchEvent(new Event('change', { bubbles:true }));
        });
      }
      localStorage.setItem(SETUP_KEY, '1');
      setTimeout(() => { recordSnapshot(false); renderDealGuidance(); }, 80);
      close();
      toast('Mortgage details saved');
    });
    backdrop.querySelector('[data-action="snapshot"]')?.addEventListener('click', () => recordSnapshot(true));
    backdrop.querySelector('[data-action="reset-history"]')?.addEventListener('click', () => {
      if (confirm('Reset all saved monthly history? Your current mortgage details will stay saved.')) {
        localStorage.removeItem(SNAPSHOT_KEY);
        renderProgress();
        toast('History reset');
      }
    });
  }

  function maybeFirstRun() {
    const hasSetup = Boolean(localStorage.getItem(SETUP_KEY));
    const hasLegacyMortgage = Boolean(localStorage.getItem('mortgage-manager-v0.4') || localStorage.getItem('mortgage-manager-v0.3') || localStorage.getItem('mortgage-manager-v0.2'));
    if (!hasSetup && !hasLegacyMortgage) setTimeout(openSetup, 450);
  }

  setupButton();
  ensureProgressCard();
  ensureDealGuidance();
  renderDealGuidance();
  renderProgress();
  maybeFirstRun();

  let renderTimer = null;
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => { renderProgress(); renderDealGuidance(); }, 120);
  }

  if (window.MortgageStore) {
    window.MortgageStore.subscribe((next, previous) => {
      const changed = ['balance','homeValue','ownership','rate','payment','fixedEnd','currentOverpayment']
        .some((key) => next[key] !== previous[key]);
      if (changed) scheduleRender();
    });
  } else {
    ['balance','homeValue','ownership','rate','payment','fixedEnd','currentOverpayment'].forEach((id) => {
      $(id)?.addEventListener('input', scheduleRender);
    });
  }

  // Keep this month's snapshot in sync only after the month has explicitly been recorded.
  setTimeout(() => {
    const history = loadHistory();
    if (history.some((row) => row.month === monthKey())) recordSnapshot(false);
  }, 700);
})();