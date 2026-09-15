(() => {
  const $ = (id) => document.getElementById(id);
  const money = (value) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(Math.max(0, Number(value)||0));

  function getHomeSettings() {
    try { return JSON.parse(localStorage.getItem('mortgage-manager-home-projection-v4') || '{}'); }
    catch (_) { return {}; }
  }

  function trendRate() {
    const n = Number(getHomeSettings().trend);
    return Number.isFinite(n) ? n : 2.5;
  }

  function balanceAt(points, month) {
    if (!points?.length) return 0;
    return points[Math.min(Math.max(0, month), points.length - 1)] ?? 0;
  }

  function renderEquityChart() {
    const grid = $('equityGrowthGrid');
    if (!grid || !window.MortgageMath) return;

    const balance = Math.max(0, Number($('balance')?.value)||0);
    const rate = Math.max(0, Number($('rate')?.value)||0);
    const payment = Math.max(0, Number($('payment')?.value)||0);
    const overpay = Math.max(0, Number($('currentOverpayment')?.value)||0);
    const home = Math.max(0, Number($('homeValue')?.value)||0);
    const ownership = Math.min(100, Math.max(0, Number($('ownership')?.value)||0));
    if (!home || !ownership) return;

    const path = MortgageMath.amortize(balance, rate, payment + overpay);
    if (!Number.isFinite(path.months)) return;

    const trend = trendRate();
    const finalYears = Math.max(1, Math.round(path.months / 12));
    const candidates = [
      { m:0, label:'Now' },
      { m:Math.min(60, path.months), label:path.months < 60 ? `${finalYears}y` : '5y' },
      { m:Math.min(120, path.months), label:path.months < 120 ? `${finalYears}y` : '10y' },
      { m:path.months, label:'Mortgage-free' },
    ];
    const seen = new Set();
    const points = candidates.filter(({m}) => !seen.has(m) && seen.add(m));

    grid.className = 'equity-visual-chart';
    grid.innerHTML = points.map(({m,label}) => {
      const futureHome = home * Math.pow(1 + trend/100, m/12);
      const shareValue = futureHome * ownership/100;
      const mortgage = balanceAt(path.monthlyPoints, m);
      const equity = Math.max(0, shareValue - mortgage);
      const pct = shareValue > 0 ? Math.min(100, Math.max(0, equity/shareValue*100)) : 0;
      return `<div class="equity-chart-col" title="${money(equity)} equity · ${money(mortgage)} mortgage">
        <div class="equity-chart-value">${pct.toFixed(0)}%</div>
        <div class="equity-chart-track"><div class="equity-chart-fill" style="height:${Math.max(3,pct).toFixed(1)}%"></div></div>
        <div class="equity-chart-label">${label}</div>
        <div class="equity-chart-meta">${money(equity)}</div>
      </div>`;
    }).join('');

    const heading = document.querySelector('#equityGrowth .deep-heading h2');
    if (heading) heading.textContent = 'How your mortgage-free share grows';
  }

  function collapseCostComparison() {
    const section = $('propertyCostComparison');
    if (!section || section.tagName === 'DETAILS') return;

    const details = document.createElement('details');
    details.id = section.id;
    details.className = section.className;
    details.innerHTML = `<summary><span>Additional information<span class="property-cost-subtitle">Costs & long-term value</span></span></summary><div class="property-cost-body"></div>`;
    const body = details.querySelector('.property-cost-body');

    const heading = section.querySelector('.deep-heading');
    if (heading) heading.remove();
    while (section.firstChild) body.appendChild(section.firstChild);
    section.replaceWith(details);
  }

  function refresh() {
    renderEquityChart();
    collapseCostComparison();
  }

  const observer = new MutationObserver(() => requestAnimationFrame(refresh));
  observer.observe(document.body, { childList:true, subtree:true });
  document.addEventListener('input', (event) => {
    if (event.target.matches('#balance,#rate,#payment,#currentOverpayment,#homeValue,#ownership,#projectionTrendRate,#projectionPurchasePrice,#projectionImprovements')) requestAnimationFrame(refresh);
  });
  requestAnimationFrame(refresh);
})();
