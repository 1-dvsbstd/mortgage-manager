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
    const trend=homeTrend();
    const label=trend===0?'Projected equity':`Projected equity (${trend.toFixed(1)}% home growth)`;
    $$('.chart-panel .legend span').forEach((item)=>{
      if(/Projected equity/i.test(item.textContent||'')){
        const dot=item.querySelector('i');
        item.textContent=label;
        if(dot) item.prepend(dot);
      }
    });
    const subtitle=$('.app-view-current .chart-panel .panel-heading .subtle');
    if(subtitle){
      subtitle.textContent=trend===0
        ? 'Debt falls while equity rises as you repay the mortgage; property value is held flat.'
        : `Debt falls while projected equity also includes ${trend.toFixed(1)}% annual home-value growth.`;
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
  }

  function run(){
    markBuild();
    stripLegacyExpansion();
    makeMarketBenchmarksReadOnly();
    fixDealEndMilestone();
    renameOwnershipLabels();
    updateEquityCopy();
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

  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
