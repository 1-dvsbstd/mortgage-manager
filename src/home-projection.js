(() => {
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'mortgage-manager-home-projection-v1';
  const defaults = { low: 1, trend: 2.5, high: 4, inflation: 2, mode: 'future' };
  let settings = { ...defaults };

  const money = (value) => new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
  }).format(Math.max(0, Number(value) || 0));

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) settings = { ...defaults, ...JSON.parse(raw) };
    } catch (error) {
      console.warn('Could not load home projection assumptions.', error);
    }
  }

  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (_) {}
  }

  function ensureUI() {
    if ($('homeProjection')) return;
    const detail = document.querySelector('.home-panel .expand-detail');
    if (!detail) return;

    const section = document.createElement('section');
    section.id = 'homeProjection';
    section.className = 'home-projection';
    section.innerHTML = `
      <div class="deep-heading">
        <div><p class="eyebrow">Future home value</p><h2>What could your home be worth when the mortgage is gone?</h2></div>
        <span class="source-date">Projection, not a valuation</span>
      </div>
      <p class="projection-working">Working value today: <strong id="projectionCurrentValue">—</strong> · based on the property value saved in this app.</p>
      <div class="projection-toggle" role="group" aria-label="Projection value type">
        <button type="button" data-projection-mode="future">Future money</button>
        <button type="button" data-projection-mode="real">Today’s money</button>
      </div>
      <div class="projection-summary">
        <div class="projection-card"><span>Low growth</span><strong id="projectionLow">—</strong><small id="projectionLowShare">—</small></div>
        <div class="projection-card trend"><span>Trend case</span><strong id="projectionTrend">—</strong><small id="projectionTrendShare">—</small></div>
        <div class="projection-card"><span>Higher growth</span><strong id="projectionHigh">—</strong><small id="projectionHighShare">—</small></div>
      </div>
      <div class="projection-controls">
        <label>Low growth %/yr<input id="projectionLowRate" type="number" min="-5" max="10" step="0.1" inputmode="decimal"></label>
        <label>Trend growth %/yr<input id="projectionTrendRate" type="number" min="-5" max="10" step="0.1" inputmode="decimal"></label>
        <label>High growth %/yr<input id="projectionHighRate" type="number" min="-5" max="12" step="0.1" inputmode="decimal"></label>
        <label>Inflation %/yr<input id="projectionInflation" type="number" min="0" max="10" step="0.1" inputmode="decimal"></label>
      </div>
      <p class="deep-note" id="projectionNote">The trend case uses an editable long-run house-price growth assumption. “Today’s money” removes the effect of your inflation assumption so distant values are easier to compare with today.</p>
    `;
    detail.appendChild(section);

    $('projectionLowRate').value = settings.low;
    $('projectionTrendRate').value = settings.trend;
    $('projectionHighRate').value = settings.high;
    $('projectionInflation').value = settings.inflation;

    document.querySelectorAll('[data-projection-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        settings.mode = button.dataset.projectionMode;
        saveSettings();
        render();
      });
    });

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

    document.querySelectorAll('[data-projection-mode]').forEach((button) => {
      button.classList.toggle('active', button.dataset.projectionMode === settings.mode);
    });

    if (!homeValue || !Number.isFinite(months)) {
      ['projectionLow','projectionTrend','projectionHigh'].forEach((id) => $(id).textContent = '—');
      ['projectionLowShare','projectionTrendShare','projectionHighShare'].forEach((id) => $(id).textContent = 'Add a valid home value and repayment path');
      return;
    }

    const scenarios = [
      ['Low', settings.low, 'projectionLow', 'projectionLowShare'],
      ['Trend', settings.trend, 'projectionTrend', 'projectionTrendShare'],
      ['High', settings.high, 'projectionHigh', 'projectionHighShare'],
    ];

    scenarios.forEach(([, growth, valueId, shareId]) => {
      const nominal = projectedValue(homeValue, growth, years);
      const displayed = settings.mode === 'real' ? realValue(nominal, settings.inflation, years) : nominal;
      const shareValue = displayed * ownership / 100;
      $(valueId).textContent = money(displayed);
      $(shareId).textContent = `${money(shareValue)} for your ${ownership.toFixed(ownership % 1 ? 1 : 0)}% share`;
    });

    $('projectionNote').textContent = settings.mode === 'real'
      ? `Shown in today’s money using ${settings.inflation.toFixed(1)}% annual inflation over roughly ${years.toFixed(1)} years. Growth assumptions remain editable.`
      : `Shown in future pounds over roughly ${years.toFixed(1)} years. Low ${settings.low.toFixed(1)}%, trend ${settings.trend.toFixed(1)}%, high ${settings.high.toFixed(1)}% annual house-price growth.`;
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
