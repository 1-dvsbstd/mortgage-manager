(() => {
  const STORE_KEY = 'mortgage-manager-state-v1';
  const LEGACY_APP_KEYS = ['mortgage-manager-v0.4', 'mortgage-manager-v0.3', 'mortgage-manager-v0.2'];
  const LEGACY_OVERPAY_KEY = 'mortgage-manager-current-overpayment-v1';

  const defaults = Object.freeze({
    balance: 180000,
    rate: 4.25,
    payment: 1100,
    currentOverpayment: 0,
    fixedEnd: '',
    homeValue: 300000,
    ownership: 100,
    scenarioExtra: 50,
  });

  const numericFields = new Set(['balance', 'rate', 'payment', 'currentOverpayment', 'homeValue', 'ownership', 'scenarioExtra']);
  let state = null;
  const subscribers = new Set();

  function normalise(input = {}) {
    const next = { ...defaults, ...input };
    numericFields.forEach((key) => {
      const value = Number(next[key]);
      next[key] = Number.isFinite(value) ? Math.max(0, value) : defaults[key];
    });
    next.ownership = Math.min(100, next.ownership);
    next.fixedEnd = typeof next.fixedEnd === 'string' ? next.fixedEnd : '';
    return next;
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function migrateLegacy() {
    let legacy = null;
    for (const key of LEGACY_APP_KEYS) {
      legacy = readJson(key);
      if (legacy) break;
    }
    const overpayRaw = localStorage.getItem(LEGACY_OVERPAY_KEY);
    return normalise({
      balance: legacy?.balance,
      rate: legacy?.rate,
      payment: legacy?.payment,
      homeValue: legacy?.homeValue,
      ownership: legacy?.ownership,
      fixedEnd: legacy?.fixedEnd,
      scenarioExtra: legacy?.extra,
      currentOverpayment: overpayRaw !== null ? overpayRaw : undefined,
    });
  }

  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function initialise() {
    if (state) return state;
    const saved = readJson(STORE_KEY);
    state = saved ? normalise(saved) : migrateLegacy();
    persist();
    return state;
  }

  function get() {
    return { ...initialise() };
  }

  function set(patch = {}, options = {}) {
    const previous = initialise();
    const next = normalise({ ...previous, ...patch });
    const changed = Object.keys(next).some((key) => next[key] !== previous[key]);
    state = next;
    if (options.persist !== false) persist();
    if (changed && options.notify !== false) {
      const snapshot = get();
      subscribers.forEach((listener) => {
        try { listener(snapshot, { ...previous }); } catch (error) { console.warn('MortgageStore subscriber failed.', error); }
      });
      document.dispatchEvent(new CustomEvent('mortgage-state-updated', { detail: snapshot }));
    }
    return get();
  }

  function fromDom() {
    const value = (id) => document.getElementById(id)?.value;
    return set({
      balance: value('balance'),
      rate: value('rate'),
      payment: value('payment'),
      currentOverpayment: value('currentOverpayment'),
      fixedEnd: value('fixedEnd') || '',
      homeValue: value('homeValue'),
      ownership: value('ownership'),
      scenarioExtra: value('customExtra'),
    });
  }

  function applyToDom(fields = null, options = {}) {
    const current = initialise();
    const ids = fields || ['balance','rate','payment','currentOverpayment','fixedEnd','homeValue','ownership','scenarioExtra'];
    const map = { scenarioExtra: 'customExtra' };
    ids.forEach((field) => {
      const element = document.getElementById(map[field] || field);
      if (!element || current[field] === undefined) return;
      element.value = current[field];
      if (options.dispatch) {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    const slider = document.getElementById('extraSlider');
    if (slider && (!fields || fields.includes('scenarioExtra'))) slider.value = Math.min(1000, current.scenarioExtra);
    return get();
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    subscribers.add(listener);
    return () => subscribers.delete(listener);
  }

  window.MortgageStore = {
    key: STORE_KEY,
    defaults: { ...defaults },
    get,
    set,
    fromDom,
    applyToDom,
    subscribe,
  };

  initialise();
})();
