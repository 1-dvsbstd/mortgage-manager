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
  const currentMortgage = () => window.MortgageStore?.get?.() || {
    balance:Math.max(0,Number($('balance')?.value)||0),
    rate:Math.max(0,Number($('rate')?.value)||0),
    payment:Math.max(0,Number($('payment')?.value)||0),
    currentOverpayment:Math.max(0,Number($('currentOverpayment')?.value)||0),
  };

  function getAnchor() {
    try {
      const saved = JSON.parse(localStorage.getItem(ANCHOR_KEY) || 'null');
      if (saved && Number.isFinite(Number(saved.balance)) && saved.month) return { balance:Number(saved.balance), month:saved.month };
    } catch (_) {}
    const anchor = { balance: Math.max(0, Number(currentMortgage().balance)||0), month: monthKey() };
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
    const mortgage = currentMortgage();
    const path = MortgageMath.amortize(anchor.balance, Math.max(0,Number(mortgage.rate)||0), Math.max(0,Number(mortgage.payment)||0) + Math.max(0,Number(mortgage.currentOverpayment)||0));
    if (!path.monthlyPoints?.length) return anchor.balance;
    return path.monthlyPoints[Math.min(elapsed, path.monthlyPoints.length-1)] ?? anchor.balance;
  }

  function ensureStatus() {
    const deep = document.querySelector('.mortgage-deep-dive');
    if (!deep || $('balanceAnchorStatus')) return;
    const status = document.createElement('div');
    status.id = 'balanceAnchorStatus';
    status.className = 'balance-anchor-status';
    deep.querySelector('h2')?.insertAdjacentElement('afterend', status);
  }

  function updateStatus() {
    ensureStatus();
    const anchor = getAnchor();
    const elapsed = monthDiff(anchor.month, monthKey());
    const status = $('balanceAnchorStatus');
    if (!status) return;
    status.innerHTML = elapsed > 0
      ? `<span>Balance last updated</span><strong>${money(anchor.balance)} · ${monthLabel(anchor.month)}</strong><small>Dashboard balance is projected forward ${elapsed} month${elapsed===1?'':'s'} to ${monthLabel(monthKey())} using your saved rate, payment and regular overpayment. Enter a fresh lender balance whenever you want to reset it.</small>`
      : `<span>Balance last updated</span><strong>${money(anchor.balance)} · ${monthLabel(anchor.month)}</strong><small>From next month, this balance will move forward automatically using your saved rate, payment and regular overpayment.</small>`;
  }

  function applyMonthlyBalance() {
    const anchor = getAnchor();
    const projected = projectedBalance(anchor);
    const mortgage = currentMortgage();
    if (Math.abs((Number(mortgage.balance)||0) - projected) < .5) { updateStatus(); return; }
    applyingProjection = true;
    if (window.MortgageStore) {
      window.MortgageStore.set({balance:Math.round(projected)});
      window.MortgageStore.applyToDom(['balance'],{dispatch:true});
    } else if ($('balance')) {
      $('balance').value = Math.round(projected);
      $('balance').dispatchEvent(new Event('input',{bubbles:true}));
    }
    applyingProjection = false;
    updateStatus();
  }

  function simplifyCurrentMortgageView() {
    document.querySelector('.mortgage-deep-dive .market-block')?.classList.add('current-only-hidden');
    document.querySelector('.mortgage-deep-dive .deep-grid .deep-stat:nth-child(3)')?.classList.add('current-only-hidden');
    const mortgageTitle = document.querySelector('.mortgage-deep-dive > h2');
    if (mortgageTitle) mortgageTitle.textContent = 'Your mortgage right now';
    document.querySelector('.hero-scenario')?.classList.add('current-only-hidden');
    $('dealEndEquity')?.classList.add('deal-equity-hidden');

    const deal = document.querySelector('.next-panel');
    const compare = $('dealMarketCompare');
    const dealDetail = deal?.querySelector('.expand-detail');
    if (deal && compare && dealDetail && compare.parentElement === dealDetail) {
      compare.classList.add('next-rate-check');
      deal.insertBefore(compare, dealDetail);
    }
  }

  const display = $('currentOverpayDisplay');
  if (display) display.classList.add('summary-overpayment-value');

  if (window.MortgageStore?.subscribe) {
    window.MortgageStore.subscribe((next,previous) => {
      if (next.balance !== previous.balance && !applyingProjection) {
        saveAnchor(next.balance, monthKey());
        updateStatus();
      }
    });
  }

  simplifyCurrentMortgageView();
  ensureStatus();
  applyMonthlyBalance();
  requestAnimationFrame(() => { simplifyCurrentMortgageView(); updateStatus(); });
})();