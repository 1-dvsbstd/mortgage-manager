(() => {
  const STORAGE_KEY = 'mortgage-manager-v0.4';
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

  const compactMonths = (months) => {
    if (!Number.isFinite(months) || months <= 0) return '0m';
    const years = Math.floor(months / 12);
    const remainder = months % 12;
    if (years && remainder) return `${years}y ${remainder}m`;
    if (years) return `${years}y`;
    return `${remainder}m`;
  };

  const payoffDate = (months) => {
    if (!Number.isFinite(months)) return '—';
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(date);
  };

  const monthsUntil = (monthValue) => {
    if (!monthValue) return null;
    const [year, month] = monthValue.split('-').map(Number);
    if (!year || !month) return null;
    const now = new Date();
    return (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());
  };

  let selectedExtra = 50;
  let saveTimer;

  function currentValues() {
    return {
      balance: +$('balance').value || 0,
      rate: +$('rate').value || 0,
      payment: +$('payment').value || 0,
      homeValue: +$('homeValue').value || 0,
      ownership: Math.min(100, Math.max(0, +$('ownership').value || 0)),
      fixedEnd: $('fixedEnd').value || '',
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
      const keys = [STORAGE_KEY, 'mortgage-manager-v0.3', 'mortgage-manager-v0.2'];
      let saved = null;
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (raw) {
          saved = JSON.parse(raw);
          break;
        }
      }
      if (!saved) return;
      ['balance', 'rate', 'payment', 'homeValue', 'ownership', 'fixedEnd'].forEach((key) => {
        if (saved[key] !== undefined && $(key)) $(key).value = saved[key];
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
    document.querySelectorAll('button[data-extra]').forEach((button) => {
      button.classList.toggle('active', Number(button.dataset.extra) === selectedExtra);
    });
  }

  function updateNextEvent(fixedEnd) {
    const months = monthsUntil(fixedEnd);
    const timelineFill = $('timelineFill');
    const timelineEndLabel = $('timelineEndLabel');

    if (months === null) {
      $('nextEventTitle').textContent = 'Add your fixed-rate end date';
      $('nextEventText').textContent = 'We’ll keep your next mortgage milestone visible here.';
      timelineFill.style.width = '0%';
      timelineEndLabel.textContent = 'Deal end';
      return;
    }

    const date = new Date(`${fixedEnd}-01T12:00:00`);
    const formatted = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(date);
    timelineEndLabel.textContent = formatted;

    if (months < 0) {
      $('nextEventTitle').textContent = 'Fixed-rate date passed';
      $('nextEventText').textContent = `${formatted} has passed. Update the mortgage after your new deal starts.`;
      timelineFill.style.width = '100%';
    } else if (months === 0) {
      $('nextEventTitle').textContent = 'Fixed rate ends this month';
      $('nextEventText').textContent = 'Your deal is at its next major milestone.';
      timelineFill.style.width = '100%';
    } else {
      $('nextEventTitle').textContent = `Fixed rate ends in ${humanMonths(months)}`;
      $('nextEventText').textContent = months <= 6
        ? `${formatted} — worth reviewing remortgage options now.`
        : `${formatted} is your next key mortgage milestone.`;
      const progress = Math.max(8, 100 - (Math.min(months, 60) / 60) * 100);
      timelineFill.style.width = `${progress}%`;
    }
  }

  function updateOwnershipVisual(values, ownedPropertyValue, householdEquity) {
    if (values.homeValue <= 0) {
      $('debtSegment').style.width = '0%';
      $('equitySegment').style.width = '0%';
      $('schemeSegment').style.width = '0%';
      $('debtLegend').textContent = '—';
      $('equityLegend').textContent = '—';
      $('schemeLegend').textContent = '—';
      return;
    }

    const ownershipPct = values.ownership;
    const schemePct = Math.max(0, 100 - ownershipPct);
    const debtPct = Math.min(ownershipPct, Math.max(0, (values.balance / values.homeValue) * 100));
    const equityPct = Math.max(0, ownershipPct - debtPct);
    const schemeValue = values.homeValue - ownedPropertyValue;

    $('debtSegment').style.width = `${debtPct}%`;
    $('equitySegment').style.width = `${equityPct}%`;
    $('schemeSegment').style.width = `${schemePct}%`;
    $('debtLegend').textContent = money(values.balance);
    $('equityLegend').textContent = householdEquity >= 0 ? money(householdEquity) : `-${money(Math.abs(householdEquity))}`;
    $('schemeLegend').textContent = money(Math.max(0, schemeValue));
    $('schemeLegendWrap').style.display = schemePct > 0.01 ? 'inline' : 'none';
  }

  function drawChart(base, accelerated) {
    const canvas = $('chart');
    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = Math.max(280, container.clientWidth);
    const cssHeight = window.innerWidth < 620 ? 245 : 310;

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const compact = cssWidth < 520;
    const pad = { left: compact ? 48 : 68, right: 16, top: 18, bottom: 36 };
    const width = cssWidth - pad.left - pad.right;
    const height = cssHeight - pad.top - pad.bottom;
    const maxBalance = Math.max(base.monthlyPoints[0] || 0, accelerated.monthlyPoints[0] || 0, 1);
    const maxMonths = Math.max(base.monthlyPoints.length, accelerated.monthlyPoints.length) - 1 || 1;

    ctx.strokeStyle = 'rgba(255,255,255,.09)';
    ctx.lineWidth = 1;
    ctx.font = compact ? '10px system-ui' : '12px system-ui';
    ctx.fillStyle = '#99aaa5';

    for (let i = 0; i <= 4; i += 1) {
      const y = pad.top + (height * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + width, y);
      ctx.stroke();
      const value = maxBalance * (1 - i / 4);
      ctx.fillText(value >= 1000 ? `£${Math.round(value / 1000)}k` : money(value), 3, y + 4);
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

    drawLine(base.monthlyPoints, '#a8b4b0');
    drawLine(accelerated.monthlyPoints, '#54e0b4');

    const maxYears = maxMonths / 12;
    [0, 0.5, 1].forEach((fraction) => {
      const x = pad.left + width * fraction;
      const year = Math.round(maxYears * fraction);
      ctx.fillText(`${year}y`, x - 8, cssHeight - 10);
    });
  }

  function update() {
    const values = currentValues();
    selectedExtra = values.extra;
    const result = MortgageMath.compare(values.balance, values.rate, values.payment, selectedExtra);

    const ownedPropertyValue = values.homeValue * (values.ownership / 100);
    const householdEquity = ownedPropertyValue - values.balance;
    const ltv = values.homeValue > 0 ? (values.balance / values.homeValue) * 100 : 0;
    const mortgageFreeShare = ownedPropertyValue > 0
      ? Math.min(100, Math.max(0, (householdEquity / ownedPropertyValue) * 100))
      : 0;

    $('balanceLine').textContent = money(values.balance);
    $('paymentStat').textContent = money(values.payment);
    $('rateStat').textContent = `${values.rate.toFixed(2)}%`;
    $('homeValueStat').textContent = money(values.homeValue);
    $('ownedValueStat').textContent = money(ownedPropertyValue);
    $('equityStat').textContent = householdEquity >= 0 ? money(householdEquity) : `-${money(Math.abs(householdEquity))}`;
    $('equitySubtext').textContent = `${mortgageFreeShare.toFixed(0)}% of your owned share is mortgage-free`;
    $('ltvStat').textContent = values.homeValue > 0 ? `${ltv.toFixed(1)}%` : '—';
    $('ownershipBadge').textContent = `${values.ownership.toFixed(values.ownership % 1 ? 1 : 0)}% share`;
    $('equityProgress').textContent = `${mortgageFreeShare.toFixed(0)}%`;
    $('progressCaption').textContent = `${money(Math.max(0, householdEquity))} equity in your share`;
    $('progressFill').style.width = `${mortgageFreeShare.toFixed(1)}%`;
    $('overpayHeadline').textContent = `${money(selectedExtra)}/month`;

    updateOwnershipVisual(values, ownedPropertyValue, householdEquity);
    updateNextEvent(values.fixedEnd);

    if (!Number.isFinite(result.base.months)) {
      $('yearsRemaining').textContent = 'Payment too low';
      $('payoffDate').textContent = 'The payment does not currently repay the mortgage.';
      $('interestRemaining').textContent = '—';
      $('interestWithExtraText').textContent = '';
      $('timeSaved').textContent = '—';
      $('scenarioSummary').textContent = 'Increase the monthly payment to create a repayment path.';
      $('heroScenario').textContent = 'Your current payment needs adjusting before we can model overpayments.';
      $('warning').textContent = 'At this rate, the monthly payment does not cover enough principal to clear the mortgage.';
      drawChart(result.base, result.accelerated);
      return;
    }

    $('yearsRemaining').textContent = humanMonths(result.base.months);
    $('payoffDate').textContent = `Mortgage-free around ${payoffDate(result.base.months)}`;
    $('interestRemaining').textContent = money(result.base.interest);
    $('warning').textContent = '';

    if (selectedExtra === 0 || !Number.isFinite(result.accelerated.months)) {
      $('timeSaved').textContent = 'No change';
      $('scenarioSummary').textContent = `Current finish: ${payoffDate(result.base.months)}`;
      $('heroScenario').textContent = 'Choose an overpayment to see how much sooner you could finish.';
      $('interestWithExtraText').textContent = 'Choose an overpayment to preview the saving.';
    } else {
      const finish = payoffDate(result.accelerated.months);
      $('timeSaved').textContent = compactMonths(result.monthsSaved);
      $('scenarioSummary').textContent = `${compactMonths(result.monthsSaved)} sooner · ${money(result.interestSaved)} saved · finish ${finish}`;
      $('heroScenario').textContent = `${money(selectedExtra)}/month gets you mortgage-free ${compactMonths(result.monthsSaved)} sooner and saves ${money(result.interestSaved)} in interest.`;
      $('interestWithExtraText').textContent = `${money(result.accelerated.interest)} interest with ${money(selectedExtra)}/month overpayment`;
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

  ['balance', 'rate', 'payment', 'homeValue', 'ownership', 'fixedEnd'].forEach((id) => {
    $(id).addEventListener('input', () => {
      update();
      queueSave();
    });
  });

  window.addEventListener('resize', update);

  loadValues();
  syncExtraControls(selectedExtra);
  update();
})();
