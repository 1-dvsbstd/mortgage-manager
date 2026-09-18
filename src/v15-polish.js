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
      card.tabIndex = 0;
      card.setAttribute('role','button');
      card.setAttribute('aria-label','View upcoming mortgage rate scenarios');
      card.innerHTML = `
        <div class="v15-current-journey-head">
          <div><span>Mortgage journey</span><strong>Your current fix and what comes next</strong></div>
          <span class="v15-current-journey-link">Rates →</span>
        </div>
        <div class="v15-current-journey-track"></div>`;
      card.addEventListener('click', goToUpcomingRates);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          goToUpcomingRates();
        }
      });
    }
    if (card.parentElement !== hero) hero.insertAdjacentElement('afterbegin', card);
    return card;
  }

  function renderCurrentJourney() {
    const card = ensureCurrentJourney();
    const data = journeyData();
    if (!card || !data) return;
    const steps = [
      ['⌂','Home purchased',dateLabel(data.purchase),'complete'],
      ['%','Current deal',dateLabel(data.dealStart),'complete'],
      ['▣','Fixed rate ends',monthLabel(data.fixedEnd),'current'],
      ['↔','Remortgage',data.remortgage ? monthLabel(data.remortgage) : '—',''],
      ['⚑','Mortgage free',data.payoff,''],
    ];
    $('.v15-current-journey-track', card).innerHTML = steps.map(([icon,title,date,status]) => `
      <div class="v15-current-journey-step ${status ? `is-${status}` : ''}">
        <div class="v15-current-journey-icon">${icon}</div>
        <div><strong>${title}</strong><span>${date}</span></div>
      </div>`).join('');
  }

  function run() { renderCurrentJourney(); }

  if (window.MortgageStore?.subscribe) MortgageStore.subscribe(() => requestAnimationFrame(run));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once:true });
  else run();
})();