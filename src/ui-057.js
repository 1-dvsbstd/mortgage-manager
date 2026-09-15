(() => {
  const $ = (id) => document.getElementById(id);
  const money = (value) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(Math.max(0, Number(value)||0));
  const hero = document.querySelector('.hero-panel');

  function stripHeroInlineEditors() {
    document.querySelectorAll('.hero-balance-row [data-edit-target], .hero-balance-row .detail-editable, .hero-balance-row .editable-metric').forEach((el) => {
      el.removeAttribute('data-edit-target');
      el.removeAttribute('role');
      el.removeAttribute('tabindex');
      el.removeAttribute('aria-label');
      el.classList.remove('detail-editable','editable-metric');
      el.querySelector('.inline-editor')?.remove();
    });
  }

  function consolidateMortgageEditor() {
    const deep = document.querySelector('.mortgage-deep-dive');
    const oldDetails = document.querySelector('.edit-panel');
    if (!deep || !oldDetails || $('mortgageDetailsEditor')) return;

    const editContent = oldDetails.querySelector('.edit-content');
    if (!editContent) return;

    const section = document.createElement('section');
    section.id = 'mortgageDetailsEditor';
    section.className = 'mortgage-details-editor';
    section.innerHTML = `
      <div class="deep-heading">
        <div><p class="eyebrow">Mortgage details</p><h2>Edit your mortgage</h2></div>
        <span class="source-date">Changes save on this device</span>
      </div>
    `;
    section.appendChild(editContent);

    const currentOverpay = $('currentOverpayment');
    if (currentOverpay) {
      const inputs = editContent.querySelector('.inputs');
      if (inputs && !inputs.querySelector('[data-moved-overpayment]')) {
        const label = document.createElement('label');
        label.dataset.movedOverpayment = 'true';
        label.textContent = 'Regular overpayment (£/month)';
        currentOverpay.remove();
        label.appendChild(currentOverpay);
        inputs.appendChild(label);
      }
      document.querySelector('.current-overpay-control')?.remove();
    }

    deep.appendChild(section);
    oldDetails.remove();
    stripHeroInlineEditors();
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

  function renderEquityRows() {
    const grid = $('equityGrowthGrid');
    if (!grid || !window.MortgageMath) return;

    grid.classList.add('equity-progress-list');

    const balance = Math.max(0, Number($('balance')?.value)||0);
    const rate = Math.max(0, Number($('rate')?.value)||0);
    const payment = Math.max(0, Number($('payment')?.value)||0);
    const regularOverpay = Math.max(0, Number($('currentOverpayment')?.value)||0);
    const home = Math.max(0, Number($('homeValue')?.value)||0);
    const ownership = Math.min(100, Math.max(0, Number($('ownership')?.value)||0));
    const path = MortgageMath.amortize(balance, rate, payment + regularOverpay);
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
      const equityPct = shareValue > 0 ? Math.min(100, Math.max(0, equity/shareValue*100)) : 0;
      return `
        <div class="equity-progress-row">
          <div class="equity-progress-top"><span>${label}</span><strong>${equityPct.toFixed(0)}%</strong></div>
          <div class="equity-progress-track" aria-label="${label}: ${equityPct.toFixed(0)}% of your share mortgage-free"><i style="width:${equityPct.toFixed(1)}%"></i></div>
          <div class="equity-progress-meta"><b>${money(equity)} equity</b><small>${money(mortgage)} mortgage · ${money(shareValue)} share value</small></div>
        </div>`;
    }).join('');

    const assumption = $('equityGrowthAssumption');
    if (assumption) assumption.textContent = `${trend.toFixed(1)}%/yr home-value trend`;
    const heading = $('equityGrowth')?.querySelector('.deep-heading h2');
    if (heading) heading.textContent = 'How much of your share could be mortgage-free';
  }

  if (hero) {
    new MutationObserver(() => requestAnimationFrame(stripHeroInlineEditors)).observe(hero, {attributes:true, attributeFilter:['class','aria-expanded']});
  }

  consolidateMortgageEditor();
  stripHeroInlineEditors();
  renderEquityRows();

  document.addEventListener('input', (event) => {
    if (event.target.matches('#balance,#rate,#payment,#currentOverpayment,#homeValue,#ownership,#projectionTrendRate')) {
      requestAnimationFrame(renderEquityRows);
    }
  });

  requestAnimationFrame(() => {
    consolidateMortgageEditor();
    stripHeroInlineEditors();
    renderEquityRows();
  });
})();