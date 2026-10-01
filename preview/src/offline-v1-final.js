(() => {
  const $=(selector,root=document)=>root?.querySelector?.(selector)||null;
  const $$=(selector,root=document)=>[...(root?.querySelectorAll?.(selector)||[])];
  const MARKET_CHOICE_KEY='mortgage-manager-market-choice-v1';
  const HISTORY_KEY='mortgage-manager-mortgage-history-v1';
  const HOME_KEY='mortgage-manager-home-projection-v4';

  function markBuild(){
    const version=$('.brand span');
    if(version) version.textContent='V0.15.21';
    document.documentElement.dataset.mortgageManagerBuild='01521';
  }

  function history(){
    try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'{}')||{};}
    catch(_){return {};}
  }
  function homeTrend(){
    try{const data=JSON.parse(localStorage.getItem(HOME_KEY)||'{}');const n=Number(data.trend);return Number.isFinite(n)?n:2.5;}
    catch(_){return 2.5;}
  }
  function monthDate(value){
    if(!value||!/^\d{4}-\d{2}$/.test(String(value))) return null;
    const [y,m]=String(value).split('-').map(Number); return y&&m?new Date(y,m-1,1):null;
  }
  function monthValue(date){return date?`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`:'';}
  function compactDuration(months){
    const n=Math.max(0,Math.round(Number(months)||0)),y=Math.floor(n/12),m=n%12;
    return y&&m?`${y}y ${m}m`:y?`${y}y`:`${m}m`;
  }

  function stripLegacyExpansion(){
    $$('.app-view [data-expandable-card],.app-view .is-expanded').forEach((card)=>{
      card.classList.remove('expandable-card','is-expanded');
      card.removeAttribute('data-expandable-card');
      card.removeAttribute('tabindex');
      card.removeAttribute('aria-expanded');
      card.querySelectorAll('[data-expand-card],.expand-hint,.card-close-bar').forEach((el)=>el.remove());
    });
    document.body.classList.remove('card-open');
    $('.card-backdrop')?.remove();
  }

  function makeMarketBenchmarksReadOnly(){
    try{localStorage.removeItem(MARKET_CHOICE_KEY);}catch(_){}
    $$('.live-rate-card').forEach((card)=>{
      card.classList.remove('is-selected');
      card.removeAttribute('role');
      card.removeAttribute('tabindex');
      card.removeAttribute('aria-pressed');
      card.removeAttribute('data-market-choice');
    });
    $$('.live-rate-selected-summary,.live-rate-selection-note').forEach((node)=>node.remove());
  }

  function fixDealEndMilestone(){
    const milestone=$('#dealPlannerMilestone');
    const target=$('#dealPlannerTarget');
    if(!milestone||!target) return;
    const text=String(target.textContent||'').trim();
    if(!text||/undefined|nan/i.test(text)){
      milestone.hidden=true;
      return;
    }
    const value=Number(text.replace(/[^0-9.\-]/g,''));
    if(!Number.isFinite(value)||value<=0) milestone.hidden=true;
  }

  function renameOwnershipLabels(){
    $$('.personal-modal label').forEach((label)=>{
      const text=(label.textContent||'').replace(/\s+/g,' ').trim();
      let replacement='';
      if(/^Property share owned \(%\)/i.test(text)) replacement='Current ownership share (%)';
      if(/^Share owned at purchase \(%\)/i.test(text)) replacement='Ownership share at purchase (%)';
      if(!replacement) return;
      const node=[...label.childNodes].find((item)=>item.nodeType===Node.TEXT_NODE&&item.textContent.trim());
      if(node) node.textContent=`${replacement} `;
    });
  }

  function updateEquityCopy(){
    const assumption=$('.app-view-current .trajectory-assumption-note');
    if(assumption) assumption.textContent=`Projection assumes ${homeTrend().toFixed(1)}% annual home-value growth`;
  }

  function renderJourney(){
    const strip=$('.v15-journey-strip');
    const state=window.MortgageStore?.get?.();
    if(!strip||!state) return;
    const h=history(),deals=Array.isArray(h.deals)?h.deals:[],currentDeal=deals.length?deals[deals.length-1]:null;
    const purchase=h.purchaseDate||'';
    const dealStart=currentDeal?.start||'';
    const fixedEnd=state.fixedEnd||currentDeal?.end||'';
    let remortgage='';
    const fixedDate=monthDate(fixedEnd);
    if(fixedDate){const d=new Date(fixedDate);d.setMonth(d.getMonth()-3);remortgage=monthValue(d);}
    const totalPayment=Math.max(0,Number(state.payment)||0)+Math.max(0,Number(state.currentOverpayment)||0);
    const path=window.MortgageMath?.amortize?.(state.balance,state.rate,totalPayment);
    const payoffDate=Number.isFinite(path?.months)?(()=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+path.months);return d;})():null;

    const raw=[
      {icon:'⌂',title:'Home purchased',date:monthDate(purchase)},
      {icon:'%',title:'Current deal',date:monthDate(dealStart)},
      {icon:'↔',title:'Remortgage window',date:monthDate(remortgage)},
      {icon:'▣',title:'Fixed rate ends',date:fixedDate},
      {icon:'⚑',title:'Mortgage free',date:payoffDate},
    ];
    const withDates=raw.filter((step)=>step.date).sort((a,b)=>a.date-b.date);
    const withoutDates=raw.filter((step)=>!step.date);
    const steps=[...withDates,...withoutDates];
    const now=new Date(); now.setDate(1); now.setHours(0,0,0,0);
    let nextIndex=steps.findIndex((step)=>step.date&&step.date>now);
    if(nextIndex<0) nextIndex=steps.length-1;
    let lastComplete=-1;
    steps.forEach((step,index)=>{if(step.date&&step.date<=now) lastComplete=index;});
    const progress=steps.length>1&&lastComplete>=0?Math.max(0,Math.min(100,lastComplete/(steps.length-1)*100)):0;
    strip.style.setProperty('--journey-progress',`${progress}%`);
    const html=steps.map((step,index)=>{
      const status=step.date&&step.date<=now?'is-complete':index===nextIndex?'is-current':'';
      const date=step.date?new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'}).format(step.date):'—';
      return `<div class="v15-journey-step ${status}"><div class="v15-journey-icon">${step.icon}</div><strong>${step.title}</strong><span>${date}</span></div>`;
    }).join('');
    if(strip.innerHTML!==html) strip.innerHTML=html;
    const callout=$('.v15-journey-callout');
    if(callout&&fixedDate){
      const months=(fixedDate.getFullYear()-now.getFullYear())*12+(fixedDate.getMonth()-now.getMonth());
      const text=months<=0?'Your fixed-rate end needs attention':`${compactDuration(months)} to fixed-rate end`;
      if(callout.textContent!==text) callout.textContent=text;
    }
  }

  function futureMoneyValue(text){
    return Number(String(text||'').replace(/[^0-9.-]/g,''))||0;
  }

  function stabiliseFuture(){
    const future=$('.app-view-future .app-view-content');
    if(!future) return;

    const ordered=[
      $('#futureOverpaymentAssumption'),
      $('#homeProjection'),
      $('#nextHomePlanner'),
      $('#futureModelRange'),
      $('#futureWaitPlanner'),
      $('#propertyCostComparison')
    ].filter(Boolean);

    ordered.forEach((node,index)=>{
      const current=[...future.children].filter((child)=>ordered.includes(child));
      if(node.parentElement!==future || current[index]!==node){
        future.appendChild(node);
      }
    });

    const cost=$('#propertyCostComparison');
    if(cost){
      cost.classList.add('panel','temporal-feature-card','temporal-feature-cost-comparison');
      cost.classList.remove('future-cost-inline');
    }

    const rows=[...document.querySelectorAll('#futureWaitPlanner .next-home-timeline-row')].slice(0,3);
    if(rows.length===3){
      const baseline=futureMoneyValue($(':scope > strong',rows[0])?.textContent);
      rows.forEach((row,index)=>{
        row.dataset.years=String(index===0?0:index===1?3:5);
        $(':scope > span',row)?.classList.add('next-home-period');

        let change=$(':scope > .next-home-change',row);
        if(!change){
          change=document.createElement('span');
          change.className='next-home-change';
          const main=$(':scope > strong',row);
          if(main) main.insertAdjacentElement('afterend',change); else row.appendChild(change);
        }
        if(index===0){
          change.classList.add('is-baseline');
          change.textContent='Starting point';
        }else{
          change.classList.remove('is-baseline');
          const value=futureMoneyValue($(':scope > strong',row)?.textContent);
          const delta=value-baseline;
          change.textContent=value&&baseline
            ? `${delta>=0?'+':'−'}£${Math.abs(delta).toLocaleString('en-GB',{maximumFractionDigits:0})} vs today`
            : 'Future position';
        }

        if(!$(':scope > .next-home-support',row)){
          const smalls=[...row.querySelectorAll(':scope > small')];
          if(smalls.length){
            const support=document.createElement('div');
            support.className='next-home-support';
            smalls[0].insertAdjacentElement('beforebegin',support);
            smalls.forEach((small)=>support.appendChild(small));
          }
        }
      });
    }
  }

  function dedupeFuture(){
    const subhead=$('.app-view-future .next-home-subhead');
    const eyebrow=$('span',subhead);
    if(eyebrow&&/looking ahead/i.test(eyebrow.textContent||'')) eyebrow.remove();
  }

  function markSharedBanners(){
    $('.v15-journey-shell')?.classList.add('v1-page-banner');
    $('.deal-action-hint')?.classList.add('v1-page-banner');
    $('#futureOverpaymentAssumption')?.classList.add('v1-page-banner');
  }

  function run(){
    markBuild();
    stripLegacyExpansion();
    makeMarketBenchmarksReadOnly();
    fixDealEndMilestone();
    renameOwnershipLabels();
    updateEquityCopy();
    renderJourney();
    stabiliseFuture();
    dedupeFuture();
    markSharedBanners();
  }

  document.addEventListener('click',(event)=>{
    if(event.target.closest('.live-rate-card')){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true);
  document.addEventListener('keydown',(event)=>{
    if(event.target.closest?.('.live-rate-card')){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true);

  const start=()=>{
    run();
    window.MortgageStore?.subscribe?.(()=>requestAnimationFrame(run));
    window.addEventListener('pageshow',run);

    let futureQueued=false;
    const queueFuture=()=>{
      if(futureQueued) return;
      futureQueued=true;
      requestAnimationFrame(()=>{ futureQueued=false; stabiliseFuture(); });
    };
    const observer=new MutationObserver(queueFuture);
    observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click',(event)=>{
      if(event.target.closest?.('[data-app-view="future"]')) setTimeout(stabiliseFuture,0);
    },true);
    [250,700,1400,2600].forEach((delay)=>setTimeout(stabiliseFuture,delay));
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
