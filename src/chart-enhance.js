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

  const values = () => {
    const state = window.MortgageStore?.get?.();
    if (state) return {
      balance: state.balance,
      rate: state.rate,
      payment: state.payment,
      regular: state.currentOverpayment,
      homeValue: state.homeValue,
      ownership: state.ownership,
      extra: state.scenarioExtra,
      fixedEnd: state.fixedEnd,
    };
    return {
      balance: +document.getElementById('balance')?.value || 0,
      rate: +document.getElementById('rate')?.value || 0,
      payment: +document.getElementById('payment')?.value || 0,
      regular: 0,
      homeValue: +document.getElementById('homeValue')?.value || 0,
      ownership: Math.min(100, Math.max(0, +document.getElementById('ownership')?.value || 0)),
      extra: Math.max(0, +document.getElementById('customExtra')?.value || 0),
      fixedEnd: document.getElementById('fixedEnd')?.value || '',
    };
  };

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
    for (let month = intervalMonths; month < maxMonths; month += intervalMonths) ticks.push({ month, label: `${dateAt(month).getFullYear()}` });
    const finalYear = `${dateAt(maxMonths).getFullYear()}`;
    const last = ticks[ticks.length - 1];
    if (!last || maxMonths - last.month > Math.max(6, intervalMonths * 0.35)) ticks.push({ month: maxMonths, label: finalYear });
    else if (last) { last.month = maxMonths; last.label = finalYear; }
    if (ticks.length > 2) {
      const plotWidth = Math.max(1, cssWidth - (cssWidth < 520 ? 70 : 88));
      const minLabelGap = cssWidth < 520 ? 62 : 52;
      const finalTick = ticks[ticks.length - 1]; const previousTick = ticks[ticks.length - 2];
      const pixelGap = plotWidth * ((finalTick.month - previousTick.month) / Math.max(1, maxMonths));
      if (pixelGap < minLabelGap) ticks.splice(ticks.length - 2, 1);
    }
    return ticks;
  }

  function pathsFor(v) {
    const scheduled = MortgageMath.amortize(v.balance, v.rate, Math.max(0, Number(v.payment) || 0));
    const regularPayment = Math.max(0, Number(v.payment) || 0) + Math.max(0, Number(v.regular) || 0);
    const current = MortgageMath.amortize(v.balance, v.rate, regularPayment);
    const selected = MortgageMath.amortize(v.balance, v.rate, regularPayment + Math.max(0, Number(v.extra) || 0));
    return { scheduled, current, selected };
  }

  function render() {
    const v = values();
    const { scheduled, current, selected } = pathsFor(v);
    if (!scheduled?.monthlyPoints?.length || !current?.monthlyPoints?.length || !selected?.monthlyPoints?.length) return;
    const container = canvas.parentElement;
    const rectWidth = Math.floor(container?.getBoundingClientRect().width || 0);
    if (rectWidth < 80) return;
    const cssWidth = Math.max(280, rectWidth);
    const compact = cssWidth < 520;
    const cssHeight = cssWidth < 620 ? 270 : 330;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.style.width = '100%'; canvas.style.height = `${cssHeight}px`; canvas.width = Math.floor(cssWidth * dpr); canvas.height = Math.floor(cssHeight * dpr);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cssWidth, cssHeight);
    const pad = { left: compact ? 52 : 62, right: compact ? 18 : 26, top: compact ? 22 : 18, bottom: compact ? 54 : 50 };
    const width = Math.max(1, cssWidth - pad.left - pad.right); const height = Math.max(1, cssHeight - pad.top - pad.bottom);
    const maxMonths = Math.max(scheduled.monthlyPoints.length, current.monthlyPoints.length, selected.monthlyPoints.length) - 1 || 1;
    const equityPoints = makeEquityPoints(v, selected.monthlyPoints, maxMonths);
    const maxEquity = equityPoints.length ? Math.max(...equityPoints) : 0;
    const maxValue = Math.max(scheduled.monthlyPoints[0] || 0, current.monthlyPoints[0] || 0, selected.monthlyPoints[0] || 0, maxEquity, 1);
    const xFor = (month) => pad.left + width * (month / maxMonths);
    const yFor = (value) => pad.top + height * (1 - Math.max(0, value) / maxValue);

    ctx.font = '11px system-ui'; ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i += 1) {
      const y = pad.top + (height * i) / 4;
      ctx.strokeStyle = 'rgba(224,231,226,.08)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + width, y); ctx.stroke();
      ctx.fillStyle = '#98a49f'; ctx.textAlign = 'right'; ctx.fillText(compactMoney(maxValue * (1 - i / 4)), pad.left - 10, y);
    }

    const yearTicks = makeYearTicks(maxMonths, cssWidth);
    ctx.textBaseline = 'alphabetic'; ctx.font = compact ? '10px system-ui' : '11px system-ui';
    yearTicks.forEach(({ month, label }, index) => {
      const x = xFor(month);
      if (index > 0 && index < yearTicks.length - 1) { ctx.strokeStyle = 'rgba(224,231,226,.04)'; ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + height); ctx.stroke(); }
      ctx.fillStyle = '#98a49f'; ctx.textAlign = index === 0 ? 'left' : index === yearTicks.length - 1 ? 'right' : 'center'; ctx.fillText(label, x, cssHeight - 17);
    });

    const drawLine = (points, colour, lineWidth, dash = []) => {
      if (!points?.length) return;
      ctx.save(); ctx.strokeStyle = colour; ctx.lineWidth = lineWidth; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash(dash); ctx.beginPath();
      points.forEach((value, month) => { const x = xFor(Math.min(month, maxMonths)); const y = yFor(value); if (month === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke(); ctx.restore();
    };
    drawLine(scheduled.monthlyPoints, '#7f8d87', compact ? 1.8 : 2.1, [4, 4]);
    drawLine(current.monthlyPoints, '#c8b78f', compact ? 2.2 : 2.5);
    drawLine(selected.monthlyPoints, '#70c8a8', compact ? 2.9 : 3.2);
    drawLine(equityPoints, '#e7e1d6', compact ? 2.1 : 2.4, [7, 5]);

    const fixedMonth = monthsUntil(v.fixedEnd);
    if (fixedMonth !== null && fixedMonth >= 0 && fixedMonth <= maxMonths) {
      const x = xFor(fixedMonth);
      ctx.save(); ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(231,225,214,.42)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + height); ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#d4ccba'; ctx.font = compact ? '9px system-ui' : '10px system-ui'; ctx.textAlign = x > cssWidth * .72 ? 'right' : 'left'; ctx.fillText('Fix ends', x + (x > cssWidth * .72 ? -5 : 5), pad.top + 13);
    }

    const readout = ensureReadout();
    if (hoverMonth === null) { readout.innerHTML = `<span>${compact ? 'Tap' : 'Hover or tap'} the chart to compare scheduled, current and What-if paths.</span>`; return; }
    const month = Math.max(0, Math.min(maxMonths, hoverMonth)); const x = xFor(month);
    const scheduledBalance = pointAt(scheduled.monthlyPoints, month);
    const currentBalance = pointAt(current.monthlyPoints, month);
    const selectedBalance = pointAt(selected.monthlyPoints, month);
    const equity = pointAt(equityPoints, month);
    ctx.strokeStyle = 'rgba(255,255,255,.24)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + height); ctx.stroke();
    const dot = (value, colour) => { ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(x, yFor(value), 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#08120f'; ctx.lineWidth = 2; ctx.stroke(); };
    dot(scheduledBalance, '#7f8d87'); dot(currentBalance, '#c8b78f'); dot(selectedBalance, '#70c8a8'); if (equityPoints.length) dot(equity, '#e7e1d6');
    const projectedHome = v.homeValue > 0 ? v.homeValue * Math.pow(1 + homeTrend()/100, month/12) : 0;
    const ltv = projectedHome > 0 ? (selectedBalance / projectedHome) * 100 : null;
    readout.innerHTML = `<strong>${formatPointDate(month)}</strong><span>Scheduled only ${money(scheduledBalance)}</span><span>Current overpayment ${money(currentBalance)}</span><span>Selected What-if ${money(selectedBalance)}</span><span>Projected equity ${equityPoints.length ? money(equity) : '—'}${ltv === null ? '' : ` · ${ltv.toFixed(1)}% projected LTV`}</span>`;
  }

  function monthFromPointer(event) {
    const rect = canvas.getBoundingClientRect(); const compact = rect.width < 520; const left = compact ? 52 : 62; const right = compact ? 18 : 26; const usable = Math.max(1, rect.width - left - right);
    const v = values(); const paths = pathsFor(v);
    const maxMonths = Math.max(paths.scheduled.monthlyPoints.length, paths.current.monthlyPoints.length, paths.selected.monthlyPoints.length) - 1 || 1;
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left - left) / usable));
    return Math.round(fraction * maxMonths);
  }

  canvas.addEventListener('pointermove', (event) => { if (event.pointerType === 'touch' || pinned) return; hoverMonth = monthFromPointer(event); render(); });
  canvas.addEventListener('pointerleave', () => { if (!pinned) { hoverMonth = null; render(); } });
  canvas.addEventListener('pointerup', (event) => { if (event.pointerType === 'touch' || event.pointerType === 'pen') { event.stopPropagation(); hoverMonth = monthFromPointer(event); pinned = true; render(); } });
  canvas.addEventListener('click', (event) => { event.stopPropagation(); hoverMonth = monthFromPointer(event); pinned = true; render(); });
  canvas.addEventListener('dblclick', (event) => { event.stopPropagation(); pinned = false; hoverMonth = null; render(); });

  const scheduleRender = () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(() => requestAnimationFrame(render)); };
  if (window.MortgageStore?.subscribe) window.MortgageStore.subscribe(scheduleRender);
  document.addEventListener('input', (event) => { if (event.target.matches('#projectionTrendRate')) scheduleRender(); });
  window.addEventListener('resize', scheduleRender);
  window.addEventListener('orientationchange', () => setTimeout(render, 180));
  window.addEventListener('pageshow', scheduleRender);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(render, 80); });

  const container = canvas.parentElement;
  if ('ResizeObserver' in window && container) new ResizeObserver(scheduleRender).observe(container);
  scheduleRender();
})();