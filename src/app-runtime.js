(() => {
  const $ = (id) => document.getElementById(id);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const DONUT_RADIUS = 72;
  const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
  const HISTORY_KEY = 'mortgage-manager-history-v1';
  const HOME_KEY = 'mortgage-manager-home-projection-v4';

  function historyCount() {
    try {
      const rows = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(rows) ? new Set(rows.map((row) => row?.month).filter(Boolean)).size : 0;
    } catch (_) { return 0; }
  }

  function homeSettings() {
    try { return JSON.parse(localStorage.getItem(HOME_KEY) || '{}') || {};
    } catch (_) { return {}; }
  }

  function refreshOptionalSections() {
    const progress = $('personalProgress');
    if (progress) progress.hidden = historyCount() < 2;

    const cost = $('propertyCostComparison');
    if (cost) {
      const settings = homeSettings();
      const purchasePrice = Math.max(0, Number(settings.purchasePrice) || 0);
      const improvements = Math.max(0, Number(settings.improvements) || 0);
      cost.hidden = !(purchasePrice > 0 || improvements > 0);
    }
  }

  function removeStandaloneEquityProgress() {
    const section = $('equityGrowth');
    if (section) section.hidden = true;
  }

  function moneyNumber(text) {
    const n = Number(String(text || '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  function ensureOwnershipDonut(bar) {
    let svg = bar?.querySelector('.ownership-donut');
    if (svg || !bar) return svg;
    svg = document.createElementNS(SVG_NS, 'svg');
    svg.classList.add('ownership-donut');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `
      <circle class="ownership-donut-track" cx="100" cy="100" r="${DONUT_RADIUS}"></circle>
      <circle class="ownership-donut-arc ownership-donut-debt" cx="100" cy="100" r="${DONUT_RADIUS}"></circle>
      <circle class="ownership-donut-arc ownership-donut-equity" cx="100" cy="100" r="${DONUT_RADIUS}"></circle>
      <circle class="ownership-donut-arc ownership-donut-other" cx="100" cy="100" r="${DONUT_RADIUS}"></circle>
      <circle class="ownership-donut-centre" cx="100" cy="100" r="54"></circle>
      <text class="ownership-donut-percent" x="100" y="95" text-anchor="middle">0%</text>
      <text class="ownership-donut-free" x="100" y="121" text-anchor="middle">free</text>`;
    bar.appendChild(svg);
    return svg;
  }

  function setArc(circle, startPct, sizePct, gapPct) {
    if (!circle) return;
    if (sizePct <= 0.01) {
      circle.style.display = 'none';
      return;
    }
    circle.style.display = '';
    const effectiveGap = Math.min(gapPct, Math.max(0, sizePct * 0.22));
    const visiblePct = Math.max(0, sizePct - effectiveGap);
    const startWithGap = startPct + effectiveGap / 2;
    const dash = DONUT_CIRCUMFERENCE * visiblePct / 100;
    const offset = -DONUT_CIRCUMFERENCE * startWithGap / 100;
    circle.setAttribute('stroke-dasharray', `${dash.toFixed(3)} ${(DONUT_CIRCUMFERENCE - dash).toFixed(3)}`);
    circle.setAttribute('stroke-dashoffset', offset.toFixed(3));
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
    const svg = ensureOwnershipDonut(bar);
    const nonZeroSegments = [debtPct, equityPctWhole, schemePct].filter((value) => value > 0.05).length;
    const gapPct = nonZeroSegments > 1 ? 0.72 : 0;
    setArc(svg.querySelector('.ownership-donut-debt'), 0, debtPct, gapPct);
    setArc(svg.querySelector('.ownership-donut-equity'), debtPct, equityPctWhole, gapPct);
    setArc(svg.querySelector('.ownership-donut-other'), debtPct + equityPctWhole, schemePct, gapPct);
    svg.querySelector('.ownership-donut-percent').textContent = `${mortgageFreeShare.toFixed(0)}%`;
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

  function standardiseSetupClose() {
    const button = document.querySelector('.personal-modal .personal-close');
    if (!button) return;
    button.textContent = 'Close';
    button.setAttribute('aria-label', 'Close setup and data');
  }

  function keepFutureSectionsOpen() {
    ['homeValueHistory','nextHomePlanner','nextHomeSettings'].forEach((id) => {
      const el = $(id);
      if (el?.tagName === 'DETAILS') el.open = true;
    });
  }

  function refresh() {
    removeStandaloneEquityProgress();
    refreshOptionalSections();
    renderOwnershipDonut();
    ensureCostBars();
    ensureEquityLegend();
    standardiseSetupClose();
    keepFutureSectionsOpen();
  }

  let frame = null;
  let timer = null;
  const schedule = (delay = 0) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(refresh);
    }, delay);
  };

  if (window.MortgageStore?.subscribe) {
    window.MortgageStore.subscribe((next, previous) => {
      if (['balance','homeValue','ownership'].some((key) => next[key] !== previous[key])) schedule();
    });
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('#personalDataButton,[data-expand-card],#propertyCostComparison,#recordSnapshot,[data-action="snapshot"],[data-action="save"],[data-action="reset-history"]')) schedule(35);
  });
  document.addEventListener('input', (event) => {
    if (event.target.matches('#projectionTrendRate,#projectionPurchasePrice,#projectionImprovements')) schedule(20);
  });
  document.addEventListener('mortgage-history-updated', () => schedule(35));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const button = document.querySelector('.personal-modal .personal-close');
    if (button) button.click();
  });

  schedule();
  setTimeout(refresh, 250);
})();