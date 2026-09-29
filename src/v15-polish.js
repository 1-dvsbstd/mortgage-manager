(() => {
  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;

  function monthLabel(value) {
    if (!value) return '—';
    const [year, month] = String(value).split('-').map(Number);
    if (!year || !month) return '—';
    return new Intl.DateTimeFormat('en-GB', { month:'short', year:'numeric' }).format(new Date(year, month - 1, 1));
  }

  function dateLabel(value) {
    if (!value) return '—';
    const parsed = /^\d{4}-\d{2}$/.test(String(value)) ? `${value}-01` : value;
    const date = new Date(parsed);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-GB', { month:'short', year:'numeric' }).format(date);
  }

  function history() {
    try { return JSON.parse(localStorage.getItem('mortgage-manager-mortgage-history-v1') || '{}'); }
    catch (_) { return {}; }
  }

  function payoffLabel(state) {
    const balance = Math.max(0, Number(state.balance) || 0);
    const rate = Math.max(0, Number(state.rate) || 0);
    const payment = Math.max(0, Number(state.payment) || 0);
    const regular = Math.max(0, Number(state.currentOverpayment) || 0);
    const result = window.MortgageMath?.amortize?.(balance, rate, payment + regular);
    if (!Number.isFinite(result?.months)) return '—';
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() + Math.max(0, Math.round(result.months)));
    return new Intl.DateTimeFormat('en-GB', { month:'short', year:'numeric' }).format(date);
  }

  function journeyData() {
    const state = window.MortgageStore?.get?.();
    if (!state) return null;
    const h = history();
    const deals = Array.isArray(h.deals) ? h.deals : [];
    const currentDeal = deals.length ? deals[deals.length - 1] : null;
    const fixedEnd = state.fixedEnd || currentDeal?.end || '';
    let remortgage = '';
    if (fixedEnd) {
      const [year, month] = fixedEnd.split('-').map(Number);
      if (year && month) {
        const d = new Date(year, month - 1, 1);
        d.setMonth(d.getMonth() - 3);
        remortgage = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`;
      }
    }
    return {
      purchase: h.purchaseDate || '',
      dealStart: currentDeal?.start || '',
      fixedEnd,
      remortgage,
      payoff: payoffLabel(state),
    };
  }

  function goToUpcomingRates() {
    const button = document.querySelector('[data-app-view="upcoming"]');
    if (button) button.click();
    setTimeout(() => {
      const target = $('.app-view-upcoming .upcoming-rates');
      if (target) target.scrollIntoView({ behavior:'smooth', block:'start' });
    }, 260);
  }

  function ensureCurrentJourney() {
    const current = $('.app-view-current .app-view-content');
    const hero = $('.app-view-current .hero-panel');
    if (!current || !hero) return null;
    let card = $('#v15CurrentJourney', current);
    if (!card) {
      card = document.createElement('section');
      card.id = 'v15CurrentJourney';
      card.className = 'v15-current-journey';
      card.removeAttribute('tabindex');
      card.removeAttribute('role');
      card.setAttribute('aria-label','Mortgage journey');
      card.innerHTML = `
        <div class="v15-current-journey-head">
          <div><span>Mortgage journey</span><strong>Your current fix and what comes next</strong></div>
          <div class="v15-current-journey-next"><span>Next milestone</span><strong data-journey-next>—</strong></div>
        </div>
        <div class="v15-current-journey-track"></div>`;
      card.addEventListener('click', (event) => {
        if (event.target.closest('[data-journey-action="rates"]')) goToUpcomingRates();
      });
      card.addEventListener('keydown', (event) => {
        if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('[data-journey-action="rates"]')) {
          event.preventDefault();
          goToUpcomingRates();
        }
      });
    }
    if (card.parentElement !== current || card.nextElementSibling !== hero) current.insertBefore(card, hero);
    return card;
  }


  function journeyIcon(kind) {
    const common = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
    const icons = {
      home: `<svg ${common}><path d="M3.5 10.5 12 3.8l8.5 6.7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.3 20v-6.2h5.4V20"/></svg>`,
      today: `<svg ${common}><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5"/></svg>`,
      switch: `<svg ${common}><path d="M5 7.5h11.8"/><path d="m14.3 4.8 2.7 2.7-2.7 2.7"/><path d="M19 16.5H7.2"/><path d="m9.7 13.8-2.7 2.7 2.7 2.7"/></svg>`,
      calendar: `<svg ${common}><rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M8 3.8v3.4M16 3.8v3.4M4 9.5h16"/><path d="M9 13h3v3H9z"/></svg>`,
      finish: `<svg ${common}><path d="M5 20V5"/><path d="M5 6h10.5l-1.8 3 1.8 3H5"/><path d="m9.2 16.3 1.8 1.8 3.8-4"/><path d="M18.4 4.2v2.2M17.3 5.3h2.2"/></svg>`
    };
    return icons[kind] || '';
  }

  function renderCurrentJourney() {
    const card = ensureCurrentJourney();
    const data = journeyData();
    if (!card || !data) return;
    const today = new Intl.DateTimeFormat('en-GB', { month:'short', year:'numeric' }).format(new Date());
    const steps = [
      ['home','Home purchased',dateLabel(data.purchase),'','complete',''],
      ['today','Today',today,'','current',''],
      ['switch','Remortgage prep',data.remortgage ? monthLabel(data.remortgage) : '—','Start looking','','rates'],
      ['calendar','Fixed rate ends',monthLabel(data.fixedEnd),'Deal ends','','rates'],
      ['finish','Mortgage free',data.payoff,'At current pace','destination',''],
    ];
    $('.v15-current-journey-track', card).innerHTML = steps.map(([icon,title,date,note,status,action]) => `
      <div class="v15-current-journey-step ${status ? `is-${status}` : ''} ${action ? 'is-actionable' : ''}" ${action ? `data-journey-action="${action}" role="button" tabindex="0" aria-label="${title}: open upcoming rates"` : ''}>
        <div class="v15-current-journey-icon">${journeyIcon(icon)}</div>
        <div class="v15-current-journey-copy"><strong>${title}</strong><span class="v15-current-journey-date">${date}</span>${note ? `<small>${note}</small>` : ''}</div>
      </div>`).join('');
    const next = $('[data-journey-next]', card);
    if (next) next.textContent = data.remortgage ? `Start looking · ${monthLabel(data.remortgage)}` : 'Add your fixed-rate end date';
  }

  function run() { renderCurrentJourney(); }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-app-view="current"]')) setTimeout(run, 80);
  });
  if (window.MortgageStore?.subscribe) MortgageStore.subscribe(() => requestAnimationFrame(run));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => [250,700,1200].forEach((delay) => setTimeout(run, delay)), { once:true });
  else [0,350,850].forEach((delay) => setTimeout(run, delay));
})();