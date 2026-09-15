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

  function getTrendRate() {
    try {
      const settings = JSON.parse(localStorage.getItem('mortgage-manager-home-projection-v4') || '{}');
      const trend = Number(settings.trend);
      return Number.isFinite(trend) ? trend : 2.5;
    } catch (_) { return 2.5; }
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

  function ensureEquitySectionVisible() {
    const detail = document.querySelector('.home-panel .expand-detail');
    if (!detail) return;
    const equity = $('equityGrowth');
    const homeStats = detail.querySelector('.home-stats');
    if (equity && homeStats && equity.previousElementSibling !== homeStats) {
      homeStats.insertAdjacentElement('afterend', equity);
    }
  }

  if (hero) {
    new MutationObserver(syncMortgageEditors).observe(hero, { attributes:true, attributeFilter:['class','aria-expanded'] });
  }

  const equityObserver = new MutationObserver(() => requestAnimationFrame(() => {
    ensureEquitySectionVisible();
    renderEquityProgress();
  }));
  const homeDetail = document.querySelector('.home-panel .expand-detail');
  if (homeDetail) equityObserver.observe(homeDetail, { childList:true, subtree:false });

  document.addEventListener('input', (event) => {
    if (event.target.matches('#balance,#rate,#payment,#currentOverpayment,#homeValue,#ownership,#projectionTrendRate')) {
      requestAnimationFrame(renderEquityProgress);
    }
  });

  syncMortgageEditors();
  requestAnimationFrame(() => {
    ensureEquitySectionVisible();
    renderEquityProgress();
  });
})();
