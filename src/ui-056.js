(() => {
  const $ = (id) => document.getElementById(id);
  const hero = document.querySelector('.hero-panel');
  const money = (value) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(Math.max(0, Number(value)||0));

  const editorTargets = [
    { element: () => $('balanceLine')?.parentElement, target: 'balance', label: 'Edit mortgage balance' },
    { element: () => $('paymentStat')?.parentElement, target: 'payment', label: 'Edit monthly payment' },
    { element: () => $('rateStat')?.parentElement, target: 'rate', label: 'Edit interest rate' },
    { element: () => $('currentOverpayDisplay')?.closest('.hero-overpay-summary'), target: 'currentOverpayment', label: 'Edit regular overpayment' },
  ];

  function syncMortgageEditors() {
    if (!hero) return;
    const expanded = hero.classList.contains('is-expanded') || hero.getAttribute('aria-expanded') === 'true';
    editorTargets.forEach(({ element, target, label }) => {
      const node = element();
      if (!node) return;
      if (expanded) {
        node.dataset.editTarget = target;
        node.setAttribute('role', 'button');
        node.setAttribute('tabindex', '0');
        node.setAttribute('aria-label', label);
        node.classList.add('detail-editable');
      } else {
        node.removeAttribute('data-edit-target');
        node.removeAttribute('role');
        node.removeAttribute('tabindex');
        node.removeAttribute('aria-label');
        node.classList.remove('detail-editable');
      }
    });
  }

  function getHomeSettings() {
    try { return JSON.parse(localStorage.getItem('mortgage-manager-home-projection-v4') || '{}'); }
    catch (_) { return {}; }
  }

  function getTrendRate() {
    const settings = getHomeSettings();
    const trend = Number(settings.trend);
    return Number.isFinite(trend) ? trend : 2.5;
  }

  function balanceAt(points, month) {
    if (!points?.length) return 0;
    return points[Math.min(Math.max(0, month), points.length - 1)] ?? 0;
  }

  function renderEquityProgress() {
    const grid = $('equityGrowthGrid');
    if (!grid || !window.MortgageMath) return;

    const balance = Math.max(0, Number($('balance')?.value)||0);
    const rate = Math.max(0, Number($('rate')?.value)||0);
    const payment = Math.max(0, Number($('payment')?.value)||0);
    const home = Math.max(0, Number($('homeValue')?.value)||0);
    const ownership = Math.min(100, Math.max(0, Number($('ownership')?.value)||0));
    const path = MortgageMath.compare(balance, rate, payment, 0).base;
    if (!home || !ownership || !Number.isFinite(path.months)) return;

    const trend = getTrendRate();
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
      const mortgage = balanceAt(path.monthlyPoints, m);
      const equity = Math.max(0, shareValue - mortgage);
      const equityPct = shareValue > 0 ? Math.min(100, Math.max(0, equity / shareValue * 100)) : 0;
      return `<div class="equity-growth-card equity-percent-card"><span>${label}</span><strong>${equityPct.toFixed(0)}%</strong><b>${money(equity)} equity</b><small>${money(mortgage)} mortgage · ${money(shareValue)} share value</small></div>`;
    }).join('');

    const assumption = $('equityGrowthAssumption');
    if (assumption) assumption.textContent = `${trend.toFixed(1)}%/yr home-value trend`;
  }

  function placeEquityWithTrajectory() {
    const equity = $('equityGrowth');
    const trajectory = document.querySelector('.chart-panel .trajectory-details');
    const milestones = $('trajectoryMilestones');
    if (!equity || !trajectory) return;

    const heading = equity.querySelector('.deep-heading');
    if (heading) {
      const eyebrow = heading.querySelector('.eyebrow');
      const title = heading.querySelector('h2');
      if (eyebrow) eyebrow.textContent = 'Equity progress';
      if (title) title.textContent = 'How your ownership builds alongside the mortgage';
    }

    if (milestones) milestones.insertAdjacentElement('afterend', equity);
    else trajectory.appendChild(equity);
  }

  function ensureCostComparison() {
    const projection = $('homeProjection');
    if (!projection || $('propertyCostComparison')) return;
    const section = document.createElement('section');
    section.id = 'propertyCostComparison';
    section.className = 'property-cost-comparison';
    section.innerHTML = `
      <div class="deep-heading"><div><p class="eyebrow">Cost vs value</p><h2>What you may pay versus what the home may be worth</h2></div></div>
      <div class="property-cost-grid">
        <div class="property-cost-card"><span>Estimated value when mortgage-free</span><strong id="costFutureValue">—</strong><small id="costFutureValueNote">Uses the Home trend assumption.</small></div>
        <div class="property-cost-card"><span>Remaining mortgage payments</span><strong id="costRemainingPayments">—</strong><small>Projected from today, including future interest and your regular overpayment.</small></div>
        <div class="property-cost-card"><span>Known lifetime cost floor</span><strong id="costKnownBasis">—</strong><small id="costKnownBasisNote">Add purchase details for this comparison.</small></div>
      </div>
      <p class="deep-note" id="costComparisonNote">The app can project future mortgage cost accurately from today, but cannot know mortgage interest or fees you already paid in previous years without historical mortgage data.</p>`;
    projection.insertAdjacentElement('afterend', section);
  }

  function renderCostComparison() {
    ensureCostComparison();
    if (!$('propertyCostComparison') || !window.MortgageMath) return;

    const balance = Math.max(0, Number($('balance')?.value)||0);
    const rate = Math.max(0, Number($('rate')?.value)||0);
    const payment = Math.max(0, Number($('payment')?.value)||0);
    const currentOverpay = Math.max(0, Number($('currentOverpayment')?.value)||0);
    const home = Math.max(0, Number($('homeValue')?.value)||0);
    const ownership = Math.min(100, Math.max(0, Number($('ownership')?.value)||0));
    const path = MortgageMath.amortize(balance, rate, payment + currentOverpay);
    const settings = getHomeSettings();
    const trend = getTrendRate();
    const purchasePrice = Math.max(0, Number(settings.purchasePrice)||0);
    const improvements = Math.max(0, Number(settings.improvements)||0);

    if (!Number.isFinite(path.months)) return;

    const years = path.months / 12;
    const futureWholeValue = home * Math.pow(1 + trend/100, years);
    const futureShareValue = futureWholeValue * ownership/100;
    const remainingPayments = balance + Math.max(0, Number(path.interest)||0);
    const knownBasis = purchasePrice ? purchasePrice + improvements + Math.max(0, Number(path.interest)||0) : 0;

    $('costFutureValue').textContent = money(futureShareValue || futureWholeValue);
    $('costFutureValueNote').textContent = ownership < 100
      ? `${ownership.toFixed(ownership%1?1:0)}% share of the projected property value.`
      : `Projected property value using ${trend.toFixed(1)}% annual growth.`;
    $('costRemainingPayments').textContent = money(remainingPayments);

    if (knownBasis) {
      $('costKnownBasis').textContent = money(knownBasis);
      $('costKnownBasisNote').textContent = `${money(purchasePrice)} purchase price${improvements ? ` + ${money(improvements)} improvements` : ''} + projected future interest.`;
      $('costComparisonNote').textContent = 'This is a floor rather than a full lifetime-cost figure: it excludes mortgage interest, fees, maintenance and other costs already paid before today.';
    } else {
      $('costKnownBasis').textContent = 'Add purchase price';
      $('costKnownBasisNote').textContent = 'Purchase price and improvements are set under Home value estimate settings.';
    }
  }

  if (hero) {
    new MutationObserver(syncMortgageEditors).observe(hero, { attributes:true, attributeFilter:['class','aria-expanded'] });
  }

  const detailObserver = new MutationObserver(() => requestAnimationFrame(() => {
    placeEquityWithTrajectory();
    renderEquityProgress();
    renderCostComparison();
  }));
  const app = document.querySelector('.app-shell');
  if (app) detailObserver.observe(app, { childList:true, subtree:true });

  document.addEventListener('input', (event) => {
    if (event.target.matches('#balance,#rate,#payment,#currentOverpayment,#homeValue,#ownership,#projectionTrendRate,#projectionPurchasePrice,#projectionImprovements')) {
      requestAnimationFrame(() => {
        renderEquityProgress();
        renderCostComparison();
      });
    }
  });

  syncMortgageEditors();
  requestAnimationFrame(() => {
    placeEquityWithTrajectory();
    renderEquityProgress();
    renderCostComparison();
  });
})();