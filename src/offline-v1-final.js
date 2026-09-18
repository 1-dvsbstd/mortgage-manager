(() => {
  const $=(selector,root=document)=>root?.querySelector?.(selector)||null;
  const $$=(selector,root=document)=>[...(root?.querySelectorAll?.(selector)||[])];
  const MARKET_CHOICE_KEY='mortgage-manager-market-choice-v1';
  const HISTORY_KEY='mortgage-manager-mortgage-history-v1';
  const HOME_KEY='mortgage-manager-home-projection-v4';

  function markBuild(){
    const version=$('.brand span');
    if(version) version.textContent='V0.15.25';
    document.documentElement.dataset.mortgageManagerBuild='01525';
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



  function effectiveFixedEnd(){
    const state=window.MortgageStore?.get?.()||{};
    if(state.fixedEnd) return String(state.fixedEnd);
    const h=history(),deals=Array.isArray(h.deals)?h.deals:[];
    return deals.length?String(deals[deals.length-1]?.end||''):'';
  }

  function syncDealEndCopy(){
    const fixedEnd=effectiveFixedEnd();
    if(!fixedEnd) return;
    const fixedDate=monthDate(fixedEnd);
    if(!fixedDate) return;
    const now=new Date(); now.setDate(1); now.setHours(0,0,0,0);
    const months=(fixedDate.getFullYear()-now.getFullYear())*12+(fixedDate.getMonth()-now.getMonth());
    const title=$('#nextEventTitle'), text=$('#nextEventText');
    if(!title||!text) return;
    const formatted=new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'}).format(fixedDate);
    if(months<0){
      title.textContent=`Saved fixed-rate end was ${formatted}`;
      text.textContent='That date has passed. Update your current mortgage deal in Setup & data.';
    }else if(months===0){
      title.textContent='Fixed rate ends this month';
      text.textContent='Your deal is at its next major milestone.';
    }else{
      title.textContent=`Fixed rate ends in ${compactDuration(months)}`;
      text.textContent=months<=6?`${formatted} — worth reviewing remortgage options now.`:`${formatted} is your next key mortgage milestone.`;
    }
  }

  function dedupeFuture(){
    const subhead=$('.app-view-future .next-home-subhead');
    const eyebrow=$('span',subhead);
    if(eyebrow&&/looking ahead/i.test(eyebrow.textContent||'')) eyebrow.remove();
  }

  function markSharedBanners(){
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
    syncDealEndCopy();
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



  function formatMonthLabel(value){
    const date=monthDate(value);
    return date?new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(date):'Select month';
  }

  function closeMonthPicker(){
    $('.month-picker-popover')?.remove();
  }

  function openMonthPicker(input,button){
    closeMonthPicker();
    const current=monthDate(input.value)||new Date();
    let year=current.getFullYear();
    const selected=input.value||'';
    const pop=document.createElement('div');
    pop.className='month-picker-popover';
    pop.setAttribute('role','dialog');
    pop.setAttribute('aria-label','Choose month and year');

    const render=()=>{
      const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      pop.innerHTML=`<div class="month-picker-head"><button type="button" class="month-picker-nav" data-year="-1" aria-label="Previous year">‹</button><strong>${year}</strong><button type="button" class="month-picker-nav" data-year="1" aria-label="Next year">›</button></div><div class="month-picker-grid">${months.map((label,index)=>{const value=`${year}-${String(index+1).padStart(2,'0')}`;return `<button type="button" data-month-value="${value}" class="${value===selected?'is-selected':''}">${label}</button>`;}).join('')}</div><div class="month-picker-footer"><button type="button" class="month-picker-action" data-clear-month>Clear</button><button type="button" class="month-picker-action" data-this-month>This month</button></div>`;
    };
    render();
    document.body.appendChild(pop);
    const rect=button.getBoundingClientRect();
    const popWidth=Math.min(320,window.innerWidth-24);
    const left=Math.max(12,Math.min(window.innerWidth-popWidth-12,rect.left));
    const preferredTop=rect.bottom+8;
    const estimatedHeight=260;
    const top=preferredTop+estimatedHeight>window.innerHeight?Math.max(12,rect.top-estimatedHeight-8):preferredTop;
    pop.style.left=`${left}px`;
    pop.style.top=`${top}px`;

    pop.addEventListener('click',(event)=>{
      const nav=event.target.closest('[data-year]');
      if(nav){year+=Number(nav.dataset.year)||0;render();return;}
      const choice=event.target.closest('[data-month-value]');
      if(choice){
        input.value=choice.dataset.monthValue;
        button.textContent=formatMonthLabel(input.value);
        button.classList.remove('is-empty');
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
        closeMonthPicker();
        button.focus();
        return;
      }
      if(event.target.closest('[data-clear-month]')){
        input.value='';
        button.textContent='Select month';
        button.classList.add('is-empty');
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
        closeMonthPicker();
        button.focus();
        return;
      }
      if(event.target.closest('[data-this-month]')){
        const now=new Date();
        input.value=monthValue(now);
        button.textContent=formatMonthLabel(input.value);
        button.classList.remove('is-empty');
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
        closeMonthPicker();
        button.focus();
      }
    });
  }

  function decorateMonthPickers(root=document){
    $("input[type='month']",root).forEach((input)=>{
      if(input.dataset.customMonthPicker==='true') return;
      input.dataset.customMonthPicker='true';
      const wrap=document.createElement('span');
      wrap.className='month-picker-control';
      input.parentNode.insertBefore(wrap,input);
      wrap.appendChild(input);
      const button=document.createElement('button');
      button.type='button';
      button.className='month-picker-button';
      button.classList.toggle('is-empty',!input.value);
      button.textContent=formatMonthLabel(input.value);
      button.setAttribute('aria-label','Choose month and year');
      wrap.appendChild(button);
      button.addEventListener('click',(event)=>{
        event.preventDefault();
        event.stopPropagation();
        openMonthPicker(input,button);
      });
      input.addEventListener('change',()=>{
        button.textContent=formatMonthLabel(input.value);
        button.classList.toggle('is-empty',!input.value);
      });
    });
  }

  function wireMonthPicker(){
    decorateMonthPickers();
    document.addEventListener('click',(event)=>{
      if(!event.target.closest('.month-picker-popover,.month-picker-button')) closeMonthPicker();
    },true);
    window.addEventListener('resize',closeMonthPicker);
    window.addEventListener('scroll',closeMonthPicker,true);
    const observer=new MutationObserver((mutations)=>{
      for(const mutation of mutations){
        mutation.addedNodes.forEach((node)=>{
          if(node.nodeType===1) decorateMonthPickers(node);
        });
      }
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  const start=()=>{
    wireMonthPicker();
    run();
    window.MortgageStore?.subscribe?.(()=>requestAnimationFrame(run));
    window.addEventListener('pageshow',run);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
