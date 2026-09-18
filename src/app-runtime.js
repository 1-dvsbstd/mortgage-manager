(() => {
  const $ = (id) => document.getElementById(id);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const DONUT_RADIUS = 72;
  const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
  const HISTORY_KEY = 'mortgage-manager-history-v1';
  const HOME_KEY = 'mortgage-manager-home-projection-v4';
  const ONLINE_MODE_KEY = 'mortgage-manager-online-mode-v1';
  const MARKET_CACHE_KEY = 'mortgage-manager-market-cache-v1';
  const BACKUP_VERSION = 1;
  const MARKET_URLS = [
    'public/market-rates.json',
    'https://raw.githubusercontent.com/1-dvsbstd/mortgage-manager/main/public/market-rates.json',
    'https://raw.githubusercontent.com/1-dvsbstd/mortgage-manager/offline-v1-foundation/public/market-rates.json',
  ];

  const money = (value) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(Math.max(0, Number(value) || 0));

  function historyCount() {
    try {
      const rows = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(rows) ? new Set(rows.map((row) => row?.month).filter(Boolean)).size : 0;
    } catch (_) { return 0; }
  }

  function homeSettings() {
    try { return JSON.parse(localStorage.getItem(HOME_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }

  function refreshOptionalSections() {
    const progress = $('personalProgress');
    if (progress) progress.hidden = historyCount() < 2;
    const cost = $('propertyCostComparison');
    if (cost) {
      const settings = homeSettings();
      const purchasePrice = Math.max(0, Number(settings.purchasePrice) || 0);
      const improvements = Math.max(0, Number(settings.improvements) || 0);
      cost.hidden = !(purchasePrice > 0 || improvements > 0);
    }
  }

  function removeStandaloneEquityProgress() {
    const section = $('equityGrowth');
    if (section) section.hidden = true;
  }

  function moneyNumber(text) {
    const n = Number(String(text || '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  function ensureOwnershipDonut(bar) {
    let svg = bar?.querySelector('.ownership-donut');
    if (svg || !bar) return svg;
    svg = document.createElementNS(SVG_NS, 'svg');
    svg.classList.add('ownership-donut');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `
      <circle class="ownership-donut-track" cx="100" cy="100" r="${DONUT_RADIUS}"></circle>
      <circle class="ownership-donut-arc ownership-donut-debt" cx="100" cy="100" r="${DONUT_RADIUS}"></circle>
      <circle class="ownership-donut-arc ownership-donut-equity" cx="100" cy="100" r="${DONUT_RADIUS}"></circle>
      <circle class="ownership-donut-arc ownership-donut-other" cx="100" cy="100" r="${DONUT_RADIUS}"></circle>
      <circle class="ownership-donut-centre" cx="100" cy="100" r="54"></circle>
      <text class="ownership-donut-percent" x="100" y="95" text-anchor="middle">0%</text>
      <text class="ownership-donut-free" x="100" y="121" text-anchor="middle">free</text>`;
    bar.appendChild(svg);
    return svg;
  }

  function setArc(circle, startPct, sizePct, gapPct) {
    if (!circle) return;
    if (sizePct <= 0.01) { circle.style.display = 'none'; return; }
    circle.style.display = '';
    const effectiveGap = Math.min(gapPct, Math.max(0, sizePct * 0.22));
    const visiblePct = Math.max(0, sizePct - effectiveGap);
    const startWithGap = startPct + effectiveGap / 2;
    const dash = DONUT_CIRCUMFERENCE * visiblePct / 100;
    const offset = -DONUT_CIRCUMFERENCE * startWithGap / 100;
    circle.setAttribute('stroke-dasharray', `${dash.toFixed(3)} ${(DONUT_CIRCUMFERENCE - dash).toFixed(3)}`);
    circle.setAttribute('stroke-dashoffset', offset.toFixed(3));
  }

  function renderOwnershipDonut() {
    const bar = document.querySelector('.home-panel .ownership-bar');
    const state = window.MortgageStore?.get?.();
    const balance = Math.max(0, Number(state?.balance ?? $('balance')?.value) || 0);
    const homeValue = Math.max(0, Number(state?.homeValue ?? $('homeValue')?.value) || 0);
    const ownership = Math.min(100, Math.max(0, Number(state?.ownership ?? $('ownership')?.value) || 0));
    if (!bar || !homeValue) return;
    const schemePct = Math.max(0, 100 - ownership);
    const debtPct = Math.min(ownership, Math.max(0, balance / homeValue * 100));
    const equityPctWhole = Math.max(0, ownership - debtPct);
    const ownedValue = homeValue * ownership / 100;
    const householdEquity = Math.max(0, ownedValue - balance);
    const mortgageFreeShare = ownedValue > 0 ? Math.min(100, Math.max(0, householdEquity / ownedValue * 100)) : 0;
    const svg = ensureOwnershipDonut(bar);
    const nonZeroSegments = [debtPct, equityPctWhole, schemePct].filter((value) => value > 0.05).length;
    const gapPct = nonZeroSegments > 1 ? 0.72 : 0;
    setArc(svg.querySelector('.ownership-donut-debt'), 0, debtPct, gapPct);
    setArc(svg.querySelector('.ownership-donut-equity'), debtPct, equityPctWhole, gapPct);
    setArc(svg.querySelector('.ownership-donut-other'), debtPct + equityPctWhole, schemePct, gapPct);
    svg.querySelector('.ownership-donut-percent').textContent = `${mortgageFreeShare.toFixed(0)}%`;
    bar.setAttribute('aria-label', `${debtPct.toFixed(1)}% mortgage debt, ${equityPctWhole.toFixed(1)}% your equity, ${schemePct.toFixed(1)}% other share`);
  }

  function ensureCostBars() {
    const cards = Array.from(document.querySelectorAll('#propertyCostComparison .property-cost-card'));
    if (!cards.length) return;
    const values = cards.map((card) => moneyNumber(card.querySelector('strong')?.textContent));
    const max = Math.max(...values, 1);
    cards.forEach((card, index) => {
      let scale = card.querySelector('.cost-scale');
      if (!scale) {
        scale = document.createElement('div');
        scale.className = 'cost-scale';
        scale.setAttribute('aria-hidden', 'true');
        scale.innerHTML = '<i></i>';
        card.appendChild(scale);
      }
      const width = Math.max(0, Math.min(100, values[index] / max * 100));
      scale.style.setProperty('--cost-width', `${width.toFixed(1)}%`);
    });
  }

  function ensureEquityLegend() {
    const legend = document.querySelector('.chart-panel .legend');
    if (!legend || legend.querySelector('.equity-legend-item')) return;
    const item = document.createElement('span');
    item.className = 'equity-legend-item';
    item.innerHTML = '<i class="dot equity-line"></i>Projected equity';
    legend.appendChild(item);
  }

  function standardiseSetupClose() {
    const button = document.querySelector('.personal-modal .personal-close');
    if (!button) return;
    button.textContent = 'Close';
    button.setAttribute('aria-label', 'Close setup and data');
  }

  function keepFutureSectionsOpen() {
    ['homeValueHistory','nextHomePlanner','nextHomeSettings'].forEach((id) => {
      const el = $(id);
      if (el?.tagName === 'DETAILS') el.open = true;
    });
  }

  function isOnlineMode() {
    return localStorage.getItem(ONLINE_MODE_KEY) === 'online';
  }

  function setOnlineMode(enabled) {
    localStorage.setItem(ONLINE_MODE_KEY, enabled ? 'online' : 'offline');
    updateConnectivityControl();
    if (enabled) refreshMarketRates(true);
    else applyCachedMarketRates();
  }

  function ensureConnectivityControl() {
    const topbar = document.querySelector('.topbar');
    const save = $('saveStatus');
    if (!topbar || !save || $('connectivityMode')) return;
    const control = document.createElement('div');
    control.id = 'connectivityMode';
    control.className = 'connectivity-mode';
    control.innerHTML = `<div class="connectivity-copy"><strong data-connectivity-title>Offline</strong><small data-connectivity-subtitle>Your data stays on this device</small></div><button type="button" class="connectivity-switch" data-connectivity-switch role="switch" aria-checked="false" aria-label="Toggle online market updates"></button>`;
    save.insertAdjacentElement('beforebegin', control);
    control.querySelector('[data-connectivity-switch]').addEventListener('click', () => setOnlineMode(!isOnlineMode()));
    updateConnectivityControl();
  }

  function updateConnectivityControl() {
    const control = $('connectivityMode');
    if (!control) return;
    const online = isOnlineMode();
    const button = control.querySelector('[data-connectivity-switch]');
    button.classList.toggle('is-online', online);
    button.setAttribute('aria-checked', String(online));
    control.querySelector('[data-connectivity-title]').textContent = online ? 'Online' : 'Offline';
    control.querySelector('[data-connectivity-subtitle]').textContent = online ? 'Latest market benchmarks' : 'Your data stays on this device';
  }

  function readMarketCache() {
    try { return JSON.parse(localStorage.getItem(MARKET_CACHE_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function validMarketData(data) {
    return !!(data && Array.isArray(data.bands) && data.bands.length && Number(data.overall?.twoYear) > 0 && Number(data.overall?.fiveYear) > 0);
  }

  async function fetchMarketData() {
    let lastError = null;
    for (const url of MARKET_URLS) {
      try {
        const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, { cache:'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!validMarketData(data)) throw new Error('Invalid market data');
        return { ...data, fetchedAt:new Date().toISOString() };
      } catch (error) { lastError = error; }
    }
    throw lastError || new Error('Unable to load market data');
  }

  function ltvBandFor(data, ltv) {
    const bands = [...(data?.bands || [])].sort((a,b) => a.ltv - b.ltv);
    if (!bands.length) return null;
    return bands.find((band) => ltv <= Number(band.ltv)) || bands[bands.length - 1];
  }

  function paymentFor(principal, annualRate, months) {
    principal = Math.max(0, Number(principal) || 0);
    months = Math.max(1, Math.round(Number(months) || 1));
    const r = Math.max(0, Number(annualRate) || 0) / 100 / 12;
    if (!principal) return 0;
    if (!r) return principal / months;
    return principal * r / (1 - Math.pow(1 + r, -months));
  }

  function monthsUntil(monthValue) {
    if (!monthValue || !/^\d{4}-\d{2}$/.test(monthValue)) return null;
    const [year, month] = monthValue.split('-').map(Number);
    const now = new Date();
    return (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());
  }

  function formatSourceDate(value) {
    if (!value) return 'dated snapshot';
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(date);
  }

  function renderLiveRateChoices(data, band, result, state) {
    const forecast = $('dealForecast');
    if (!forecast || !state.fixedEnd || !result?.base?.monthlyPoints?.length) return;
    let box = $('liveRateChoices');
    if (!box) {
      box = document.createElement('div');
      box.id = 'liveRateChoices';
      box.className = 'live-rate-choices';
      forecast.appendChild(box);
    }
    const untilEnd = monthsUntil(state.fixedEnd);
    if (untilEnd === null || untilEnd < 0) { box.hidden = true; return; }
    box.hidden = false;
    const endIndex = Math.min(untilEnd, result.base.monthlyPoints.length - 1);
    const balanceAtEnd = Math.max(0, result.base.monthlyPoints[endIndex] || 0);
    const remainingMonths = Math.max(1, result.base.months - untilEnd);
    const twoRate = Number(band?.twoYear || data.overall.twoYear);
    const fiveRate = Number(band?.fiveYear || data.overall.fiveYear);
    const twoPayment = paymentFor(balanceAtEnd, twoRate, remainingMonths);
    const fivePayment = paymentFor(balanceAtEnd, fiveRate, remainingMonths);
    box.innerHTML = `<div class="live-rate-head"><strong>${isOnlineMode() ? 'Latest market projection' : 'Saved market projection'}</strong><small>${band ? `Using ${band.ltv}% LTV benchmark` : 'Overall market benchmark'} · ${formatSourceDate(data.sourceAsOf)}</small></div><div class="live-rate-grid"><div class="live-rate-card"><span>Indicative 2-year fix</span><strong>${twoRate.toFixed(2)}%</strong><small>${money(twoPayment)}/month at projected deal-end balance</small></div><div class="live-rate-card"><span>Indicative 5-year fix</span><strong>${fiveRate.toFixed(2)}%</strong><small>${money(fivePayment)}/month at projected deal-end balance</small></div></div>`;
  }

  function applyMarketRates(data) {
    if (!validMarketData(data)) return;
    const state = window.MortgageStore?.get?.();
    if (!state) return;
    const ltv = state.homeValue > 0 ? state.balance / state.homeValue * 100 : 100;
    const band = ltvBandFor(data, ltv);
    const twoRate = Number(band?.twoYear || data.overall.twoYear);
    const fiveRate = Number(band?.fiveYear || data.overall.fiveYear);
    const result = window.MortgageMath?.compare?.(state.balance, state.rate, state.payment, state.scenarioExtra);
    const termMonths = Math.max(1, Number(result?.base?.months) || 300);
    if ($('market2yRate')) $('market2yRate').textContent = `${twoRate.toFixed(2)}%`;
    if ($('market5yRate')) $('market5yRate').textContent = `${fiveRate.toFixed(2)}%`;
    if ($('marketCurrentRate')) $('marketCurrentRate').textContent = `${Number(state.rate || 0).toFixed(2)}%`;
    if ($('marketLtvBand')) $('marketLtvBand').textContent = band ? `${ltv.toFixed(1)}% current LTV · ${band.ltv}% benchmark` : `${ltv.toFixed(1)}% current LTV`;
    if ($('market2yPayment')) $('market2yPayment').textContent = `${money(paymentFor(state.balance, twoRate, termMonths))}/month equivalent`;
    if ($('market5yPayment')) $('market5yPayment').textContent = `${money(paymentFor(state.balance, fiveRate, termMonths))}/month equivalent`;
    const source = document.querySelector('.market-block .source-date');
    if (source) source.textContent = `${isOnlineMode() ? 'Online' : 'Saved'} · Moneyfacts · ${formatSourceDate(data.sourceAsOf)}`;
    renderLiveRateChoices(data, band, result, state);
  }

  function applyCachedMarketRates() {
    const cached = readMarketCache();
    if (cached) applyMarketRates(cached);
    const source = document.querySelector('.market-block .source-date');
    if (!cached && source && !isOnlineMode()) source.textContent = 'Offline · switch online for latest rates';
  }

  async function refreshMarketRates(force = false) {
    if (!isOnlineMode() && !force) { applyCachedMarketRates(); return; }
    const source = document.querySelector('.market-block .source-date');
    if (source) source.textContent = 'Updating market rates…';
    try {
      const data = await fetchMarketData();
      localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify(data));
      applyMarketRates(data);
    } catch (_) {
      const cached = readMarketCache();
      if (cached) {
        applyMarketRates(cached);
        if (source) source.textContent = `Online unavailable · saved ${formatSourceDate(cached.sourceAsOf)}`;
      } else if (source) source.textContent = 'Online rates unavailable';
    }
  }

  function collectBackup() {
    const data = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith('mortgage-manager-')) data[key] = localStorage.getItem(key);
    }
    return { product:'Mortgage Manager', backupVersion:BACKUP_VERSION, exportedAt:new Date().toISOString(), data };
  }

  function downloadBackup() {
    const payload = JSON.stringify(collectBackup(), null, 2);
    const blob = new Blob([payload], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mortgage-manager-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function mortgageManagerKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith('mortgage-manager-')) keys.push(key);
    }
    return keys;
  }

  async function importBackup(file, status) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || parsed.product !== 'Mortgage Manager' || !parsed.data || typeof parsed.data !== 'object') throw new Error('This is not a Mortgage Manager backup.');
    const version = Number(parsed.backupVersion || 0);
    if (!Number.isFinite(version) || version < 1) throw new Error('This backup is missing a supported version.');
    if (version > BACKUP_VERSION) throw new Error('This backup was created by a newer version of Mortgage Manager. Update the app before restoring it.');
    const entries = Object.entries(parsed.data).filter(([key,value]) => key.startsWith('mortgage-manager-') && typeof value === 'string');
    if (!entries.length) throw new Error('No Mortgage Manager data was found in this backup.');
    const confirmed = window.confirm(`Restore this backup from ${parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString('en-GB') : 'an earlier session'}? This replaces the Mortgage Manager data currently saved on this device.`);
    if (!confirmed) {
      if (status) status.textContent = 'Restore cancelled. Your current data was not changed.';
      return;
    }
    mortgageManagerKeys().forEach((key) => localStorage.removeItem(key));
    entries.forEach(([key,value]) => localStorage.setItem(key, value));
    if (status) status.textContent = `Restored ${entries.length} saved items. Reloading…`;
    setTimeout(() => location.reload(), 350);
  }

  function ensureBackupSection() {
    const modal = document.querySelector('.personal-modal');
    if (!modal || $('dataBackupSection')) return;
    const section = document.createElement('details');
    section.id = 'dataBackupSection';
    section.className = 'personal-section data-backup-section';
    section.innerHTML = `<summary><span><strong>Backup & restore</strong><small>Keep a portable copy of everything saved on this device</small></span><span class="history-summary-chevron">+</span></summary><div class="mortgage-history-body"><p class="history-intro">Your mortgage data is stored locally. Export a backup before changing browser, clearing site data or moving to another device.</p><div class="backup-actions"><button type="button" class="personal-button" data-backup-export>Export backup</button><button type="button" class="personal-button" data-backup-import>Restore backup</button><input class="backup-file" type="file" accept="application/json,.json" data-backup-file></div><p class="backup-status" data-backup-status>No account or cloud storage required.</p></div>`;
    modal.appendChild(section);
    const status = section.querySelector('[data-backup-status]');
    const input = section.querySelector('[data-backup-file]');
    section.querySelector('[data-backup-export]').addEventListener('click', () => { downloadBackup(); status.textContent = 'Backup downloaded.'; });
    section.querySelector('[data-backup-import]').addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try { await importBackup(file, status); }
      catch (error) { status.textContent = error?.message || 'Could not restore this backup.'; input.value = ''; }
    });
  }

  function ensureQuickLumpSumAction() {
    const section = $('mortgageHistorySection');
    if (!section || section.querySelector('[data-quick-lump]')) return;
    const summary = section.querySelector('summary');
    if (!summary) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'personal-button';
    button.dataset.quickLump = '';
    button.textContent = 'Add overpayment';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      section.open = true;
      const add = section.querySelector('[data-add-lump]');
      add?.click();
      setTimeout(() => section.querySelector('[data-lump-list] [data-history-lump]:last-child input')?.focus(), 20);
    });
    summary.appendChild(button);
  }

  function refresh() {
    removeStandaloneEquityProgress();
    refreshOptionalSections();
    renderOwnershipDonut();
    ensureCostBars();
    ensureEquityLegend();
    standardiseSetupClose();
    keepFutureSectionsOpen();
    ensureConnectivityControl();
    ensureBackupSection();
    ensureQuickLumpSumAction();
    applyCachedMarketRates();
  }

  let frame = null;
  let timer = null;
  const schedule = (delay = 0) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(refresh);
    }, delay);
  };

  if (window.MortgageStore?.subscribe) {
    window.MortgageStore.subscribe((next, previous) => {
      if (['balance','homeValue','ownership','rate','payment','fixedEnd'].some((key) => next[key] !== previous[key])) {
        schedule();
        if (isOnlineMode()) refreshMarketRates();
      }
    });
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('#personalDataButton,[data-expand-card],#propertyCostComparison,#recordSnapshot,[data-action="snapshot"],[data-action="save"],[data-action="reset-history"]')) schedule(35);
  });
  document.addEventListener('input', (event) => {
    if (event.target.matches('#projectionTrendRate,#projectionPurchasePrice,#projectionImprovements')) schedule(20);
  });
  document.addEventListener('mortgage-history-updated', () => schedule(35));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const button = document.querySelector('.personal-modal .personal-close');
    if (button) button.click();
  });

  ensureConnectivityControl();
  schedule();
  setTimeout(() => {
    refresh();
    if (isOnlineMode()) refreshMarketRates();
  }, 250);
})();