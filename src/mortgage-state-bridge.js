(() => {
  if (!window.MortgageStore) return;

  const tracked = new Set(['balance','rate','payment','currentOverpayment','fixedEnd','homeValue','ownership','customExtra','extraSlider']);
  let applyingStore = false;
  let saveTimer = null;

  function patchFromElement(element) {
    if (!element?.id || !tracked.has(element.id)) return;
    const key = ['customExtra','extraSlider'].includes(element.id) ? 'scenarioExtra' : element.id;
    const value = key === 'fixedEnd' ? element.value : Number(element.value);
    window.MortgageStore.set({ [key]: value });
  }

  function scheduleCapture(element) {
    if (applyingStore) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => patchFromElement(element), 80);
  }

  document.addEventListener('input', (event) => {
    if (tracked.has(event.target?.id)) scheduleCapture(event.target);
  });

  document.addEventListener('change', (event) => {
    if (tracked.has(event.target?.id)) patchFromElement(event.target);
  });

  document.addEventListener('click', (event) => {
    const preset = event.target.closest?.('button[data-extra]');
    if (!preset) return;
    requestAnimationFrame(() => {
      const custom = document.getElementById('customExtra');
      if (custom) patchFromElement(custom);
    });
  });

  window.MortgageStore.subscribe((next, previous) => {
    const map = {
      balance: 'balance',
      rate: 'rate',
      payment: 'payment',
      currentOverpayment: 'currentOverpayment',
      fixedEnd: 'fixedEnd',
      homeValue: 'homeValue',
      ownership: 'ownership',
      scenarioExtra: 'customExtra',
    };
    applyingStore = true;
    try {
      Object.entries(map).forEach(([key, id]) => {
        if (next[key] === previous[key]) return;
        const element = document.getElementById(id);
        if (!element || String(element.value) === String(next[key])) return;
        element.value = next[key];
        element.dispatchEvent(new Event('input', { bubbles:true }));
        element.dispatchEvent(new Event('change', { bubbles:true }));
      });
      if (next.scenarioExtra !== previous.scenarioExtra) {
        const slider = document.getElementById('extraSlider');
        if (slider) slider.value = Math.min(1000, next.scenarioExtra);
      }
    } finally {
      applyingStore = false;
    }
  });

  // All dynamic source inputs now exist. Capture the live state once so any
  // current-deal/history migration performed during startup becomes canonical.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const live = {};
      ['balance','rate','payment','currentOverpayment','fixedEnd','homeValue','ownership'].forEach((id) => {
        const element = document.getElementById(id);
        if (!element) return;
        live[id] = id === 'fixedEnd' ? element.value : Number(element.value);
      });
      const custom = document.getElementById('customExtra');
      if (custom) live.scenarioExtra = Number(custom.value);
      window.MortgageStore.set(live);
    });
  });
})();