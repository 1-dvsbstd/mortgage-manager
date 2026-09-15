(() => {
  const $ = (id) => document.getElementById(id);
  const money = (value) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(Math.max(0, Number(value) || 0));
  const pct = (value) => `${Math.max(0, Number(value) || 0).toFixed(1)}%`;

  const marketRates = [
    { maxLtv: 60, label: 'Up to 60% LTV', two: 5.11, five: 5.40 },
    { maxLtv: 75, label: 'Up to 75% LTV', two: 5.48, five: 5.61 },
    { maxLtv: 85, label: 'Up to 85% LTV', two: 5.64, five: 5.60 },
    { maxLtv: 95, label: 'Up to 95% LTV', two: 6.09, five: 6.00 },
    { maxLtv: 100, label: 'Above 95% LTV', two: 6.09, five: 6.00 },
  ];

  const payoffDate = (months) => {
    if (!Number.isFinite(months)) return '—';
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(date);
  };

  const compactMonths = (months) => {
    if (!Number.isFinite(months) || months <= 0) return '0m';
    const years = Math.floor(months / 12);
    const remainder = months % 12;
    return years && remainder ? `${years}y ${remainder}m` : years ? `${years}y` : `${remainder}m`;
  };

  const paymentFor = (principal, annualRate, months) => {
    principal = Math.max(0, Number(principal) || 0);
    months = Math.max(1, Math.round(Number(months) || 1));
    const r = Math.max(0, Number(annualRate) || 0) / 100 / 12;
    if (!principal) return 0;
    if (!r) return principal / months;
    return principal * r / (1 - Math.pow(1 + r, -months));
  };

  function values() {
    return {
      balance: +$('balance')?.value || 0,
      rate: +$('rate')?.value || 0,
      payment: +$('payment')?.value || 0,
      homeValue: +$('homeValue')?.value || 0,
      ownership: Math.min(100, Math.max(0, +$('ownership')?.value || 0)),
      extra: Math.max(0, +$('customExtra')?.value || 0),
      fixedEnd: $('fixedEnd')?.value || '',
    };
  }

  function monthsUntil(monthValue) {
    if (!monthValue) return null;
    const [year, month] = monthValue.split('-').map(Number);
    if (!year || !month) return null;
    const now = new Date();
    return (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());
  }

  function simulatePeriod(balance, annualRate, payment, months) {
    let remaining = Math.max(0, balance);
    const r = Math.max(0, annualRate) / 100 / 12;
    let interestTotal = 0;
    let capitalTotal = 0;
    for (let i = 0; i < months && remaining > 0.01; i += 1) {
      const interest = remaining * r;
      const capital = Math.max(0, Math.min(remaining, payment - interest));
      interestTotal += interest;
      capitalTotal += capital;
      remaining -= capital;
      if (capital <= 0) break;
    }
    return { remaining, interestTotal, capitalTotal };
  }

  function renderMortgageDeepDive(v, result) {
    if (!$('monthInterest')) return;
    const monthlyInterest = v.balance * (v.rate / 100 / 12);
    const scheduledCapital = Math.max(0, v.payment - monthlyInterest);
    const nextYear = simulatePeriod(v.balance, v.rate, v.payment + v.extra, 12);

    $('monthInterest').textContent = money(monthlyInterest);
    $('monthCapital').textContent = money(scheduledCapital);
    $('yearCapital').textContent = `${money(nextYear.capitalTotal)} capital`;
    $('yearInterest').textContent = `${money(nextYear.interestTotal)} interest${v.extra ? ` with ${money(v.extra)}/mo overpayment` : ''}`;

    const ltv = v.homeValue > 0 ? (v.balance / v.homeValue) * 100 : 100;
    const band = marketRates.find((item) => ltv <= item.maxLtv) || marketRates[marketRates.length - 1];
    const term = Number.isFinite(result.base.months) ? result.base.months : 300;
    $('marketCurrentRate').textContent = pct(v.rate);
    $('marketLtvBand').textContent = v.homeValue > 0 ? `${pct(ltv)} current LTV · ${band.label}` : band.label;
    $('market2yRate').textContent = pct(band.two);
    $('market5yRate').textContent = pct(band.five);
    $('market2yPayment').textContent = `${money(paymentFor(v.balance, band.two, term))}/mo over current remaining term`;
    $('market5yPayment').textContent = `${money(paymentFor(v.balance, band.five, term))}/mo over current remaining term`;
  }

  function renderScenarioComparison(v, result) {
    const body = $('scenarioCompareBody');
    if (!body) return;
    const extras = [0, 50, 100, 250, 500];
    body.innerHTML = extras.map((extra) => {
      const comparison = MortgageMath.compare(v.balance, v.rate, v.payment, extra);
      const selected = Math.round(extra) === Math.round(v.extra) ? ' class="is-selected"' : '';
      const finish = Number.isFinite(comparison.accelerated.months) ? payoffDate(comparison.accelerated.months) : '—';
      return `<tr${selected}><td><strong>${money(extra)}/mo</strong></td><td>${finish}</td><td>${extra ? compactMonths(comparison.monthsSaved) : '—'}</td><td>${extra ? money(comparison.interestSaved) : '—'}</td></tr>`;
    }).join('');

    const useful = [50, 100, 250, 500].map((extra) => ({ extra, c: MortgageMath.compare(v.balance, v.rate, v.payment, extra) })).find(({ c }) => c.monthsSaved >= 12);
    $('overpayTargetInsight').textContent = useful
      ? `${money(useful.extra)}/month is the first preset that saves at least a year (${compactMonths(useful.c.monthsSaved)}).`
      : 'Even small overpayments reduce interest; use the slider to find a level that fits comfortably.';
  }

  function balanceAt(points, month) {
    if (!points?.length) return 0;
    return points[Math.min(Math.max(0, month), points.length - 1)] ?? 0;
  }

  function findLtvMonth(points, homeValue, target) {
    if (!homeValue) return -1;
    return points.findIndex((balance) => (balance / homeValue) * 100 <= target);
  }

  function renderTrajectory(v, result) {
    const milestones = $('trajectoryMilestones');
    const rows = $('yearlyBalanceBody');
    if (!milestones || !rows || !Number.isFinite(result.base.months)) return;

    const currentLtv = v.homeValue > 0 ? (v.balance / v.homeValue) * 100 : null;
    const ltvTargets = [90, 85, 80, 75, 70, 65, 60, 50, 40, 30, 20, 10];
    const nextTarget = currentLtv === null ? null : ltvTargets.find((target) => currentLtv > target);
    const nextTargetMonth = nextTarget === null ? -1 : findLtvMonth(result.base.monthlyPoints, v.homeValue, nextTarget);
    const fixedMonths = monthsUntil(v.fixedEnd);
    const fixedBalance = fixedMonths !== null && fixedMonths >= 0 ? balanceAt(result.base.monthlyPoints, fixedMonths) : null;

    const cards = [
      `<div class="deep-stat"><span>Mortgage-free</span><strong>${payoffDate(result.base.months)}</strong><small>${compactMonths(result.base.months)} on the current path</small></div>`,
      `<div class="deep-stat"><span>With selected overpayment</span><strong>${payoffDate(result.accelerated.months)}</strong><small>${compactMonths(result.monthsSaved)} sooner</small></div>`,
      nextTarget && nextTargetMonth >= 0
        ? `<div class="deep-stat"><span>Next LTV milestone</span><strong>${nextTarget}%</strong><small>Around ${payoffDate(nextTargetMonth)}</small></div>`
        : `<div class="deep-stat"><span>Deal-end balance</span><strong>${fixedBalance === null ? '—' : money(fixedBalance)}</strong><small>${v.fixedEnd ? 'At your saved fixed-rate end date' : 'Add a fixed-rate end date to calculate this'}</small></div>`,
    ];
    milestones.innerHTML = cards.join('');

    const candidateMonths = [12, 36, 60, 120, result.base.months];
    const uniqueMonths = [...new Set(candidateMonths.filter((m) => m > 0 && m <= result.base.months))];
    rows.innerHTML = uniqueMonths.map((month) => {
      const base = balanceAt(result.base.monthlyPoints, month);
      const over = balanceAt(result.accelerated.monthlyPoints, month);
      const ltv = v.homeValue > 0 ? (base / v.homeValue) * 100 : null;
      const label = month === result.base.months ? `${compactMonths(result.base.months)} · Mortgage-free` : month % 12 === 0 ? `Year ${month / 12}` : compactMonths(month);
      return `<tr><td><strong>${label}</strong></td><td>${money(base)}</td><td>${money(over)}</td><td>${ltv === null ? '—' : pct(ltv)}</td></tr>`;
    }).join('');
  }

  function render() {
    if (!window.MortgageMath || !$('balance')) return;
    const v = values();
    const result = MortgageMath.compare(v.balance, v.rate, v.payment, v.extra);
    renderMortgageDeepDive(v, result);
    renderScenarioComparison(v, result);
    renderTrajectory(v, result);
  }

  document.addEventListener('input', (event) => {
    if (event.target.matches('#balance,#rate,#payment,#homeValue,#ownership,#fixedEnd,#customExtra,#extraSlider')) requestAnimationFrame(render);
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest('#overpayButtons')) requestAnimationFrame(render);
  });
  window.addEventListener('resize', () => requestAnimationFrame(render));
  render();
})();