(() => {
  const SNAPSHOT_KEY = 'mortgage-manager-history-v1';
  const SETUP_KEY = 'mortgage-manager-personal-setup-v1';
  const BACKUP_VERSION = '0.9.11';
  const STORAGE_PREFIX = 'mortgage-manager';
  const $ = (id) => document.getElementById(id);
  const money = (value) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(Number(value) || 0);
  const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  const monthLabel = (key) => {
    const [year, month] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('en-GB', { month:'short', year:'numeric' }).format(new Date(year, month-1, 1));
  };
  const toast = (text) => {
    document.querySelector('.personal-toast')?.remove();
    const el = document.createElement('div');
    el.className = 'personal-toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  };

  function currentState() {
    if (window.MortgageStore) return window.MortgageStore.get();
    const readNum = (id) => Math.max(0, Number($(id)?.value) || 0);
    return {
      balance: readNum('balance'),
      homeValue: readNum('homeValue'),
      ownership: Math.min(100, readNum('ownership')),
      rate: readNum('rate'),
      payment: readNum('payment'),
      currentOverpayment: readNum('currentOverpayment'),
      fixedEnd: $('fixedEnd')?.value || '',
    };
  }

  function currentSnapshot() {
    const state = currentState();
    const balance = Math.max(0, Number(state.balance) || 0);
    const homeValue = Math.max(0, Number(state.homeValue) || 0);
    const ownership = Math.min(100, Math.max(0, Number(state.ownership) || 0));
    const shareValue = homeValue * (ownership / 100);
    const equity = shareValue - balance;
    return {
      month: monthKey(),
      savedAt: new Date().toISOString(),
      balance,
      homeValue,
      ownership,
      equity,
      rate: Math.max(0, Number(state.rate) || 0),
      payment: Math.max(0, Number(state.payment) || 0),
      currentOverpayment: Math.max(0, Number(state.currentOverpayment) || 0),
      fixedEnd: state.fixedEnd || '',
      payoffText: (() => {
        const path=window.MortgageMath?.amortize?.(balance,Math.max(0,Number(state.rate)||0),Math.max(0,Number(state.payment)||0)+Math.max(0,Number(state.currentOverpayment)||0));
        if(!Number.isFinite(path?.months)) return '';
        const date=new Date(); date.setMonth(date.getMonth()+path.months);
        return `Mortgage-free around ${new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'}).format(date)}`;
      })(),
      remainingText: (() => {
        const path=window.MortgageMath?.amortize?.(balance,Math.max(0,Number(state.rate)||0),Math.max(0,Number(state.payment)||0)+Math.max(0,Number(state.currentOverpayment)||0));
        if(!Number.isFinite(path?.months)) return '';
        const years=Math.floor(path.months/12), months=path.months%12;
        return [years?`${years} year${years===1?'':'s'}`:'',months?`${months} month${months===1?'':'s'}`:''].filter(Boolean).join(' ');
      })(),
    };
  }

  function loadHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  }

  function saveHistory(history) {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(history.slice(-120)));
  }

  function recordSnapshot(showToast = false) {
    const snapshot = currentSnapshot();
    if (!snapshot.balance) return;
    const history = loadHistory();
    const index = history.findIndex((row) => row.month === snapshot.month);
    if (index >= 0) history[index] = snapshot; else history.push(snapshot);
    history.sort((a,b) => a.month.localeCompare(b.month));
    saveHistory(history);
    renderProgress();
    if (showToast) toast(`Saved ${monthLabel(snapshot.month)} snapshot`);
  }

  function deltaText(value) {
    if (!Number.isFinite(value) || Math.abs(value) < .5) return 'No change yet';
    const sign = value > 0 ? '+' : '−';
    return `${sign}${money(Math.abs(value))}`;
  }

  function ensureProgressCard() {
    if ($('personalProgress')) return;
    const trajectory = document.querySelector('[data-expandable-card="trajectory"]');
    if (!trajectory) return;
    const section = document.createElement('section');
    section.id = 'personalProgress';
    section.className = 'panel progress-panel';
    section.innerHTML = `
      <div class="progress-heading">
        <div class="progress-heading-copy"><p class="eyebrow">Your progress</p><h2>Since you started tracking</h2><p id="progressContext">Your first snapshot becomes the baseline for real progress.</p></div>
        <button type="button" id="recordSnapshot" class="progress-action">Save this month</button>
      </div>
      <div class="progress-grid">
        <div class="progress-stat"><span>Mortgage reduced</span><strong id="progressDebt">—</strong><small id="progressDebtNote">—</small></div>
        <div class="progress-stat"><span>Equity gained</span><strong id="progressEquity">—</strong><small id="progressEquityNote">—</small></div>
        <div class="progress-stat"><span>Home value change</span><strong id="progressHome">—</strong><small id="progressHomeNote">—</small></div>
      </div>
      <div class="progress-history" id="progressHistory"></div>`;
    trajectory.insertAdjacentElement('beforebegin', section);
    $('recordSnapshot')?.addEventListener('click', (event) => { event.stopPropagation(); recordSnapshot(true); });
  }

  function renderProgress() {
    ensureProgressCard();
    const history = loadHistory();
    const current = currentSnapshot();
    if (!history.length) {
      $('progressDebt').textContent = 'Tracking starts now';
      $('progressDebtNote').textContent = 'Save this month to create your baseline.';
      $('progressEquity').textContent = '—';
      $('progressEquityNote').textContent = 'Equity change will appear after a later snapshot.';
      $('progressHome').textContent = '—';
      $('progressHomeNote').textContent = 'Home-value changes stay separate from mortgage repayment.';
      $('progressHistory').innerHTML = '<div class="progress-history-empty">No monthly history yet.</div>';
      return;
    }
    const first = history[0];
    const latest = history[history.length - 1];
    const debtReduced = first.balance - current.balance;
    const equityGained = current.equity - first.equity;
    const homeChange = current.homeValue - first.homeValue;
    $('progressContext').textContent = `Tracking from ${monthLabel(first.month)} · ${history.length} monthly snapshot${history.length === 1 ? '' : 's'} saved.`;
    $('progressDebt').textContent = debtReduced > .5 ? money(debtReduced) : '—';
    $('progressDebtNote').textContent = debtReduced > .5 ? `Balance ${money(first.balance)} → ${money(current.balance)}` : 'Your current month is still the baseline.';
    $('progressEquity').textContent = Math.abs(equityGained) > .5 ? deltaText(equityGained) : '—';
    $('progressEquityNote').textContent = `Current estimated equity ${money(current.equity)}`;
    $('progressHome').textContent = Math.abs(homeChange) > .5 ? deltaText(homeChange) : '—';
    $('progressHomeNote').textContent = `Current property value ${money(current.homeValue)}`;
    const recent = history.slice(-6).reverse();
    $('progressHistory').innerHTML = recent.map((row) => `
      <div class="progress-history-row"><span>${monthLabel(row.month)}</span><strong>${money(row.balance)}</strong><span>Equity ${money(row.equity)}</span><span>${row.payoffText || ''}</span></div>`).join('');
    if (latest.month !== current.month) {
      $('progressHistory').insertAdjacentHTML('afterbegin','<div class="progress-history-empty">This month has not been saved yet.</div>');
    }
  }

  function monthsUntil(monthValue) {
    if (!monthValue) return null;
    const [year, month] = monthValue.split('-').map(Number);
    if (!year || !month) return null;
    const now = new Date();
    return (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());
  }

  function ensureDealGuidance() {
    const panel = document.querySelector('.next-panel');
    if (!panel || $('dealActionHint')) return;
    const timeline = panel.querySelector('.timeline-labels');
    if (!timeline) return;
    const box = document.createElement('div');
    box.id = 'dealActionHint';
    box.className = 'deal-action-hint';
    timeline.insertAdjacentElement('afterend', box);
  }

  function renderDealGuidance() {
    ensureDealGuidance();
    const box = $('dealActionHint');
    if (!box) return;
    const months = monthsUntil(currentState().fixedEnd || '');
    let title = 'Add your fixed-rate end date';
    let detail = 'Once it is set, this card will tell you when action is actually useful.';
    if (months !== null) {
      if (months < 0) { title = 'Update your mortgage deal'; detail = 'Your saved fixed-rate end has passed, so the rate and payment details may now be out of date.'; }
      else if (months <= 3) { title = 'Time to compare your next deal'; detail = 'You are inside the period where getting real remortgage/product-transfer options is useful.'; }
      else if (months <= 6) { title = 'Start watching rates now'; detail = 'You are close enough to deal end that rate movements and projected LTV are worth monitoring.'; }
      else if (months <= 12) { title = 'Keep an eye on the market'; detail = 'No urgent action, but this is a useful window to watch your projected deal-end balance and LTV.'; }
      else { title = 'Nothing you need to do yet'; detail = 'Keep reducing the balance. The app will make this milestone more prominent as the end date gets closer.'; }
    }
    box.innerHTML = `<span>Action</span><strong>${title}</strong><small>${detail}</small>`;
  }

  function setupButton() {
    const topbar = document.querySelector('.topbar');
    const save = $('saveStatus');
    if (!topbar || $('personalDataButton')) return;
    const wrap = document.createElement('div');
    wrap.className = 'topbar-actions';
    const button = document.createElement('button');
    button.id = 'personalDataButton';
    button.className = 'personal-data-button';
    button.type = 'button';
    button.textContent = 'Setup & data';
    wrap.append(save, button);
    topbar.appendChild(wrap);
    button.addEventListener('click', openSetup);
  }


  function formatMonthValue(value){
    const match=/^(\d{4})-(\d{2})$/.exec(String(value||''));
    if(!match) return 'Choose month';
    return new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(new Date(Number(match[1]),Number(match[2])-1,1));
  }

  function inputMarkup(id, label, type='number', step='1') {
    const value = currentState()[id] ?? '';
    if(type==='month'){
      const escaped=String(value).replace(/"/g,'&quot;');
      return `<label>${label}<input data-personal-field="${id}" type="hidden" value="${escaped}" /><button type="button" class="setup-month-field" data-month-field><span>${formatMonthValue(value)}</span><i aria-hidden="true"></i></button></label>`;
    }
    const numeric = type === 'number';
    const input = `<input data-personal-field="${id}" type="${numeric?'text':type}" ${numeric ? 'inputmode="decimal"' : ''} value="${String(value).replace(/"/g,'&quot;')}" />`;
    return `<label>${label}${input}</label>`;
  }

  function closeSetupMonthPicker(){
    document.querySelector('.setup-month-popover')?.remove();
  }

  function openSetupMonthPicker(input){
    closeSetupMonthPicker();

    const now=new Date();
    const match=/^(\d{4})-(\d{2})$/.exec(input.value||'');
    let year=match?Number(match[1]):now.getFullYear();
    const selectedMonth=match?Number(match[2]):null;
    const monthNames=Array.from({length:12},(_,index)=>
      new Intl.DateTimeFormat('en-GB',{month:'short'}).format(new Date(2020,index,1))
    );

    const popover=document.createElement('div');
    popover.className='setup-month-popover';
    popover._monthInput=input;
    popover.setAttribute('role','dialog');
    popover.setAttribute('aria-label','Choose month');

    const render=()=>{
      popover.innerHTML=`
        <div class="setup-month-popover-head">
          <button type="button" data-month-prev aria-label="Previous year">‹</button>
          <strong>${year}</strong>
          <button type="button" data-month-next aria-label="Next year">›</button>
          <button type="button" class="setup-month-close" data-month-close aria-label="Close calendar">×</button>
        </div>
        <div class="setup-month-grid">
          ${monthNames.map((name,index)=>{
            const month=index+1;
            const selected=year===Number(match?.[1])&&month===selectedMonth;
            const current=year===now.getFullYear()&&month===now.getMonth()+1;
            return `<button type="button" data-month="${month}" class="${selected?'is-selected ':''}${current?'is-current':''}">${name}</button>`;
          }).join('')}
        </div>
        <div class="setup-month-popover-foot">
          <button type="button" data-month-clear>Clear</button>
          <button type="button" data-month-current>This month</button>
        </div>`;
    };

    const position=()=>{
      const anchor=input.closest('label')?.querySelector('[data-month-field],[data-deal-term]')||input;
      const rect=anchor.getBoundingClientRect();
      const width=Math.min(292,window.innerWidth-24);
      let left=Math.min(rect.left,window.innerWidth-width-12);
      left=Math.max(12,left);
      let top=rect.bottom+7;
      const estimatedHeight=250;
      if(top+estimatedHeight>window.innerHeight-12) top=Math.max(12,rect.top-estimatedHeight-7);
      popover.style.left=`${Math.round(left)}px`;
      popover.style.top=`${Math.round(top)}px`;
      popover.style.width=`${Math.round(width)}px`;
    };

    popover.addEventListener('pointerdown',(event)=>{
      const target=event.target.closest('button');
      if(!target) return;
      if(target.matches('[data-month-prev]')){
        event.preventDefault();
        event.stopPropagation();
        year-=1;
        render();
        return;
      }
      if(target.matches('[data-month-next]')){
        event.preventDefault();
        event.stopPropagation();
        year+=1;
        render();
      }
    });

    popover.addEventListener('click',(event)=>{
      const target=event.target.closest('button');
      if(!target) return;
      if(target.matches('[data-month-prev],[data-month-next]')) return;
      if(target.matches('[data-month-close]')){ closeSetupMonthPicker(); return; }
      if(target.matches('[data-month-clear]')){
        input.value='';
      }else if(target.matches('[data-month-current]')){
        input.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      }else if(target.dataset.month){
        input.value=`${year}-${String(target.dataset.month).padStart(2,'0')}`;
      }else return;
      const display=input.closest('label')?.querySelector('[data-month-field] span,[data-deal-term] span');
      if(display) display.textContent=formatMonthValue(input.value);
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      closeSetupMonthPicker();
    });

    render();
    document.body.appendChild(popover);
    position();
  }

  function wireSetupMonthInputs(){
    if(document.documentElement.dataset.setupMonthInputs==='true') return;
    document.documentElement.dataset.setupMonthInputs='true';

    document.addEventListener('keydown',(event)=>{
      if(event.key==='Escape') closeSetupMonthPicker();
    });

    document.addEventListener('mortgage-open-month-picker',(event)=>{
      const input=event.detail?.input;
      if(input?.isConnected) openSetupMonthPicker(input);
    });

    window.addEventListener('resize',closeSetupMonthPicker);
    document.addEventListener('scroll',()=>{
      const popover=document.querySelector('.setup-month-popover');
      const input=popover?._monthInput;
      if(!popover||!input?.isConnected) return;
      const anchor=input.closest('label')?.querySelector('[data-month-field],[data-deal-term]')||input;
      const rect=anchor.getBoundingClientRect();
      const width=Math.min(292,window.innerWidth-24);
      let left=Math.min(rect.left,window.innerWidth-width-12);
      left=Math.max(12,left);
      let top=rect.bottom+7;
      const estimatedHeight=250;
      if(top+estimatedHeight>window.innerHeight-12) top=Math.max(12,rect.top-estimatedHeight-7);
      popover.style.left=`${Math.round(left)}px`;
      popover.style.top=`${Math.round(top)}px`;
      popover.style.width=`${Math.round(width)}px`;
    },true);
  }

  function openSetup() {
    document.querySelector('.personal-backdrop')?.remove();
    const backdrop = document.createElement('div');
    backdrop.className = 'personal-backdrop';
    backdrop.innerHTML = `
      <section class="personal-modal" role="dialog" aria-modal="true" aria-labelledby="personalModalTitle">
        <div class="personal-modal-head"><div><p class="eyebrow">Your mortgage</p><h2 id="personalModalTitle">Setup & data</h2><p>These are the numbers the whole dashboard uses. Changes save to this device.</p></div><button class="personal-close" type="button" aria-label="Close setup and data">Close</button></div>
        <div class="personal-form">
          ${inputMarkup('balance','Current mortgage balance (£)','number','100')}
          ${inputMarkup('payment','Scheduled monthly payment (£)','number','1')}
          ${inputMarkup('rate','Interest rate (%)','number','0.01')}
          ${inputMarkup('currentOverpayment','Regular overpayment (£/month)','number','1')}
          ${inputMarkup('fixedEnd','Fixed rate ends','month')}
          ${inputMarkup('homeValue','Current property value (£)','number','1000')}
          ${inputMarkup('ownership','Property share owned (%)','number','1')}
        </div>
        <div class="personal-section"><h3>Monthly history</h3><p>The app stores one snapshot per month on this device. Saving again in the same month updates that month rather than creating duplicates.</p><div class="personal-actions"><button type="button" class="personal-button" data-action="snapshot">Save this month</button><button type="button" class="personal-button danger" data-action="reset-history">Reset history</button></div></div>
        <div class="personal-section"><h3>Backup</h3><p>Export everything stored by Mortgage Manager before changing phones or clearing browser/app data.</p><div class="personal-actions"><button type="button" class="personal-button" data-action="export">Export backup</button><button type="button" class="personal-button" data-action="import">Import backup</button><input class="personal-import-input" type="file" accept="application/json,.json" /></div></div>
        <div class="personal-footer-actions"><button type="button" class="personal-button" data-action="cancel">Cancel</button><button type="button" class="personal-button primary" data-action="save">Save changes</button></div>
      </section>`;
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click',(event)=>{
      const button=event.target.closest?.('[data-month-field]');
      if(!button) return;
      event.preventDefault();
      event.stopPropagation();
      const input=button.closest('label')?.querySelector('input[type="hidden"]');
      if(input) openSetupMonthPicker(input);
    },true);

    document.dispatchEvent(new CustomEvent('mortgage-setup-opened', { detail:{ firstRun:!localStorage.getItem(SETUP_KEY) } }));
    const close = () => backdrop.remove();
    // Setup contains editable data: require an explicit close action so a drag/text
    // selection that ends on the backdrop cannot accidentally discard the modal.
    backdrop.querySelector('.personal-close')?.addEventListener('click', close);
    backdrop.querySelector('[data-action="cancel"]')?.addEventListener('click', close);
    backdrop.querySelector('[data-action="save"]')?.addEventListener('click', () => {
      const patch = {};
      backdrop.querySelectorAll('[data-personal-field]').forEach((field) => {
        const key = field.dataset.personalField;
        patch[key] = key === 'fixedEnd' ? field.value : Number(field.value);
      });
      if (window.MortgageStore) window.MortgageStore.set(patch);
      else {
        Object.entries(patch).forEach(([key, value]) => {
          const source = $(key);
          if (!source) return;
          source.value = value;
          source.dispatchEvent(new Event('input', { bubbles:true }));
          source.dispatchEvent(new Event('change', { bubbles:true }));
        });
      }
      localStorage.setItem(SETUP_KEY, '1');
      setTimeout(() => { recordSnapshot(false); renderDealGuidance(); }, 80);
      close();
      toast('Mortgage details saved');
    });
    backdrop.querySelector('[data-action="snapshot"]')?.addEventListener('click', () => recordSnapshot(true));
    backdrop.querySelector('[data-action="reset-history"]')?.addEventListener('click', () => {
      if (confirm('Reset all saved monthly history? Your current mortgage details will stay saved.')) {
        localStorage.removeItem(SNAPSHOT_KEY);
        renderProgress();
        toast('History reset');
      }
    });
    backdrop.querySelector('[data-action="export"]')?.addEventListener('click',(event)=>{
      event.preventDefault();
      exportBackup();
    });
    const importButton=backdrop.querySelector('[data-action="import"]');
    const importInput=backdrop.querySelector('.personal-import-input');
    importButton?.addEventListener('click',(event)=>{
      event.preventDefault();
      importInput?.click();
    });
    importInput?.addEventListener('change',async()=>{
      const file=importInput.files?.[0];
      if(!file) return;
      try{
        await importBackup(file);
      }catch(error){
        window.alert(error?.message || 'Could not restore that Mortgage Manager backup.');
      }finally{
        importInput.value='';
      }
    });
  }

  function exportBackup() {
    const data = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) data[key] = localStorage.getItem(key);
    }
    const payload = {
      product:'Mortgage Manager',
      backupVersion:1,
      exportedAt:new Date().toISOString(),
      data,
    };
    const blob = new Blob([JSON.stringify(payload,null,2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mortgage-manager-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    toast('Backup exported');
  }

  async function importBackup(file) {
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed?.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
      throw new Error('This is not a Mortgage Manager backup.');
    }
    const entries = Object.entries(parsed.data)
      .filter(([key,value]) => key.startsWith(STORAGE_PREFIX) && typeof value === 'string');
    if (!entries.length) throw new Error('No Mortgage Manager data was found in this backup.');

    const confirmed = window.confirm('Restore this backup? This replaces the Mortgage Manager data currently saved on this device.');
    if (!confirmed) return;

    const existing = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) existing.push(key);
    }
    existing.forEach((key) => localStorage.removeItem(key));
    entries.forEach(([key,value]) => localStorage.setItem(key,String(value)));

    toast('Backup restored · reloading');
    setTimeout(() => location.reload(), 500);
  }

  function maybeFirstRun() {
    const hasSetup = Boolean(localStorage.getItem(SETUP_KEY));
    const hasLegacyMortgage = Boolean(localStorage.getItem('mortgage-manager-v0.4') || localStorage.getItem('mortgage-manager-v0.3') || localStorage.getItem('mortgage-manager-v0.2'));
    if (!hasSetup && !hasLegacyMortgage) setTimeout(openSetup, 450);
  }

  wireSetupMonthInputs();
  setupButton();
  ensureProgressCard();
  ensureDealGuidance();
  renderDealGuidance();
  renderProgress();
  maybeFirstRun();

  let renderTimer = null;
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => { renderProgress(); renderDealGuidance(); }, 120);
  }

  if (window.MortgageStore) {
    window.MortgageStore.subscribe((next, previous) => {
      const changed = ['balance','homeValue','ownership','rate','payment','fixedEnd','currentOverpayment']
        .some((key) => next[key] !== previous[key]);
      if (changed) scheduleRender();
    });
  } else {
    ['balance','homeValue','ownership','rate','payment','fixedEnd','currentOverpayment'].forEach((id) => {
      $(id)?.addEventListener('input', scheduleRender);
    });
  }

  // Keep this month's snapshot in sync only after the month has explicitly been recorded.
  setTimeout(() => {
    const history = loadHistory();
    if (history.some((row) => row.month === monthKey())) recordSnapshot(false);
  }, 700);
})();