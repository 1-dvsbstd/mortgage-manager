(() => {
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'mortgage-manager-home-projection-v3';
  const defaults = { low: 1, trend: 2.5, high: 4, purchasePrice: '', purchaseYear: '' };
  let settings = { ...defaults };

  const money = (value) => new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
  }).format(Math.max(0, Number(value) || 0));

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('mortgage-manager-home-projection-v2');
      if (raw) settings = { ...defaults, ...JSON.parse(raw) };
    } catch (error) {
      console.warn('Could not load home projection assumptions.', error);
    }
  }

  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (_) {}
  }

  function clamp(value, min, max, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }

  function projectedValue(start, annualRate, years) {
    return start * Math.pow(1 + annualRate / 100, Math.max(0, years));
  }

  function projectionYear(months) {
    const date = new Date();
    date.setMonth(date.getMonth() + Math.max(0, months));
    return date.getFullYear();
  }

  function yearsSincePurchase(year) {
    const now = new Date();
    const currentYear = now.getFullYear() + now.getMonth() / 12;
    return Math.max(0, currentYear - Number(year));
  }

  function ensureUI() {
    if ($('homeProjection')) return;
    const detail = document.querySelector('.home-panel .expand-detail');
    if (!detail) return;

    const section = document.createElement('section');
    section.id = 'homeProjection';
    section.className = 'home-projection simplified';
    section.innerHTML = `
      <div class="deep-heading projection-heading">
        <div><p class="eyebrow">Home value</p><h2>From what you paid to what it might be worth later</h2></div>
        <span class="source-date">Estimate, not a valuation</span>
      </div>

      <div class="projection-core-grid">
        <div class="projection-core-card">
          <span>Bought for</span>
          <strong id="projectionPurchase">Add purchase details</strong>
          <small id="projectionPurchaseNote">Purchase price and year give the estimate a factual starting point.</small>
        </div>
        <div class="projection-core-card current-estimate">
          <span>Estimated value today</span>
          <strong id="projectionCurrentEstimate">—</strong>
          <small id="projectionCurrentNote">—</small>
          <button type="button" id="useCurrentEstimate" class="projection-use-button">Use for dashboard</button>
        </div>
        <div class="projection-core-card future-estimate">
          <span>Estimated value when mortgage-free</span>
          <strong id="projectionFutureValue">—</strong>
          <small id="projectionFutureNote">—</small>
        </div>
        <div class="projection-core-card">
          <span>Your projected share</span>
          <strong id="projectionShareValue">—</strong>
          <small id="projectionShareNote">—</small>
        </div>
      </div>

      <p class="projection-plain-note" id="projectionPlainNote">Add your purchase price and year bought to anchor the estimate to something you know.</p>

      <details class="projection-assumptions">
        <summary>Estimate settings</summary>
        <div class="projection-controls purchase-controls">
          <label>Purchase price (£)<input id="projectionPurchasePrice" type="number" min="0" step="1000" inputmode="decimal"></label>
          <label>Year bought<input id="projectionPurchaseYear" type="number" min="1900" max="2100" step="1" inputmode="numeric"></label>
          <label>Low growth<input id="projectionLowRate" type="number" min="-5" max="10" step="0.1" inputmode="decimal"><span>% per year</span></label>
          <label>Trend growth<input id="projectionTrendRate" type="number" min="-5" max="10" step="0.1" inputmode="decimal"><span>% per year</span></label>
          <label>High growth<input id="projectionHighRate" type="number" min="-5" max="12" step="0.1" inputmode="decimal"><span>% per year</span></label>
        </div>
        <p class="deep-note">The current estimate grows your purchase price by the trend assumption from the year you bought. The future estimate then uses that same trend to the projected mortgage-free date. Local sales, renovations and property condition are not included yet.</p>
      </details>
    `;
    detail.appendChild(section);

    $('projectionPurchasePrice').value = settings.purchasePrice;
    $('projectionPurchaseYear').value = settings.purchaseYear;
    $('projectionLowRate').value = settings.low;
    $('projectionTrendRate').value = settings.trend;
    $('projectionHighRate').value = settings.high;

    ['projectionPurchasePrice','projectionPurchaseYear','projectionLowRate','projectionTrendRate','projectionHighRate'].forEach((id) => {
      $(id).addEventListener('input', () => {
        settings.purchasePrice = $('projectionPurchasePrice').value;
        settings.purchaseYear = $('projectionPurchaseYear').value;
        settings.low = clamp(+$('projectionLowRate').value, -5, 10, defaults.low);
        settings.trend = clamp(+$('projectionTrendRate').value, -5, 10, defaults.trend);
        settings.high = clamp(+$('projectionHighRate').value, -5, 12, defaults.high);
        saveSettings();
        render();
      });
    });

    $('useCurrentEstimate').addEventListener('click', (event) => {
      event.stopPropagation();
      const estimate = Number($('useCurrentEstimate').dataset.value || 0);
      if (!estimate || !$('homeValue')) return;
      $('homeValue').value = Math.round(estimate);
      $('homeValue').dispatchEvent(new Event('input', { bubbles: true }));
      $('useCurrentEstimate').textContent = 'Using this estimate';
      setTimeout(() => { if ($('useCurrentEstimate')) $('useCurrentEstimate').textContent = 'Use for dashboard'; }, 1400);
    });
  }

  function render() {
    ensureUI();
    if (!$('homeProjection') || !window.MortgageMath) return;

    const savedHomeValue = +$('homeValue')?.value || 0;
    const ownership = Math.min(100, Math.max(0, +$('ownership')?.value || 0));
    const balance = +$('balance')?.value || 0;
    const rate = +$('rate')?.value || 0;
    const payment = +$('payment')?.value || 0;
    const extra = +$('customExtra')?.value || 0;
    const result = MortgageMath.compare(balance, rate, payment, extra);
    const months = Number.isFinite(result.accelerated.months) ? result.accelerated.months : result.base.months;
    const yearsToPayoff = Number.isFinite(months) ? months / 12 : 0;

    const purchasePrice = Math.max(0, Number(settings.purchasePrice) || 0);
    const purchaseYear = Math.round(Number(settings.purchaseYear) || 0);
    const currentYear = new Date().getFullYear();
    const validPurchase = purchasePrice > 0 && purchaseYear >= 1900 && purchaseYear <= currentYear;

    let estimatedToday = savedHomeValue;
    if (validPurchase) estimatedToday = projectedValue(purchasePrice, settings.trend, yearsSincePurchase(purchaseYear));

    $('projectionPurchase').textContent = validPurchase ? `${money(purchasePrice)} in ${purchaseYear}` : 'Add purchase details';
    $('projectionPurchaseNote').textContent = validPurchase
      ? 'A factual starting point for the estimate.'
      : 'Purchase price and year give the estimate a factual starting point.';

    if (!estimatedToday) {
      $('projectionCurrentEstimate').textContent = '—';
      $('projectionCurrentNote').textContent = 'Add purchase details or a current property value.';
      $('projectionFutureValue').textContent = '—';
      $('projectionFutureNote').textContent = '';
      $('projectionShareValue').textContent = '—';
      $('projectionShareNote').textContent = '';
      $('projectionPlainNote').textContent = 'Add your purchase price and year bought to anchor the estimate to something you know.';
      $('useCurrentEstimate').style.display = 'none';
      return;
    }

    $('projectionCurrentEstimate').textContent = money(estimatedToday);
    $('useCurrentEstimate').dataset.value = String(estimatedToday);
    $('useCurrentEstimate').style.display = validPurchase ? 'inline-flex' : 'none';
    $('projectionCurrentNote').textContent = validPurchase
      ? `Modelled from ${money(purchasePrice)} in ${purchaseYear} using ${settings.trend.toFixed(1)}% annual growth.`
      : 'Using the current property value saved in the dashboard.';

    if (!Number.isFinite(months)) {
      $('projectionFutureValue').textContent = '—';
      $('projectionFutureNote').textContent = 'A valid repayment path is needed.';
      $('projectionShareValue').textContent = '—';
      $('projectionShareNote').textContent = '';
      return;
    }

    const trendFuture = projectedValue(estimatedToday, settings.trend, yearsToPayoff);
    const lowFuture = projectedValue(estimatedToday, settings.low, yearsToPayoff);
    const highFuture = projectedValue(estimatedToday, settings.high, yearsToPayoff);
    const shareFuture = trendFuture * ownership / 100;
    const year = projectionYear(months);

    $('projectionFutureValue').textContent = money(trendFuture);
    $('projectionFutureNote').textContent = `Centre estimate for ${year}; rough range ${money(lowFuture)}–${money(highFuture)}.`;
    $('projectionShareValue').textContent = money(shareFuture);
    $('projectionShareNote').textContent = `${ownership.toFixed(ownership % 1 ? 1 : 0)}% of the centre estimate.`;

    $('projectionPlainNote').textContent = validPurchase
      ? `This is a simple growth model: ${money(purchasePrice)} in ${purchaseYear} → about ${money(estimatedToday)} today → about ${money(trendFuture)} by ${year}. It is an estimate, not a valuation.`
      : `The forecast currently starts from your saved ${money(savedHomeValue)} property estimate. Add purchase price and year bought for a clearer starting point.`;
  }

  loadSettings();
  document.addEventListener('input', (event) => {
    if (event.target.matches('#homeValue,#ownership,#balance,#rate,#payment,#customExtra,#extraSlider')) requestAnimationFrame(render);
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest('#overpayButtons')) requestAnimationFrame(render);
  });
  render();
})();
