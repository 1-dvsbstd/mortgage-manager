(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const money = (value) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(Math.max(0, Number(value)||0));
  const WHATIF_MIGRATION_KEY = 'mortgage-manager-whatif-total-v1';

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

  function parseRateText(id){
    const text=document.getElementById(id)?.textContent || '';
    const value=Number(String(text).replace(/[^0-9.\-]/g,''));
    return Number.isFinite(value) && value>0 ? value : null;
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
    const rounded=Math.round(regular*100)/100;
    const presets=[rounded,100,250,500].filter((value)=>value>=rounded-.01);
    const candidates=presets.length>=3?presets:[rounded,rounded+100,rounded+250,rounded+500];
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

    const value=$('.whatif-regular-value',scenario);
    if(value) value.textContent=`${money(regular)}/month`;

    const buttons=$('#totalOverpayButtons',scenario);
    if(buttons){
      buttons.innerHTML=totalCandidates(regular).map((amount)=>`<button type="button" data-total-overpay="${amount}" class="${Math.abs(amount-total)<.5?'active':''}">${Math.abs(amount-regular)<.5?'Current ':''}${money(amount)}</button>`).join('') + `<label class="custom-chip total-custom-chip">Custom £<input id="totalOverpayCustom" type="number" min="${regular}" step="10" inputmode="decimal" value="${Math.round(total*100)/100}"></label>`;
    }
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
    $('#compactWhatIf')?.remove();
    $('.whatif-current-baseline',scenario)?.remove();

    let inline=$('.whatif-regular-inline',scenario);
    if(!inline){
      inline=document.createElement('div');
      inline.className='whatif-regular-inline';
      inline.innerHTML='<div class="whatif-regular-label"><span>Current regular overpayment</span><strong class="whatif-regular-value">—</strong></div><div class="whatif-regular-live"></div>';
      const range=$('#extraSlider',scenario);
      if(range) range.insertAdjacentElement('beforebegin',inline); else scenario.appendChild(inline);
    }
    const host=$('.whatif-regular-live',inline);
    if(savings&&savings.parentElement!==host) host.appendChild(savings);
    if(regularControl&&regularControl.parentElement!==host){
      regularControl.classList.remove('source-fields-only');
      host.appendChild(regularControl);
    }
    if(oldPanel) oldPanel.remove();

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
    /* Payment scenarios intentionally exclude overpayments. Use the scheduled
       payment path for both the projected deal-end balance and remaining term
       so the current-rate scenario reconciles with today's scheduled payment. */
    const scheduledPayment=Math.max(0,Number(state.payment)||0);
    const path=MortgageMath.amortize(state.balance,state.rate,scheduledPayment);
    const points=path.monthlyPoints||[];
    const index=Math.min(Math.max(0,months),Math.max(0,points.length-1));
    const balance=points[index]??Math.max(0,Number(state.balance)||0);
    const remainingMonths=Number.isFinite(path.months)?Math.max(1,path.months-months):300;
    return {months,balance,remainingMonths,scheduledPayment};
  }

  function paymentScenarioRates(state){
    const current=Math.max(.1,Number(state.rate)||0);
    const twoYear=parseRateText('market2yRate') || parseRateText('deal2yRate');
    const fiveYear=parseRateText('market5yRate') || parseRateText('deal5yRate');
    const known=[current,twoYear,fiveYear].filter(Number.isFinite);
    const low=Math.max(.1,Math.min(...known)-.5);
    const high=Math.max(...known)+.5;
    const raw=[
      {rate:low,label:'Lower test'},
      {rate:current,label:'Current rate'},
      ...(twoYear?[{rate:twoYear,label:'Avg 2-year'}]:[]),
      ...(fiveYear?[{rate:fiveYear,label:'Avg 5-year'}]:[]),
      {rate:high,label:'Higher test'},
    ];
    const seen=new Set();
    return raw.filter((item)=>{
      const key=(Math.round(item.rate*100)/100).toFixed(2);
      if(seen.has(key)) return false;
      seen.add(key); item.rate=Number(key); return true;
    }).sort((a,b)=>a.rate-b.rate);
  }

  function renderUpcomingRates(){
    const state=window.MortgageStore?.get?.();
    const grid=$('#dealPlannerRateGrid');
    if(!state||!grid) return;
    const position=projectedDealPosition(state);
    if(!position) return;
    const rates=paymentScenarioRates(state);
    grid.innerHTML=rates.map(({rate,label})=>{
      const scenarioPayment=paymentFor(position.balance,rate,position.remainingMonths);
      const diff=scenarioPayment-position.scheduledPayment;
      const note=Math.abs(diff)<1?'About the same as your scheduled payment':`${money(Math.abs(diff))}/mo ${diff>0?'more':'less'} than your scheduled payment`;
      const current=label==='Current rate';
      return `<div class="deal-planner-rate ${current?'is-current-rate':''}"><span>${rate.toFixed(2)}% · ${label}</span><strong>${money(scenarioPayment)}<small>/mo</small></strong><em>${note} · without overpayment</em></div>`;
    }).join('');
    const note=$('.deal-planner-note');
    if(note) note.textContent='Payments shown exclude overpayments. They use the projected balance and remaining term on your scheduled-payment path. The centre values use your current rate and the calculated 2-year / 5-year market estimates; outer values are simple stress tests.';
  }

  function refineUpcoming(){
    const shell=$('.app-view-upcoming .upcoming-sections');
    if(!shell) return;
    const timeline=$('.upcoming-timeline',shell), rates=$('.upcoming-rates',shell), position=$('.upcoming-position',shell), action=$('.upcoming-action',shell), interest=$('.upcoming-interest',shell);
    if(!timeline||!rates||!position) return;

    $('.upcoming-section-heading h2',timeline).textContent='Your current fix';
    $('.upcoming-section-heading h2',rates).textContent='What your payment could look like';
    const positionTitle=$('.upcoming-section-heading h2',position);
    const state=window.MortgageStore?.get?.();
    if(positionTitle){
      positionTitle.textContent='Your position at deal end';
      if(state?.fixedEnd){
        const separator=document.createElement('span');
        separator.className='deal-end-title-separator';
        separator.textContent='·';
        const date=document.createElement('span');
        date.className='deal-end-title-date';
        date.textContent=formatMonth(state.fixedEnd);
        positionTitle.append(separator,date);
      }
    }
    const legacyPlannerHeading=$('.deal-planner-heading',position);
    if(legacyPlannerHeading) legacyPlannerHeading.remove();
    shell.querySelectorAll('.upcoming-section-heading .eyebrow').forEach((el)=>el.remove());

    let fixStats=$('.current-fix-stats',timeline);
    if(!fixStats){
      fixStats=document.createElement('div'); fixStats.className='current-fix-stats';
      $('.upcoming-section-body',timeline)?.appendChild(fixStats);
    }
    if(state){
      const total=Math.max(0,Number(state.payment)||0)+Math.max(0,Number(state.currentOverpayment)||0);
      const two=parseRateText('market2yRate'), five=parseRateText('market5yRate');
      fixStats.innerHTML=`<div><span>Current rate</span><strong>${Number(state.rate||0).toFixed(2)}%</strong></div><div><span>Avg 2-year</span><strong>${two?two.toFixed(2)+'%':'—'}</strong></div><div><span>Avg 5-year</span><strong>${five?five.toFixed(2)+'%':'—'}</strong></div><div><span>Total monthly payment</span><strong>${money(total)}</strong></div><div><span>Fix ends</span><strong>${formatMonth(state.fixedEnd)}</strong></div>`;
    }

    if(action){
      const milestone=$('#dealPlannerMilestone',action);
      if(milestone){
        milestone.classList.add('deal-position-milestone');
        if(milestone.parentElement!==$('.upcoming-section-body',position)) $('.upcoming-section-body',position)?.appendChild(milestone);
      }
      action.remove();
    }
    if(interest){
      const box=$('.interest-box',interest);
      if(box){ box.classList.add('deal-position-interest'); $('.upcoming-section-body',position)?.appendChild(box); }
      interest.remove();
    }
    shell.append(timeline,rates,position);

    /* Remove any emptied legacy rate wrapper left behind by the original
       deal-planner markup. Its border-top otherwise renders as a stray
       horizontal rule between the Action and payment cards. */
    shell.closest('.upcoming-workspace')?.querySelectorAll('.deal-planner-rates').forEach((legacy) => {
      if (!legacy.querySelector('#dealPlannerRateGrid') && !legacy.querySelector('.deal-planner-note')) legacy.remove();
    });

    renderUpcomingRates();
  }

  function splitNextHomePlanner(){
    const future=$('.app-view-future .app-view-content'), planner=$('#nextHomePlanner');
    if(!future||!planner) return;
    const body=$('.next-home-body',planner), timeline=$('.next-home-timeline',planner);
    if(!body||!timeline) return;

    const heading=$('.next-home-heading',body);
    if(heading){
      const eyebrow=$('.eyebrow',heading); if(eyebrow) eyebrow.textContent='Next-home position';
      const title=$('h2',heading); if(title) title.textContent='What your current equity could mean today';
    }

    let wait=$('#futureWaitPlanner');
    if(!wait){
      wait=document.createElement('section');
      wait.id='futureWaitPlanner'; wait.className='panel future-wait-planner';
      wait.innerHTML='<div class="future-wait-heading"><p class="eyebrow">Looking ahead</p><h2>How your next-home budget could grow over time</h2></div><div class="future-wait-host"></div>';
      planner.insertAdjacentElement('afterend',wait);
    }
    const host=$('.future-wait-host',wait);
    $('.next-home-subhead',timeline)?.remove();
    if(timeline.parentElement!==host) host.appendChild(timeline);
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
    splitNextHomePlanner();
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
      if(next.currentOverpayment!==previous.currentOverpayment && next.scenarioExtra!==0) MortgageStore.set({scenarioExtra:0});
      requestAnimationFrame(()=>{ renderWhatIfControls(); refineFutureAssumption(); refineUpcoming(); renderUpcomingRates(); });
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{setTimeout(run,780);setTimeout(run,1300);},{once:true});
  else {setTimeout(run,780);setTimeout(run,1300);}
})();