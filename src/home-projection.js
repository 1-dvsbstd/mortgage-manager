(() => {
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'mortgage-manager-home-projection-v2';
  const defaults = { low: 1, trend: 2.5, high: 4, inflation: 2 };
  let settings = { ...defaults };

  const money = (value) => new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
  }).format(Math.max(0, Number(value) || 0));

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('mortgage-manager-home-projection-v1');
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
    return start * Math.pow(1 + annualRate / 100, years);
  }

  function realValue(nominal, inflation, years) {
    return nominal / Math.pow(1 + inflation / 100, years);
  }

  function projectionYear(months) {
    const date = new Date();
    date.setMonth(date.getMonth() + Math.max(0, months));
    return date.getFullYear();
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
        <div><p class="eyebrow">Future home value</p><h2>What might your home be worth when the mortgage is gone?</h2></div>
        <span class="source-date">Projection, not a valuation</span>
      </div>

      <div class="projection-hero">
        <span class="projection-label">Estimated value around <strong id="projectionYear">—</strong></span>
        <strong class="projection-main-value" id="projectionTrend">—</strong>
        <p id="projectionRange" class="projection-range">—</p>
        <p id="projectionShareLine" class="projection-share-line">—</p>
      </div>

      <div class="projection-context">
        <div><span>Worth in today’s money</span><strong id="projectionRealValue">—</strong><small id="projectionRealNote">—</small></div>
        <div><span>Starting value</span><strong id="projectionCurrentValue">—</strong><small>Saved property value</small></div>
      </div>

      <details class="projection-assumptions">
        <summary>Adjust assumptions</summary>
        <div class="projection-controls">
          <label>Low growth<input id="projectionLowRate" type="number" min="-5" max="10" step="0.1" inputmode="decimal"><span>% per year</span></label>
          <label>Trend growth<input id="projectionTrendRate" type="number" min="-5" max="10" step="0.1" inputmode="decimal"><span>% per year</span></label>
          <label>High growth<input id="projectionHighRate" type="number" min="-5" max="12" step="0.1" inputmode="decimal"><span>% per year</span></label>
          <label>Inflation<input id="projectionInflation" type="number" min="0" max="10" step="0.1" inputmode="decimal"><span>% per year</span></label>
        </div>
        <p class="deep-note">The centre estimate uses your trend growth assumption. The range uses the low and high assumptions. “Today’s money” removes your inflation assumption so a distant future value is easier to compare with today.</p>
      </details>
    `;
    detail.appendChild(section);

    $('projectionLowRate').value = settings.low;
    $('projectionTrendRate').value = settings.trend;
    $('projectionHighRate').value = settings.high;
    $('projectionInflation').value = settings.inflation;

    ['projectionLowRate','projectionTrendRate','projectionHighRate','projectionInflation'].forEach((id) => {
      $(id).addEventListener('input', () => {
        settings.low = clamp(+$('projectionLowRate').value, -5, 10, defaults.low);
        settings.trend = clamp(+$('projectionTrendRate').value, -5, 10, defaults.trend);
        settings.high = clamp(+$('projectionHighRate').value, -5, 12, defaults.high);
        settings.inflation = clamp(+$('projectionInflation').value, 0, 10, defaults.inflation);
        saveSettings();
        render();
      });
    });
  }

  function render() {
    ensureUI();
    if (!$('homeProjection') || !window.MortgageMath) return;

    const homeValue = +$('homeValue')?.value || 0;
    const ownership = Math.min(100, Math.max(0, +$('ownership')?.value || 0));
    const balance = +$('balance')?.value || 0;
    const rate = +$('rate')?.value || 0;
    const payment = +$('payment')?.value || 0;
    const extra = +$('customExtra')?.value || 0;
    const result = MortgageMath.compare(balance, rate, payment, extra);
    const months = Number.isFinite(result.accelerated.months) ? result.accelerated.months : result.base.months;
    const years = Number.isFinite(months) ? months / 12 : 0;

    $('projectionCurrentValue').textContent = homeValue ? money(homeValue) : 'Add a property value';
    $('projectionYear').textContent = Number.isFinite(months) ? projectionYear(months) : '—';

    if (!homeValue || !Number.isFinite(months)) {
      $('projectionTrend').textContent = '—';
      $('projectionRange').textContent = 'Add a valid property value and repayment path to see a projection.';
      $('projectionShareLine').textContent = '';
      $('projectionRealValue').textContent = '—';
      $('projectionRealNote').textContent = '';
      return;
    }

    const low = projectedValue(homeValue, settings.low, years);
    const trend = projectedValue(homeValue, settings.trend, years);
    const high = projectedValue(homeValue, settings.high, years);
    const real = realValue(trend, settings.inflation, years);
    const share = trend * ownership / 100;

    $('projectionTrend').textContent = money(trend);
    $('projectionRange').textContent = `A rough range is ${money(low)} to ${money(high)} using ${settings.low.toFixed(1)}%–${settings.high.toFixed(1)}% annual house-price growth.`;
    $('projectionShareLine').textContent = ownership < 99.95
      ? `At your ${ownership.toFixed(ownership % 1 ? 1 : 0)}% share, that centre estimate would be about ${money(share)}.`
      : `If you still own 100%, that would also be your approximate property equity once the mortgage is cleared.`;
    $('projectionRealValue').textContent = money(real);
    $('projectionRealNote').textContent = `Using ${settings.inflation.toFixed(1)}% annual inflation over roughly ${years.toFixed(1)} years`;
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
