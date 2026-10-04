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

  function compactDuration(months){
    const value=Math.max(0,Math.round(Number(months)||0));
    const years=Math.floor(value/12), remainder=value%12;
    if(years&&remainder) return `${years}y ${remainder}m`;
    if(years) return `${years}y`;
    return `${remainder}m`;
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

  function monthlyExtraForDealTarget(state,months,targetBalance){
    if(months<=0||!window.MortgageMath) return null;
    const scheduled=Math.max(0,Number(state.payment)||0);
    const regular=Math.max(0,Number(state.currentOverpayment)||0);
    const projected=(extra)=>{
      const path=MortgageMath.amortize(state.balance,state.rate,scheduled+regular+Math.max(0,Number(extra)||0));
      const points=path.monthlyPoints||[];
      return points[Math.min(Math.max(0,months),Math.max(0,points.length-1))] ?? (Number(state.balance)||0);
    };
    if(projected(0)<=targetBalance) return 0;
    let low=0,high=100;
    while(high<10000&&projected(high)>targetBalance) high*=2;
    if(high>=10000&&projected(high)>targetBalance) return null;
    for(let i=0;i<28;i+=1){
      const mid=(low+high)/2;
      if(projected(mid)<=targetBalance) high=mid; else low=mid;
    }
    return Math.ceil(high);
  }

  function projectedDealPosition(state){
    const months=monthsUntil(state.fixedEnd);
    if(months===null||months<0||!window.MortgageMath) return null;
    const scheduledPayment=Math.max(0,Number(state.payment)||0);
    const regularOverpayment=Math.max(0,Number(state.currentOverpayment)||0);
    const currentTotal=scheduledPayment+regularOverpayment;
    const path=MortgageMath.amortize(state.balance,state.rate,currentTotal);
    const points=path.monthlyPoints||[];
    const index=Math.min(Math.max(0,months),Math.max(0,points.length-1));
    const balance=points[index]??Math.max(0,Number(state.balance)||0);
    const remainingMonths=Number.isFinite(path.months)?Math.max(1,path.months-months):300;
    return {months,balance,remainingMonths,scheduledPayment,regularOverpayment,currentTotal};
  }

  function paymentScenarioRates(state){
    const current=Math.max(.1,Number(state.rate)||0);
    const market=window.MortgageMarket||{};
    const twoYear=Number(market.twoYear)>0?Number(market.twoYear):null;
    const fiveYear=Number(market.fiveYear)>0?Number(market.fiveYear):null;
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
    if(note) note.textContent='Deal-end balance includes your regular overpayment. Payment scenarios show the scheduled mortgage payment at each rate, without assuming a future overpayment. Centre rates use your current rate and market benchmarks; outer rates are simple stress tests.';
  }

  function renderRateTrend(){
    const rates=$('.app-view-upcoming .upcoming-rates');
    const body=$('.upcoming-section-body',rates||document);
    const history=window.MortgageMarket?.history;
    const twoPoints=history?.series?.twoYear?.points||[];
    const fivePoints=history?.series?.fiveYear?.points||[];
    if(!body||twoPoints.length<12||twoPoints.length!==fivePoints.length) return;

    let panel=$('#marketRateTrend',rates);
    if(!panel){
      panel=document.createElement('section');
      panel.id='marketRateTrend';
      panel.className='market-rate-trend market-rate-trend-split';
      const note=$('.deal-planner-note',body);
      if(note) note.insertAdjacentElement('afterend',panel); else body.appendChild(panel);
    }

    const two=twoPoints.map((point)=>Number(point.rate));
    const five=fivePoints.map((point)=>Number(point.rate));
    const all=[...two,...five];
    const dataMin=Math.min(...all),dataMax=Math.max(...all);
    const yMin=Math.max(0,Math.floor((dataMin-.35)*2)/2);
    const yMax=Math.ceil((dataMax+.35)*2)/2;

    const movingAverage=(values,windowSize=6)=>values.map((_,index)=>{
      const from=Math.max(0,index-windowSize+1);
      const slice=values.slice(from,index+1);
      return slice.reduce((sum,value)=>sum+value,0)/slice.length;
    });
    const avg=(items)=>items.reduce((sum,value)=>sum+value,0)/Math.max(1,items.length);
    const directionMeta=(values)=>{
      const delta=avg(values.slice(-6))-avg(values.slice(-12,-6));
      const dir=Math.abs(delta)<.04?'flat':delta<0?'down':'up';
      return {
        delta,
        dir,
        symbol:dir==='flat'?'→':dir==='down'?'↓':'↑',
        label:dir==='flat'?'Broadly flat':dir==='down'?'Averaging down':'Averaging up'
      };
    };

    const width=520,height=190,pad={left:38,right:14,top:12,bottom:24};
    const x=(index,count)=>pad.left+(width-pad.left-pad.right)*(index/Math.max(1,count-1));
    const y=(value)=>pad.top+(height-pad.top-pad.bottom)*(1-(value-yMin)/(yMax-yMin));
    const path=(values)=>values.map((value,index)=>`${index?'L':'M'} ${x(index,values.length).toFixed(1)} ${y(value).toFixed(1)}`).join(' ');
    const yTicks=[yMin,(yMin+yMax)/2,yMax];
    const yearIndices=[];
    twoPoints.forEach((point,index)=>{ if(point.date.slice(5,7)==='01') yearIndices.push(index); });
    if(!yearIndices.includes(0)) yearIndices.unshift(0);
    if(!yearIndices.includes(twoPoints.length-1)) yearIndices.push(twoPoints.length-1);

    const card=(kind,label,points,values)=>{
      const trend=movingAverage(values);
      const meta=directionMeta(values);
      const linePath=path(values),trendPath=path(trend);
      const latest=values.at(-1);
      return `
        <article class="market-rate-card market-rate-card-${kind}">
          <div class="market-rate-card-head">
            <div>
              <span>${label}</span>
              <strong>${latest.toFixed(2)}%</strong>
              <small>Latest quoted rate</small>
            </div>
            <div class="market-rate-card-direction" data-direction="${meta.dir}">
              <strong>${meta.symbol} ${meta.label}</strong>
              <small>${Math.abs(meta.delta).toFixed(2)} pts vs prior 6 months</small>
            </div>
          </div>
          <div class="market-rate-card-chart">
            <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Five-year history of ${label.toLowerCase()} mortgage rates">
              ${yTicks.map((tick)=>`<line class="market-rate-grid" x1="${pad.left}" x2="${width-pad.right}" y1="${y(tick).toFixed(1)}" y2="${y(tick).toFixed(1)}"></line><text class="market-rate-y-label" x="${pad.left-7}" y="${(y(tick)+3).toFixed(1)}" text-anchor="end">${tick.toFixed(1)}%</text>`).join('')}
              ${yearIndices.map((index)=>`<text class="market-rate-x-label" x="${x(index,values.length).toFixed(1)}" y="${height-5}" text-anchor="${index===0?'start':index===values.length-1?'end':'middle'}">${new Date(points[index].date+'T12:00:00Z').getUTCFullYear()}</text>`).join('')}
              <path class="market-rate-line" d="${linePath}"></path>
              <path class="market-rate-trendline" d="${trendPath}"></path>
              <circle class="market-rate-end" cx="${x(values.length-1,values.length).toFixed(1)}" cy="${y(latest).toFixed(1)}" r="3.5"></circle>
            </svg>
            <div class="market-rate-card-foot">
              <span>Actual monthly rate</span>
              <span><i></i>6-month trend</span>
              <span>Aug 2026</span>
            </div>
          </div>
        </article>`;
    };

    panel.innerHTML=`
      <div class="market-rate-trend-heading">
        <div>
          <p class="eyebrow">Five-year history</p>
          <h3>How fixed mortgage rates have moved</h3>
          <p>Bank of England quoted household rates · 75% LTV</p>
        </div>
      </div>
      <div class="market-rate-trend-grid">
        ${card('two','2-year fixed',twoPoints,two)}
        ${card('five','5-year fixed',fivePoints,five)}
      </div>
    `;
  }

  function refineUpcoming(){
    const shell=$('.app-view-upcoming .upcoming-sections');
    if(!shell) return;
    const timeline=$('.upcoming-timeline',shell), rates=$('.upcoming-rates',shell), position=$('.upcoming-position',shell);
    if(!timeline||!rates||!position) return;

    document.getElementById('dealActionHint')?.remove();

    const state=window.MortgageStore?.get?.();
    const deal=state?projectedDealPosition(state):null;
    const fixedMonths=state?monthsUntil(state.fixedEnd):null;
    const prepMonths=fixedMonths===null?null:Math.max(0,fixedMonths-3);

    timeline.classList.add('upcoming-hero');
    const timelineHeading=$('.upcoming-section-heading',timeline);
    if(timelineHeading){
      timelineHeading.innerHTML=`
        <div class="upcoming-hero-copy">
          <p class="eyebrow">Remortgage readiness</p>
          <h2>${prepMonths===null?'Add your fixed-rate end date':prepMonths<=0?'Remortgage prep is due now':`Remortgage prep starts in ${compactDuration(prepMonths)}`}</h2>
          <p class="upcoming-hero-subtitle">${state?.fixedEnd?`Your fixed rate ends ${formatMonth(state.fixedEnd)}. Start reviewing rates and affordability from ${formatMonth(new Date(new Date(state.fixedEnd+'-01T12:00:00Z').setUTCMonth(new Date(state.fixedEnd+'-01T12:00:00Z').getUTCMonth()-3)).toISOString().slice(0,7))}.`:'Set your fixed-rate end date so Mortgage Manager can build your remortgage timeline.'}</p>
        </div>
        <div class="upcoming-hero-meta">
          <span>Fixed rate ends</span>
          <strong>${formatMonth(state?.fixedEnd)}</strong>
          <small>${fixedMonths===null?'Date not set':fixedMonths<=0?'Needs attention':`${compactDuration(fixedMonths)} away`}</small>
        </div>`;
    }

    $('.upcoming-hero-snapshot',timeline)?.remove();

    $('.upcoming-section-heading h2',rates).textContent='What your payment could look like';
    const rateEyebrow=$('.upcoming-section-heading .eyebrow',rates);
    if(rateEyebrow) rateEyebrow.textContent='Rate outlook';
    renderRateTrend();

    const positionHeading=$('.upcoming-section-heading',position);
    const positionTitle=$('h2',positionHeading||position);
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
    const positionEyebrow=$('.upcoming-section-heading .eyebrow',position);
    if(positionEyebrow) positionEyebrow.textContent='Deal-end snapshot';

    const legacyPlannerHeading=$('.deal-planner-heading',position);
    if(legacyPlannerHeading) legacyPlannerHeading.remove();

    // Current-fix glance cards are superseded by the new hero snapshot.
    $('.current-fix-stats',timeline)?.remove();


    const summary=$('#dealPlannerSummary',position);
    $('#dealPlannerMilestone',position)?.remove();
    if(summary&&state&&deal){
      const countdown=$('#dealPlannerCountdown')?.closest('div');
      if(countdown&&countdown.parentElement===summary){
        countdown.hidden=true;
        countdown.classList.add('deal-position-countdown-source');
        countdown.style.setProperty('display','none','important');
      }
      let equity=$('#dealPlannerEquity',summary);
      if(!equity){
        equity=document.createElement('div');
        equity.id='dealPlannerEquity';
        equity.className='deal-position-equity';
        equity.innerHTML='<span>Projected equity</span><strong>—</strong><small>Using today’s property value.</small>';
        const interestCard=$('.deal-position-interest',summary);
        if(interestCard) summary.insertBefore(equity,interestCard);
        else summary.appendChild(equity);
      }else{
        const interestCard=$('.deal-position-interest',summary);
        if(interestCard&&equity.nextElementSibling!==interestCard) summary.insertBefore(equity,interestCard);
      }
      const homeValue=Math.max(0,Number(state.homeValue)||0);
      const projectedEquity=Math.max(0,homeValue-Math.max(0,Number(deal.balance)||0));
      $('strong',equity).textContent=homeValue>0?money(projectedEquity):'—';

      const balanceValue=$('#dealPlannerBalance',summary);
      const balanceNote=$('#dealPlannerBalanceNote',summary);
      const ltvValue=$('#dealPlannerLtv',summary);
      const projectedLtv=homeValue>0?deal.balance/homeValue*100:null;
      if(balanceValue) balanceValue.textContent=money(deal.balance);
      if(balanceNote) balanceNote.textContent=deal.regularOverpayment>0
        ? `Includes your ${money(deal.regularOverpayment)}/month regular overpayment.`
        : 'Based on your scheduled monthly payment.';
      if(ltvValue) ltvValue.textContent=projectedLtv===null?'—':`${projectedLtv.toFixed(1)}%`;

      const currentPath=window.MortgageMath?.amortize?.(
        Math.max(0,Number(state.balance)||0),
        Math.max(0,Number(state.rate)||0),
        Math.max(0,Number(state.payment)||0)+Math.max(0,Number(state.currentOverpayment)||0)
      );
      const interestValue=$('#interestRemaining',summary);
      const interestNote=$('#interestWithExtraText',summary);
      if(interestValue) interestValue.textContent=Number.isFinite(currentPath?.interest)?money(currentPath.interest):'—';
      if(interestNote) interestNote.textContent=deal.regularOverpayment>0
        ? `Includes your ${money(deal.regularOverpayment)}/month regular overpayment.`
        : 'Based on your scheduled monthly payment.';

      const milestone=$('#dealPlannerMilestone',position);
      if(milestone&&projectedLtv!==null){
        const targets=[90,85,80,75,70,65,60,50,40,30,20,10];
        const target=targets.find((value)=>projectedLtv>value+.01);
        if(target){
          const targetBalance=homeValue*target/100;
          const gap=Math.max(0,deal.balance-targetBalance);
          const extra=monthlyExtraForDealTarget(state,deal.months,targetBalance);
          milestone.hidden=false;
          const targetEl=$('#dealPlannerTarget',milestone);
          const gapEl=$('#dealPlannerGap',milestone);
          const noteEl=$('#dealPlannerGapNote',milestone);
          if(targetEl) targetEl.textContent=`${target}% LTV`;
          if(gapEl) gapEl.textContent=gap>0?`${money(gap)} away`:'Already on track';
          if(noteEl) noteEl.textContent=gap<=0
            ? `Your current path already reaches ${target}% LTV by deal end.`
            : extra!==null
              ? `About ${money(extra)}/month extra until deal end would target this milestone, assuming today’s property value.`
              : `A balance around ${money(targetBalance)} would equal ${target}% LTV at today’s property value.`;
        }else{
          milestone.hidden=true;
        }
      }
    }

    shell.append(timeline,rates,position);

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
  }

  function organiseFutureFlow(){
    const future=$('.app-view-future .app-view-content');
    if(!future) return;
    const order=[
      $('#futureOverpaymentAssumption'),
      $('#homeProjection'),
      $('#futureModelRange'),
      $('#futureWaitPlanner'),
      $('#nextHomePlanner'),
      $('#propertyCostComparison')
    ].filter(Boolean);
    order.forEach((node)=>future.appendChild(node));
  }

  function refineFuturePresentation(){
    const future=$('.app-view-future');
    if(!future) return;
    const heading=$('.app-view-heading',future);
    const assumption=$('#futureOverpaymentAssumption',future)||$('#futureOverpaymentAssumption');
    if(heading&&assumption){
      heading.classList.add('future-heading-integrated');
      if(assumption.parentElement!==heading) heading.appendChild(assumption);
    }
    const wait=$('#futureWaitPlanner');
    const waitEyebrow=$('.future-wait-heading .eyebrow',wait);
    const waitTitle=$('.future-wait-heading h2',wait);
    if(waitEyebrow) waitEyebrow.textContent='Looking ahead';
    if(waitTitle) waitTitle.textContent='How your next-home budget could grow over time';

    const model=$('#futureModelRange');
    const modelEyebrow=$('.future-model-heading .eyebrow',model);
    const modelTitle=$('.future-model-heading h2',model);
    if(modelEyebrow) modelEyebrow.textContent='Property forecast';
    if(modelTitle) modelTitle.textContent='Where your home value could be heading';
  }

  function refineFuture(){
    const future=$('.app-view-future .app-view-content'), home=$('#homeProjection'), range=$('#homeProfileRange'), planner=$('#nextHomePlanner');
    if(!future||!home) return;
    home.querySelector('.future-estimate')?.classList.add('future-remove');
    $('#homeValueHistory',home)?.classList.add('future-remove');
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

    const cost=$('#propertyCostComparison');
    if(cost){
      cost.classList.add('panel','temporal-feature-card','temporal-feature-cost-comparison');
      cost.classList.remove('future-cost-inline');
    }
    organiseFutureFlow();
    refineFuturePresentation();
  }

  function run(){
    mergeHomeIntoMortgage();
    mergeRegularIntoWhatIf();
    refineUpcoming();
    refineFuture();
    refineFutureAssumption();
    refineFuturePresentation();
  }

  if(window.MortgageStore?.subscribe){
    MortgageStore.subscribe((next,previous)=>{
      if(next.currentOverpayment!==previous.currentOverpayment && next.scenarioExtra!==0) MortgageStore.set({scenarioExtra:0});
      requestAnimationFrame(()=>{ renderWhatIfControls(); refineFutureAssumption(); refineUpcoming(); renderUpcomingRates(); organiseFutureFlow(); });
    });
  }

  document.addEventListener('mortgage-market-rates-updated',()=>{
    requestAnimationFrame(()=>{ renderUpcomingRates(); refineUpcoming(); renderRateTrend(); });
  });

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{setTimeout(run,780);setTimeout(run,1300);},{once:true});
  else {setTimeout(run,780);setTimeout(run,1300);}
})();