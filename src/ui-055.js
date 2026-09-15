(() => {
  const $ = (id) => document.getElementById(id);
  const money = (value) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(Number(value) || 0);
  const ANCHOR_KEY = 'mortgage-manager-balance-anchor-v1';
  let applyingProjection = false;

  const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  const monthDiff = (from, to) => {
    if (!from || !to) return 0;
    const [fy,fm] = from.split('-').map(Number), [ty,tm] = to.split('-').map(Number);
    return Math.max(0, (ty-fy)*12 + (tm-fm));
  };
  const monthLabel = (value) => {
    if (!value) return '—';
    const [y,m] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'}).format(new Date(y,m-1,1));
  };

  function getAnchor() {
    try {
      const saved = JSON.parse(localStorage.getItem(ANCHOR_KEY) || 'null');
      if (saved && Number.isFinite(Number(saved.balance)) && saved.month) return { balance:Number(saved.balance), month:saved.month };
    } catch (_) {}
    const anchor = { balance: Math.max(0, Number($('balance')?.value)||0), month: monthKey() };
    try { localStorage.setItem(ANCHOR_KEY, JSON.stringify(anchor)); } catch (_) {}
    return anchor;
  }

  function saveAnchor(balance, month = monthKey()) {
    const anchor = { balance: Math.max(0, Number(balance)||0), month };
    try { localStorage.setItem(ANCHOR_KEY, JSON.stringify(anchor)); } catch (_) {}
    return anchor;
  }

  function projectedBalance(anchor) {
    const elapsed = monthDiff(anchor.month, monthKey());
    if (!elapsed || !window.MortgageMath) return anchor.balance;
    const rate = Math.max(0, Number($('rate')?.value)||0);
    const payment = Math.max(0, Number($('payment')?.value)||0);
    const regularOverpay = Math.max(0, Number($('currentOverpayment')?.value)||0);
    const path = MortgageMath.amortize(anchor.balance, rate, payment + regularOverpay);
    if (!path.monthlyPoints?.length) return anchor.balance;
    return path.monthlyPoints[Math.min(elapsed, path.monthlyPoints.length-1)] ?? anchor.balance;
  }

  function ensureCurrentSnapshot() {
    const deep = document.querySelector('.mortgage-deep-dive');
    if (!deep || $('balanceAnchorStatus')) return;
    const status = document.createElement('div');
    status.id = 'balanceAnchorStatus';
    status.className = 'balance-anchor-status';
    deep.querySelector('h2')?.insertAdjacentElement('afterend', status);
  }

  function updateCurrentSnapshot() {
    ensureCurrentSnapshot();
    const anchor = getAnchor();
    const elapsed = monthDiff(anchor.month, monthKey());
    const status = $('balanceAnchorStatus');
    if (!status) return;
    status.innerHTML = elapsed > 0
      ? `<span>Balance last updated</span><strong>${money(anchor.balance)} · ${monthLabel(anchor.month)}</strong><small>Dashboard balance is automatically projected forward ${elapsed} month${elapsed===1?'':'s'} to ${monthLabel(monthKey())}. Update the balance whenever you have a fresh lender figure.</small>`
      : `<span>Balance last updated</span><strong>${money(anchor.balance)} · ${monthLabel(anchor.month)}</strong><small>This is the current anchor. From next month, the dashboard will project it forward automatically until you enter a fresh lender balance.</small>`;
  }

  function applyMonthlyBalance() {
    const input = $('balance');
    if (!input) return;
    const anchor = getAnchor();
    const projected = projectedBalance(anchor);
    if (Math.abs((Number(input.value)||0) - projected) < .5) { updateCurrentSnapshot(); return; }
    applyingProjection = true;
    input.value = Math.round(projected);
    input.dispatchEvent(new Event('input',{bubbles:true}));
    applyingProjection = false;
    updateCurrentSnapshot();
  }

  function simplifySections() {
    // Rate comparison belongs with the deal/fixed-rate card only.
    $('dashboardRateStrip')?.remove();
    document.querySelector('.mortgage-deep-dive .market-block')?.classList.add('current-only-hidden');
    const yearCard = document.querySelector('.mortgage-deep-dive .deep-grid .deep-stat:nth-child(3)');
    yearCard?.classList.add('current-only-hidden');
    const mortgageTitle = document.querySelector('.mortgage-deep-dive > h2');
    if (mortgageTitle) mortgageTitle.textContent = 'Your mortgage right now';

    // Equity belongs in Home; the deal card should stay about remortgaging.
    $('dealEndEquity')?.classList.add('deal-equity-hidden');
  }

  function getTrendRate() {
    try {
      const settings = JSON.parse(localStorage.getItem('mortgage-manager-home-projection-v4') || '{}');
      const trend = Number(settings.trend);
      return Number.isFinite(trend) ? trend : 2.5;
    } catch (_) { return 2.5; }
  }

  function ensureEquityGrowth() {
    const detail = document.querySelector('.home-panel .expand-detail');
    if (!detail || $('equityGrowth')) return;
    const section = document.createElement('section');
    section.id = 'equityGrowth';
    section.className = 'equity-growth';
    section.innerHTML = `
      <div class="deep-heading"><div><p class="eyebrow">Equity over time</p><h2>How your share could build</h2></div><span id="equityGrowthAssumption" class="source-date"></span></div>
      <div id="equityGrowthGrid" class="equity-growth-grid"></div>
      <p class="deep-note">Illustrative only: combines your scheduled mortgage path with the Home value trend assumption. Actual house prices and lender balances will differ.</p>`;
    const projection = $('homeProjection');
    if (projection) projection.insertAdjacentElement('beforebegin', section);
    else detail.appendChild(section);
  }

  function balanceAt(points, month) {
    if (!points?.length) return 0;
    return points[Math.min(Math.max(0,month), points.length-1)] ?? 0;
  }

  function updateEquityGrowth() {
    ensureEquityGrowth();
    const grid = $('equityGrowthGrid');
    if (!grid || !window.MortgageMath) return;
    const balance = Math.max(0, Number($('balance')?.value)||0);
    const rate = Math.max(0, Number($('rate')?.value)||0);
    const payment = Math.max(0, Number($('payment')?.value)||0);
    const home = Math.max(0, Number($('homeValue')?.value)||0);
    const ownership = Math.min(100,Math.max(0,Number($('ownership')?.value)||0));
    const path = MortgageMath.compare(balance,rate,payment,0).base;
    if (!home || !Number.isFinite(path.months)) { grid.innerHTML=''; return; }
    const trend = getTrendRate();
    $('equityGrowthAssumption').textContent = `${trend.toFixed(1)}%/yr home-value trend`;
    const candidates = [
      {m:0,label:'Now'},
      {m:12,label:'1 year'},
      {m:60,label:'5 years'},
      {m:120,label:'10 years'},
      {m:path.months,label:'Mortgage-free'}
    ];
    const seen = new Set();
    const points = candidates.filter(({m}) => m <= path.months && !seen.has(m) && seen.add(m));
    grid.innerHTML = points.map(({m,label}) => {
      const futureHome = home * Math.pow(1 + trend/100, m/12);
      const shareValue = futureHome * ownership/100;
      const mortgage = balanceAt(path.monthlyPoints,m);
      const equity = Math.max(0, shareValue - mortgage);
      return `<div class="equity-growth-card"><span>${label}</span><strong>${money(equity)}</strong><small>${money(mortgage)} mortgage · ${money(shareValue)} share value</small></div>`;
    }).join('');
  }

  // Keep the overpayment suffix visually subordinate and on one line.
  function normalizeOverpaymentSummary() {
    const display = $('currentOverpayDisplay');
    if (display) display.classList.add('summary-overpayment-value');
  }

  document.addEventListener('input',(event) => {
    if (event.target.id === 'balance' && event.isTrusted && !applyingProjection) {
      saveAnchor(event.target.value, monthKey());
      updateCurrentSnapshot();
    }
    if (event.target.matches('#balance,#rate,#payment,#currentOverpayment,#homeValue,#ownership,#projectionTrendRate')) {
      requestAnimationFrame(updateEquityGrowth);
    }
  });

  simplifySections();
  normalizeOverpaymentSummary();
  ensureCurrentSnapshot();
  applyMonthlyBalance();
  updateEquityGrowth();
  requestAnimationFrame(() => { simplifySections(); normalizeOverpaymentSummary(); updateCurrentSnapshot(); updateEquityGrowth(); });
})();