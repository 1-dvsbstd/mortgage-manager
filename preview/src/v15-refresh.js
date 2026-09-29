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
    const scheduledOnly = window.MortgageMath?.amortize?.(balance, rate, payment);
    const combinedPath = window.MortgageMath?.amortize?.(balance, rate, payment + regular + extra);
    const combinedInterestSaved =
      Number.isFinite(scheduledOnly?.interest) && Number.isFinite(combinedPath?.interest)
        ? Math.max(0, scheduledOnly.interest - combinedPath.interest)
        : 0;
    const scenario = window.MortgageMath?.compare?.(balance, rate, payment, extra, regular);
    const plus100 = window.MortgageMath?.compare?.(balance, rate, payment, 100, regular);
    return { balance, rate, payment, regular, extra, homeValue, ownership, shareValue, equity, ownedSharePct, ltv, base, scheduledOnly, combinedPath, combinedInterestSaved, scenario, plus100 };
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
        <h1><span class="v15-equity-value">—</span></h1>
        <p class="v15-subline">—</p>
        <div class="v15-hero-progress">
          <div class="v15-hero-progress-head"><span>Mortgage progress</span><strong class="v15-progress-value">—</strong></div>
          <div class="v15-hero-progress-track"><i></i></div>
          <div class="v15-hero-progress-foot"><span class="v15-progress-owned">— equity</span><span class="v15-progress-debt">— mortgage remaining</span></div>
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
      const statIcon = (kind) => {
        const map = {
          balance:'icon-balance',
          payment:'icon-payment',
          rate:'icon-rate',
          overpay:'icon-overpay'
        };
        const id = map[kind] || map.balance;
        return `<svg class="v15-art-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href="public/mortgage-icons.svg#${id}"></use></svg>`;
      };
      const stat = (kind, label, valueKey, support, supportKey = '') => `
        <div class="v15-stat" data-stat="${kind}">
          <i class="v15-stat-icon">${statIcon(kind)}</i>
          <div class="v15-stat-copy">
            <span>${label}</span>
            <strong data-v15="${valueKey}">—</strong>
            <small ${supportKey ? `data-v15="${supportKey}"` : ''}>${support}</small>
          </div>
        </div>`;
      grid.innerHTML = `
        ${stat('balance','Mortgage remaining','balance','— LTV','ltv')}
        ${stat('payment','Monthly payment','payment','Scheduled monthly payment')}
        ${stat('rate','Interest rate','rate','Current mortgage deal','fix')}
        ${stat('overpay','Regular overpayment','regular','— extra per year','annual-overpay')}`;
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
        <div class="v15-action-copy"><div class="v15-action-icon">↗</div><div><span>See the impact of a little more</span><strong data-v15="plus100">+£100/month</strong><small data-v15="plus100-interest"></small></div></div>
        <button type="button" data-v15-action>Try +£100 What-if →</button>`;
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
    $('.v15-equity-value', hero).textContent = `You’ve built ${money(c.equity)} in equity`;
    const subline = $('.v15-subline', hero);
    if (subline) {
      const p=c.ownedSharePct;
      subline.textContent = p >= 95 ? 'Almost mortgage-free.'
        : p >= 75 ? 'Well over three quarters of the way there.'
        : p >= 55 ? 'More than halfway to being mortgage-free.'
        : p >= 40 ? 'Nearly halfway to being mortgage-free.'
        : p >= 20 ? 'A solid start towards being mortgage-free.'
        : 'Every payment is building your position.';
    }
    $('.v15-progress-value', hero).textContent = `${pct(c.ownedSharePct)} paid off`;
    $('.v15-progress-owned', hero).textContent = `${money(c.equity)} equity`;
    $('.v15-progress-debt', hero).textContent = `${money(c.balance)} mortgage remaining`;
    const fill = $('.v15-hero-progress-track i', hero); if (fill) fill.style.width = `${c.ownedSharePct}%`;

    $('[data-v15="balance"]', grid).textContent = money(c.balance);
    $('[data-v15="payment"]', grid).textContent = money(c.payment);
    $('[data-v15="regular"]', grid).textContent = money(c.regular);
    $('[data-v15="rate"]', grid).textContent = pct(c.rate,2);
    $('[data-v15="fix"]', grid).textContent = state.fixedEnd ? `Fixed until ${monthLabel(state.fixedEnd)}` : 'Current mortgage deal';
    $('[data-v15="ltv"]', grid).textContent = `${pct(c.ltv,1)} LTV`;
    $('[data-v15="annual-overpay"]', grid).textContent = c.regular > 0 ? `${money(c.regular * 12)} extra per year` : 'No regular overpayment';

    const saved = c.plus100?.monthsSaved || 0;
    const savedInterest = c.plus100?.interestSaved || 0;
    $('[data-v15="plus100"]', action).textContent = saved > 0 ? `+£100/month = ${compactDuration(saved)} sooner` : '+£100/month changes your payoff path';
    const plus100Interest = $('[data-v15="plus100-interest"]', action);
    if (plus100Interest) plus100Interest.textContent = savedInterest > 0 ? `${money(savedInterest)} less interest on the current assumptions` : 'Compare it with your current repayment path';
  }

  function journeyDates(state) {
    const h = history();
    const deals = Array.isArray(h.deals) ? h.deals : [];
    const currentDeal = deals.length ? deals[deals.length - 1] : null;
    const purchase = h.purchaseDate || '';
    const dealStart = currentDeal?.start || '';
    const fixedEnd = state.fixedEnd || currentDeal?.end || '';
    let remortgage = '';
    if (fixedEnd) {
      const [y,m] = fixedEnd.split('-').map(Number);
      if (y && m) {
        const d = new Date(y,m - 1,1); d.setMonth(d.getMonth() - 3);
        remortgage = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      }
    }
    const c = calculations(state);
    const payoffDate = Number.isFinite(c.base?.months) ? monthDate(c.base.months) : null;
    return { purchase, dealStart, fixedEnd, remortgage, payoffDate };
  }

  function ensureJourney() {
    const body = $('.app-view-upcoming .upcoming-timeline .upcoming-section-body');
    if (!body) return null;
    let strip = $('.v15-journey-shell', body);
    if (!strip) {
      strip = document.createElement('div');
      strip.className = 'v15-journey-shell';
      strip.innerHTML = '<div class="v15-journey-strip"></div><div class="v15-journey-callout"></div>';
      body.insertAdjacentElement('afterbegin', strip);
    }
    return strip;
  }


  function journeyIcon(kind) {
    const common = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
    const icons = {
      home: `<svg ${common}><path d="M3.5 10.5 12 3.8l8.5 6.7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.3 20v-6.2h5.4V20"/></svg>`,
      today: `<svg ${common}><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5"/></svg>`,
      switch: `<svg ${common}><path d="M5 7.5h11.8"/><path d="m14.3 4.8 2.7 2.7-2.7 2.7"/><path d="M19 16.5H7.2"/><path d="m9.7 13.8-2.7 2.7 2.7 2.7"/></svg>`,
      calendar: `<svg ${common}><rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M8 3.8v3.4M16 3.8v3.4M4 9.5h16"/><path d="M9 13h3v3H9z"/></svg>`,
      finish: `<svg ${common}><path d="M5 20V5"/><path d="M5 6h10.5l-1.8 3 1.8 3H5"/><path d="m9.2 16.3 1.8 1.8 3.8-4"/></svg>`
    };
    return icons[kind] || '';
  }

  function renderJourney() {
    const state = window.MortgageStore?.get?.();
    if (!state) return;
    const shell = ensureJourney();
    if (!shell) return;
    const dates = journeyDates(state);
    const now = new Date();
    const payoff = dates.payoffDate ? new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'}).format(dates.payoffDate) : '—';
    const today = new Intl.DateTimeFormat('en-GB', { month:'short', year:'numeric' }).format(new Date());
    const steps = [
      ['home','Home purchased',dateLabel(dates.purchase),dates.purchase ? 'complete' : ''],
      ['today','Today',today,'current'],
      ['switch','Remortgage prep',dates.remortgage ? `from ${monthLabel(dates.remortgage)}` : '—',''],
      ['calendar','Fixed rate ends',monthLabel(dates.fixedEnd),''],
      ['finish','Mortgage free',payoff,''],
    ];
    $('.v15-journey-strip', shell).innerHTML = steps.map(([icon,title,date,status]) => `
      <div class="v15-journey-step ${status ? `is-${status}` : ''}"><div class="v15-journey-icon">${journeyIcon(icon)}</div><strong>${title}</strong><span>${date}</span></div>`).join('');
    const left = monthsUntil(dates.fixedEnd);
    const callout = $('.v15-journey-callout', shell);
    if (callout) callout.textContent = left === null ? 'Add your fixed-rate end date to complete the journey' : left <= 0 ? 'Your fixed-rate end needs attention' : `${compactDuration(left)} to fixed-rate end`;
  }

  function render() {
    renderCurrent();
    renderJourney();
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
