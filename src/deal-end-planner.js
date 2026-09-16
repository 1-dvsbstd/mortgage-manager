(() => {
  const $ = (id) => document.getElementById(id);
  const RATE_SCENARIOS = [3.5, 4.0, 4.5, 5.0];
  const LTV_MILESTONES = [95, 90, 85, 80, 75, 70, 65, 60, 50, 40];

  const money = (value) => new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
  }).format(Math.max(0, Number(value) || 0));

  const pct = (value) => `${Math.max(0, Number(value) || 0).toFixed(1)}%`;

  const compactMonths = (months) => {
    if (!Number.isFinite(months) || months <= 0) return 'now';
    const y = Math.floor(months / 12);
    const m = months % 12;
    return y && m ? `${y}y ${m}m` : y ? `${y}y` : `${m}m`;
  };

  function monthsUntil(monthValue) {
    if (!monthValue) return null;
    const [year, month] = String(monthValue).split('-').map(Number);
    if (!year || !month) return null;
    const now = new Date();
    return (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());
  }

  function formatMonth(monthValue) {
    if (!monthValue) return '—';
    const [year, month] = String(monthValue).split('-').map(Number);
    if (!year || !month) return '—';
    return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(new Date(year, month - 1, 1));
  }

  function paymentFor(principal, annualRate, months) {
    const balance = Math.max(0, Number(principal) || 0);
    const term = Math.max(1, Math.round(Number(months) || 1));
    const r = Math.max(0, Number(annualRate) || 0) / 100 / 12;
    if (!balance) return 0;
    if (!r) return balance / term;
    return balance * r / (1 - Math.pow(1 + r, -term));
  }

  function balanceAt(points, month) {
    if (!Array.isArray(points) || !points.length) return 0;
    return points[Math.min(Math.max(0, month), points.length - 1)] ?? 0;
  }

  function projectedBalanceWithExtra(state, months, additionalMonthly) {
    if (!window.MortgageMath) return Number(state.balance) || 0;
    const payment = Math.max(0, Number(state.payment) || 0)
      + Math.max(0, Number(state.currentOverpayment) || 0)
      + Math.max(0, Number(additionalMonthly) || 0);
    const path = MortgageMath.amortize(state.balance, state.rate, payment);
    return balanceAt(path.monthlyPoints, months);
  }

  function monthlyExtraForTarget(state, months, targetBalance) {
    if (months <= 0) return null;
    const currentEndBalance = projectedBalanceWithExtra(state, months, 0);
    if (currentEndBalance <= targetBalance) return 0;

    let low = 0;
    let high = 100;
    while (high < 10000 && projectedBalanceWithExtra(state, months, high) > targetBalance) high *= 2;
    if (high >= 10000 && projectedBalanceWithExtra(state, months, high) > targetBalance) return null;

    for (let i = 0; i < 28; i += 1) {
      const mid = (low + high) / 2;
      if (projectedBalanceWithExtra(state, months, mid) <= targetBalance) high = mid;
      else low = mid;
    }
    return Math.ceil(high);
  }

  function ensurePlanner() {
    const detail = document.querySelector('.next-panel .expand-detail');
    if (!detail || $('dealEndPlanner')) return;

    const section = document.createElement('section');
    section.id = 'dealEndPlanner';
    section.className = 'deal-end-planner';
    section.innerHTML = `
      <div class="deal-planner-heading">
        <div><p class="eyebrow">Deal-end plan</p><h2>Where you may stand when this fix ends</h2></div>
        <span id="dealPlannerDate" class="source-date">—</span>
      </div>
      <div id="dealPlannerMissing" class="deal-planner-empty" hidden></div>
      <div id="dealPlannerContent">
        <div class="deal-planner-summary">
          <div><span>Projected balance</span><strong id="dealPlannerBalance">—</strong><small id="dealPlannerBalanceNote">—</small></div>
          <div><span>Projected LTV</span><strong id="dealPlannerLtv">—</strong><small>Uses today’s property value.</small></div>
          <div><span>Time to deal end</span><strong id="dealPlannerCountdown">—</strong><small id="dealPlannerCountdownNote">—</small></div>
        </div>

        <div id="dealPlannerMilestone" class="deal-planner-milestone">
          <div><span>Next LTV milestone</span><strong id="dealPlannerTarget">—</strong></div>
          <div class="deal-planner-milestone-copy"><strong id="dealPlannerGap">—</strong><small id="dealPlannerGapNote">—</small></div>
        </div>

        <div class="deal-planner-rates">
          <div class="deal-planner-subhead"><div><span>Future-rate stress test</span><strong>What the payment could look like</strong></div><small>Illustrative rates, not a forecast.</small></div>
          <div id="dealPlannerRateGrid" class="deal-planner-rate-grid"></div>
        </div>
        <p class="deal-planner-note">Projection assumes your current rate, scheduled payment and regular overpayment continue until the saved deal-end date. LTV uses today’s property value, so actual lender figures may differ. Rate examples exclude product fees and are not mortgage offers.</p>
      </div>`;

    detail.appendChild(section);
  }

  function render() {
    ensurePlanner();
    const section = $('dealEndPlanner');
    if (!section || !window.MortgageMath || !window.MortgageStore) return;

    const state = MortgageStore.get();
    const fixedMonths = monthsUntil(state.fixedEnd);
    const empty = $('dealPlannerMissing');
    const content = $('dealPlannerContent');
    $('dealPlannerDate').textContent = formatMonth(state.fixedEnd);

    if (fixedMonths === null) {
      empty.hidden = false;
      content.hidden = true;
      empty.innerHTML = '<strong>Add your fixed-rate end date</strong><span>Once it is set, Mortgage Manager can project your balance, LTV and possible future payments at that point.</span>';
      return;
    }

    if (fixedMonths < 0) {
      empty.hidden = false;
      content.hidden = true;
      empty.innerHTML = '<strong>Your saved deal end has passed</strong><span>Update the fixed-rate end date in Setup & data so the planner can use your current mortgage deal.</span>';
      return;
    }

    empty.hidden = true;
    content.hidden = false;

    const balance = Math.max(0, Number(state.balance) || 0);
    const rate = Math.max(0, Number(state.rate) || 0);
    const payment = Math.max(0, Number(state.payment) || 0);
    const regular = Math.max(0, Number(state.currentOverpayment) || 0);
    const homeValue = Math.max(0, Number(state.homeValue) || 0);
    const path = MortgageMath.amortize(balance, rate, payment + regular);
    const projectedBalance = balanceAt(path.monthlyPoints, fixedMonths);
    const projectedLtv = homeValue > 0 ? projectedBalance / homeValue * 100 : null;

    $('dealPlannerBalance').textContent = money(projectedBalance);
    $('dealPlannerBalanceNote').textContent = regular > 0
      ? `Includes your ${money(regular)}/month regular overpayment.`
      : 'Based on your scheduled payment.';
    $('dealPlannerLtv').textContent = projectedLtv === null ? '—' : pct(projectedLtv);
    $('dealPlannerCountdown').textContent = compactMonths(fixedMonths);
    $('dealPlannerCountdownNote').textContent = fixedMonths === 0 ? 'Deal end is this month.' : `Until ${formatMonth(state.fixedEnd)}.`;

    const target = projectedLtv === null ? null : LTV_MILESTONES.find((value) => projectedLtv > value + 0.01);
    const milestone = $('dealPlannerMilestone');
    if (target === null) {
      milestone.hidden = true;
    } else {
      milestone.hidden = false;
      const targetBalance = homeValue * target / 100;
      const gap = Math.max(0, projectedBalance - targetBalance);
      const extraMonthly = monthlyExtraForTarget(state, fixedMonths, targetBalance);
      $('dealPlannerTarget').textContent = `${target}% LTV`;
      $('dealPlannerGap').textContent = gap > 0 ? `${money(gap)} away` : 'Already on track';
      if (gap <= 0) {
        $('dealPlannerGapNote').textContent = `Your current path already reaches ${target}% LTV by deal end.`;
      } else if (extraMonthly !== null) {
        $('dealPlannerGapNote').textContent = `About ${money(extraMonthly)}/month extra until deal end would target this milestone, assuming today’s property value.`;
      } else {
        $('dealPlannerGapNote').textContent = `A balance around ${money(targetBalance)} would equal ${target}% LTV at today’s property value.`;
      }
    }

    const remainingTerm = Number.isFinite(path.months) ? Math.max(1, path.months - fixedMonths) : 300;
    const rateGrid = $('dealPlannerRateGrid');
    rateGrid.innerHTML = RATE_SCENARIOS.map((scenarioRate) => {
      const scenarioPayment = paymentFor(projectedBalance, scenarioRate, remainingTerm);
      const diff = scenarioPayment - payment;
      const change = Math.abs(diff) < 1 ? 'About your current scheduled payment' : `${money(Math.abs(diff))}/mo ${diff > 0 ? 'more' : 'less'} than scheduled today`;
      return `<div class="deal-planner-rate"><span>${scenarioRate.toFixed(1)}%</span><strong>${money(scenarioPayment)}<small>/mo</small></strong><em>${change}</em></div>`;
    }).join('');
  }

  if (window.MortgageStore?.subscribe) {
    MortgageStore.subscribe((next, previous) => {
      if (['balance','rate','payment','currentOverpayment','homeValue','fixedEnd'].some((key) => next[key] !== previous[key])) requestAnimationFrame(render);
    });
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('.next-panel [data-expand-card],#personalDataButton,[data-action="save"]')) requestAnimationFrame(render);
  });

  render();
  requestAnimationFrame(render);
})();
