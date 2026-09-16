(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const money = (value) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(Math.max(0, Number(value)||0));
  const WHATIF_MIGRATION_KEY = 'mortgage-manager-whatif-total-v1';
  let lastRegular = null;

  function paymentFor(principal, annualRate, months){
    const balance=Math.max(0,Number(principal)||0), term=Math.max(1,Math.round(Number(months)||1));
    const r=Math.max(0,Number(annualRate)||0)/100/12;
    if(!balance) return 0;
    if(!r) return balance/term;
    return balance*r/(1-Math.pow(1+r,-term));
  }

  function monthsUntil(monthValue){
    if(!monthValue) return null;
    const [year,month]=String(monthValue).split('-').map(Number);
    if(!year||!month) return null;
    const now=new Date();
    return (year-now.getFullYear())*12+(month-1-now.getMonth());
  }

  function formatMonth(monthValue){
    if(!monthValue) return 'Not set';
    const [year,month]=String(monthValue).split('-').map(Number);
    if(!year||!month) return 'Not set';
    return new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'}).format(new Date(year,month-1,1));
  }

  function mergeHomeIntoMortgage(){
    const hero=$('.app-view-current .hero-panel'), home=$('.app-view-current .home-panel');
    if(!hero||!home||hero.contains(home)) return;
    const main=$('.hero-main',hero), anchor=$('.hero-balance-row',main||hero);
    home.classList.remove('panel');
    home.classList.add('current-home-inline');
    if(anchor) anchor.insertAdjacentElement('afterend',home); else (main||hero).appendChild(home);
  }

  function totalCandidates(regular){
    let candidates=[regular,100,250,500].filter((value)=>value>=regular-.01);
    if(candidates.length<3) candidates=[regular,regular+100,regular+250,regular+500];
    return [...new Set(candidates.map((value)=>Math.round(value*100)/100))];
  }

  function renderWhatIfControls(){
    const state=window.MortgageStore?.get?.();
    const scenario=$('.trajectory-what-if');
    if(!state||!scenario) return;
    const regular=Math.max(0,Number(state.currentOverpayment)||0);
    const extra=Math.max(0,Number(state.scenarioExtra)||0);
    const total=regular+extra;
    const headline=$('#overpayHeadline',scenario);
    if(headline) headline.textContent=`${money(total)}/month total`;

    const buttons=$('#totalOverpayButtons',scenario);
    if(buttons){
      buttons.innerHTML=totalCandidates(regular).map((value)=>`<button type="button" data-total-overpay="${value}" class="${Math.abs(value-total)<.5?'active':''}">${Math.abs(value-regular)<.5?'Current ':''}${money(value)}</button>`).join('') + `<label class="custom-chip total-custom-chip">Custom £<input id="totalOverpayCustom" type="number" min="${regular}" step="10" inputmode="decimal" value="${Math.round(total*100)/100}"></label>`;
    }

    const baseline=$('.whatif-current-baseline',scenario);
    const label=$('.whatif-baseline-value',baseline||scenario);
    if(label) label.textContent=`${money(regular)}/month`;
  }

  function applyTotalOverpayment(total){
    const state=window.MortgageStore?.get?.();
    if(!state) return;
    const regular=Math.max(0,Number(state.currentOverpayment)||0);
    const nextTotal=Math.max(regular,Number(total)||0);
    MortgageStore.set({scenarioExtra:Math.max(0,nextTotal-regular)});
  }

  function mergeRegularIntoWhatIf(){
    const scenario=$('.trajectory-what-if');
    if(!scenario) return;
    const regularControl=$('.current-overpay-control');
    const savings=$('#currentSavingsSummary');
    const oldPanel=$('#currentOverpaymentPanel');

    let baseline=$('.whatif-current-baseline',scenario);
    if(!baseline){
      baseline=document.createElement('div');
      baseline.className='whatif-current-baseline';
      baseline.innerHTML='<div class="whatif-baseline-copy"><span>Current regular overpayment</span><strong class="whatif-baseline-value">—</strong><small>This is the starting point for the scenarios below.</small></div><div class="whatif-baseline-controls"></div>';
      const range=$('#extraSlider',scenario);
      if(range) range.insertAdjacentElement('beforebegin',baseline); else scenario.appendChild(baseline);
    }
    const host=$('.whatif-baseline-controls',baseline);
    if(savings&&savings.parentElement!==host) host.appendChild(savings);
    if(regularControl&&regularControl.parentElement!==host) host.appendChild(regularControl);
    if(oldPanel && !oldPanel.contains(savings) && !oldPanel.contains(regularControl)) oldPanel.remove();

    const oldRange=$('#extraSlider',scenario), oldButtons=$('#overpayButtons',scenario);
    if(oldRange) oldRange.classList.add('whatif-source-only');
    if(oldButtons) oldButtons.classList.add('whatif-source-only');

    let totalButtons=$('#totalOverpayButtons',scenario);
    if(!totalButtons){
      totalButtons=document.createElement('div');
      totalButtons.id='totalOverpayButtons';
      totalButtons.className='scenario-chips total-overpay-buttons';
      if(oldButtons) oldButtons.insertAdjacentElement('afterend',totalButtons); else scenario.appendChild(totalButtons);
      totalButtons.addEventListener('click',(event)=>{
        const button=event.target.closest('[data-total-overpay]');
        if(button) applyTotalOverpayment(button.dataset.totalOverpay);
      });
      totalButtons.addEventListener('input',(event)=>{
        if(event.target.id==='totalOverpayCustom') applyTotalOverpayment(event.target.value);
      });
    }

    try{
      if(!localStorage.getItem(WHATIF_MIGRATION_KEY)){
        localStorage.setItem(WHATIF_MIGRATION_KEY,'1');
        MortgageStore.set({scenarioExtra:0});
      }
    }catch(_){}
    renderWhatIfControls();
  }

  function refineFutureAssumption(){
    const panel=$('#futureOverpaymentAssumption');
    const state=window.MortgageStore?.get?.();
    if(!panel||!state) return;
    if(panel.dataset.totalMode!=='true'){
      panel.dataset.totalMode='true';
      panel.innerHTML='<div class="future-assumption-copy"><div><span class="future-assumption-label">Planning with</span><strong id="futureExtraSummary">—</strong></div><p>The same total overpayment used on Current.</p></div><div class="future-assumption-controls" id="futureTotalControls"></div>';
      panel.addEventListener('click',(event)=>{
        const button=event.target.closest('[data-future-total]');
        if(button) applyTotalOverpayment(button.dataset.futureTotal);
      });
      panel.addEventListener('input',(event)=>{
        if(event.target.id==='futureTotalCustom') applyTotalOverpayment(event.target.value);
      });
    }
    const regular=Math.max(0,Number(state.currentOverpayment)||0), total=regular+Math.max(0,Number(state.scenarioExtra)||0);
    const summary=$('#futureExtraSummary',panel); if(summary) summary.textContent=`${money(total)}/month total`;
    const controls=$('#futureTotalControls',panel);
    if(controls) controls.innerHTML=totalCandidates(regular).map((value)=>`<button type="button" data-future-total="${value}" class="${Math.abs(value-total)<.5?'active':''}">${Math.abs(value-regular)<.5?'Current ':''}${money(value)}</button>`).join('')+`<label>Custom £<input id="futureTotalCustom" type="number" min="${regular}" step="10" value="${Math.round(total*100)/100}"></label>`;
  }

  function projectedDealPosition(state){
    const months=monthsUntil(state.fixedEnd);
    if(months===null||months<0||!window.MortgageMath) return null;
    const totalPayment=Math.max(0,Number(state.payment)||0)+Math.max(0,Number(state.currentOverpayment)||0);
    const path=MortgageMath.amortize(state.balance,state.rate,totalPayment);
    const points=path.monthlyPoints||[];
    const index=Math.min(Math.max(0,months),Math.max(0,points.length-1));
    const balance=points[index]??Math.max(0,Number(state.balance)||0);
    const remainingMonths=Number.isFinite(path.months)?Math.max(1,path.months-months):300;
    return {months,balance,remainingMonths,totalPayment};
  }

  function renderUpcomingRates(){
    const state=window.MortgageStore?.get?.();
    const grid=$('#dealPlannerRateGrid');
    if(!state||!grid) return;
    const position=projectedDealPosition(state);
    if(!position) return;
    const currentRate=Math.max(.1,Number(state.rate)||0);
    const rates=[currentRate-1,currentRate-.5,currentRate,currentRate+.5,currentRate+1].map((r)=>Math.max(.1,Math.round(r*100)/100));
    grid.innerHTML=rates.map((scenarioRate)=>{
      const scenarioPayment=paymentFor(position.balance,scenarioRate,position.remainingMonths);
      const diff=scenarioPayment-position.totalPayment;
      const note=Math.abs(diff)<1?'About the same as you pay now':`${money(Math.abs(diff))}/mo ${diff>0?'more':'less'} than now`;
      const current=Math.abs(scenarioRate-currentRate)<.01;
      return `<div class="deal-planner-rate ${current?'is-current-rate':''}"><span>${scenarioRate.toFixed(2)}%${current?' · your rate':''}</span><strong>${money(scenarioPayment)}<small>/mo</small></strong><em>${note}</em></div>`;
    }).join('');
    const note=$('.deal-planner-note');
    if(note) note.textContent=`Uses your projected balance at deal end and the remaining term needed to keep the same projected mortgage-free date. Examples sit either side of your saved ${currentRate.toFixed(2)}% rate; they are stress tests, not forecasts or mortgage offers.`;
  }

  function refineUpcoming(){
    const shell=$('.app-view-upcoming .upcoming-sections');
    if(!shell) return;
    const timeline=$('.upcoming-timeline',shell), rates=$('.upcoming-rates',shell), position=$('.upcoming-position',shell), action=$('.upcoming-action',shell), interest=$('.upcoming-interest',shell);
    if(!timeline||!rates||!position) return;

    $('.upcoming-section-heading h2',timeline).textContent='Your current fix';
    $('.upcoming-section-heading h2',rates).textContent='What your payment could look like';
    $('.upcoming-section-heading h2',position).textContent='Your position at deal end';
    shell.querySelectorAll('.upcoming-section-heading .eyebrow').forEach((el)=>el.remove());

    let fixStats=$('.current-fix-stats',timeline);
    if(!fixStats){
      fixStats=document.createElement('div'); fixStats.className='current-fix-stats';
      $('.upcoming-section-body',timeline)?.appendChild(fixStats);
    }
    const state=window.MortgageStore?.get?.();
    if(state){
      const total=Math.max(0,Number(state.payment)||0)+Math.max(0,Number(state.currentOverpayment)||0);
      fixStats.innerHTML=`<div><span>Current rate</span><strong>${Number(state.rate||0).toFixed(2)}%</strong></div><div><span>Total monthly payment</span><strong>${money(total)}</strong></div><div><span>Fix ends</span><strong>${formatMonth(state.fixedEnd)}</strong></div>`;
    }

    if(action){
      const milestone=$('#dealPlannerMilestone',action);
      if(milestone && milestone.parentElement!==$('.upcoming-section-body',position)) $('.upcoming-section-body',position)?.appendChild(milestone);
      action.remove();
    }
    if(interest){
      const box=$('.interest-box',interest);
      if(box){ box.classList.add('deal-position-interest'); $('.upcoming-section-body',position)?.appendChild(box); }
      interest.remove();
    }
    shell.append(timeline,rates,position);
    renderUpcomingRates();
  }

  function refineFuture(){
    const future=$('.app-view-future .app-view-content'), home=$('#homeProjection'), range=$('#homeProfileRange'), planner=$('#nextHomePlanner');
    if(!future||!home) return;
    home.querySelector('.future-estimate')?.classList.add('future-remove');
    $('#homeValueHistory',home)?.classList.add('future-remove');
    planner?.querySelector('.next-home-settings')?.classList.add('future-remove');
    future.querySelectorAll('.future-stage-label').forEach((label)=>label.remove());

    const heading=$('.projection-heading',home);
    if(heading){
      const eyebrow=$('.eyebrow',heading); if(eyebrow) eyebrow.textContent='Property value';
      const title=$('h2',heading); if(title) title.textContent='What your home may be worth today';
    }

    if(range){
      let rangePanel=$('#futureModelRange');
      if(!rangePanel){
        rangePanel=document.createElement('section');
        rangePanel.id='futureModelRange'; rangePanel.className='panel future-model-range-panel';
        rangePanel.innerHTML='<div class="future-model-heading"><p class="eyebrow">Model range</p><h2>How different growth assumptions change today’s estimate</h2></div><div class="future-model-range-host"></div>';
        home.insertAdjacentElement('afterend',rangePanel);
      }
      const host=$('.future-model-range-host',rangePanel);
      if(host && range.parentElement!==host) host.appendChild(range);
    }
  }

  function run(){
    mergeHomeIntoMortgage();
    mergeRegularIntoWhatIf();
    refineUpcoming();
    refineFuture();
    refineFutureAssumption();
  }

  if(window.MortgageStore?.subscribe){
    MortgageStore.subscribe((next,previous)=>{
      if(next.currentOverpayment!==previous.currentOverpayment){
        lastRegular=next.currentOverpayment;
        if(next.scenarioExtra!==0) MortgageStore.set({scenarioExtra:0});
      }
      requestAnimationFrame(()=>{ renderWhatIfControls(); refineFutureAssumption(); refineUpcoming(); renderUpcomingRates(); });
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{setTimeout(run,780);setTimeout(run,1300);},{once:true});
  else {setTimeout(run,780);setTimeout(run,1300);}
})();