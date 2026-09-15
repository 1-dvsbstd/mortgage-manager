(() => {
  const canvas = document.getElementById('chart');
  if (!canvas || !window.MortgageMath) return;

  let hoverMonth = null;
  let pinned = false;
  let resizeFrame = null;

  const money = (value) => new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
  }).format(Math.max(0, Number(value) || 0));

  const compactMoney = (value) => {
    const n = Math.max(0, Number(value) || 0);
    return n >= 1000 ? `£${Math.round(n / 1000)}k` : money(n);
  };

  const homeTrend = () => {
    try {
      const settings = JSON.parse(localStorage.getItem('mortgage-manager-home-projection-v4') || '{}');
      const n = Number(settings.trend);
      return Number.isFinite(n) ? n : 2.5;
    } catch (_) { return 2.5; }
  };

  const values = () => ({
    balance: +document.getElementById('balance')?.value || 0,
    rate: +document.getElementById('rate')?.value || 0,
    payment: +document.getElementById('payment')?.value || 0,
    homeValue: +document.getElementById('homeValue')?.value || 0,
    ownership: Math.min(100, Math.max(0, +document.getElementById('ownership')?.value || 0)),
    extra: Math.max(0, +document.getElementById('customExtra')?.value || 0),
    fixedEnd: document.getElementById('fixedEnd')?.value || '',
  });

  function dateAt(months) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() + months);
    return date;
  }

  function monthsUntil(monthValue) {
    if (!monthValue) return null;
    const [year, month] = monthValue.split('-').map(Number);
    if (!year || !month) return null;
    const now = new Date();
    return (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());
  }

  function formatPointDate(months) {
    return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(dateAt(months));
  }

  function pointAt(points, month) {
    if (!points?.length) return 0;
    return points[Math.min(Math.max(0, month), points.length - 1)] ?? 0;
  }

  function makeEquityPoints(v, mortgagePoints, maxMonths) {
    if (!v.homeValue || !v.ownership) return [];
    const trend = homeTrend();
    const ownedFraction = v.ownership / 100;
    const points = [];
    for (let month = 0; month <= maxMonths; month += 1) {
      const projectedHome = v.homeValue * Math.pow(1 + trend / 100, month / 12);
      const shareValue = projectedHome * ownedFraction;
      const mortgage = pointAt(mortgagePoints, month);
      points.push(Math.max(0, shareValue - mortgage));
    }
    return points;
  }

  function ensureReadout() {
    let readout = document.getElementById('chartReadout');
    if (readout) return readout;
    readout = document.createElement('div');
    readout.id = 'chartReadout';
    readout.className = 'chart-readout';
    readout.setAttribute('aria-live', 'polite');
    canvas.insertAdjacentElement('afterend', readout);
    return readout;
  }

  function makeYearTicks(maxMonths, cssWidth) {
    const totalYears = Math.max(1, maxMonths / 12);
    const maxTicks = cssWidth < 420 ? 5 : cssWidth < 620 ? 6 : 8;
    const intervalYears = Math.max(1, Math.ceil(totalYears / Math.max(1, maxTicks - 1)));
    const intervalMonths = intervalYears * 12;
    const ticks = [{ month: 0, label: `${dateAt(0).getFullYear()}` }];

    for (let month = intervalMonths; month < maxMonths; month += intervalMonths) {
      ticks.push({ month, label: `${dateAt(month).getFullYear()}` });
    }

    const finalYear = `${dateAt(maxMonths).getFullYear()}`;
    const last = ticks[ticks.length - 1];
    if (!last || maxMonths - last.month > Math.max(6, intervalMonths * 0.35)) {
      ticks.push({ month: maxMonths, label: finalYear });
    } else if (last) {
      last.month = maxMonths;
      last.label = finalYear;
    }

    if (ticks.length > 2) {
      const plotWidth = Math.max(1, cssWidth - (cssWidth < 520 ? 70 : 88));
      const minLabelGap = cssWidth < 520 ? 62 : 52;
      const finalTick = ticks[ticks.length - 1];
      const previousTick = ticks[ticks.length - 2];
      const pixelGap = plotWidth * ((finalTick.month - previousTick.month) / Math.max(1, maxMonths));
      if (pixelGap < minLabelGap) ticks.splice(ticks.length - 2, 1);
    }

    return ticks;
  }

  function render() {
    const v = values();
    const result = MortgageMath.compare(v.balance, v.rate, v.payment, v.extra);
    const base = result.base;
    const accelerated = result.accelerated;
    if (!base?.monthlyPoints?.length || !accelerated?.monthlyPoints?.length) return;

    const container = canvas.parentElement;
    const rectWidth = Math.floor(container?.getBoundingClientRect().width || 0);
    if (rectWidth < 80) return;

    const cssWidth = Math.max(280, rectWidth);
    const expanded = canvas.closest('.expandable-card')?.classList.contains('is-expanded');
    const compact = cssWidth < 520;
    const cssHeight = expanded
      ? (compact ? 390 : Math.max(360, Math.min(500, Math.round(cssWidth * 0.46))))
      : (cssWidth < 620 ? 250 : 315);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);

    canvas.style.width = '100%';
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const pad = {
      left: compact ? 52 : 62,
      right: compact ? 18 : 26,
      top: compact ? 22 : 18,
      bottom: compact ? 54 : 50,
    };
    const width = Math.max(1, cssWidth - pad.left - pad.right);
    const height = Math.max(1, cssHeight - pad.top - pad.bottom);
    const maxMonths = Math.max(base.monthlyPoints.length, accelerated.monthlyPoints.length) - 1 || 1;
    const equityPoints = makeEquityPoints(v, base.monthlyPoints, maxMonths);
    const maxEquity = equityPoints.length ? Math.max(...equityPoints) : 0;
    const maxValue = Math.max(base.monthlyPoints[0] || 0, accelerated.monthlyPoints[0] || 0, maxEquity, 1);

    const xFor = (month) => pad.left + width * (month / maxMonths);
    const yFor = (value) => pad.top + height * (1 - Math.max(0, value) / maxValue);

    ctx.font = '11px system-ui';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i += 1) {
      const y = pad.top + (height * i) / 4;
      ctx.strokeStyle = 'rgba(255,255,255,.075)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + width, y);
      ctx.stroke();
      ctx.fillStyle = '#8fa39c';
      ctx.textAlign = 'right';
      ctx.fillText(compactMoney(maxValue * (1 - i / 4)), pad.left - 10, y);
    }

    const yearTicks = makeYearTicks(maxMonths, cssWidth);
    ctx.textBaseline = 'alphabetic';
    ctx.font = compact ? '10px system-ui' : '11px system-ui';
    yearTicks.forEach(({ month, label }, index) => {
      const x = xFor(month);
      if (index > 0 && index < yearTicks.length - 1) {
        ctx.strokeStyle = 'rgba(255,255,255,.035)';
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, pad.top + height);
        ctx.stroke();
      }
      ctx.fillStyle = '#8fa39c';
      ctx.textAlign = index === 0 ? 'left' : index === yearTicks.length - 1 ? 'right' : 'center';
      ctx.fillText(label, x, cssHeight - 17);
    });

    const drawLine = (points, colour, lineWidth, dash = []) => {
      if (!points?.length) return;
      ctx.save();
      ctx.strokeStyle = colour;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.setLineDash(dash);
      ctx.beginPath();
      points.forEach((value, month) => {
        const x = xFor(Math.min(month, maxMonths));
        const y = yFor(value);
        if (month === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    };

    drawLine(base.monthlyPoints, '#a8b4b0', compact ? 2.2 : 2.5);
    drawLine(accelerated.monthlyPoints, '#54e0b4', compact ? 2.7 : 3);
    drawLine(equityPoints, '#e7dcc4', compact ? 2.2 : 2.5, [6, 5]);

    const fixedMonth = monthsUntil(v.fixedEnd);
    if (fixedMonth !== null && fixedMonth >= 0 && fixedMonth <= maxMonths) {
      const x = xFor(fixedMonth);
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = 'rgba(231,220,196,.42)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + height);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#d7cdb8';
      ctx.font = compact ? '9px system-ui' : '10px system-ui';
      ctx.textAlign = x > cssWidth * .72 ? 'right' : 'left';
      ctx.fillText('Fix ends', x + (x > cssWidth * .72 ? -5 : 5), pad.top + 13);
    }

    const readout = ensureReadout();
    if (hoverMonth === null) {
      readout.innerHTML = `<span>${compact ? 'Tap' : 'Hover or tap'} the chart to inspect mortgage and equity over time.</span>`;
      return;
    }

    const month = Math.max(0, Math.min(maxMonths, hoverMonth));
    const x = xFor(month);
    const baseBalance = pointAt(base.monthlyPoints, month);
    const overBalance = pointAt(accelerated.monthlyPoints, month);
    const equity = pointAt(equityPoints, month);

    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + height);
    ctx.stroke();

    const dot = (value, colour) => {
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(x, yFor(value), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#071713';
      ctx.lineWidth = 2;
      ctx.stroke();
    };
    dot(baseBalance, '#a8b4b0');
    dot(overBalance, '#54e0b4');
    if (equityPoints.length) dot(equity, '#e7dcc4');

    const projectedHome = v.homeValue > 0 ? v.homeValue * Math.pow(1 + homeTrend()/100, month/12) : 0;
    const ltv = projectedHome > 0 ? (baseBalance / projectedHome) * 100 : null;
    const difference = Math.max(0, baseBalance - overBalance);
    readout.innerHTML = `<strong>${formatPointDate(month)}</strong><span>Mortgage ${money(baseBalance)}</span><span>Projected equity ${equityPoints.length ? money(equity) : '—'}</span><span>With selected overpayment ${money(overBalance)}</span><span>${difference ? `${money(difference)} less owed` : 'Same balance'}${ltv === null ? '' : ` · ${ltv.toFixed(1)}% projected LTV`}</span>`;
  }

  function monthFromPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const compact = rect.width < 520;
    const left = compact ? 52 : 62;
    const right = compact ? 18 : 26;
    const usable = Math.max(1, rect.width - left - right);
    const v = values();
    const result = MortgageMath.compare(v.balance, v.rate, v.payment, v.extra);
    const maxMonths = Math.max(result.base.monthlyPoints.length, result.accelerated.monthlyPoints.length) - 1 || 1;
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left - left) / usable));
    return Math.round(fraction * maxMonths);
  }

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || pinned) return;
    hoverMonth = monthFromPointer(event);
    render();
  });
  canvas.addEventListener('pointerleave', () => {
    if (!pinned) { hoverMonth = null; render(); }
  });
  canvas.addEventListener('pointerup', (event) => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      event.stopPropagation();
      hoverMonth = monthFromPointer(event);
      pinned = true;
      render();
    }
  });
  canvas.addEventListener('click', (event) => {
    event.stopPropagation();
    hoverMonth = monthFromPointer(event);
    pinned = true;
    render();
  });
  canvas.addEventListener('dblclick', (event) => {
    event.stopPropagation();
    pinned = false;
    hoverMonth = null;
    render();
  });

  const scheduleRender = () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => requestAnimationFrame(render));
  };

  document.addEventListener('input', (event) => {
    if (event.target.matches('#balance,#rate,#payment,#homeValue,#ownership,#fixedEnd,#customExtra,#extraSlider,#projectionTrendRate')) scheduleRender();
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest('#overpayButtons,[data-expandable-card="trajectory"]')) scheduleRender();
  });
  window.addEventListener('resize', scheduleRender);
  window.addEventListener('orientationchange', () => setTimeout(render, 180));
  window.addEventListener('pageshow', scheduleRender);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) setTimeout(render, 80);
  });

  const container = canvas.parentElement;
  if ('ResizeObserver' in window && container) new ResizeObserver(scheduleRender).observe(container);

  const card = canvas.closest('[data-expandable-card="trajectory"]');
  if (card) {
    new MutationObserver(scheduleRender).observe(card, {
      attributes: true,
      attributeFilter: ['class', 'aria-expanded'],
    });
  }

  scheduleRender();
})();