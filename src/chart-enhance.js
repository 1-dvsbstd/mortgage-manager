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

  function values() {
    return {
      balance: +document.getElementById('balance')?.value || 0,
      rate: +document.getElementById('rate')?.value || 0,
      payment: +document.getElementById('payment')?.value || 0,
      homeValue: +document.getElementById('homeValue')?.value || 0,
      extra: Math.max(0, +document.getElementById('customExtra')?.value || 0),
      fixedEnd: document.getElementById('fixedEnd')?.value || '',
    };
  }

  function monthsUntil(monthValue) {
    if (!monthValue) return null;
    const [year, month] = monthValue.split('-').map(Number);
    if (!year || !month) return null;
    const now = new Date();
    return (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());
  }

  function dateAt(months) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() + months);
    return date;
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

  function render() {
    const v = values();
    const result = MortgageMath.compare(v.balance, v.rate, v.payment, v.extra);
    const base = result.base;
    const accelerated = result.accelerated;
    if (!base?.monthlyPoints?.length || !accelerated?.monthlyPoints?.length) return;

    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = Math.max(280, Math.floor(container.getBoundingClientRect().width));
    const expanded = canvas.closest('.expandable-card')?.classList.contains('is-expanded');
    const cssHeight = expanded
      ? Math.max(360, Math.min(500, Math.round(cssWidth * 0.46)))
      : (window.innerWidth < 620 ? 250 : 315);

    canvas.style.width = '100%';
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const compact = cssWidth < 520;
    const pad = { left: compact ? 46 : 60, right: compact ? 14 : 24, top: 18, bottom: compact ? 44 : 48 };
    const width = cssWidth - pad.left - pad.right;
    const height = cssHeight - pad.top - pad.bottom;
    const maxBalance = Math.max(base.monthlyPoints[0] || 0, accelerated.monthlyPoints[0] || 0, 1);
    const maxMonths = Math.max(base.monthlyPoints.length, accelerated.monthlyPoints.length) - 1 || 1;

    const xFor = (month) => pad.left + width * (month / maxMonths);
    const yFor = (balance) => pad.top + height * (1 - Math.max(0, balance) / maxBalance);

    ctx.font = compact ? '10px system-ui' : '11px system-ui';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= 4; i += 1) {
      const y = pad.top + (height * i) / 4;
      ctx.strokeStyle = 'rgba(255,255,255,.075)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + width, y);
      ctx.stroke();
      const amount = maxBalance * (1 - i / 4);
      ctx.fillStyle = '#8fa39c';
      ctx.textAlign = 'right';
      ctx.fillText(compactMoney(amount), pad.left - 8, y);
    }

    const totalYears = maxMonths / 12;
    const yearStep = totalYears <= 12 ? 1 : totalYears <= 24 ? 2 : 3;
    const start = new Date();
    const firstJanuaryMonths = (12 - start.getMonth()) % 12 || 12;
    const yearTicks = [{ month: 0, label: `${start.getFullYear()}` }];
    for (let month = firstJanuaryMonths; month <= maxMonths; month += 12 * yearStep) {
      yearTicks.push({ month, label: `${dateAt(month).getFullYear()}` });
    }
    if (yearTicks[yearTicks.length - 1].month < maxMonths - 6) {
      yearTicks.push({ month: maxMonths, label: `${dateAt(maxMonths).getFullYear()}` });
    }

    ctx.textBaseline = 'alphabetic';
    yearTicks.forEach(({ month, label }, index) => {
      const x = xFor(month);
      if (index > 0 && index < yearTicks.length - 1) {
        ctx.strokeStyle = 'rgba(255,255,255,.035)';
        ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + height); ctx.stroke();
      }
      ctx.fillStyle = '#8fa39c';
      ctx.textAlign = month === 0 ? 'left' : month === maxMonths ? 'right' : 'center';
      ctx.fillText(label, x, cssHeight - 14);
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
    drawLine(accelerated.monthlyPoints, '#54e0b4', compact ? 2.6 : 3);

    const fixedMonth = monthsUntil(v.fixedEnd);
    if (fixedMonth !== null && fixedMonth >= 0 && fixedMonth <= maxMonths) {
      const x = xFor(fixedMonth);
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = 'rgba(231,220,196,.55)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + height); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#d7cdb8';
      ctx.font = compact ? '9px system-ui' : '10px system-ui';
      ctx.textAlign = x > cssWidth * .72 ? 'right' : 'left';
      ctx.fillText('Fix ends', x + (x > cssWidth * .72 ? -5 : 5), pad.top + 12);
    }

    const readout = ensureReadout();
    if (hoverMonth === null) {
      readout.innerHTML = '<span>Hover or tap the chart to inspect a point in time.</span>';
      return;
    }

    const month = Math.max(0, Math.min(maxMonths, hoverMonth));
    const x = xFor(month);
    const baseBalance = pointAt(base.monthlyPoints, month);
    const overBalance = pointAt(accelerated.monthlyPoints, month);
    const baseY = yFor(baseBalance);
    const overY = yFor(overBalance);

    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + height); ctx.stroke();

    const dot = (y, colour) => {
      ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#071713'; ctx.lineWidth = 2; ctx.stroke();
    };
    dot(baseY, '#a8b4b0');
    dot(overY, '#54e0b4');

    const ltv = v.homeValue > 0 ? (baseBalance / v.homeValue) * 100 : null;
    const difference = Math.max(0, baseBalance - overBalance);
    readout.innerHTML = `<strong>${formatPointDate(month)}</strong><span>Current path ${money(baseBalance)}</span><span>With overpayment ${money(overBalance)}</span><span>${difference ? `${money(difference)} less owed` : 'Same balance'}${ltv === null ? '' : ` · ${ltv.toFixed(1)}% LTV`}</span>`;
  }

  function monthFromPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const compact = rect.width < 520;
    const left = compact ? 46 : 60;
    const right = compact ? 14 : 24;
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

  document.addEventListener('input', (event) => {
    if (event.target.matches('#balance,#rate,#payment,#homeValue,#ownership,#fixedEnd,#customExtra,#extraSlider')) requestAnimationFrame(render);
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest('#overpayButtons')) requestAnimationFrame(render);
    if (event.target.closest('[data-expandable-card="trajectory"]') && !event.target.closest('canvas')) requestAnimationFrame(render);
  });
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(render);
  });

  const container = canvas.parentElement;
  if ('ResizeObserver' in window && container) {
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(render);
    });
    observer.observe(container);
  }

  const card = canvas.closest('[data-expandable-card="trajectory"]');
  if (card) {
    new MutationObserver(() => requestAnimationFrame(render)).observe(card, {
      attributes: true,
      attributeFilter: ['class', 'aria-expanded'],
    });
  }

  requestAnimationFrame(render);
})();