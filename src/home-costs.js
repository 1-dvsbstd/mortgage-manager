(() => {
  const $ = (id) => document.getElementById(id);
  const money = (value) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(Math.max(0, Number(value)||0));

  function getHomeSettings() {
    try { return JSON.parse(localStorage.getItem('mortgage-manager-home-projection-v4') || '{}'); }
    catch (_) { return {}; }
  }

  function getHistorySummary() {
    try { return JSON.parse(localStorage.getItem('mortgage-manager-mortgage-history-summary-v1') || '{}') || {}; }
    catch (_) { return {}; }
  }

  function getTrendRate() {
    const trend = Number(getHomeSettings().trend);
    return Number.isFinite(trend) ? trend : 2.5;
  }

  function currentMortgage() {
    const state = window.MortgageStore?.get?.();
    if (state) return state;
    return {
      balance:+$('balance')?.value||0,
      rate:+$('rate')?.value||0,
      payment:+$('payment')?.value||0,
      currentOverpayment:+$('currentOverpayment')?.value||0,
      scenarioExtra:+$('customExtra')?.value||0,
      homeValue:+$('homeValue')?.value||0,
      ownership:Math.min(100,Math.max(0,+$('ownership')?.value||0)),
    };
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
        <div class="property-cost-card"><span>Remaining mortgage payments</span><strong id="costRemainingPayments">—</strong><small id="costRemainingPaymentsNote">Projected from today.</small></div>
        <div class="property-cost-card"><span>Estimated lifetime cost floor</span><strong id="costKnownBasis">—</strong><small id="costKnownBasisNote">Add purchase details for this comparison.</small></div>
      </div>
      <p class="deep-note" id="costComparisonNote">Add mortgage history to include estimated interest already paid.</p>`;
    projection.insertAdjacentElement('afterend', section);
  }

  function renderCostComparison() {
    ensureCostComparison();
    if (!$('propertyCostComparison') || !window.MortgageMath) return;

    const mortgage = currentMortgage();
    const balance = Math.max(0,Number(mortgage.balance)||0);
    const rate = Math.max(0,Number(mortgage.rate)||0);
    const payment = Math.max(0,Number(mortgage.payment)||0);
    const currentOverpay = Math.max(0,Number(mortgage.currentOverpayment)||0);
    const scenarioExtra = Math.max(0,Number(mortgage.scenarioExtra)||0);
    const home = Math.max(0,Number(mortgage.homeValue)||0);
    const ownership = Math.min(100,Math.max(0,Number(mortgage.ownership)||0));
    const path = MortgageMath.amortize(balance, rate, payment + currentOverpay + scenarioExtra);
    if (!Number.isFinite(path.months)) return;

    const settings = getHomeSettings();
    const history = getHistorySummary();
    const trend = getTrendRate();
    const purchasePrice = Math.max(0, Number(history.purchasePrice) || Number(settings.purchasePrice) || 0);
    const improvements = Math.max(0, Number(settings.improvements)||0);
    const historicalInterest = Math.max(0, Number(history.historicalInterest) || 0);
    const years = path.months / 12;
    const futureWholeValue = home * Math.pow(1 + trend/100, years);
    const futureShareValue = futureWholeValue * ownership/100;
    const futureInterest = Math.max(0, Number(path.interest)||0);
    const remainingPayments = balance + futureInterest;
    const knownBasis = purchasePrice ? purchasePrice + improvements + historicalInterest + futureInterest : 0;

    $('costFutureValue').textContent = money(futureShareValue || futureWholeValue);
    $('costFutureValueNote').textContent = ownership < 100
      ? `${ownership.toFixed(ownership%1?1:0)}% share of the projected property value.`
      : `Projected property value using ${trend.toFixed(1)}% annual growth.`;
    $('costRemainingPayments').textContent = money(remainingPayments);
    $('costRemainingPaymentsNote').textContent = scenarioExtra > 0
      ? `Projected using your regular overpayment plus ${money(scenarioExtra)}/month extra.`
      : 'Projected using your current payment and regular overpayment.';

    if (knownBasis) {
      $('costKnownBasis').textContent = money(knownBasis);
      const historyText = historicalInterest > 0 ? ` + ${money(historicalInterest)} estimated past interest` : '';
      $('costKnownBasisNote').textContent = `${money(purchasePrice)} purchase price${improvements ? ` + ${money(improvements)} improvements` : ''}${historyText} + ${money(futureInterest)} projected future interest.`;
      if (historicalInterest > 0 && history.complete) {
        $('costComparisonNote').textContent = 'Uses your entered mortgage history for estimated past interest and the selected repayment path for future interest. Fees, maintenance, insurance and other ownership costs are still excluded.';
      } else if (historicalInterest > 0) {
        $('costComparisonNote').textContent = 'Historical interest is partially reconstructed from the deal periods entered. Add any missing mortgage periods to improve the lifetime estimate.';
      } else {
        $('costComparisonNote').textContent = 'Purchase details are included, but past mortgage interest is not yet reconstructed. Add your previous mortgage deals under Setup & data → Mortgage history.';
      }
    } else {
      $('costKnownBasis').textContent = 'Add purchase price';
      $('costKnownBasisNote').textContent = 'Purchase price and mortgage history are set under Setup & data.';
      $('costComparisonNote').textContent = 'Add mortgage history to turn this into a more complete lifetime-cost estimate.';
    }
  }

  const schedule = () => requestAnimationFrame(renderCostComparison);
  if (window.MortgageStore?.subscribe) window.MortgageStore.subscribe(schedule);
  document.addEventListener('input', (event) => {
    if (event.target.matches('#projectionTrendRate,#projectionPurchasePrice,#projectionImprovements')) schedule();
  });
  document.addEventListener('change', (event) => {
    if (event.target.matches('#projectionPurchasePrice,#projectionImprovements')) schedule();
  });
  document.addEventListener('mortgage-history-updated', schedule);

  schedule();
  setTimeout(renderCostComparison, 250);
})();