(() => {
  const NEXT_HOME_KEY='mortgage-manager-next-home-v1';
  const VALUE_HISTORY_KEY='mortgage-manager-home-value-history-v1';
  const THEME_KEY='mortgage-manager-theme-v1';
  const themes=[
    {id:'parchment',name:'Parchment',note:'Premium, distinctive and calm.'},
    {id:'warm',name:'Warm',note:'Friendly, approachable and inviting.'},
    {id:'dusk',name:'Dusk',note:'Richer contrast with more character.'},
  ];
  const nextHomeDefaults={householdIncome:'',savings:'',cashBuffer:'',saleCosts:'',purchaseCosts:'',borrowingMultiple:4.5};
  const $=(selector,root=document)=>root.querySelector(selector);
  const money=(value)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Math.max(0,Number(value)||0));
  const monthKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  const monthLabel=(key)=>{const [y,m]=String(key||'').split('-').map(Number);return y&&m?new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'}).format(new Date(y,m-1,1)):'—';};

  function loadNextHome(){
    try{const parsed=JSON.parse(localStorage.getItem(NEXT_HOME_KEY)||'null');return parsed&&typeof parsed==='object'?{...nextHomeDefaults,...parsed}:{...nextHomeDefaults};}catch(_){return {...nextHomeDefaults};}
  }
  function saveNextHome(settings){
    try{localStorage.setItem(NEXT_HOME_KEY,JSON.stringify(settings));}catch(_){}
    const bridge={
      nextHomeIncome:settings.householdIncome,nextHomeSavings:settings.savings,nextHomeBuffer:settings.cashBuffer,
      nextHomeSaleCosts:settings.saleCosts,nextHomePurchaseCosts:settings.purchaseCosts,nextHomeMultiple:settings.borrowingMultiple,
    };
    Object.entries(bridge).forEach(([id,value])=>{
      const input=document.getElementById(id);
      if(!input) return;
      input.value=value??'';
      input.dispatchEvent(new Event('input',{bubbles:true}));
    });
  }

  function loadValueHistory(){
    try{const rows=JSON.parse(localStorage.getItem(VALUE_HISTORY_KEY)||'[]');return Array.isArray(rows)?rows:[];}catch(_){return [];}
  }
  function saveValueHistory(rows){try{localStorage.setItem(VALUE_HISTORY_KEY,JSON.stringify(rows.slice(-120)));}catch(_){} }

  function renderHistory(section){
    const list=$('.setup-value-history-list',section), summary=$('.setup-value-history-summary',section);
    if(!list||!summary) return;
    const rows=loadValueHistory();
    if(!rows.length){summary.textContent='No saved checkpoints yet';list.innerHTML='<p class="setup-empty">Save the current dashboard property value to start a simple monthly history.</p>';return;}
    const first=rows[0],latest=rows[rows.length-1],change=latest.value-first.value;
    summary.textContent=`${rows.length} checkpoint${rows.length===1?'':'s'}`;
    list.innerHTML=rows.slice(-8).reverse().map((row)=>`<div class="setup-history-row"><span>${monthLabel(row.month)}</span><strong>${money(row.value)}</strong><small>${row.source||'Saved value'}</small></div>`).join('')+(rows.length>1?`<div class="setup-history-total"><span>Since ${monthLabel(first.month)}</span><strong>${change>=0?'+':'−'}${money(Math.abs(change))}</strong></div>`:'');
  }

  function addBudgetSection(futurePane,modal){
    if($('.setup-budget-section',futurePane)) return;
    const settings=loadNextHome();
    const section=document.createElement('details');
    section.className='personal-section setup-budget-section';
    section.innerHTML=`<summary><span><strong>Next-home budget assumptions</strong><small>Income, savings, costs and borrowing multiple used for move-budget estimates.</small></span></summary><div class="setup-budget-body"><div class="setup-future-grid">
      <label>Household income (£/year)<input data-budget-field="householdIncome" type="number" min="0" step="1000" inputmode="decimal"></label>
      <label>Savings available (£)<input data-budget-field="savings" type="number" min="0" step="1000" inputmode="decimal"></label>
      <label>Cash buffer to keep (£)<input data-budget-field="cashBuffer" type="number" min="0" step="1000" inputmode="decimal"></label>
      <label>Estimated selling costs (£)<input data-budget-field="saleCosts" type="number" min="0" step="500" inputmode="decimal"></label>
      <label>Estimated purchase costs (£)<input data-budget-field="purchaseCosts" type="number" min="0" step="500" inputmode="decimal"></label>
      <label>Borrowing multiple<input data-budget-field="borrowingMultiple" type="number" min="0" max="10" step="0.1" inputmode="decimal"><span>Planning only; actual lender affordability can differ.</span></label>
    </div></div>`;
    futurePane.appendChild(section);
    section.querySelectorAll('[data-budget-field]').forEach((input)=>{input.value=settings[input.dataset.budgetField]??'';});
    modal.querySelector('[data-action="save"]')?.addEventListener('click',()=>{
      const next={...nextHomeDefaults};
      section.querySelectorAll('[data-budget-field]').forEach((input)=>{next[input.dataset.budgetField]=input.value;});
      saveNextHome(next);
    });
  }

  function addValueHistorySection(futurePane){
    if($('.setup-value-history-section',futurePane)) return;
    const section=document.createElement('section');
    section.className='personal-section setup-value-history-section';
    section.innerHTML='<div class="setup-section-heading"><div><h3>Property value history</h3><p class="setup-value-history-summary">—</p></div><button type="button" class="personal-button setup-save-value">Save current value</button></div><div class="setup-value-history-list"></div>';
    futurePane.appendChild(section);
    $('.setup-save-value',section)?.addEventListener('click',()=>{
      const state=window.MortgageStore?.get?.();
      const value=Math.max(0,Number(state?.homeValue)||0); if(!value)return;
      const rows=loadValueHistory(), month=monthKey(), row={month,value:Math.round(value),source:'Dashboard value',savedAt:new Date().toISOString()};
      const index=rows.findIndex((item)=>item.month===month); if(index>=0)rows[index]=row;else rows.push(row);
      rows.sort((a,b)=>a.month.localeCompare(b.month)); saveValueHistory(rows); renderHistory(section);
    });
    renderHistory(section);
  }

  function applyTheme(theme){
    const id=themes.some((item)=>item.id===theme)?theme:'parchment';
    document.documentElement.dataset.theme=id;
    try{localStorage.setItem(THEME_KEY,id);}catch(_){}
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta) meta.content=id==='warm'?'#f7eee5':id==='dusk'?'#e7e1d4':'#f0ece5';
  }

  function currentTheme(){
    try{return localStorage.getItem(THEME_KEY)||document.documentElement.dataset.theme||'parchment';}catch(_){return document.documentElement.dataset.theme||'parchment';}
  }

  function syncThemeControl(){
    const selected=currentTheme();
    const active=themes.find((theme)=>theme.id===selected)||themes[0];
    const label=document.querySelector('#themeMenuButton .theme-menu-label');
    if(label) label.textContent=`Theme · ${active.name}`;
    document.querySelectorAll('[data-theme-choice]').forEach((item)=>{
      const on=item.dataset.themeChoice===active.id;
      item.classList.toggle('active',on);
      item.setAttribute('aria-checked',String(on));
    });
  }

  function ensureThemeControl(modal=document.querySelector('.personal-modal')){
    if(!modal || modal.querySelector('#themeMenuButton')) return;
    const head=modal.querySelector('.personal-modal-head');
    if(!head) return;

    const utility=document.createElement('div');
    utility.className='setup-utility-row';
    const control=document.createElement('div');
    control.className='theme-menu';
    control.innerHTML=`
      <button type="button" id="themeMenuButton" class="theme-menu-button" aria-haspopup="menu" aria-expanded="false">
        <span class="theme-menu-label">Theme</span><span class="theme-menu-chevron" aria-hidden="true">⌄</span>
      </button>
      <div class="theme-menu-popover" role="menu" hidden>
        ${themes.map((theme)=>`<button type="button" role="menuitemradio" data-theme-choice="${theme.id}" aria-checked="false"><span class="theme-menu-swatch ${theme.id}" aria-hidden="true"><i></i><i></i><i></i></span><span><strong>${theme.name}</strong><small>${theme.note}</small></span></button>`).join('')}
      </div>`;
    utility.appendChild(control);
    head.insertAdjacentElement('afterend',utility);

    const button=control.querySelector('#themeMenuButton');
    const popover=control.querySelector('.theme-menu-popover');
    const close=()=>{popover.hidden=true;button.setAttribute('aria-expanded','false');};
    const open=()=>{popover.hidden=false;button.setAttribute('aria-expanded','true');};

    button.addEventListener('click',(event)=>{
      event.stopPropagation();
      popover.hidden?open():close();
    });
    control.addEventListener('click',(event)=>{
      const choice=event.target.closest('[data-theme-choice]');
      if(!choice)return;
      applyTheme(choice.dataset.themeChoice);
      syncThemeControl();
      close();
    });
    document.addEventListener('click',(event)=>{if(!control.contains(event.target))close();});
    document.addEventListener('keydown',(event)=>{if(event.key==='Escape')close();});
    syncThemeControl();
  }

  function activate(modal,key){
    modal.querySelectorAll('[data-setup-pane]').forEach((pane)=>pane.hidden=pane.dataset.setupPane!==key);
    modal.querySelectorAll('[data-setup-tab]').forEach((button)=>{const active=button.dataset.setupTab===key;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));});
  }

  function organise(){
    const modal=$('.personal-modal');
    if(!modal||modal.dataset.tabbedSetup==='true') return;
    const form=$('.personal-form',modal); if(!form)return;
    modal.dataset.tabbedSetup='true';

    const nav=document.createElement('div'); nav.className='setup-tab-nav'; nav.setAttribute('role','tablist');
    nav.innerHTML='<button type="button" data-setup-tab="current">Current</button><button type="button" data-setup-tab="upcoming">Upcoming</button><button type="button" data-setup-tab="future">Future</button>';
    const current=document.createElement('div'), upcoming=document.createElement('div'), future=document.createElement('div');
    current.className='setup-pane'; upcoming.className='setup-pane'; future.className='setup-pane';
    current.dataset.setupPane='current'; upcoming.dataset.setupPane='upcoming'; future.dataset.setupPane='future';
    const head=$('.personal-modal-head',modal);
    ensureThemeControl(modal);
    const utility=$('.setup-utility-row',modal);
    (utility||head).insertAdjacentElement('afterend',nav);
    nav.after(current,upcoming,future);

    current.appendChild(form);
    const upcomingGrid=document.createElement('div'); upcomingGrid.className='personal-form setup-upcoming-grid'; upcoming.appendChild(upcomingGrid);
    ['rate','fixedEnd'].forEach((key)=>{const input=modal.querySelector(`[data-personal-field="${key}"]`);if(input?.closest('label'))upcomingGrid.appendChild(input.closest('label'));});
    const upcomingIntro=document.createElement('div'); upcomingIntro.className='setup-pane-intro'; upcomingIntro.innerHTML='<p class="eyebrow">Current deal</p><h3>Rate and fixed period</h3><p>These values drive the Upcoming payment and deal-end scenarios.</p>'; upcoming.insertBefore(upcomingIntro,upcomingGrid);

    const currentIntro=document.createElement('div'); currentIntro.className='setup-pane-intro'; currentIntro.innerHTML='<p class="eyebrow">Current position</p><h3>Mortgage and home today</h3><p>Balance, payments, regular overpayment and your current property position.</p>'; current.insertBefore(currentIntro,form);
    const futureIntro=document.createElement('div'); futureIntro.className='setup-pane-intro'; futureIntro.innerHTML='<p class="eyebrow">Future assumptions</p><h3>Property and next-home planning</h3><p>Inputs used only for longer-term projections and planning.</p>'; future.appendChild(futureIntro);

    const sections=[...modal.querySelectorAll('.personal-section')];
    const mortgageHistory=sections.find((section)=>section.classList.contains('mortgage-history-section'));
    const monthly=sections.find((section)=>$('h3',section)?.textContent.trim()==='Monthly history');
    const backup=sections.find((section)=>$('h3',section)?.textContent.trim()==='Backup');
    const methodology=$('#methodologySection',modal);
    if(mortgageHistory) current.appendChild(mortgageHistory);
    if(monthly) current.appendChild(monthly);
    if(backup) current.appendChild(backup);
    if(methodology) upcoming.appendChild(methodology);

    const profile=$('.personal-home-profile-section',modal); if(profile) future.appendChild(profile);
    addBudgetSection(future,modal); addValueHistorySection(future);

    nav.addEventListener('click',(event)=>{const button=event.target.closest('[data-setup-tab]');if(button)activate(modal,button.dataset.setupTab);});
    const initial=['current','upcoming','future'].includes(document.body.dataset.appView)?document.body.dataset.appView:'current';
    activate(modal,initial);
  }

  function organiseAndSettle(){
    setTimeout(organise,0);
    setTimeout(()=>{
      organise();
      ensureThemeControl(document.querySelector('.personal-modal'));
      const modal=$('.personal-modal');
      const upcoming=modal?.querySelector('[data-setup-pane="upcoming"]');
      const future=modal?.querySelector('[data-setup-pane="future"]');
      const methodology=modal?.querySelector('#methodologySection');
      const profile=modal?.querySelector('.personal-home-profile-section');
      if(upcoming&&methodology&&!upcoming.contains(methodology)) upcoming.appendChild(methodology);
      if(future&&profile&&!future.contains(profile)) future.insertBefore(profile,future.querySelector('.setup-budget-section'));
    },80);
  }

  const button=document.getElementById('personalDataButton');
  if(button) button.addEventListener('click',organiseAndSettle);
  document.addEventListener('mortgage-setup-opened',organiseAndSettle);
})();