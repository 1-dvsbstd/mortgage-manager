(() => {
  const OVERPAY_KEY = 'mortgage-manager-current-overpayment-v1';
  const $ = (id) => document.getElementById(id);
  let syncing = false;
  let saveTimer = null;

  function monthIndex(value) {
    if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
    const [year, month] = value.split('-').map(Number);
    return year * 12 + (month - 1);
  }

  function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function findCurrentDeal(data) {
    const now = monthIndex(currentMonthKey());
    if (now === null || !Array.isArray(data?.deals)) return null;
    return data.deals.find((deal) => {
      const start = monthIndex(deal.start);
      const end = monthIndex(deal.end);
      if (start === null || now < start) return false;
      return end === null ? true : now < end;
    }) || null;
  }

  function setLiveValue(id, value) {
    const input = $(id);
    if (!input || value === undefined || value === null || value === '') return false;
    const next = String(value);
    if (String(input.value) === next) return false;
    input.value = next;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function persistOverpayment(value) {
    try { localStorage.setItem(OVERPAY_KEY, String(Math.max(0, Number(value) || 0))); } catch (_) {}
  }

  function syncHistoryToLive() {
    if (syncing || !window.MortgageHistory) return;
    const data = window.MortgageHistory.load();
    const deal = findCurrentDeal(data);
    syncing = true;
    try {
      if (deal) {
        setLiveValue('rate', deal.rate);
        setLiveValue('payment', deal.payment);
        setLiveValue('currentOverpayment', deal.overpayment || 0);
        if (deal.end) setLiveValue('fixedEnd', deal.end);
        persistOverpayment(deal.overpayment || 0);
      } else {
        const saved = localStorage.getItem(OVERPAY_KEY);
        if (saved !== null) setLiveValue('currentOverpayment', saved);
      }

      // app.js listens to payment changes to run the main dashboard update.
      // Trigger one refresh even when only regular overpayment changed.
      const payment = $('payment');
      if (payment) payment.dispatchEvent(new Event('input', { bubbles: true }));
    } finally {
      syncing = false;
    }
  }

  function syncLiveToHistory() {
    if (syncing || !window.MortgageHistory) return;
    const overpay = Math.max(0, Number($('currentOverpayment')?.value) || 0);
    persistOverpayment(overpay);

    const data = window.MortgageHistory.load();
    const deal = findCurrentDeal(data);
    if (!deal) return;

    deal.rate = $('rate')?.value || deal.rate || '';
    deal.payment = $('payment')?.value || deal.payment || '';
    deal.overpayment = String(overpay);
    deal.end = $('fixedEnd')?.value || deal.end || '';

    syncing = true;
    try { window.MortgageHistory.save(data); }
    finally { syncing = false; }
  }

  function scheduleLiveToHistory() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(syncLiveToHistory, 120);
  }

  document.addEventListener('mortgage-history-updated', () => {
    if (!syncing) requestAnimationFrame(syncHistoryToLive);
  });

  document.addEventListener('change', (event) => {
    if (event.target?.matches?.('#rate,#payment,#currentOverpayment,#fixedEnd')) scheduleLiveToHistory();
  });

  document.addEventListener('input', (event) => {
    if (event.target?.id === 'currentOverpayment') {
      persistOverpayment(event.target.value);
      // currentOverpayment was historically missing from app.js' refresh list.
      // Re-fire payment input so every dashboard projection recalculates now.
      if (!syncing && $('payment')) $('payment').dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  // Mortgage history loads after the base app. Apply the linked current deal once
  // all dynamic source fields have been created and loaded.
  requestAnimationFrame(() => requestAnimationFrame(syncHistoryToLive));
  setTimeout(syncHistoryToLive, 350);
})();
