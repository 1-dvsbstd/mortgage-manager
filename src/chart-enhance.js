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

  const values = () => ({
    balance: +document.getElementById('balance')?.value || 0,
    rate: +document.getElementById('rate')?.value || 0,
    payment: +document.getElementById('payment')?.value || 0,
    homeValue: +document.getElementById('homeValue')?.value || 0,
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
    const maxBalance = Math.max(base.monthlyPoints[0] || 0, accelerated.monthlyPoints[0] || 0, 1);
    const maxMonths = Math.max(base.monthlyPoints.length, accelerated.monthlyPoints.length) - 1 || 1;

    const xFor = (month) => pad.left + width * (month / maxMonths);
    const yFor = (balance) => pad.top + height * (1 - Math.max(0, balance) / maxBalance);

    ctx.font = compact ? '11px system-ui' : '11px system-ui';
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
      ctx.fillText(compactMoney(maxBalance * (1 - i / 4)), pad.left - 10, y);
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

    const drawLine = (points, colour, lineWidth) => {
      ctx.strokeStyle = colour;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      points.forEach((balance, month) => {
        const x = xFor(Math.min(month, maxMonths));
        const y = yFor(balance);
        if (month === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    drawLine(base.monthlyPoints, '#a8b4b0', compact ? 2.2 : 2.5);
    drawLine(accelerated.monthlyPoints, '#54e0b4', compact ? 2.7 : 3);

    const fixedMonth = monthsUntil(v.fixedEnd);
    if (fixedMonth !== null && fixedMonth >= 0 && fixedMonth <= maxMonths) {
      const x = xFor(fixedMonth);
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = 'rgba(231,220,196,.55)';
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
      readout.innerHTML = `<span>${compact ? 'Tap' : 'Hover or tap'} the chart to inspect a point in time.</span>`;
      return;
    }

    const month = Math.max(0, Math.min(maxMonths, hoverMonth));
    const x = xFor(month);
    const baseBalance = pointAt(base.monthlyPoints, month);
    const overBalance = pointAt(accelerated.monthlyPoints, month);

    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + height);
    ctx.stroke();

    const dot = (balance, colour) => {
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(x, yFor(balance), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#071713';
      ctx.lineWidth = 2;
      ctx.stroke();
    };
    dot(baseBalance, '#a8b4b0');
    dot(overBalance, '#54e0b4');

    const ltv = v.homeValue > 0 ? (baseBalance / v.homeValue) * 100 : null;
    const difference = Math.max(0, baseBalance - overBalance);
    readout.innerHTML = `<strong>${formatPointDate(month)}</strong><span>Current path ${money(baseBalance)}</span><span>With overpayment ${money(overBalance)}</span><span>${difference ? `${money(difference)} less owed` : 'Same balance'}${ltv === null ? '' : ` · ${ltv.toFixed(1)}% LTV`}</span>`;
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
    if (event.target.matches('#balance,#rate,#payment,#homeValue,#ownership,#fixedEnd,#customExtra,#extraSlider')) scheduleRender();
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