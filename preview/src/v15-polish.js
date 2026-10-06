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
          <div><span>Mortgage journey</span><strong>Your mortgage so far — and what comes next</strong></div>
          <div class="v15-current-journey-next"><span>Next</span><strong data-journey-next>—</strong></div>
        </div>
        <div class="v15-current-journey-track"></div>`;
    }
    if (!card.dataset.bound) {
      card.dataset.bound='true';
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
    if (card.parentElement !== current || hero.nextElementSibling !== card) hero.insertAdjacentElement('afterend', card);
    return card;
  }


  function journeyIcon(kind) {
    const map = {
      home:'icon-start',
      today:'icon-today',
      switch:'icon-remortgage',
      calendar:'icon-fixed-end',
      finish:'icon-finish'
    };
    const id = map[kind] || map.today;
    return `<svg class="v15-art-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href="public/mortgage-icons.svg#${id}"></use></svg>`;
  }

  function renderCurrentJourney() {
    const card = ensureCurrentJourney();
    const data = journeyData();
    if (!card || !data) return;
    const today = new Intl.DateTimeFormat('en-GB', { month:'short', year:'numeric' }).format(new Date());
    const steps = [
      ['home','Mortgage start',dateLabel(data.purchase),'','complete',''],
      ['today','Today',today,'','current',''],
      ['switch','Remortgage prep',data.remortgage ? monthLabel(data.remortgage) : '—','','','rates'],
      ['calendar','Fixed rate ends',monthLabel(data.fixedEnd),'','','rates'],
      ['finish','Mortgage free',data.payoff,'At current pace','destination',''],
    ];
    $('.v15-current-journey-track', card).innerHTML = steps.map(([icon,title,date,note,status,action]) => `
      <div class="v15-current-journey-step ${status ? `is-${status}` : ''} ${action ? 'is-actionable' : ''}" ${action ? `data-journey-action="${action}" role="button" tabindex="0" aria-label="${title}: open upcoming rates"` : ''}>
        <div class="v15-current-journey-icon">${journeyIcon(icon)}</div>
        <div class="v15-current-journey-copy"><strong>${title}</strong><span class="v15-current-journey-date">${date}</span>${note ? `<small>${note}</small>` : ''}</div>
      </div>`).join('');
    const next = $('[data-journey-next]', card);
    if (next) next.textContent = data.remortgage ? `Remortgage prep ${monthLabel(data.remortgage)}` : 'Add your fixed-rate end date';
  }

  function run() { renderCurrentJourney(); }

  if (window.MortgageStore?.subscribe) MortgageStore.subscribe(() => requestAnimationFrame(run));
  document.addEventListener('mortgage-history-updated', () => requestAnimationFrame(run));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once:true });
  else run();
})();