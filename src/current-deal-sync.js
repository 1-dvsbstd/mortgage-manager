(() => {
  if (!window.MortgageStore) return;

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

  function syncHistoryToStore() {
    if (syncing || !window.MortgageHistory) return;
    const data = window.MortgageHistory.load();
    const deal = findCurrentDeal(data);
    if (!deal) return;

    const patch = {};
    if (deal.rate !== undefined && deal.rate !== '') patch.rate = Number(deal.rate);
    if (deal.payment !== undefined && deal.payment !== '') patch.payment = Number(deal.payment);
    patch.currentOverpayment = Math.max(0, Number(deal.overpayment) || 0);
    if (deal.end) patch.fixedEnd = deal.end;

    syncing = true;
    try { window.MortgageStore.set(patch); }
    finally { syncing = false; }
  }

  function syncStoreToHistory() {
    if (syncing || !window.MortgageHistory) return;
    const state = window.MortgageStore.get();
    const data = window.MortgageHistory.load();
    const deal = findCurrentDeal(data);
    if (!deal) return;

    const nextRate = String(state.rate);
    const nextPayment = String(state.payment);
    const nextOverpayment = String(state.currentOverpayment);
    const nextEnd = state.fixedEnd || '';

    if (
      String(deal.rate || '') === nextRate &&
      String(deal.payment || '') === nextPayment &&
      String(deal.overpayment || '0') === nextOverpayment &&
      String(deal.end || '') === nextEnd
    ) return;

    deal.rate = nextRate;
    deal.payment = nextPayment;
    deal.overpayment = nextOverpayment;
    deal.end = nextEnd;

    syncing = true;
    try { window.MortgageHistory.save(data); }
    finally { syncing = false; }
  }

  function scheduleStoreToHistory() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(syncStoreToHistory, 120);
  }

  document.addEventListener('mortgage-history-updated', () => {
    if (!syncing) requestAnimationFrame(syncHistoryToStore);
  });

  window.MortgageStore.subscribe((next, previous) => {
    if (syncing) return;
    const changed = ['rate','payment','currentOverpayment','fixedEnd']
      .some((key) => next[key] !== previous[key]);
    if (changed) scheduleStoreToHistory();
  });

  // Mortgage history mounts after the base app. Reconcile the active deal once
  // startup has finished, then again after the history UI has had time to mount.
  requestAnimationFrame(() => requestAnimationFrame(syncHistoryToStore));
  setTimeout(syncHistoryToStore, 350);
})();
