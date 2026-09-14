(() => {
  const $ = (id) => document.getElementById(id);
  const money = (value) =>
    new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0,
    }).format(Math.max(0, Number(value) || 0));

  const humanMonths = (months) => {
    if (!Number.isFinite(months)) return '—';
    const years = Math.floor(months / 12);
    const remainder = months % 12;
    return [
      years ? `${years} year${years === 1 ? '' : 's'}` : '',
      remainder ? `${remainder} month${remainder === 1 ? '' : 's'}` : '',
    ]
      .filter(Boolean)
      .join(' ');
  };

  let selectedExtra = 50;

  function drawChart(base, accelerated) {
    const canvas = $('chart');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pad = { left: 72, right: 24, top: 24, bottom: 48 };
    const width = canvas.width - pad.left - pad.right;
    const height = canvas.height - pad.top - pad.bottom;
    const maxBalance = Math.max(base.annualPoints[0] || 0, accelerated.annualPoints[0] || 0, 1);
    const maxYears = Math.max(base.annualPoints.length, accelerated.annualPoints.length) - 1 || 1;

    ctx.strokeStyle = '#27314c';
    ctx.lineWidth = 1;
    ctx.font = '12px system-ui';
    ctx.fillStyle = '#9ba6bf';

    for (let i = 0; i <= 4; i += 1) {
      const y = pad.top + (height * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + width, y);
      ctx.stroke();
      const value = maxBalance * (1 - i / 4);
      ctx.fillText(money(value), 8, y + 4);
    }

    function drawLine(points, colour) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = 3;
      ctx.beginPath();
      points.forEach((value, index) => {
        const x = pad.left + width * (index / maxYears);
        const y = pad.top + height * (1 - value / maxBalance);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    drawLine(base.annualPoints, '#7ea2ff');
    drawLine(accelerated.annualPoints, '#66d39e');

    [0, Math.round(maxYears / 2), maxYears].forEach((year) => {
      const x = pad.left + width * (year / maxYears);
      ctx.fillText(`${year}y`, x - 8, canvas.height - 16);
    });
  }

  function currentValues() {
    return {
      balance: +$('balance').value || 0,
      rate: +$('rate').value || 0,
      payment: +$('payment').value || 0,
      homeValue: +$('homeValue').value || 0,
    };
  }

  function update() {
    const values = currentValues();
    const result = MortgageMath.compare(
      values.balance,
      values.rate,
      values.payment,
      selectedExtra
    );

    const equity = Math.max(0, values.homeValue - values.balance);
    const ltv = values.homeValue > 0 ? (values.balance / values.homeValue) * 100 : 0;

    $('balanceStat').textContent = money(values.balance);
    $('homeValueStat').textContent = money(values.homeValue);
    $('equityStat').textContent = money(equity);
    $('ltvStat').textContent = values.homeValue > 0 ? `${ltv.toFixed(1)}%` : '—';
    $('balanceLine').textContent = `${money(values.balance)} remaining`;
    $('overpayHeadline').textContent = `Overpay ${money(selectedExtra)}/month`;

    if (!Number.isFinite(result.base.months)) {
      $('yearsRemaining').textContent = 'Payment too low';
      $('overpayImpact').textContent = 'Increase the monthly payment to reduce the mortgage balance.';
      $('warning').textContent = 'At this rate, the payment does not cover enough principal to repay the mortgage.';
      drawChart(result.base, result.accelerated);
      return;
    }

    $('yearsRemaining').textContent = humanMonths(result.base.months);
    $('warning').textContent = '';

    if (selectedExtra === 0) {
      $('overpayImpact').textContent = 'Choose an amount to see how much time and interest you could save.';
    } else {
      $('overpayImpact').innerHTML = `Save <strong>${money(result.interestSaved)}</strong> in interest and finish <strong>${humanMonths(result.monthsSaved)}</strong> earlier.`;
    }

    drawChart(result.base, result.accelerated);
  }

  $('overpayButtons').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-extra]');
    if (!button) return;
    selectedExtra = +button.dataset.extra;
    document.querySelectorAll('button[data-extra]').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    update();
  });

  ['balance', 'rate', 'payment', 'homeValue'].forEach((id) => {
    $(id).addEventListener('input', update);
  });

  update();
})();
