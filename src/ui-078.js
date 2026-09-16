(() => {
  const $ = (id) => document.getElementById(id);

  function moneyNumber(text) {
    const n = Number(String(text || '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  function renderOwnershipDonut() {
    const bar = document.querySelector('.home-panel .ownership-bar');
    const state = window.MortgageStore?.get?.();
    const balance = Math.max(0, Number(state?.balance ?? $('balance')?.value) || 0);
    const homeValue = Math.max(0, Number(state?.homeValue ?? $('homeValue')?.value) || 0);
    const ownership = Math.min(100, Math.max(0, Number(state?.ownership ?? $('ownership')?.value) || 0));
    if (!bar || !homeValue) return;

    const schemePct = Math.max(0, 100 - ownership);
    const debtPct = Math.min(ownership, Math.max(0, balance / homeValue * 100));
    const equityPctWhole = Math.max(0, ownership - debtPct);
    const ownedValue = homeValue * ownership / 100;
    const householdEquity = Math.max(0, ownedValue - balance);
    const mortgageFreeShare = ownedValue > 0 ? Math.min(100, Math.max(0, householdEquity / ownedValue * 100)) : 0;

    const debtEnd = debtPct;
    const equityEnd = debtPct + equityPctWhole;
    bar.style.setProperty('--debt-end', `${debtEnd.toFixed(2)}%`);
    bar.style.setProperty('--equity-end', `${equityEnd.toFixed(2)}%`);

    let emphasis = bar.querySelector('.ownership-equity-emphasis');
    if (!emphasis) {
      emphasis = document.createElement('span');
      emphasis.className = 'ownership-equity-emphasis';
      emphasis.setAttribute('aria-hidden', 'true');
      bar.appendChild(emphasis);
    }

    bar.dataset.equityLabel = `${mortgageFreeShare.toFixed(0)}%\nfree`;
    bar.setAttribute('aria-label', `${debtPct.toFixed(1)}% mortgage debt, ${equityPctWhole.toFixed(1)}% your equity, ${schemePct.toFixed(1)}% other share`);
  }

  function ensureCostBars() {
    const cards = Array.from(document.querySelectorAll('#propertyCostComparison .property-cost-card'));
    if (!cards.length) return;
    const values = cards.map((card) => moneyNumber(card.querySelector('strong')?.textContent));
    const max = Math.max(...values, 1);

    cards.forEach((card, index) => {
      let scale = card.querySelector('.cost-scale');
      if (!scale) {
        scale = document.createElement('div');
        scale.className = 'cost-scale';
        scale.setAttribute('aria-hidden', 'true');
        scale.innerHTML = '<i></i>';
        card.appendChild(scale);
      }
      const width = Math.max(0, Math.min(100, values[index] / max * 100));
      scale.style.setProperty('--cost-width', `${width.toFixed(1)}%`);
    });
  }

  function ensureEquityLegend() {
    const legend = document.querySelector('.chart-panel .legend');
    if (!legend || legend.querySelector('.equity-legend-item')) return;
    const item = document.createElement('span');
    item.className = 'equity-legend-item';
    item.innerHTML = '<i class="dot equity-line"></i>Projected equity';
    legend.appendChild(item);
  }

  function refresh() {
    renderOwnershipDonut();
    ensureCostBars();
    ensureEquityLegend();
  }

  let frame = null;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(refresh);
  };

  if (window.MortgageStore?.subscribe) {
    window.MortgageStore.subscribe((next, previous) => {
      if (['balance','homeValue','ownership'].some((key) => next[key] !== previous[key])) schedule();
    });
  }

  document.addEventListener('input', (event) => {
    if (event.target.matches('#projectionTrendRate,#projectionPurchasePrice,#projectionImprovements')) {
      setTimeout(schedule, 20);
    }
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-expand-card],#propertyCostComparison')) setTimeout(schedule, 40);
  });

  schedule();
  setTimeout(refresh, 250);
})();
