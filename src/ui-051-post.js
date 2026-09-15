(() => {
  const current = document.getElementById('currentOverpayment');
  const display = document.getElementById('currentOverpayDisplay');
  const scenario = document.querySelector('.scenario-panel');
  const money = (value) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(Math.max(0, Number(value)||0));
  const key = 'mortgage-manager-current-overpayment-v1';

  const compactMonths = (months) => {
    if (!Number.isFinite(months) || months <= 0) return 'No time saved yet';
    const years = Math.floor(months / 12);
    const remainder = months % 12;
    return years && remainder ? `${years}y ${remainder}m sooner` : years ? `${years}y sooner` : `${remainder}m sooner`;
  };

  function ensureCompactSavings() {
    if (!scenario || document.getElementById('currentSavingsSummary')) return;
    const top = scenario.querySelector('.scenario-top');
    if (!top) return;
    const block = document.createElement('div');
    block.id = 'currentSavingsSummary';
    block.className = 'current-savings-summary';
    block.innerHTML = `
      <span>Current savings</span>
      <strong id="currentSavingsMain">—</strong>
      <small id="currentSavingsInterest">—</small>
    `;
    top.appendChild(block);
  }

  function ensureCompactWhatIf() {
    if (!scenario || document.getElementById('compactWhatIf')) return;
    const originalButtons = document.getElementById('overpayButtons');
    if (!originalButtons) return;

    const wrap = document.createElement('div');
    wrap.id = 'compactWhatIf';
    wrap.className = 'compact-what-if';
    wrap.innerHTML = `
      <div class="compact-what-if-head">
        <div><span>What if?</span><strong>Try a little more</strong></div>
        <small id="compactWhatIfSummary">Choose an amount to preview the impact.</small>
      </div>
      <div class="compact-what-if-buttons" aria-label="Try an extra monthly overpayment"></div>
    `;

    const buttonRow = wrap.querySelector('.compact-what-if-buttons');
    originalButtons.querySelectorAll('button[data-extra]').forEach((source) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.compactExtra = source.dataset.extra;
      button.textContent = source.textContent;
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        source.click();
        syncCompactWhatIf();
      });
      buttonRow.appendChild(button);
    });

    const detail = scenario.querySelector('.expand-detail');
    if (detail) scenario.insertBefore(wrap, detail);
    else scenario.appendChild(wrap);
  }

  function syncCompactWhatIf() {
    const wrap = document.getElementById('compactWhatIf');
    if (!wrap) return;
    const selected = Math.max(0, Number(document.getElementById('customExtra')?.value) || 0);
    wrap.querySelectorAll('button[data-compact-extra]').forEach((button) => {
      button.classList.toggle('active', Number(button.dataset.compactExtra) === selected);
    });
    const sourceSummary = document.getElementById('scenarioSummary');
    const summary = document.getElementById('compactWhatIfSummary');
    if (summary && sourceSummary) summary.textContent = sourceSummary.textContent || 'Choose an amount to preview the impact.';
  }

  function updateCurrentSavings() {
    ensureCompactSavings();
    ensureCompactWhatIf();
    if (!window.MortgageMath || !current) return;
    const balance = Math.max(0, Number(document.getElementById('balance')?.value) || 0);
    const rate = Math.max(0, Number(document.getElementById('rate')?.value) || 0);
    const payment = Math.max(0, Number(document.getElementById('payment')?.value) || 0);
    const currentExtra = Math.max(0, Number(current.value) || 0);
    const base = MortgageMath.amortize(balance, rate, payment);
    const withCurrent = MortgageMath.amortize(balance, rate, payment + currentExtra);
    const main = document.getElementById('currentSavingsMain');
    const interest = document.getElementById('currentSavingsInterest');
    if (!main || !interest) return;

    if (!currentExtra) {
      main.textContent = 'No regular overpayment';
      interest.textContent = 'Add one in the detailed view to see the impact.';
      return;
    }
    if (!Number.isFinite(base.months) || !Number.isFinite(withCurrent.months)) {
      main.textContent = 'Saving unavailable';
      interest.textContent = 'Check that the scheduled payment repays the mortgage.';
      return;
    }
    const monthsSaved = Math.max(0, base.months - withCurrent.months);
    const interestSaved = Math.max(0, base.interest - withCurrent.interest);
    main.textContent = compactMonths(monthsSaved);
    interest.textContent = `${money(interestSaved)} interest saved over the mortgage`;
  }

  if (current) {
    try { const saved = localStorage.getItem(key); if (saved !== null) current.value = saved; } catch (_) {}
    const sync = () => {
      const value = Math.max(0, Number(current.value)||0);
      if (display) display.textContent = `${money(value)}/month`;
      try { localStorage.setItem(key, String(value)); } catch (_) {}
      document.getElementById('customExtra')?.dispatchEvent(new Event('input', { bubbles:true }));
      updateCurrentSavings();
      requestAnimationFrame(syncCompactWhatIf);
    };
    current.addEventListener('input', sync);
    sync();
  }

  ['balance','rate','payment'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => requestAnimationFrame(updateCurrentSavings));
  });
  document.getElementById('customExtra')?.addEventListener('input', () => requestAnimationFrame(syncCompactWhatIf));

  const sourceSummary = document.getElementById('scenarioSummary');
  if (sourceSummary) {
    new MutationObserver(syncCompactWhatIf).observe(sourceSummary, { childList:true, characterData:true, subtree:true });
  }

  const dealDetail = document.querySelector('.next-panel .expand-detail');
  if (dealDetail && !document.getElementById('dealMarketCompare')) {
    const block = document.createElement('div');
    block.id = 'dealMarketCompare';
    block.className = 'deal-market-compare';
    block.innerHTML = `
      <div class="deep-heading"><div><p class="eyebrow">Rate comparison</p><h2>Your rate vs indicative market averages</h2></div><span class="source-date">Moneyfacts · 1 Sep 2026</span></div>
      <div class="market-comparison">
        <div class="market-current"><span>Your rate</span><strong id="dealYourRate">—</strong><small id="dealLtvBand">—</small></div>
        <div><span>Avg 2-year fix</span><strong id="deal2yRate">—</strong><small id="deal2yPayment">—</small></div>
        <div><span>Avg 5-year fix</span><strong id="deal5yRate">—</strong><small id="deal5yPayment">—</small></div>
      </div>`;
    dealDetail.insertAdjacentElement('afterbegin', block);
  }

  const copyRates = () => {
    const map = [
      ['marketCurrentRate','dealYourRate'],['marketLtvBand','dealLtvBand'],['market2yRate','deal2yRate'],['market2yPayment','deal2yPayment'],['market5yRate','deal5yRate'],['market5yPayment','deal5yPayment']
    ];
    map.forEach(([from,to]) => { const a=document.getElementById(from), b=document.getElementById(to); if(a&&b) b.textContent=a.textContent; });
  };
  copyRates();
  const observer = new MutationObserver(copyRates);
  ['marketCurrentRate','marketLtvBand','market2yRate','market2yPayment','market5yRate','market5yPayment'].forEach((id)=>{ const el=document.getElementById(id); if(el) observer.observe(el,{childList:true,characterData:true,subtree:true}); });

  ensureCompactWhatIf();
  syncCompactWhatIf();
})();