(() => {
  const $ = (id) => document.getElementById(id);
  const hero = document.querySelector('.hero-panel');
  const ANCHOR_KEY = 'mortgage-manager-balance-anchor-v1';
  const money = (value) => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Math.max(0,Number(value)||0));

  const configs = {
    balance:{label:'Mortgage remaining',prefix:'£',suffix:''},
    payment:{label:'Monthly payment',prefix:'£',suffix:'/month'},
    rate:{label:'Interest rate',prefix:'',suffix:'%'},
    currentOverpayment:{label:'Regular overpayment',prefix:'£',suffix:'/month'},
    fixedEnd:{label:'Fixed rate ends',prefix:'',suffix:''},
    homeValue:{label:'Property value',prefix:'£',suffix:''},
    ownership:{label:'Property share owned',prefix:'',suffix:'%'}
  };

  const state = () => window.MortgageStore?.get?.() || {};
  const valueFor = (target) => {
    const current = state();
    return Object.prototype.hasOwnProperty.call(current,target) ? current[target] : ($(target)?.value ?? '');
  };

  const formatMonth = (value) => {
    if (!value) return 'Add date';
    const [y,m] = String(value).split('-').map(Number);
    if (!y || !m) return 'Add date';
    return new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'}).format(new Date(y,m-1,1));
  };

  function displayValue(target){
    const v=valueFor(target);
    if(target==='fixedEnd') return formatMonth(v);
    if(target==='rate') return `${Number(v||0).toFixed(2).replace(/\.00$/,'')}%`;
    if(target==='ownership') return `${Number(v||0).toFixed(Number(v||0)%1?1:0)}%`;
    if(['balance','payment','currentOverpayment','homeValue'].includes(target)) return money(v);
    return v||'—';
  }

  function ensureDetailTiles(){
    const row=document.querySelector('.hero-balance-row');
    const deep=document.querySelector('.mortgage-deep-dive');
    if(!row||!deep) return;

    const balanceTile=$('balanceLine')?.parentElement;
    const paymentTile=$('paymentStat')?.parentElement;
    const rateTile=$('rateStat')?.parentElement;
    const overpayTile=$('currentOverpayDisplay')?.closest('.hero-overpay-summary');
    [[balanceTile,'balance'],[paymentTile,'payment'],[rateTile,'rate'],[overpayTile,'currentOverpayment']].forEach(([tile,target])=>{
      if(!tile) return;
      tile.dataset.mortgageTile=target;
      tile.classList.remove('editable-metric','detail-editable');
      tile.removeAttribute('data-edit-target');
    });

    if(!$('mortgageExtraTiles')){
      const extra=document.createElement('div');
      extra.id='mortgageExtraTiles';
      extra.className='mortgage-extra-tiles expand-detail';
      extra.innerHTML=`
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
    const map={balance:'balanceLine',payment:'paymentStat',rate:'rateStat'};
    Object.entries(map).forEach(([target,id])=>{const out=$(id); if(out) out.textContent=displayValue(target);});
    const over=$('currentOverpayDisplay');
    if(over) over.innerHTML=`<span class="current-overpay-amount">${money(valueFor('currentOverpayment'))}</span><span class="current-overpay-suffix">/month</span>`;
    document.querySelectorAll('[data-tile-value]').forEach(el=>{el.textContent=displayValue(el.dataset.tileValue);});
  }

  function syncEditability(){
    if(!hero) return;
    const expanded=hero.classList.contains('is-expanded')||hero.getAttribute('aria-expanded')==='true';
    hero.querySelectorAll('[data-mortgage-tile]').forEach(tile=>{
      if(expanded){
        tile.dataset.summaryEdit=tile.dataset.mortgageTile;
        tile.classList.add('summary-editable');
        tile.setAttribute('role','button');
        tile.setAttribute('tabindex','0');
        tile.setAttribute('aria-label',`Edit ${configs[tile.dataset.mortgageTile]?.label?.toLowerCase()||'mortgage detail'}`);
      }else{
        delete tile.dataset.summaryEdit;
        tile.classList.remove('summary-editable');
        tile.removeAttribute('role'); tile.removeAttribute('tabindex'); tile.removeAttribute('aria-label');
      }
    });
  }

  function saveBalanceAnchor(value){
    try{const now=new Date();const month=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;localStorage.setItem(ANCHOR_KEY,JSON.stringify({balance:Math.max(0,Number(value)||0),month}));}catch(_){ }
  }

  function commit(target,value){
    if(window.MortgageStore){
      window.MortgageStore.set({[target]:target==='fixedEnd'?value:Number(value)});
      window.MortgageStore.applyToDom([target],{dispatch:true});
    }else{
      const source=$(target); if(!source)return;
      source.value=value;
      source.dispatchEvent(new Event('input',{bubbles:true}));
      source.dispatchEvent(new Event('change',{bubbles:true}));
    }
    if(target==='balance') saveBalanceAnchor(value);
  }

  function closeQuickEditor(){ $('summaryQuickEditorBackdrop')?.remove(); $('summaryQuickEditor')?.remove(); }

  function openQuickEditor(target){
    closeQuickEditor();
    const source=$(target), config=configs[target];
    if(!source||!config) return;
    const currentValue=valueFor(target);
    const backdrop=document.createElement('div'); backdrop.id='summaryQuickEditorBackdrop'; backdrop.className='summary-quick-editor-backdrop';
    const sheet=document.createElement('div'); sheet.id='summaryQuickEditor'; sheet.className='summary-quick-editor'; sheet.setAttribute('role','dialog'); sheet.setAttribute('aria-modal','true');
    const type=target==='fixedEnd'?'month':(source.type||'number');
    sheet.innerHTML=`
      <div class="summary-quick-editor-head"><div><span>Edit</span><strong>${config.label}</strong></div><button type="button" class="summary-quick-close" aria-label="Close editor">Close</button></div>
      <label class="summary-quick-field"><span>${config.label}</span><div class="summary-quick-input-wrap">${config.prefix?`<i>${config.prefix}</i>`:''}<input type="${type}" inputmode="${source.inputMode||'decimal'}" value="${currentValue}" ${source.min?`min="${source.min}"`:''} ${source.max?`max="${source.max}"`:''} ${source.step?`step="${source.step}"`:''}>${config.suffix?`<i>${config.suffix}</i>`:''}</div></label>
      <div class="summary-quick-actions"><button type="button" class="summary-quick-cancel">Cancel</button><button type="button" class="summary-quick-save">Save</button></div>`;
    document.body.append(backdrop,sheet);
    const input=sheet.querySelector('input');
    const save=()=>{commit(target,input.value);syncTileValues();closeQuickEditor();};
    backdrop.addEventListener('click',closeQuickEditor); sheet.querySelector('.summary-quick-close').addEventListener('click',closeQuickEditor); sheet.querySelector('.summary-quick-cancel').addEventListener('click',closeQuickEditor); sheet.querySelector('.summary-quick-save').addEventListener('click',save);
    input.addEventListener('keydown',e=>{if(e.key==='Enter')save();if(e.key==='Escape')closeQuickEditor();});
    requestAnimationFrame(()=>{input.focus({preventScroll:true});});
  }

  function ensurePayoffDateVisible(){
    const line=$('payoffDate'); if(!line) return;
    line.classList.add('payoff-date-visible');
    if(line.textContent.trim() && line.textContent.trim()!=='—') return;
    if(!window.MortgageMath) return;
    const current=state();
    const balance=Number(current.balance)||0, rate=Number(current.rate)||0, payment=Number(current.payment)||0, over=Number(current.currentOverpayment)||0;
    const path=MortgageMath.amortize(balance,rate,payment+over);
    if(!Number.isFinite(path.months)) return;
    const d=new Date(); d.setMonth(d.getMonth()+path.months);
    line.textContent=`Mortgage-free around ${new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'}).format(d)}`;
  }

  function getTrendRate(){try{const s=JSON.parse(localStorage.getItem('mortgage-manager-home-projection-v4')||'{}');const n=Number(s.trend);return Number.isFinite(n)?n:2.5;}catch(_){return 2.5;}}
  function balanceAt(points,month){if(!points?.length)return 0;return points[Math.min(Math.max(0,month),points.length-1)]??0;}
  function renderEquityRows(){
    const grid=$('equityGrowthGrid'); if(!grid||!window.MortgageMath)return; grid.classList.add('equity-progress-list');
    const current=state();
    const balance=Math.max(0,Number(current.balance)||0),rate=Math.max(0,Number(current.rate)||0),payment=Math.max(0,Number(current.payment)||0),regularOverpay=Math.max(0,Number(current.currentOverpayment)||0),home=Math.max(0,Number(current.homeValue)||0),ownership=Math.min(100,Math.max(0,Number(current.ownership)||0));
    const path=MortgageMath.amortize(balance,rate,payment+regularOverpay); if(!home||!ownership||!Number.isFinite(path.months))return;
    const trend=getTrendRate(), candidates=[{m:0,label:'Now'},{m:12,label:'1 year'},{m:60,label:'5 years'},{m:120,label:'10 years'},{m:path.months,label:`${new Date(new Date().setMonth(new Date().getMonth()+path.months)).getFullYear()} · Mortgage-free`}], seen=new Set(), points=candidates.filter(({m})=>m<=path.months&&!seen.has(m)&&seen.add(m));
    grid.innerHTML=points.map(({m,label})=>{const futureHome=home*Math.pow(1+trend/100,m/12),shareValue=futureHome*ownership/100,mortgage=balanceAt(path.monthlyPoints,m),equity=Math.max(0,shareValue-mortgage),pct=shareValue>0?Math.min(100,Math.max(0,equity/shareValue*100)):0;return `<div class="equity-progress-row"><div class="equity-progress-top"><span>${label}</span><strong>${pct.toFixed(0)}%</strong></div><div class="equity-progress-track"><i style="width:${pct.toFixed(1)}%"></i></div><div class="equity-progress-meta"><b>${money(equity)} equity</b><small>${money(mortgage)} mortgage · ${money(shareValue)} share value</small></div></div>`;}).join('');
    const assumption=$('equityGrowthAssumption');if(assumption)assumption.textContent=`${trend.toFixed(1)}%/yr home-value trend`;
  }

  const refresh=()=>requestAnimationFrame(()=>{syncTileValues();ensurePayoffDateVisible();renderEquityRows();});

  document.addEventListener('click',e=>{const tile=e.target.closest('[data-summary-edit]');if(!tile)return;e.stopPropagation();openQuickEditor(tile.dataset.summaryEdit);});
  document.addEventListener('keydown',e=>{const tile=e.target.closest?.('[data-summary-edit]');if(tile&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openQuickEditor(tile.dataset.summaryEdit);}});
  document.addEventListener('input',e=>{if(e.target.matches('#projectionTrendRate'))refresh();});

  if(window.MortgageStore?.subscribe){
    window.MortgageStore.subscribe((next,previous)=>{
      if(['balance','rate','payment','currentOverpayment','homeValue','ownership','fixedEnd'].some(key=>next[key]!==previous[key])) refresh();
    });
  }

  if(hero)new MutationObserver(()=>requestAnimationFrame(()=>{ensureDetailTiles();syncEditability();ensurePayoffDateVisible();})).observe(hero,{attributes:true,attributeFilter:['class','aria-expanded']});
  ensureDetailTiles(); ensurePayoffDateVisible(); renderEquityRows();
  requestAnimationFrame(()=>{ensureDetailTiles();syncTileValues();syncEditability();ensurePayoffDateVisible();renderEquityRows();});
})();
