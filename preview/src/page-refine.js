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
      ...(twoYear?[{rate:twoYear,label:'Market avg 2-year'}]:[]),
      ...(fiveYear?[{rate:fiveYear,label:'Market avg 5-year'}]:[]),
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
    if(note) note.textContent='Deal-end balance includes your regular overpayment. Payment scenarios use your current rate plus current UK market-average 2- and 5-year fixes; outer rates are simple stress tests. Historical charts below use the Bank of England 75% LTV benchmark.';

    const marketMeta=$('#upcomingMarketMeta');
    if(marketMeta && grid.nextElementSibling!==marketMeta) grid.insertAdjacentElement('afterend',marketMeta);
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
        cue:dir==='flat'?'→':dir==='down'?'↘':'↗',
        label:dir==='flat'?'Broadly flat':dir==='down'?'Averaging down':'Averaging up'
      };
    };

    const width=520,height=190,pad={left:38,right:14,top:12,bottom:24};
    const x=(index,count)=>pad.left+(width-pad.left-pad.right)*(index/Math.max(1,count-1));
    const y=(value)=>pad.top+(height-pad.top-pad.bottom)*(1-(value-yMin)/(yMax-yMin));
    const path=(values)=>values.map((value,index)=>`${index?'L':'M'} ${x(index,values.length).toFixed(1)} ${y(value).toFixed(1)}`).join(' ');
    const yTicks=[yMin,(yMin+yMax)/2,yMax];
    const yearTicks=['2021','2022','2023','2024','2025','2026'];

    const card=(kind,label,points,values)=>{
      const trend=movingAverage(values);
      const meta=directionMeta(values);
      const linePath=path(values),trendPath=path(trend);
      const latest=values.at(-1);
      const latestPoint=points.at(-1);
      const latestMonth=latestPoint?.date ? formatMonth(String(latestPoint.date).slice(0,7)) : 'Latest historical point';
      const seriesMin=Math.min(...values);
      const seriesMax=Math.max(...values);
      const rangePosition=seriesMax>seriesMin ? (latest-seriesMin)/(seriesMax-seriesMin) : .5;
      const fromLow=Math.round(rangePosition*100);
      const belowHigh=Math.round((1-rangePosition)*100);
      const rangeLabel=belowHigh<=fromLow ? `${belowHigh}% below 5-year high` : `${fromLow}% above 5-year low`;
      return `
        <article class="market-rate-card market-rate-card-${kind}">
          <div class="market-rate-card-head">
            <div class="market-rate-card-history">
              <span>${label}</span>
              <strong>${latestMonth}</strong>
              <small>Historical benchmark · ${latest.toFixed(2)}%</small>
            </div>
            <div class="market-rate-card-direction" data-direction="${meta.dir}">
              <span>Recent trend</span>
              <strong><b class="market-rate-direction-cue">${meta.cue}</b>${meta.label}</strong>
              <small>${Math.abs(meta.delta).toFixed(2)}pp vs prior 6 months · ${rangeLabel}</small>
            </div>
          </div>
          <div class="market-rate-card-chart">
            <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Five-year history of ${label.toLowerCase()} mortgage rates">
              ${yTicks.map((tick)=>`<line class="market-rate-grid" x1="${pad.left}" x2="${width-pad.right}" y1="${y(tick).toFixed(1)}" y2="${y(tick).toFixed(1)}"></line><text class="market-rate-y-label" x="${pad.left-7}" y="${(y(tick)+3).toFixed(1)}" text-anchor="end">${tick.toFixed(1)}%</text>`).join('')}
              ${yearTicks.map((label,index)=>{ const tx=pad.left+(width-pad.left-pad.right)*(index/(yearTicks.length-1)); return `<text class="market-rate-x-label" x="${tx.toFixed(1)}" y="${height-5}" text-anchor="${index===0?'start':index===yearTicks.length-1?'end':'middle'}">${label}</text>`; }).join('')}
              <path class="market-rate-line" d="${linePath}"></path>
              <path class="market-rate-trendline" d="${trendPath}"></path>
              <circle class="market-rate-end" cx="${x(values.length-1,values.length).toFixed(1)}" cy="${y(latest).toFixed(1)}" r="3.5"></circle>
            </svg>
            <div class="market-rate-card-foot">
              <span>Monthly rate</span>
              <span><i></i>6-month trend</span>
            </div>
          </div>
        </article>`;
    };

    panel.innerHTML=`
      <div class="market-rate-trend-heading">
        <div>
          <p class="eyebrow">Historical context</p>
          <h3>How fixed mortgage rates have moved</h3>
          <p>Bank of England quoted household rates · 75% LTV · latest historical point ${formatMonth(String(twoPoints.at(-1)?.date||'').slice(0,7))}. Current scenarios above use Moneyfacts.</p>
        </div>
      </div>
      <div class="market-rate-trend-grid">
        ${card('two','2-year fixed',twoPoints,two)}
        ${card('five','5-year fixed',fivePoints,five)}
      </div>
      <div class="market-rate-history-source">
        <span>Historical benchmark</span>
        <strong>Bank of England · ${formatMonth(String(twoPoints.at(-1)?.date||'').slice(0,7))}</strong>
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
    $('.v15-journey-callout',timeline)?.remove();

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
    const timeline=$('.next-home-timeline',planner);
    if(!timeline) return;
    $('.next-home-settings',planner)?.remove();

    let wait=$('#futureWaitPlanner');
    if(!wait){
      wait=document.createElement('section');
      wait.id='futureWaitPlanner';
      wait.className='panel future-wait-planner future-next-home-hero option-c';
      wait.innerHTML=`
        <div class="future-next-home-c-header">
          <div>
            <p class="eyebrow">Next-home planning</p>
            <h2>Your next-home budget</h2>
            <p class="future-wait-subtitle">See how your equity, savings and borrowing power could shape your next move — today or over time.</p>
          </div>
        </div>

        <div class="future-next-home-c-stage">
          <div class="future-next-home-time-rail">
            <span>Plan for</span>
            <div class="future-next-home-controls" role="tablist" aria-label="Next-home planning horizon"></div>
          </div>

          <div class="future-budget-donut-wrap">
            <div class="future-budget-chart-shell">
              <canvas id="futureBudgetChart" class="future-budget-chart" aria-label="Next-home budget composition"></canvas>
              <div class="future-budget-chart-centre" aria-hidden="true">
                <span>Estimated next-home budget</span>
                <strong id="futureBudgetDonutValue">—</strong>
                <small id="futureBudgetDonutPeriod">—</small>
                <b id="futureBudgetDonutDelta">—</b>
              </div>
            </div>
          </div>

          <div class="future-next-home-c-labels">
            <div class="future-next-home-c-callout callout-equity" id="futureCalloutEquity"></div>
            <div class="future-next-home-c-callout callout-borrowing" id="futureCalloutBorrowing"></div>
            <div class="future-next-home-c-callout callout-savings" id="futureCalloutSavings"></div>
            <div class="future-next-home-c-callout callout-repayment is-repayment" id="futureCalloutRepayment"></div>
          </div>
        </div>

        <div class="future-wait-source" hidden></div>`;
      planner.insertAdjacentElement('afterend',wait);
    }

    const source=$('.future-wait-source',wait);
    if(timeline.parentElement!==source) source.appendChild(timeline);
    planner.classList.add('future-source-only');

    const parseMoney=(text)=>Number(String(text||'').replace(/[^0-9.-]/g,''))||0;
    const monthlyPayment=(principal,annualRate,months)=>{
      const p=Math.max(0,Number(principal)||0);
      const n=Math.max(1,Number(months)||360);
      const monthly=Math.max(0,Number(annualRate)||0)/1200;
      if(!p) return 0;
      if(!monthly) return p/n;
      return p*monthly/(1-Math.pow(1+monthly,-n));
    };
    const moneyShort=(value)=>money(Math.round(Math.max(0,Number(value)||0)));

    const renderCallout=(root,label,valueText,share,note,index)=>{
      if(!root) return;
      root.innerHTML=`
        <div class="future-callout-title"><i data-index="${index}"></i><span>${label}</span></div>
        <strong>${valueText}</strong>
        <small>${share!==null?`${share}% of budget`:note}</small>`;
    };

    const renderHero=()=>{
      const rows=[...timeline.querySelectorAll('.next-home-timeline-row')];
      if(!rows.length) return;

      const data=rows.map((row)=>{
        const years=Number(row.dataset.years)||0;
        const period=row.querySelector('.next-home-period')?.textContent?.trim()||(years===0?'Today':`In ${years} years`);
        const budget=row.querySelector(':scope > strong')?.textContent?.trim()||'—';
        const change=row.querySelector('.next-home-change')?.textContent?.trim()||'';
        const supports=[...row.querySelectorAll('.next-home-support small')].map((item)=>{
          const text=item.textContent.trim();
          const valueText=item.querySelector('b')?.textContent?.trim()||'';
          const label=text.replace(valueText,'').trim();
          return {label,valueText,value:parseMoney(valueText)};
        }).filter((item)=>item.value>0);
        return {years,period,budget,budgetValue:parseMoney(budget),change,supports};
      });

      let selected=Number(wait.dataset.selectedYears);
      if(!data.some((item)=>item.years===selected)) selected=data.some((item)=>item.years===0)?0:data[0].years;
      wait.dataset.selectedYears=String(selected);
      const active=data.find((item)=>item.years===selected)||data[0];

      const controls=$('.future-next-home-controls',wait);
      if(controls) controls.innerHTML=data.map((item)=>`<button type="button" role="tab" aria-selected="${item.years===selected?'true':'false'}" data-next-home-years="${item.years}">${item.years===0?'Today':`In ${item.years} years`}</button>`).join('');

      $('#futureBudgetDonutValue',wait).textContent=active.budget;
      $('#futureBudgetDonutPeriod',wait).textContent=active.period;
      const deltaText=active.years===0?'Available today':active.change.replace(/\s+vs today$/i,' vs today');
      $('#futureBudgetDonutDelta',wait).textContent=deltaText;

      const totalParts=active.supports.reduce((sum,item)=>sum+item.value,0)||1;
      const chartCanvas=$('#futureBudgetChart',wait);
      const chartValues=active.supports.map((item)=>item.value);
      const chartLabels=active.supports.map((item)=>item.label.replace(/^illustrative\s+/i,''));
      const styles=getComputedStyle(document.documentElement);
      const equityColour=(styles.getPropertyValue('--accent-strong')||'#617663').trim();
      const chartColours=[equityColour,'#a88459','#c7bca8'];
      if(chartCanvas && window.Chart){
        if(wait._futureBudgetChart){
          wait._futureBudgetChart.data.labels=chartLabels;
          wait._futureBudgetChart.data.datasets[0].data=chartValues;
          wait._futureBudgetChart.data.datasets[0].backgroundColor=chartColours.slice(0,chartValues.length);
          wait._futureBudgetChart.update();
        }else{
          wait._futureBudgetChart=new Chart(chartCanvas.getContext('2d'),{
            type:'doughnut',
            data:{
              labels:chartLabels,
              datasets:[{
                data:chartValues,
                backgroundColor:chartColours.slice(0,chartValues.length),
                borderColor:'#fbf8f2',
                borderWidth:3,
                hoverBorderWidth:3,
                hoverOffset:4,
                spacing:2
              }]
            },
            options:{
              responsive:true,
              maintainAspectRatio:false,
              cutout:'73%',
              rotation:-90,
              circumference:360,
              animation:{duration:420,easing:'easeOutQuart'},
              interaction:{mode:'nearest',intersect:true},
              plugins:{
                legend:{display:false},
                tooltip:{
                  enabled:true,
                  displayColors:false,
                  padding:10,
                  caretSize:6,
                  callbacks:{
                    title:()=> '',
                    label:(context)=>{
                      const value=Number(context.raw)||0;
                      const total=(context.dataset.data||[]).reduce((sum,item)=>sum+(Number(item)||0),0)||1;
                      const pct=Math.round(value/total*100);
                      return context.label+': '+moneyShort(value)+' · '+pct+'%';
                    }
                  }
                }
              }
            }
          });
        }
      }
      const equity=active.supports.find((item)=>/equity/i.test(item.label));
      const borrowing=active.supports.find((item)=>/borrowing/i.test(item.label));
      const savings=active.supports.find((item)=>/savings/i.test(item.label));
      const share=(item)=>item?Math.round(item.value/totalParts*100):null;

      renderCallout($('#futureCalloutEquity',wait),'Move equity',equity?.valueText||'—',share(equity),null,0);
      renderCallout($('#futureCalloutBorrowing',wait),'Borrowing',borrowing?.valueText||'—',share(borrowing),null,1);
      renderCallout($('#futureCalloutSavings',wait),'Savings',savings?.valueText||'—',share(savings),null,2);

      const mortgageState=window.MortgageStore?.get?.()||{};
      const totalBorrowing=Math.max(0,Number(borrowing?.value)||0);
      const currentBalance=Math.max(0,Number(mortgageState.balance)||0);
      const currentRate=Math.max(.1,Number(mortgageState.rate)||0);
      const currentScheduled=Math.max(0,Number(mortgageState.payment)||0);
      const regularOverpayment=Math.max(0,Number(mortgageState.currentOverpayment)||0);
      const marketRate=(()=>{
        const live=Number(window.MortgageMarket?.fiveYear);
        if(Number.isFinite(live)&&live>0) return live;
        try{
          const cached=JSON.parse(localStorage.getItem('mortgage-manager-market-cache-v1')||'null');
          const rate=Number(cached?.live?.fiveYear);
          if(Number.isFinite(rate)&&rate>0) return rate;
        }catch(_){}
        return 6.00;
      })();
      const planningMonths=360;
      const horizonMonths=Math.max(0,Math.round(active.years*12));
      const fixedMonthsNow=Math.max(0,Number(monthsUntil(mortgageState.fixedEnd))||0);
      const fixedMonthsRemaining=Math.max(0,Math.min(planningMonths,fixedMonthsNow-horizonMonths));

      const existingPath=window.MortgageMath?.amortize?.(
        currentBalance,
        currentRate,
        currentScheduled+regularOverpayment
      );
      const projectedExistingBalance=existingPath?.monthlyPoints?.length
        ? Math.max(0,Number(existingPath.monthlyPoints[Math.min(horizonMonths,existingPath.monthlyPoints.length-1)])||0)
        : currentBalance;

      const portedAmount=Math.min(totalBorrowing,projectedExistingBalance);
      const extraBorrowing=Math.max(0,totalBorrowing-portedAmount);
      const blendedPortRate=fixedMonthsRemaining>0
        ? ((currentRate*fixedMonthsRemaining)+(marketRate*(planningMonths-fixedMonthsRemaining)))/planningMonths
        : marketRate;

      const portedPayment=monthlyPayment(portedAmount,blendedPortRate,planningMonths);
      const extraPayment=monthlyPayment(extraBorrowing,marketRate,planningMonths);
      const repayment=portedPayment+extraPayment;

      const fixedYears=(fixedMonthsRemaining/12);
      const marketYears=((planningMonths-fixedMonthsRemaining)/12);
      let repaymentNote='Add income in Setup & Data';
      if(totalBorrowing>0){
        if(fixedMonthsRemaining>0&&portedAmount>0){
          const fixedLabel=fixedYears%1===0?fixedYears.toFixed(0):fixedYears.toFixed(1);
          const marketLabel=marketYears%1===0?marketYears.toFixed(0):marketYears.toFixed(1);
          repaymentNote=extraBorrowing>0
            ? `${moneyShort(portedAmount)} potentially ported · ${fixedLabel}y at ${currentRate.toFixed(2)}%, then ${marketLabel}y at ${marketRate.toFixed(2)}% · ${moneyShort(extraBorrowing)} extra at ${marketRate.toFixed(2)}%`
            : `${moneyShort(portedAmount)} potentially ported · ${fixedLabel}y at ${currentRate.toFixed(2)}%, then ${marketLabel}y at ${marketRate.toFixed(2)}%`;
        }else{
          repaymentNote=`${moneyShort(totalBorrowing)} over 30 years at today's ${marketRate.toFixed(2)}% 5-year market average · planning assumption, not a forecast`;
        }
      }

      renderCallout(
        $('#futureCalloutRepayment',wait),
        'Illustrative monthly repayment',
        totalBorrowing?moneyShort(repayment)+'/mo':'—',
        null,
        repaymentNote,
        3
      );


    };

    if(!wait.dataset.heroBound){
      wait.dataset.heroBound='true';
      wait.addEventListener('click',(event)=>{
        const button=event.target.closest('[data-next-home-years]');
        if(!button) return;
        wait.dataset.selectedYears=button.dataset.nextHomeYears;
        renderHero();
      });
      const observer=new MutationObserver(()=>requestAnimationFrame(renderHero));
      observer.observe(timeline,{subtree:true,childList:true,characterData:true});
    }
    renderHero();
  }


  function renderFuturePayoffTargets(){
    const future=$('.app-view-future .app-view-content');
    const state=window.MortgageStore?.get?.();
    if(!future||!state) return;

    const plannerKey='mortgage-manager-next-home-v1';
    let plannerSettings={};
    try{ plannerSettings=JSON.parse(localStorage.getItem(plannerKey)||'{}')||{}; }catch(_){}

    let section=$('#futurePayoffTargets');
    if(!section){
      section=document.createElement('section');
      section.id='futurePayoffTargets';
      section.className='panel future-payoff-targets';
      section.innerHTML='<div class="future-payoff-heading"><div><p class="eyebrow">Mortgage-free targets</p><h2>How much of your income would you trade for an earlier mortgage-free date?</h2><p class="future-payoff-subtitle">Use household take-home to compare your current plan with more ambitious repayment levels.</p></div></div><div class="future-payoff-spectrum" id="futurePayoffSpectrum"></div><p class="future-payoff-note" id="futurePayoffNote"></p>';
      const wait=$('#futureWaitPlanner');
      if(wait) wait.insertAdjacentElement('afterend',section); else future.appendChild(section);
    }

    const monthlyTakeHome=Math.max(0,Number(plannerSettings.monthlyTakeHome)||0);
    const balance=Math.max(0,Number(state.balance)||0);
    const rate=Math.max(0,Number(state.rate)||0);
    const scheduled=Math.max(0,Number(state.payment)||0);
    const regular=Math.max(0,Number(state.currentOverpayment)||0);
    const currentTotal=scheduled+regular;

    const payoffDuration=(months)=>{
      if(!Number.isFinite(months)) return 'Does not repay';
      const years=Math.floor(months/12);
      const rem=months%12;
      if(years&&rem) return `${years}y ${rem}m`;
      if(years) return `${years} year${years===1?'':'s'}`;
      return `${rem} month${rem===1?'':'s'}`;
    };

    const payoffDate=(months)=>{
      if(!Number.isFinite(months)) return '';
      const date=new Date();
      date.setMonth(date.getMonth()+months);
      return new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'}).format(date);
    };

    const spectrum=$('#futurePayoffSpectrum',section);
    if(spectrum){
      if(!monthlyTakeHome){
        spectrum.innerHTML='<div class="future-payoff-empty"><strong>Add household take-home in Setup & Data</strong><span>Then this section can compare your current plan with comfortable, typical, stretch and aggressive repayment levels.</span></div>';
      }else{
        const currentPct=Math.max(0,currentTotal/monthlyTakeHome*100);
        const points=[
          {label:'Current',pct:currentPct,payment:currentTotal,className:'is-current'},
          {label:'Comfortable',pct:30,payment:monthlyTakeHome*.30,className:'is-comfortable'},
          {label:'Typical',pct:35,payment:monthlyTakeHome*.35,className:'is-typical'},
          {label:'Stretch',pct:45,payment:monthlyTakeHome*.45,className:'is-stretch'},
          {label:'Aggressive',pct:60,payment:monthlyTakeHome*.60,className:'is-aggressive'}
        ].map((point)=>{
          const path=window.MortgageMath?.amortize?.(balance,rate,point.payment);
          const months=Number(path?.months);
          return {
            ...point,
            months,
            date:payoffDate(months),
            duration:payoffDuration(months),
            delta:point.payment-currentTotal
          };
        });

        const maxPct=Math.max(65,...points.map((point)=>point.pct+3));
        spectrum.innerHTML=`
          <div class="future-payoff-scale">
            <div class="future-payoff-scale-line"></div>
            ${points.map((point,index)=>{
              const left=Math.max(2,Math.min(98,(point.pct/maxPct)*100));
              const side=index%2===0?'is-below':'is-above';
              const delta=point.className==='is-current'
                ? `${point.pct.toFixed(0)}% of take-home`
                : `${point.delta>=0?'+':'−'}${money(Math.abs(point.delta))}/mo`;
              return `
                <article class="future-payoff-marker ${point.className} ${side}" style="left:${left}%">
                  <span class="future-payoff-marker-dot" aria-hidden="true"></span>
                  <div class="future-payoff-marker-card">
                    <span class="future-payoff-marker-label">${point.label}</span>
                    <strong>${point.date}</strong>
                    <small>${point.duration}</small>
                    <b>${money(point.payment)}/mo</b>
                    <em>${delta}</em>
                  </div>
                </article>`;
            }).join('')}
          </div>
          <div class="future-payoff-scale-caption"><span>Lower monthly commitment</span><strong>Earlier payoff →</strong><span>Higher monthly commitment</span></div>
        `;
      }
    }

    const note=$('#futurePayoffNote',section);
    if(note){
      note.textContent=monthlyTakeHome
        ? 'More monthly commitment brings the mortgage-free date forward. Figures use your current balance and rate and do not include lender overpayment limits or fees.'
        : 'Add household take-home in Setup & Data to compare repayment levels.';
    }
  }

  function futureHistorySummary(){
    try{return JSON.parse(localStorage.getItem('mortgage-manager-mortgage-history-summary-v1')||'{}')||{};}
    catch(_){return {};}
  }

  function futureHomeSettings(){
    try{return JSON.parse(localStorage.getItem('mortgage-manager-home-projection-v4')||'{}')||{};}
    catch(_){return {};}
  }

  function futureRegionSlug(value){
    return String(value||'')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/&/g,' and ')
      .replace(/['’]/g,'')
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/^-|-$/g,'');
  }

  function futureCurrentHomeValue(fallback){
    const settings=futureHomeSettings();
    const recent=Math.max(0,Number(settings.recentValue)||0);
    if(recent) return recent;

    const purchasePrice=Math.max(0,Number(settings.purchasePrice)||0);
    const purchaseMonth=String(settings.purchaseMonth||'').slice(0,7);
    const slug=futureRegionSlug(settings.localAuthority||'');
    if(purchasePrice&&purchaseMonth&&slug&&settings.propertyType){
      try{
        const cache=JSON.parse(localStorage.getItem('mortgage-manager-local-hpi-v1')||'{}')||{};
        const model=cache[`${slug}|${settings.propertyType}|${purchaseMonth}`];
        if(model?.multiplier>0){
          return purchasePrice*Number(model.multiplier)+Math.max(0,Number(settings.improvements)||0);
        }
      }catch(_){}
    }
    return Math.max(0,Number(fallback)||0);
  }

  function futurePayoffLabel(months){
    if(!Number.isFinite(months)) return '—';
    const date=new Date();
    date.setMonth(date.getMonth()+Math.max(0,Math.round(months)));
    return new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'}).format(date);
  }

  function renderFutureLifetimeCost(){
    const future=$('.app-view-future .app-view-content');
    const state=window.MortgageStore?.get?.();
    if(!future||!state||!window.MortgageMath) return;

    let section=$('#futureLifetimeCost');
    if(!section){
      section=document.createElement('section');
      section.id='futureLifetimeCost';
      section.className='panel future-lifetime-cost';
      section.innerHTML=`
        <div class="future-cost-heading">
          <div>
            <p class="eyebrow">Lifetime mortgage cost</p>
            <h2>What the mortgage is likely to cost you</h2>
            <p>Combines the mortgage history you have entered with your saved repayment plan from today.</p>
          </div>
          <div class="future-cost-date"><span>Mortgage-free</span><strong id="futureLifetimePayoff">—</strong></div>
        </div>
        <div class="future-lifetime-ledger">
          <article class="future-lifetime-primary">
            <span>Estimated lifetime mortgage payments</span>
            <strong id="futureLifetimePayments">—</strong>
            <small id="futureLifetimePaymentsNote">—</small>
          </article>

          <div class="future-lifetime-support">
            <article>
              <span>Total interest</span>
              <strong id="futureLifetimeInterest">—</strong>
              <small id="futureLifetimeInterestNote">—</small>
            </article>
            <article>
              <span>Interest still to pay</span>
              <strong id="futureFutureInterest">—</strong>
              <small>From today on your saved regular plan.</small>
            </article>
            <article>
              <span>Remaining mortgage payments</span>
              <strong id="futureRemainingPayments">—</strong>
              <small>Capital + interest from today.</small>
            </article>
          </div>
        </div>

        <div class="future-lifetime-split">
          <div class="future-lifetime-split-labels">
            <span>Estimated paid so far <b id="futurePaidSoFar">—</b></span>
            <span>Projected from today <b id="futureProjectedFromToday">—</b></span>
          </div>
          <div class="future-lifetime-split-bar" aria-hidden="true">
            <i id="futurePaidSoFarBar"></i><b id="futureProjectedFromTodayBar"></b>
          </div>
        </div>

        <p class="future-lifetime-note" id="futureLifetimeNote"></p>`;
      future.appendChild(section);
    }

    const balance=Math.max(0,Number(state.balance)||0);
    const rate=Math.max(0,Number(state.rate)||0);
    const payment=Math.max(0,Number(state.payment)||0);
    const regular=Math.max(0,Number(state.currentOverpayment)||0);
    const path=MortgageMath.amortize(balance,rate,payment+regular);
    const history=futureHistorySummary();
    const historicalInterest=Math.max(0,Number(history.historicalInterest)||0);
    const historicalPayments=Math.max(0,Number(history.historicalPayments)||0);
    const futureInterest=Number.isFinite(path.interest)?Math.max(0,path.interest):0;
    const remainingPayments=Number.isFinite(path.totalPaid)?Math.max(0,path.totalPaid):0;
    const lifetimeInterest=historicalInterest+futureInterest;
    const lifetimePayments=historicalPayments+remainingPayments;

    $('#futureLifetimePayoff',section).textContent=futurePayoffLabel(path.months);
    $('#futureFutureInterest',section).textContent=money(futureInterest);
    $('#futureRemainingPayments',section).textContent=money(remainingPayments);

    const hasHistory=historicalPayments>0||historicalInterest>0;
    $('#futureLifetimePayments',section).textContent=hasHistory?money(lifetimePayments):money(remainingPayments);
    $('#futureLifetimeInterest',section).textContent=hasHistory?money(lifetimeInterest):money(futureInterest);

    const paidSoFar=hasHistory?historicalPayments:0;
    const projectedFromToday=remainingPayments;
    const splitTotal=Math.max(1,paidSoFar+projectedFromToday);
    $('#futurePaidSoFar',section).textContent=money(paidSoFar);
    $('#futureProjectedFromToday',section).textContent=money(projectedFromToday);
    const paidBar=$('#futurePaidSoFarBar',section);
    const projectedBar=$('#futureProjectedFromTodayBar',section);
    if(paidBar) paidBar.style.width=(paidSoFar/splitTotal*100)+'%';
    if(projectedBar) projectedBar.style.width=(projectedFromToday/splitTotal*100)+'%';
    $('#futureLifetimePaymentsNote',section).textContent=hasHistory
      ? money(historicalPayments)+' estimated paid so far + '+money(remainingPayments)+' projected from today.'
      : 'Currently showing projected payments from today; add mortgage history for a lifetime estimate.';
    $('#futureLifetimeInterestNote',section).textContent=hasHistory
      ? money(historicalInterest)+' estimated past interest + '+money(futureInterest)+' projected future interest.'
      : 'Currently showing projected future interest only.';

    const note=$('#futureLifetimeNote',section);
    if(note){
      note.textContent=hasHistory
        ? (history.complete
          ? 'Historical figures use the mortgage periods you entered. Future figures assume today’s rate and your saved regular payment plan continue.'
          : 'Mortgage history is only partially complete, so lifetime totals are an estimate. Future figures assume today’s rate and your saved regular payment plan continue.')
        : 'Add your previous mortgage deals in Setup & Data to include what you have already paid.';
    }
  }

  function renderFutureLongTermOutcome(){
    const future=$('.app-view-future .app-view-content');
    const state=window.MortgageStore?.get?.();
    if(!future||!state||!window.MortgageMath) return;

    let section=$('#futureLongTermOutcome');
    if(!section){
      section=document.createElement('section');
      section.id='futureLongTermOutcome';
      section.className='panel future-long-term-outcome';
      section.innerHTML=`
        <div class="future-outcome-heading">
          <div>
            <p class="eyebrow">Long-term outcome</p>
            <h2>What the home could be worth by the time the mortgage is gone</h2>
            <p>Compares a projected property value with the known purchase price and mortgage interest we can account for.</p>
          </div>
        </div>
        <div class="future-outcome-comparison">
          <article class="future-outcome-value">
            <span>Projected value when mortgage-free</span>
            <strong id="futureOutcomeValue">—</strong>
            <small id="futureOutcomeValueNote">—</small>
          </article>
          <div class="future-outcome-vs">vs</div>
          <article class="future-outcome-cost">
            <span>Known lifetime home + mortgage cost</span>
            <strong id="futureOutcomeCost">—</strong>
            <small id="futureOutcomeCostNote">—</small>
          </article>
        </div>

        <div class="future-outcome-result">
          <div>
            <span>Projected value above known cost</span>
            <strong id="futureOutcomeDifference">—</strong>
          </div>
          <small>This is not profit: maintenance, insurance, taxes, fees and other ownership costs are excluded.</small>
        </div>
      `;
      future.appendChild(section);
    }

    const balance=Math.max(0,Number(state.balance)||0);
    const rate=Math.max(0,Number(state.rate)||0);
    const payment=Math.max(0,Number(state.payment)||0);
    const regular=Math.max(0,Number(state.currentOverpayment)||0);
    const ownership=Math.min(100,Math.max(0,Number(state.ownership)||0));
    const path=MortgageMath.amortize(balance,rate,payment+regular);
    if(!Number.isFinite(path.months)) return;

    const history=futureHistorySummary();
    const settings=futureHomeSettings();
    const currentHome=futureCurrentHomeValue(state.homeValue);
    const trend=Number.isFinite(Number(settings.trend))?Number(settings.trend):2.5;
    const years=path.months/12;
    const projectedWhole=currentHome*Math.pow(1+trend/100,years);
    const projectedShare=projectedWhole*(ownership/100);
    const purchasePrice=Math.max(0,Number(history.purchasePrice)||Number(settings.purchasePrice)||0);
    const improvements=Math.max(0,Number(settings.improvements)||0);
    const historicalInterest=Math.max(0,Number(history.historicalInterest)||0);
    const futureInterest=Math.max(0,Number(path.interest)||0);
    const knownCost=purchasePrice?purchasePrice+improvements+historicalInterest+futureInterest:0;
    const projectedValue=ownership<100?projectedShare:projectedWhole;
    const difference=knownCost?projectedValue-knownCost:0;
    const payoff=futurePayoffLabel(path.months);

    $('#futureOutcomeValue',section).textContent=money(projectedValue);
    $('#futureOutcomeValueNote',section).textContent=ownership<100
      ? ownership.toFixed(ownership%1?1:0)+'% share of the projected whole-property value in '+payoff+'.'
      : 'Projected to '+payoff+' using '+trend.toFixed(1)+'% annual home growth.';

    const costEl=$('#futureOutcomeCost',section);
    const costNote=$('#futureOutcomeCostNote',section);
    const diffEl=$('#futureOutcomeDifference',section);
    if(knownCost){
      costEl.textContent=money(knownCost);
      const parts=[money(purchasePrice)+' purchase price'];
      if(improvements) parts.push(money(improvements)+' improvements');
      if(historicalInterest) parts.push(money(historicalInterest)+' estimated past interest');
      parts.push(money(futureInterest)+' projected future interest');
      costNote.textContent=parts.join(' + ')+'.';
      diffEl.textContent=(difference>=0?'+':'−')+money(Math.abs(difference));
      section.classList.toggle('is-negative',difference<0);
    }else{
      costEl.textContent='Add purchase price';
      costNote.textContent='Purchase details and mortgage history are managed in Setup & Data.';
      diffEl.textContent='—';
      section.classList.remove('is-negative');
    }
  }


  function organiseFutureFlow(){
    const future=$('.app-view-future .app-view-content');
    if(!future) return;

    const sources=[
      $('#homeProjection'),
      $('#nextHomePlanner')
    ].filter(Boolean);
    sources.forEach((node)=>node.classList.add('future-source-only'));

    const primary=$('#futureWaitPlanner');
    if(primary && future.firstElementChild!==primary) future.prepend(primary);

    [
      $('#futurePayoffTargets'),
      $('#futureLifetimeCost'),
      $('#futureLongTermOutcome')
    ].filter(Boolean).forEach((node)=>future.appendChild(node));

    sources.forEach((node)=>future.appendChild(node));
  }



  function refineFuture(){
    const future=$('.app-view-future .app-view-content');
    const planner=$('#nextHomePlanner');
    if(!future||!planner) return;

    splitNextHomePlanner();
    renderFuturePayoffTargets();
    $('#futureDrivers')?.remove();
    renderFutureLifetimeCost();
    renderFutureLongTermOutcome();
    organiseFutureFlow();
  }

  function run(){
    refineUpcoming();
    refineFuture();
  }

  if(window.MortgageStore?.subscribe){
    MortgageStore.subscribe((next,previous)=>{
      if(next.currentOverpayment!==previous.currentOverpayment && next.scenarioExtra!==0) MortgageStore.set({scenarioExtra:0});
      requestAnimationFrame(()=>{ refineUpcoming(); renderUpcomingRates(); renderFuturePayoffTargets(); renderFutureLifetimeCost(); renderFutureLongTermOutcome(); organiseFutureFlow(); });
    });
  }

  document.addEventListener('mortgage-market-rates-updated',()=>{
    requestAnimationFrame(()=>{ renderUpcomingRates(); refineUpcoming(); renderRateTrend(); splitNextHomePlanner(); });
  });

  document.addEventListener('mortgage-history-updated',()=>{
    requestAnimationFrame(()=>{ renderFutureLifetimeCost(); renderFutureLongTermOutcome(); organiseFutureFlow(); });
  });

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{
    run();
    requestAnimationFrame(run);
  },{once:true});
  else {
    run();
    requestAnimationFrame(run);
  }
})();