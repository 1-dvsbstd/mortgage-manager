(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const money = (value) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(Math.max(0, Number(value)||0));

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
      const note=Math.abs(diff)<1?'About the same':`${money(Math.abs(diff))}/mo ${diff>0?'more':'less'}`;
      const current=label==='Current rate';
      return `<div class="deal-planner-rate ${current?'is-current-rate':''}"><span>${rate.toFixed(2)}% · ${label}</span><strong>${money(scenarioPayment)}<small>/mo</small></strong><em>${note}</em></div>`;
    }).join('');
    const note=$('.deal-planner-note');
    if(note) note.textContent='Payments exclude overpayments and use your projected deal-end balance and remaining term. Centre rates use your current rate and market benchmarks; outer rates are simple stress tests.';
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
      const summary=$('#dealPlannerSummary',position);
      if(box&&summary){
        box.classList.add('deal-position-interest');
        const label=box.querySelector(':scope > span');
        if(label) label.textContent='Interest remaining on current path';
        summary.appendChild(box);
      }
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
    $('.next-home-settings',planner)?.remove();

    const heading=$('.next-home-heading',body);
    if(heading){
      const eyebrow=$('.eyebrow',heading); if(eyebrow) eyebrow.textContent='Next-home position';
      const title=$('h2',heading); if(title) title.textContent='What your equity could give you today';
      let explainer=$('.next-home-heading-note',heading);
      if(!explainer){
        explainer=document.createElement('p');
        explainer.className='next-home-heading-note';
        const copy=heading.firstElementChild;
        if(copy) copy.appendChild(explainer);
      }
      if(explainer) explainer.textContent='Combines the equity you could take with you and illustrative borrowing from your saved assumptions.';
    }

    let wait=$('#futureWaitPlanner');
    if(!wait){
      wait=document.createElement('section');
      wait.id='futureWaitPlanner'; wait.className='panel future-wait-planner';
      wait.innerHTML='<div class="future-wait-heading"><p class="eyebrow">Looking ahead</p><h2>How your next-home budget could grow over time</h2><p class="future-wait-subtitle">Combines projected home value, your falling mortgage balance and your saved borrowing assumptions.</p></div><div class="future-wait-host"></div>';
      planner.insertAdjacentElement('afterend',wait);
    }
    const host=$('.future-wait-host',wait);
    $('.next-home-subhead',timeline)?.remove();
    if(timeline.parentElement!==host) host.appendChild(timeline);
    planner.classList.add('future-source-only');
  }

  function renderFuturePayoffTargets(){
    const future=$('.app-view-future .app-view-content');
    const state=window.MortgageStore?.get?.();
    if(!future||!state) return;

    let section=$('#futurePayoffTargets');
    if(!section){
      section=document.createElement('section');
      section.id='futurePayoffTargets';
      section.className='panel future-payoff-targets';
      section.innerHTML='<div class="future-payoff-heading"><p class="eyebrow">Mortgage-free targets</p><h2>What would it take to clear the mortgage sooner?</h2><p class="future-payoff-subtitle">Monthly payment needed from today, using your current balance and rate assumption.</p></div><div class="future-payoff-track" id="futurePayoffTrack"></div><p class="future-payoff-note" id="futurePayoffNote"></p>';
      const wait=$('#futureWaitPlanner');
      if(wait) wait.insertAdjacentElement('afterend',section); else future.appendChild(section);
    }

    const balance=Math.max(0,Number(state.balance)||0);
    const rate=Math.max(0,Number(state.rate)||0);
    const scheduled=Math.max(0,Number(state.payment)||0);
    const regular=Math.max(0,Number(state.currentOverpayment)||0);
    const selectedScenario=Math.max(0,Number(state.scenarioExtra)||0);
    const selectedOverpayment=selectedScenario>0?selectedScenario:regular;
    const currentTotal=scheduled+selectedOverpayment;
    const currentPath=window.MortgageMath?.amortize?.(balance,rate,currentTotal);
    const currentMonths=Number(currentPath?.months);
    const targets=[3,5,10];

    const track=$('#futurePayoffTrack',section);
    if(track){
      track.innerHTML=targets.map((years)=>{
        const months=years*12;
        const required=paymentFor(balance,rate,months);
        const already=Number.isFinite(currentMonths)&&currentMonths<=months;
        const extra=Math.max(0,required-currentTotal);
        const level=extra<=100?'is-reachable':extra<=500?'is-stretch':'is-ambitious';
        const status=already?'Already on track':extra<=100?'Close to current plan':extra<=500?'Stretch target':'Ambitious target';
        const secondary=already
          ? 'No increase needed'
          : `+${money(extra)}/month vs selected plan`;
        return `<article class="future-payoff-target ${level} ${already?'is-on-track':''}" data-years="${years}"><span class="future-payoff-year">${years} years</span><strong>${money(required)}<small>/month</small></strong><em>${secondary}</em><div class="future-payoff-status">${status}</div></article>`;
      }).join('');
    }

    const note=$('#futurePayoffNote',section);
    if(note){
      note.textContent=`Your selected plan is ${money(currentTotal)}/month in total (${money(scheduled)} scheduled + ${money(selectedOverpayment)} overpayment). Targets assume the current interest rate stays unchanged, so they are planning figures rather than a mortgage offer.`;
    }
  }

  function organiseFutureFlow(){
    const future=$('.app-view-future .app-view-content');
    if(!future) return;
    const order=[
      $('#futureWaitPlanner'),
      $('#futurePayoffTargets'),
      $('#homeProjection'),
      $('#futureModelRange'),
      $('#nextHomePlanner'),
      $('#propertyCostComparison')
    ].filter(Boolean);
    order.forEach((node)=>future.appendChild(node));
  }

  function refineFuture(){
    const future=$('.app-view-future .app-view-content'), home=$('#homeProjection'), range=$('#homeProfileRange'), planner=$('#nextHomePlanner');
    if(!future||!home) return;
    home.querySelector('.future-estimate')?.remove();
    $('#homeValueHistory',home)?.remove();
    planner?.querySelector('.next-home-settings')?.remove();
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
        rangePanel.innerHTML='<div class="future-model-heading"><p class="eyebrow">Property forecast</p><h2>Where your home value could be heading</h2><p class="future-model-subtitle">Property value only · based on local HPI history</p></div><div class="future-model-range-host"></div>';
        home.insertAdjacentElement('afterend',rangePanel);
      }
      const host=$('.future-model-range-host',rangePanel);
      if(host && range.parentElement!==host) host.appendChild(range);
    }
    splitNextHomePlanner();
    renderFuturePayoffTargets();

    const cost=$('#propertyCostComparison');
    if(cost){
      cost.classList.add('panel','temporal-feature-card','temporal-feature-cost-comparison');
      cost.classList.remove('future-cost-inline');
      const heading=$('.deep-heading h2',cost);
      if(heading) heading.textContent='What the home could be worth versus what it cost you';
      const cards=cost.querySelectorAll('.property-cost-card');
      if(cards.length>=2){
        const value=Number((cards[0].querySelector('strong')?.textContent||'').replace(/[^0-9.-]/g,''))||0;
        const costValue=Number((cards[1].querySelector('strong')?.textContent||'').replace(/[^0-9.-]/g,''))||0;
        let result=cost.querySelector('.long-term-difference-note');
        const grid=cost.querySelector('.property-cost-grid');
        if(!result){
          result=document.createElement('div');
          result.className='long-term-difference-note';
        }
        if(grid && result.nextElementSibling!==grid) grid.insertAdjacentElement('beforebegin',result);
        if(value&&costValue){
          const diff=value-costValue;
          result.innerHTML=`<span>Projected difference</span><strong>${diff>=0?'+':'−'}£${Math.round(Math.abs(diff)).toLocaleString('en-GB')}</strong><small>${diff>=0?'Projected value above known purchase + mortgage cost':'Known purchase + mortgage cost above projected value'}</small>`;
        }
      }
    }
    organiseFutureFlow();
  }

  function run(){
    mergeHomeIntoMortgage();
    refineUpcoming();
    refineFuture();
    const futureReady=
      !!document.querySelector('.app-view-future .app-view-content') &&
      !!document.querySelector('#homeProjection') &&
      !!document.querySelector('#futureModelRange') &&
      !!document.querySelector('#futureWaitPlanner') &&
      !!document.querySelector('#futurePayoffTargets') &&
      !!document.querySelector('#nextHomePlanner.future-source-only') &&
      !document.querySelector('#homeProjection #homeValueHistory');
    if(futureReady) document.documentElement.classList.remove('future-refining');
  }

  if(window.MortgageStore?.subscribe){
    MortgageStore.subscribe((next,previous)=>{
      if(next.currentOverpayment!==previous.currentOverpayment && next.scenarioExtra!==0) MortgageStore.set({scenarioExtra:0});
      requestAnimationFrame(()=>{ refineUpcoming(); renderUpcomingRates(); renderFuturePayoffTargets(); organiseFutureFlow(); });
    });
  }

  const startRefinement=()=>{
    run();
    requestAnimationFrame(run);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',startRefinement,{once:true});
  else startRefinement();
})();