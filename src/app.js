(() => {
  const STORAGE_KEY = 'mortgage-manager-v0.2';
  const $ = (id) => document.getElementById(id);
  const money = (value) =>
    new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0,
    }).format(Math.max(0, Number(value) || 0));

  const humanMonths = (months) => {
    if (!Number.isFinite(months)) return '—';
    if (months === 0) return 'Paid off';
    const years = Math.floor(months / 12);
    const remainder = months % 12;
    return [
      years ? `${years} year${years === 1 ? '' : 's'}` : '',
      remainder ? `${remainder} month${remainder === 1 ? '' : 's'}` : '',
    ].filter(Boolean).join(' ');
  };

  const payoffDate = (months) => {
    if (!Number.isFinite(months)) return '—';
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(date);
  };

  let selectedExtra = 50;
  let saveTimer;

  function currentValues() {
    return {
      balance: +$('balance').value || 0,
      rate: +$('rate').value || 0,
      payment: +$('payment').value || 0,
      homeValue: +$('homeValue').value || 0,
      extra: Math.max(0, +$('customExtra').value || 0),
    };
  }

  function saveValues() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentValues()));
    $('saveStatus').textContent = 'Saved on this device';
  }

  function queueSave() {
    $('saveStatus').textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveValues, 250);
  }

  function loadValues() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved) return;
      ['balance', 'rate', 'payment', 'homeValue'].forEach((key) => {
        if (saved[key] !== undefined) $(key).value = saved[key];
      });
      if (saved.extra !== undefined) {
        selectedExtra = Math.max(0, Number(saved.extra) || 0);
        $('customExtra').value = selectedExtra;
        $('extraSlider').value = Math.min(1000, selectedExtra);
      }
    } catch (error) {
      console.warn('Could not load saved mortgage data.', error);
    }
  }

  function syncExtraControls(value) {
    selectedExtra = Math.max(0, Number(value) || 0);
    $('customExtra').value = selectedExtra;
    $('extraSlider').value = Math.min(1000, selectedExtra);
    $('customExtraLabel').textContent = money(selectedExtra);

    document.querySelectorAll('button[data-extra]').forEach((button) => {
      button.classList.toggle('active', Number(button.dataset.extra) === selectedExtra);
    });
  }

  function drawChart(base, accelerated) {
    const canvas = $('chart');
    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = Math.max(300, container.clientWidth);
    const cssHeight = window.innerWidth < 620 ? 250 : 340;

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const compact = cssWidth < 520;
    const pad = { left: compact ? 50 : 72, right: 16, top: 20, bottom: 38 };
    const width = cssWidth - pad.left - pad.right;
    const height = cssHeight - pad.top - pad.bottom;
    const maxBalance = Math.max(base.monthlyPoints[0] || 0, accelerated.monthlyPoints[0] || 0, 1);
    const maxMonths = Math.max(base.monthlyPoints.length, accelerated.monthlyPoints.length) - 1 || 1;

    ctx.strokeStyle = '#27314c';
    ctx.lineWidth = 1;
    ctx.font = compact ? '10px system-ui' : '12px system-ui';
    ctx.fillStyle = '#9ba6bf';

    for (let i = 0; i <= 4; i += 1) {
      const y = pad.top + (height * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + width, y);
      ctx.stroke();
      const value = maxBalance * (1 - i / 4);
      const label = value >= 1000 ? `£${Math.round(value / 1000)}k` : money(value);
      ctx.fillText(label, 4, y + 4);
    }

    function drawLine(points, colour) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = compact ? 2.5 : 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      points.forEach((value, index) => {
        const x = pad.left + width * (index / maxMonths);
        const y = pad.top + height * (1 - value / maxBalance);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    drawLine(base.monthlyPoints, '#7ea2ff');
    drawLine(accelerated.monthlyPoints, '#66d39e');

    const maxYears = maxMonths / 12;
    [0, 0.5, 1].forEach((fraction) => {
      const x = pad.left + width * fraction;
      const year = Math.round(maxYears * fraction);
      ctx.fillText(`${year}y`, x - 8, cssHeight - 12);
    });
  }

  function update() {
    const values = currentValues();
    selectedExtra = values.extra;
    const result = MortgageMath.compare(values.balance, values.rate, values.payment, selectedExtra);

    const equity = values.homeValue - values.balance;
    const ltv = values.homeValue > 0 ? (values.balance / values.homeValue) * 100 : 0;

    $('balanceStat').textContent = money(values.balance);
    $('homeValueStat').textContent = money(values.homeValue);
    $('equityStat').textContent = money(Math.max(0, equity));
    $('ltvStat').textContent = values.homeValue > 0 ? `${ltv.toFixed(1)}%` : '—';
    $('balanceLine').textContent = money(values.balance);
    $('overpayHeadline').textContent = `${money(selectedExtra)}/month`;
    $('customExtraLabel').textContent = money(selectedExtra);

    if (!Number.isFinite(result.base.months)) {
      $('yearsRemaining').textContent = 'Payment too low';
      $('payoffDate').textContent = 'The payment does not currently repay the mortgage.';
      $('overpayImpact').textContent = 'Increase the payment or overpayment to create a repayment path.';
      $('acceleratedPayoff').textContent = '';
      $('warning').textContent = 'At this rate, the monthly payment does not cover enough principal to clear the mortgage.';
      $('interestRemaining').textContent = '—';
      $('interestWithExtra').textContent = '—';
      $('interestSaved').textContent = '—';
      drawChart(result.base, result.accelerated);
      return;
    }

    $('yearsRemaining').textContent = humanMonths(result.base.months);
    $('payoffDate').textContent = `Mortgage-free around ${payoffDate(result.base.months)}`;
    $('warning').textContent = '';
    $('interestRemaining').textContent = money(result.base.interest);

    if (selectedExtra === 0 || !Number.isFinite(result.accelerated.months)) {
      $('overpayImpact').textContent = 'Choose an amount to see how much time and interest you could save.';
      $('acceleratedPayoff').textContent = '';
      $('interestWithExtra').textContent = money(result.base.interest);
      $('interestSaved').textContent = money(0);
    } else {
      $('overpayImpact').innerHTML = `Save <strong>${money(result.interestSaved)}</strong> in interest and finish <strong>${humanMonths(result.monthsSaved)}</strong> earlier.`;
      $('acceleratedPayoff').textContent = `Paid off ${payoffDate(result.accelerated.months)}`;
      $('interestWithExtra').textContent = money(result.accelerated.interest);
      $('interestSaved').textContent = money(result.interestSaved);
    }

    drawChart(result.base, result.accelerated);
  }

  function applyExtra(value, shouldSave = true) {
    syncExtraControls(value);
    update();
    if (shouldSave) queueSave();
  }

  $('overpayButtons').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-extra]');
    if (!button) return;
    applyExtra(button.dataset.extra);
  });

  $('extraSlider').addEventListener('input', (event) => applyExtra(event.target.value));
  $('customExtra').addEventListener('input', (event) => applyExtra(event.target.value));

  ['balance', 'rate', 'payment', 'homeValue'].forEach((id) => {
    $(id).addEventListener('input', () => {
      update();
      queueSave();
    });
  });

  window.addEventListener('resize', () => update());

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((error) => {
        console.warn('Service worker registration failed.', error);
      });
    });
  }

  loadValues();
  syncExtraControls(selectedExtra);
  update();
})();
