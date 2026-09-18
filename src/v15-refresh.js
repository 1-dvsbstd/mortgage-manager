(() => {
  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const money = (value) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(Math.max(0, Number(value) || 0));
  const pct = (value, digits = 0) => `${Math.max(0, Number(value) || 0).toFixed(digits)}%`;

  function compactDuration(months) {
    const n = Math.max(0, Math.round(Number(months) || 0));
    const y = Math.floor(n / 12), m = n % 12;
    if (y && m) return `${y} year${y === 1 ? '' : 's'} ${m} month${m === 1 ? '' : 's'}`;
    if (y) return `${y} year${y === 1 ? '' : 's'}`;
    return `${m} month${m === 1 ? '' : 's'}`;
  }

  function monthDate(months) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + Math.max(0, Math.round(months || 0)));
    return d;
  }

  function monthLabel(value) {
    if (!value) return '—';
    const [year, month] = String(value).split('-').map(Number);
    if (!year || !month) return '—';
    return new Intl.DateTimeFormat('en-GB', { month:'short', year:'numeric' }).format(new Date(year, month - 1, 1));
  }

  function dateLabel(value) {
    if (!value) return '—';
    const parsed = /^\d{4}-\d{2}$/.test(String(value)) ? `${value}-01` : value;
    const d = new Date(parsed);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-GB', { month:'short', year:'numeric' }).format(d);
  }

  function monthsUntil(value) {
    if (!value) return null;
    const [year, month] = String(value).split('-').map(Number);
    if (!year || !month) return null;
    const now = new Date();
    return (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());
  }

  function history() {
    try { return JSON.parse(localStorage.getItem('mortgage-manager-mortgage-history-v1') || '{}'); }
    catch (_) { return {}; }
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning,';
    if (hour < 18) return 'Good afternoon,';
    return 'Good evening,';
  }

  function calculations(state) {
    const balance = Math.max(0, Number(state.balance) || 0);
    const rate = Math.max(0, Number(state.rate) || 0);
    const payment = Math.max(0, Number(state.payment) || 0);
    const regular = Math.max(0, Number(state.currentOverpayment) || 0);
    const extra = Math.max(0, Number(state.scenarioExtra) || 0);
    const homeValue = Math.max(0, Number(state.homeValue) || 0);
    const ownership = Math.min(100, Math.max(0, Number(state.ownership) || 0));
    const shareValue = homeValue * ownership / 100;
    const equity = Math.max(0, shareValue - balance);
    const ownedSharePct = shareValue > 0 ? Math.min(100, equity / shareValue * 100) : 0;
    const ltv = homeValue > 0 ? balance / homeValue * 100 : 0;
    const base = window.MortgageMath?.amortize?.(balance, rate, payment + regular);
    const scenario = window.MortgageMath?.compare?.(balance, rate, payment, extra, regular);
    const plus100 = window.MortgageMath?.compare?.(balance, rate, payment, 100, regular);
    return { balance, rate, payment, regular, extra, homeValue, ownership, shareValue, equity, ownedSharePct, ltv, base, scenario, plus100 };
  }

  function ensureHero() {
    const hero = $('.app-view-current .hero-panel');
    if (!hero) return null;
    hero.classList.add('current-hero-condensed');
    let copy = $('.v15-home-copy', hero);
    if (!copy) {
      copy = document.createElement('div');
      copy.className = 'v15-home-copy';
      copy.innerHTML = `
        <p class="v15-greeting"></p>
        <h1><span class="v15-equity-value">—</span><br>of your home</h1>
        <p class="v15-subline">That’s <strong class="v15-owned-pct">—</strong> of your share</p>
        <div class="v15-hero-progress">
          <div class="v15-hero-progress-head"><span>Mortgage-free share</span><strong class="v15-progress-value">—</strong></div>
          <div class="v15-hero-progress-track"><i></i></div>
          <div class="v15-hero-progress-foot"><span class="v15-progress-owned">— owned</span><span class="v15-progress-debt">— mortgage remaining</span></div>
        </div>`;
      const main = $('.hero-main', hero);
      if (main) main.insertAdjacentElement('afterbegin', copy);
    }
    if (!$('.v15-home-visual', hero)) {
      const visual = document.createElement('div');
      visual.className = 'v15-home-visual';
      visual.setAttribute('role','img');
      visual.setAttribute('aria-label','Editorial illustration of a home and countryside');
      const main = $('.hero-main', hero);
      if (main) main.insertAdjacentElement('afterend', visual);
      else hero.appendChild(visual);
    }
    return hero;
  }

  function ensureStats(hero) {
    const current = $('.app-view-current .app-view-content');
    if (!current || !hero) return null;
    let grid = $('.v15-current-stats', current);
    if (!grid) {
      grid = document.createElement('section');
      grid.className = 'v15-current-stats';
      grid.setAttribute('aria-label','Mortgage and home summary');
      grid.innerHTML = `
        <div class="v15-stat"><span>Monthly payment</span><strong data-v15="payment">—</strong><small>Scheduled payment</small></div>
        <div class="v15-stat"><span>Regular overpayment</span><strong data-v15="regular">—</strong><small>Already paid each month</small></div>
        <div class="v15-stat"><span>Interest rate</span><strong data-v15="rate">—</strong><small data-v15="fix">Current mortgage deal</small></div>
        <div class="v15-stat is-warm"><span>Interest remaining</span><strong data-v15="interest">—</strong><small>On your current repayment path</small></div>
        <div class="v15-stat is-positive"><span>Interest saved</span><strong data-v15="saved">—</strong><small data-v15="saved-note">With selected What-if</small></div>
        <div class="v15-stat"><span>Home value</span><strong data-v15="home">—</strong><small>Current saved value</small></div>
        <div class="v15-stat"><span>Ownership share</span><strong data-v15="ownership">—</strong><small>Your household share</small></div>
        <div class="v15-stat is-positive"><span>Your equity</span><strong data-v15="equity">—</strong><small data-v15="ltv">— LTV</small></div>`;
      hero.insertAdjacentElement('afterend', grid);
    }
    return grid;
  }

  function ensureAction(grid) {
    const current = $('.app-view-current .app-view-content');
    if (!current || !grid) return null;
    let card = $('.v15-action-card', current);
    if (!card) {
      card = document.createElement('section');
      card.className = 'v15-action-card';
      card.innerHTML = `
        <div class="v15-action-copy"><div class="v15-action-icon">↗</div><div><span>Increase your overpayment</span><strong data-v15="plus100">+£100/month</strong></div></div>
        <button type="button" data-v15-action>Use +£100 What-if →</button>`;
      grid.insertAdjacentElement('afterend', card);
      $('[data-v15-action]', card)?.addEventListener('click', () => window.MortgageStore?.set?.({ scenarioExtra:100 }));
    }
    return card;
  }

  function renderCurrent() {
    const state = window.MortgageStore?.get?.();
    if (!state) return;
    const c = calculations(state);
    const hero = ensureHero();
    const grid = ensureStats(hero);
    const action = ensureAction(grid);
    if (!hero || !grid || !action) return;

    $('.v15-greeting', hero).textContent = greeting();
    $('.v15-equity-value', hero).textContent = `You own ${money(c.equity)}`;
    $('.v15-owned-pct', hero).textContent = pct(c.ownedSharePct);
    $('.v15-progress-value', hero).textContent = pct(c.ownedSharePct);
    $('.v15-progress-owned', hero).textContent = `${pct(c.ownedSharePct)} owned`;
    $('.v15-progress-debt', hero).textContent = `${pct(100 - c.ownedSharePct)} mortgage remaining`;
    const fill = $('.v15-hero-progress-track i', hero); if (fill) fill.style.width = `${c.ownedSharePct}%`;

    $('[data-v15="payment"]', grid).textContent = money(c.payment);
    $('[data-v15="regular"]', grid).textContent = money(c.regular);
    $('[data-v15="rate"]', grid).textContent = pct(c.rate,2);
    $('[data-v15="fix"]', grid).textContent = state.fixedEnd ? `Fixed until ${monthLabel(state.fixedEnd)}` : 'Current mortgage deal';
    $('[data-v15="interest"]', grid).textContent = Number.isFinite(c.base?.interest) ? money(c.base.interest) : '—';
    $('[data-v15="saved"]', grid).textContent = money(c.scenario?.interestSaved || 0);
    $('[data-v15="saved-note"]', grid).textContent = c.extra > 0 ? `With ${money(c.extra)}/month What-if` : 'Choose a What-if below';
    $('[data-v15="home"]', grid).textContent = money(c.homeValue);
    $('[data-v15="ownership"]', grid).textContent = pct(c.ownership);
    $('[data-v15="equity"]', grid).textContent = money(c.equity);
    $('[data-v15="ltv"]', grid).textContent = `${pct(c.ltv,1)} LTV`;

    const saved = c.plus100?.monthsSaved || 0;
    $('[data-v15="plus100"]', action).textContent = saved > 0 ? `+£100/month = ${compactDuration(saved)} sooner` : '+£100/month changes your payoff path';
  }

  function render() {
    renderCurrent();
  }

  function start() {
    render();
    requestAnimationFrame(render);
    setTimeout(render,180);
    setTimeout(render,650);
    setTimeout(render,1300);
    if (window.MortgageStore?.subscribe) MortgageStore.subscribe(() => requestAnimationFrame(render));
    window.addEventListener('pageshow', render);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
