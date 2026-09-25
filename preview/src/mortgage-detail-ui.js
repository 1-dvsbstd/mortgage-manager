(() => {
  const $ = (id) => document.getElementById(id);
  const hero = document.querySelector('.hero-panel');
  const scenario = document.querySelector('.scenario-panel');
  const money = (value) => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Math.max(0,Number(value)||0));
  const compactMonths = (months) => {
    if (!Number.isFinite(months) || months <= 0) return 'No time saved yet';
    const years = Math.floor(months / 12), remainder = months % 12;
    return years && remainder ? `${years}y ${remainder}m sooner` : years ? `${years}y sooner` : `${remainder}m sooner`;
  };
  const state = () => window.MortgageStore?.get?.() || {};

  const configs = {
    balance:{label:'Mortgage remaining',prefix:'£',suffix:''},
    payment:{label:'Monthly payment',prefix:'£',suffix:'/month'},
    rate:{label:'Interest rate',prefix:'',suffix:'%'},
    currentOverpayment:{label:'Regular overpayment',prefix:'£',suffix:'/month'},
    fixedEnd:{label:'Fixed rate ends',prefix:'',suffix:''},
    homeValue:{label:'Property value',prefix:'£',suffix:''},
    ownership:{label:'Property share owned',prefix:'',suffix:'%'}
  };

  function valueFor(target){
    const current = state();
    return Object.prototype.hasOwnProperty.call(current,target) ? current[target] : ($(target)?.value ?? '');
  }

  function formatMonth(value){
    if (!value) return 'Add date';
    const [y,m] = String(value).split('-').map(Number);
    if (!y || !m) return 'Add date';
    return new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'}).format(new Date(y,m-1,1));
  }

  function displayValue(target){
    const v = valueFor(target);
    if(target==='fixedEnd') return formatMonth(v);
    if(target==='rate') return `${Number(v||0).toFixed(2).replace(/\.00$/,'')}%`;
    if(target==='ownership') return `${Number(v||0).toFixed(Number(v||0)%1?1:0)}%`;
    if(['balance','payment','currentOverpayment','homeValue'].includes(target)) return money(v);
    return v||'—';
  }

  function ensureDetailTiles(){
    const row = document.querySelector('.hero-balance-row');
    const deep = document.querySelector('.mortgage-deep-dive');
    if(!row || !deep) return;

    const balanceTile = $('balanceLine')?.parentElement;
    const paymentTile = $('paymentStat')?.parentElement;
    const rateTile = $('rateStat')?.parentElement;
    const overpayTile = $('currentOverpayDisplay')?.closest('.hero-overpay-summary');

    [[balanceTile,'balance'],[paymentTile,'payment'],[rateTile,'rate'],[overpayTile,'currentOverpayment']].forEach(([tile,target])=>{
      if(!tile) return;
      tile.dataset.mortgageTile = target;
      tile.classList.remove('editable-metric','detail-editable');
      tile.removeAttribute('data-edit-target');
    });

    if(!$('mortgageExtraTiles')){
      const extra = document.createElement('div');
      extra.id = 'mortgageExtraTiles';
      extra.className = 'mortgage-extra-tiles expand-detail';
      extra.innerHTML = `
        <div class="mortgage-edit-tile" data-mortgage-tile="fixedEnd"><span>Fixed rate ends</span><strong data-tile-value="fixedEnd">—</strong></div>
        <div class="mortgage-edit-tile" data-mortgage-tile="homeValue"><span>Property value</span><strong data-tile-value="homeValue">—</strong></div>
        <div class="mortgage-edit-tile" data-mortgage-tile="ownership"><span>Property share owned</span><strong data-tile-value="ownership">—</strong></div>`;
      row.insertAdjacentElement('afterend',extra);
    }

    document.querySelector('.edit-panel')?.classList.add('source-fields-only');
    document.querySelector('.current-overpay-control')?.classList.add('source-fields-only');
    syncTileValues();
    syncEditability();
  }

  function syncTileValues(){
    const map = {balance:'balanceLine',payment:'paymentStat',rate:'rateStat'};
    Object.entries(map).forEach(([target,id])=>{ const out=$(id); if(out) out.textContent=displayValue(target); });
    const over = $('currentOverpayDisplay');
    if(over) over.innerHTML=`<span class="current-overpay-amount">${money(valueFor('currentOverpayment'))}</span><span class="current-overpay-suffix">/month</span>`;
    document.querySelectorAll('[data-tile-value]').forEach((el)=>{ el.textContent=displayValue(el.dataset.tileValue); });
  }

  function syncEditability(){
    if(!hero) return;
    const expanded = hero.classList.contains('is-expanded') || hero.getAttribute('aria-expanded')==='true';
    hero.querySelectorAll('[data-mortgage-tile]').forEach((tile)=>{
      if(expanded){
        tile.dataset.summaryEdit=tile.dataset.mortgageTile;
        tile.classList.add('summary-editable');
        tile.setAttribute('role','button');
        tile.setAttribute('tabindex','0');
        tile.setAttribute('aria-label',`Edit ${configs[tile.dataset.mortgageTile]?.label?.toLowerCase()||'mortgage detail'}`);
      } else {
        delete tile.dataset.summaryEdit;
        tile.classList.remove('summary-editable');
        tile.removeAttribute('role');
        tile.removeAttribute('tabindex');
        tile.removeAttribute('aria-label');
      }
    });
  }

  function commit(target,value){
    if(window.MortgageStore){
      window.MortgageStore.set({[target]:target==='fixedEnd'?value:Number(value)});
      window.MortgageStore.applyToDom([target],{dispatch:true});
      return;
    }
    const source=$(target);
    if(!source) return;
    source.value=value;
    source.dispatchEvent(new Event('input',{bubbles:true}));
    source.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function closeQuickEditor(){
    $('summaryQuickEditorBackdrop')?.remove();
    $('summaryQuickEditor')?.remove();
  }

  function openQuickEditor(target){
    closeQuickEditor();
    const source=$(target), config=configs[target];
    if(!source || !config) return;
    const currentValue=valueFor(target);
    const backdrop=document.createElement('div');
    backdrop.id='summaryQuickEditorBackdrop';
    backdrop.className='summary-quick-editor-backdrop';
    const sheet=document.createElement('div');
    sheet.id='summaryQuickEditor';
    sheet.className='summary-quick-editor';
    sheet.setAttribute('role','dialog');
    sheet.setAttribute('aria-modal','true');
    const type=target==='fixedEnd'?'month':(source.type||'number');
    sheet.innerHTML=`
      <div class="summary-quick-editor-head"><div><span>Edit</span><strong>${config.label}</strong></div><button type="button" class="summary-quick-close" aria-label="Close editor">Close</button></div>
      <label class="summary-quick-field"><span>${config.label}</span><div class="summary-quick-input-wrap">${config.prefix?`<i>${config.prefix}</i>`:''}<input type="${type}" inputmode="${source.inputMode||'decimal'}" value="${currentValue}" ${source.min?`min="${source.min}"`:''} ${source.max?`max="${source.max}"`:''} ${source.step?`step="${source.step}"`:''}>${config.suffix?`<i>${config.suffix}</i>`:''}</div></label>
      <div class="summary-quick-actions"><button type="button" class="summary-quick-cancel">Cancel</button><button type="button" class="summary-quick-save">Save</button></div>`;
    document.body.append(backdrop,sheet);
    const input=sheet.querySelector('input');
    const save=()=>{ commit(target,input.value); syncTileValues(); closeQuickEditor(); };
    backdrop.addEventListener('click',closeQuickEditor);
    sheet.querySelector('.summary-quick-close').addEventListener('click',closeQuickEditor);
    sheet.querySelector('.summary-quick-cancel').addEventListener('click',closeQuickEditor);
    sheet.querySelector('.summary-quick-save').addEventListener('click',save);
    input.addEventListener('keydown',(event)=>{ if(event.key==='Enter') save(); if(event.key==='Escape') closeQuickEditor(); });
    requestAnimationFrame(()=>input.focus({preventScroll:true}));
  }

  function ensureCompactSavings(){
    if(!scenario || $('currentSavingsSummary')) return;
    const top=scenario.querySelector('.scenario-top');
    if(!top) return;
    const block=document.createElement('div');
    block.id='currentSavingsSummary';
    block.className='current-savings-summary';
    block.innerHTML='<span>Current savings</span><strong id="currentSavingsMain">—</strong><small id="currentSavingsInterest">—</small>';
    top.appendChild(block);
  }

  function ensureCompactWhatIf(){
    if(!scenario || $('compactWhatIf')) return;
    const originalButtons=$('overpayButtons');
    if(!originalButtons) return;
    const wrap=document.createElement('div');
    wrap.id='compactWhatIf';
    wrap.className='compact-what-if';
    wrap.innerHTML='<div class="compact-what-if-head"><div><span>What if?</span><strong>Try a little more</strong></div><small id="compactWhatIfSummary">Choose an amount to preview the impact.</small></div><div class="compact-what-if-buttons" aria-label="Try an extra monthly overpayment"></div>';
    const buttonRow=wrap.querySelector('.compact-what-if-buttons');
    originalButtons.querySelectorAll('button[data-extra]').forEach((source)=>{
      const button=document.createElement('button');
      button.type='button';
      button.dataset.compactExtra=source.dataset.extra;
      button.textContent=source.textContent;
      button.addEventListener('click',(event)=>{ event.stopPropagation(); source.click(); syncCompactWhatIf(); });
      buttonRow.appendChild(button);
    });
    const detail=scenario.querySelector('.expand-detail');
    if(detail) scenario.insertBefore(wrap,detail); else scenario.appendChild(wrap);
  }

  function syncCompactWhatIf(){
    const wrap=$('compactWhatIf');
    if(!wrap) return;
    const selected=Math.max(0,Number(state().scenarioExtra ?? $('customExtra')?.value)||0);
    wrap.querySelectorAll('button[data-compact-extra]').forEach((button)=>button.classList.toggle('active',Number(button.dataset.compactExtra)===selected));
    const sourceSummary=$('scenarioSummary'), summary=$('compactWhatIfSummary');
    if(summary && sourceSummary) summary.textContent=sourceSummary.textContent || 'Choose an amount to preview the impact.';
  }

  function updateCurrentSavings(){
    ensureCompactSavings();
    ensureCompactWhatIf();
    if(!window.MortgageMath) return;
    const current=state();
    const balance=Math.max(0,Number(current.balance)||0);
    const rate=Math.max(0,Number(current.rate)||0);
    const payment=Math.max(0,Number(current.payment)||0);
    const extra=Math.max(0,Number(current.currentOverpayment)||0);
    const base=MortgageMath.amortize(balance,rate,payment);
    const withCurrent=MortgageMath.amortize(balance,rate,payment+extra);
    const main=$('currentSavingsMain'), interest=$('currentSavingsInterest');
    if(!main || !interest) return;
    if(!extra){ main.textContent='No regular overpayment'; interest.textContent='Add one in the detailed view to see the impact.'; return; }
    if(!Number.isFinite(base.months) || !Number.isFinite(withCurrent.months)){ main.textContent='Saving unavailable'; interest.textContent='Check that the scheduled payment repays the mortgage.'; return; }
    main.textContent=compactMonths(Math.max(0,base.months-withCurrent.months));
    interest.textContent=`${money(Math.max(0,base.interest-withCurrent.interest))} interest saved over the mortgage`;
  }

  function ensureDealRateComparison(){
    const dealDetail=document.querySelector('.next-panel .expand-detail');
    if(!dealDetail || $('dealMarketCompare')) return;
    const block=document.createElement('div');
    block.id='dealMarketCompare';
    block.className='deal-market-compare';
    block.innerHTML='<div class="deep-heading"><div><p class="eyebrow">Rate comparison</p><h2>Your rate vs indicative market averages</h2></div><span class="source-date">Moneyfacts · 1 Sep 2026</span></div><div class="market-comparison"><div class="market-current"><span>Your rate</span><strong id="dealYourRate">—</strong><small id="dealLtvBand">—</small></div><div><span>Avg 2-year fix</span><strong id="deal2yRate">—</strong><small id="deal2yPayment">—</small></div><div><span>Avg 5-year fix</span><strong id="deal5yRate">—</strong><small id="deal5yPayment">—</small></div></div>';
    dealDetail.insertAdjacentElement('afterbegin',block);
  }

  const rateMappings=[['marketCurrentRate','dealYourRate'],['marketLtvBand','dealLtvBand'],['market2yRate','deal2yRate'],['market2yPayment','deal2yPayment'],['market5yRate','deal5yRate'],['market5yPayment','deal5yPayment']];
  function copyRates(){
    rateMappings.forEach(([from,targetId])=>{ const source=$(from), target=$(targetId); if(source && target) target.textContent=source.textContent; });
  }

  function ensurePayoffDateVisible(){
    const line=$('payoffDate');
    if(!line) return;
    line.classList.add('payoff-date-visible');
    if(line.textContent.trim() && line.textContent.trim()!=='—') return;
    if(!window.MortgageMath) return;
    const current=state();
    const path=MortgageMath.amortize(Number(current.balance)||0,Number(current.rate)||0,(Number(current.payment)||0)+(Number(current.currentOverpayment)||0));
    if(!Number.isFinite(path.months)) return;
    const date=new Date();
    date.setMonth(date.getMonth()+path.months);
    line.textContent=`Mortgage-free around ${new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'}).format(date)}`;
  }

  function refresh(){
    ensureDetailTiles();
    syncTileValues();
    syncEditability();
    ensurePayoffDateVisible();
    updateCurrentSavings();
    syncCompactWhatIf();
    copyRates();
  }

  document.addEventListener('click',(event)=>{
    const tile=event.target.closest('[data-summary-edit]');
    if(tile){ event.stopPropagation(); openQuickEditor(tile.dataset.summaryEdit); }
  });
  document.addEventListener('keydown',(event)=>{
    const tile=event.target.closest?.('[data-summary-edit]');
    if(tile && (event.key==='Enter' || event.key===' ')){ event.preventDefault(); openQuickEditor(tile.dataset.summaryEdit); }
  });

  if(window.MortgageStore?.subscribe){
    window.MortgageStore.subscribe((next,previous)=>{
      if(['balance','rate','payment','currentOverpayment','homeValue','ownership','fixedEnd','scenarioExtra'].some((key)=>next[key]!==previous[key])) requestAnimationFrame(refresh);
    });
  }

  if(hero) new MutationObserver(()=>requestAnimationFrame(refresh)).observe(hero,{attributes:true,attributeFilter:['class','aria-expanded']});

  ensureDealRateComparison();
  const sourceSummary=$('scenarioSummary');
  if(sourceSummary) new MutationObserver(syncCompactWhatIf).observe(sourceSummary,{childList:true,characterData:true,subtree:true});
  const rateObserver=new MutationObserver(copyRates);
  rateMappings.forEach(([from])=>{ const el=$(from); if(el) rateObserver.observe(el,{childList:true,characterData:true,subtree:true}); });

  ensureCompactWhatIf();
  refresh();
  requestAnimationFrame(refresh);
})();