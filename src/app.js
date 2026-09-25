(() => {
  const $ = (id) => document.getElementById(id);
  let selectedExtra = 50;
  let simulatedRate = 4;
  let updateFrame = null;

  const money = (value) => new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
  }).format(Math.max(0, Number(value) || 0));

  const humanMonths = (months) => {
    if (!Number.isFinite(months)) return '—';
    if (months === 0) return 'Paid off';
    const years = Math.floor(months / 12);
    const remainder = months % 12;
    return [years ? `${years} year${years === 1 ? '' : 's'}` : '', remainder ? `${remainder} month${remainder === 1 ? '' : 's'}` : ''].filter(Boolean).join(' ');
  };

  const compactMonths = (months) => {
    if (!Number.isFinite(months) || months <= 0) return '0m';
    const y = Math.floor(months / 12), m = months % 12;
    return y && m ? `${y}y ${m}m` : y ? `${y}y` : `${m}m`;
  };

  const payoffDate = (months) => {
    if (!Number.isFinite(months)) return '—';
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(date);
  };

  const monthsUntil = (monthValue) => {
    if (!monthValue) return null;
    const [year, month] = monthValue.split('-').map(Number);
    if (!year || !month) return null;
    const now = new Date();
    return (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());
  };

  const paymentFor = (principal, annualRate, months) => {
    principal = Math.max(0, Number(principal) || 0);
    months = Math.max(1, Math.round(Number(months) || 1));
    const r = Math.max(0, Number(annualRate) || 0) / 100 / 12;
    if (!principal) return 0;
    if (!r) return principal / months;
    return principal * r / (1 - Math.pow(1 + r, -months));
  };

  function currentValues() {
    if (window.MortgageStore) {
      const state = window.MortgageStore.get();
      return {
        balance: state.balance,
        rate: state.rate,
        payment: state.payment,
        homeValue: state.homeValue,
        ownership: state.ownership,
        fixedEnd: state.fixedEnd,
        extra: state.scenarioExtra,
      };
    }
    return {
      balance: +$('balance').value || 0,
      rate: +$('rate').value || 0,
      payment: +$('payment').value || 0,
      homeValue: +$('homeValue').value || 0,
      ownership: Math.min(100, Math.max(0, +$('ownership').value || 0)),
      fixedEnd: $('fixedEnd').value || '',
      extra: Math.max(0, +$('customExtra').value || 0),
    };
  }

  function setSavedStatus() {
    const status = $('saveStatus');
    if (status) status.textContent = 'Saved on this device';
  }

  function setStorePatch(patch) {
    if (window.MortgageStore) window.MortgageStore.set(patch);
    setSavedStatus();
  }

  function loadValues() {
    if (window.MortgageStore) {
      window.MortgageStore.applyToDom(null, { dispatch:false });
      const state = window.MortgageStore.get();
      selectedExtra = state.scenarioExtra;
      return;
    }
  }

  function syncExtraControls(value) {
    selectedExtra = Math.max(0, Number(value) || 0);
    $('customExtra').value = selectedExtra;
    $('extraSlider').value = Math.min(1000, selectedExtra);
    document.querySelectorAll('button[data-extra]').forEach((button) => {
      button.classList.toggle('active', Number(button.dataset.extra) === selectedExtra);
    });
  }

  function ensureForecastUI() {
    if ($('dealForecast')) return;
    const anchor = document.querySelector('.next-panel .timeline-labels');
    if (!anchor) return;

    const style = document.createElement('style');
    style.textContent = `
      .deal-forecast{margin-top:16px;display:grid;gap:10px}.deal-forecast-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.deal-forecast-card{padding:11px;border:1px solid var(--border);border-radius:13px;background:var(--panel-soft);min-width:0}.deal-forecast-card span{display:block;color:var(--muted);font-size:11px}.deal-forecast-card strong{display:block;margin-top:4px;font-size:18px}.deal-forecast-card small{display:block;color:var(--muted);font-size:11px;margin-top:4px;line-height:1.35}.rate-sim{margin-top:5px;padding-top:12px;border-top:1px solid var(--border)}.rate-sim-head{display:flex;justify-content:space-between;gap:10px;align-items:end}.rate-sim-head span{color:var(--muted);font-size:11px}.rate-sim-payment{font-size:24px;color:var(--warm)}.rate-buttons{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.rate-buttons button{min-height:36px;padding:7px 10px;font-size:12px}.rate-buttons button.active{background:var(--accent);color:#062018}.rate-note{margin:8px 0 0;color:var(--muted);font-size:11px;line-height:1.4}.ltv-milestone{margin-top:8px;color:var(--warm);font-size:12px;line-height:1.4}@media(max-width:390px){.deal-forecast-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.id = 'dealForecast';
    wrap.className = 'deal-forecast';
    wrap.innerHTML = `
      <div class="deal-forecast-grid">
        <div class="deal-forecast-card"><span>Balance at deal end</span><strong id="dealEndBalance">—</strong><small id="dealEndBalanceExtra">—</small></div>
        <div class="deal-forecast-card"><span>Projected LTV</span><strong id="dealEndLtv">—</strong><small id="dealEndEquity">—</small></div>
      </div>
      <div id="ltvMilestone" class="ltv-milestone"></div>
      <div class="rate-sim">
        <div class="rate-sim-head"><div><span>Next-rate payment</span><strong id="nextRatePayment" class="rate-sim-payment">—</strong></div><div><span id="nextRateLabel">At 4.00%</span></div></div>
        <div class="rate-buttons" id="rateButtons">
          <button type="button" data-rate="3">3%</button><button type="button" data-rate="4" class="active">4%</button><button type="button" data-rate="5">5%</button><button type="button" data-rate="6">6%</button>
        </div>
        <p class="rate-note" id="rateNote">Estimated payment needed after the fix to keep your current projected mortgage-free date.</p>
      </div>`;
    anchor.insertAdjacentElement('afterend', wrap);

    $('rateButtons').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-rate]');
      if (!button) return;
      simulatedRate = Number(button.dataset.rate);
      document.querySelectorAll('#rateButtons button').forEach((b) => b.classList.toggle('active', b === button));
      update();
    });
  }

  function updateNextEvent(fixedEnd) {
    const months = monthsUntil(fixedEnd);
    const timelineFill = $('timelineFill');
    const timelineEndLabel = $('timelineEndLabel');
    if (months === null) {
      $('nextEventTitle').textContent = 'Add your fixed-rate end date';
      $('nextEventText').textContent = 'We’ll keep your next mortgage milestone visible here.';
      timelineFill.style.width = '0%'; timelineEndLabel.textContent = 'Deal end'; return;
    }
    const date = new Date(`${fixedEnd}-01T12:00:00`);
    const formatted = new Intl.DateTimeFormat('en-GB', { month:'short', year:'numeric' }).format(date);
    timelineEndLabel.textContent = formatted;
    if (months < 0) {
      $('nextEventTitle').textContent = 'Fixed-rate date passed';
      $('nextEventText').textContent = `${formatted} has passed. Update the mortgage after your new deal starts.`;
      timelineFill.style.width = '100%';
    } else if (months === 0) {
      $('nextEventTitle').textContent = 'Fixed rate ends this month';
      $('nextEventText').textContent = 'Your deal is at its next major milestone.';
      timelineFill.style.width = '100%';
    } else {
      $('nextEventTitle').textContent = `Fixed rate ends in ${humanMonths(months)}`;
      $('nextEventText').textContent = months <= 6 ? `${formatted} — worth reviewing remortgage options now.` : `${formatted} is your next key mortgage milestone.`;
      timelineFill.style.width = `${Math.max(8, 100 - (Math.min(months,60)/60)*100)}%`;
    }
  }

  function updateDealForecast(values, result) {
    ensureForecastUI();
    if (!$('dealForecast')) return;
    const months = monthsUntil(values.fixedEnd);
    const valid = months !== null && months >= 0 && Number.isFinite(result.base.months);
    $('dealForecast').style.display = valid ? 'grid' : 'none';
    if (!valid) return;

    const m = Math.max(0, Math.min(months, result.base.monthlyPoints.length - 1));
    const baseBalance = result.base.monthlyPoints[m] ?? 0;
    const acceleratedIndex = Math.min(months, result.accelerated.monthlyPoints.length - 1);
    const acceleratedBalance = result.accelerated.monthlyPoints[acceleratedIndex] ?? 0;
    const projectedLtv = values.homeValue > 0 ? (baseBalance / values.homeValue) * 100 : null;
    const projectedEquity = values.homeValue * (values.ownership / 100) - baseBalance;

    $('dealEndBalance').textContent = money(baseBalance);
    $('dealEndBalanceExtra').textContent = selectedExtra > 0
      ? `${money(acceleratedBalance)} with ${money(selectedExtra)}/month overpayment (${money(Math.max(0, baseBalance - acceleratedBalance))} less owed)`
      : 'Based on your current payment and rate.';
    $('dealEndLtv').textContent = projectedLtv === null ? '—' : `${projectedLtv.toFixed(1)}%`;
    $('dealEndEquity').textContent = `${money(Math.max(0, projectedEquity))} estimated equity in your share`;

    const thresholds = [90,85,80,75,70,65,60,50,40,30,20,10];
    const currentLtv = values.homeValue > 0 ? (values.balance / values.homeValue) * 100 : null;
    let milestoneText = '';
    if (currentLtv !== null) {
      const target = thresholds.find((t) => currentLtv > t);
      if (target) {
        const hit = result.base.monthlyPoints.findIndex((balance) => values.homeValue > 0 && (balance / values.homeValue) * 100 <= target);
        if (hit >= 0) milestoneText = `Next LTV milestone: ${target}% around ${payoffDate(hit)}.`;
      }
    }
    $('ltvMilestone').textContent = milestoneText;

    const remainingMonths = Math.max(1, result.base.months - months);
    const newPayment = paymentFor(baseBalance, simulatedRate, remainingMonths);
    $('nextRatePayment').textContent = money(newPayment);
    $('nextRateLabel').textContent = `At ${simulatedRate.toFixed(2)}%`;
    $('rateNote').textContent = `Estimated payment over the remaining ${humanMonths(remainingMonths)} to keep the current projected finish date. Fees and lender rules are not included.`;
  }

  function updateOwnershipVisual(values, ownedPropertyValue, householdEquity) {
    if (values.homeValue <= 0) {
      ['debtSegment','equitySegment','schemeSegment'].forEach((id) => $(id).style.width = '0%');
      $('debtLegend').textContent = $('equityLegend').textContent = $('schemeLegend').textContent = '—'; return;
    }
    const schemePct = Math.max(0,100-values.ownership);
    const debtPct = Math.min(values.ownership, Math.max(0,(values.balance/values.homeValue)*100));
    const equityPct = Math.max(0, values.ownership-debtPct);
    $('debtSegment').style.width=`${debtPct}%`; $('equitySegment').style.width=`${equityPct}%`; $('schemeSegment').style.width=`${schemePct}%`;
    $('debtLegend').textContent=money(values.balance); $('equityLegend').textContent=householdEquity>=0?money(householdEquity):`-${money(Math.abs(householdEquity))}`;
    $('schemeLegend').textContent=money(Math.max(0,values.homeValue-ownedPropertyValue)); $('schemeLegendWrap').style.display=schemePct>.01?'inline':'none';
  }

  function drawChart(base, accelerated) {
    const canvas=$('chart'), container=canvas.parentElement, dpr=window.devicePixelRatio||1;
    const cssWidth=Math.max(280,container.clientWidth), cssHeight=window.innerWidth<620?245:310;
    canvas.style.width=`${cssWidth}px`; canvas.style.height=`${cssHeight}px`; canvas.width=Math.floor(cssWidth*dpr); canvas.height=Math.floor(cssHeight*dpr);
    const ctx=canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,cssWidth,cssHeight);
    const compact=cssWidth<520, pad={left:compact?48:68,right:16,top:18,bottom:36}, width=cssWidth-pad.left-pad.right, height=cssHeight-pad.top-pad.bottom;
    const maxBalance=Math.max(base.monthlyPoints[0]||0,accelerated.monthlyPoints[0]||0,1), maxMonths=Math.max(base.monthlyPoints.length,accelerated.monthlyPoints.length)-1||1;
    ctx.strokeStyle='rgba(255,255,255,.09)'; ctx.lineWidth=1; ctx.font=compact?'10px system-ui':'12px system-ui'; ctx.fillStyle='#99aaa5';
    for(let i=0;i<=4;i++){const y=pad.top+(height*i)/4;ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(pad.left+width,y);ctx.stroke();const value=maxBalance*(1-i/4);ctx.fillText(value>=1000?`£${Math.round(value/1000)}k`:money(value),3,y+4);}
    const line=(points,colour)=>{ctx.strokeStyle=colour;ctx.lineWidth=compact?2.5:3;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();points.forEach((value,index)=>{const x=pad.left+width*(index/maxMonths),y=pad.top+height*(1-value/maxBalance);index?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();};
    line(base.monthlyPoints,'#a8b4b0'); line(accelerated.monthlyPoints,'#54e0b4');
    const maxYears=maxMonths/12; [0,.5,1].forEach((f)=>{const x=pad.left+width*f,year=Math.round(maxYears*f);ctx.fillText(`${year}y`,x-8,cssHeight-10);});
  }

  function update() {
    const values=currentValues(); selectedExtra=values.extra;
    const result=MortgageMath.compare(values.balance,values.rate,values.payment,selectedExtra);
    const ownedPropertyValue=values.homeValue*(values.ownership/100), householdEquity=ownedPropertyValue-values.balance;
    const ltv=values.homeValue>0?(values.balance/values.homeValue)*100:0;
    const mortgageFreeShare=ownedPropertyValue>0?Math.min(100,Math.max(0,(householdEquity/ownedPropertyValue)*100)):0;

    $('balanceLine').textContent=money(values.balance); $('paymentStat').textContent=money(values.payment); $('rateStat').textContent=`${values.rate.toFixed(2)}%`;
    $('homeValueStat').textContent=money(values.homeValue); $('ownedValueStat').textContent=money(ownedPropertyValue); $('equityStat').textContent=householdEquity>=0?money(householdEquity):`-${money(Math.abs(householdEquity))}`;
    $('equitySubtext').textContent=`${mortgageFreeShare.toFixed(0)}% of your owned share is mortgage-free`; $('ltvStat').textContent=values.homeValue>0?`${ltv.toFixed(1)}%`:'—';
    $('ownershipBadge').textContent=`${values.ownership.toFixed(values.ownership%1?1:0)}% share`; $('equityProgress').textContent=`${mortgageFreeShare.toFixed(0)}%`;
    $('progressCaption').textContent=`${money(Math.max(0,householdEquity))} equity in your share`; $('progressFill').style.width=`${mortgageFreeShare.toFixed(1)}%`; $('overpayHeadline').textContent=`${money(selectedExtra)}/month`;

    updateOwnershipVisual(values,ownedPropertyValue,householdEquity); updateNextEvent(values.fixedEnd); updateDealForecast(values,result);

    if(!Number.isFinite(result.base.months)){
      $('yearsRemaining').textContent='Payment too low'; $('payoffDate').textContent='The payment does not currently repay the mortgage.'; $('interestRemaining').textContent='—'; $('interestWithExtraText').textContent=''; $('timeSaved').textContent='—';
      $('scenarioSummary').textContent='Increase the monthly payment to create a repayment path.'; $('heroScenario').textContent='Your current payment needs adjusting before we can model overpayments.'; $('warning').textContent='At this rate, the monthly payment does not cover enough principal to clear the mortgage.'; drawChart(result.base,result.accelerated); return;
    }

    $('yearsRemaining').textContent=humanMonths(result.base.months); $('payoffDate').textContent=`Mortgage-free around ${payoffDate(result.base.months)}`; $('interestRemaining').textContent=money(result.base.interest); $('warning').textContent='';
    const regularOverpayment=Math.max(0,Number(values.currentOverpayment)||0);
    $('interestWithExtraText').textContent=regularOverpayment>0
      ? `Includes your ${money(regularOverpayment)}/month regular overpayment`
      : 'Based on your scheduled monthly payment';
    if(selectedExtra===0||!Number.isFinite(result.accelerated.months)){
      $('timeSaved').textContent='No change'; $('scenarioSummary').textContent=`Current finish: ${payoffDate(result.base.months)}`; $('heroScenario').textContent='Choose an overpayment to see how much sooner you could finish.';
    }else{
      const finish=payoffDate(result.accelerated.months); $('timeSaved').textContent=compactMonths(result.monthsSaved); $('scenarioSummary').textContent=`${compactMonths(result.monthsSaved)} sooner · ${money(result.interestSaved)} saved · finish ${finish}`; $('heroScenario').textContent=`${money(selectedExtra)}/month gets you mortgage-free ${compactMonths(result.monthsSaved)} sooner and saves ${money(result.interestSaved)} in interest.`;
    }
    drawChart(result.base,result.accelerated);
  }

  function scheduleUpdate() {
    if (updateFrame) cancelAnimationFrame(updateFrame);
    updateFrame = requestAnimationFrame(() => {
      updateFrame = null;
      const state = window.MortgageStore?.get();
      if (state) syncExtraControls(state.scenarioExtra);
      update();
    });
  }

  const applyExtra=(value)=>{
    const next=Math.max(0,Number(value)||0);
    syncExtraControls(next);
    setStorePatch({ scenarioExtra: next });
  };

  $('overpayButtons').addEventListener('click',(event)=>{const button=event.target.closest('button[data-extra]');if(button)applyExtra(button.dataset.extra);});
  $('extraSlider').addEventListener('input',(event)=>applyExtra(event.target.value));
  $('customExtra').addEventListener('input',(event)=>applyExtra(event.target.value));

  const fieldMap = {
    balance:'balance', rate:'rate', payment:'payment', homeValue:'homeValue', ownership:'ownership', fixedEnd:'fixedEnd', currentOverpayment:'currentOverpayment'
  };
  Object.entries(fieldMap).forEach(([id,key])=>{
    const element=$(id);
    if(!element) return;
    element.addEventListener('input',()=>{
      const value=key==='fixedEnd'?element.value:Number(element.value);
      setStorePatch({[key]:value});
    });
  });

  if (window.MortgageStore) {
    window.MortgageStore.subscribe(() => scheduleUpdate());
  }
  window.addEventListener('resize',update);

  loadValues();
  syncExtraControls(currentValues().extra);
  ensureForecastUI();
  update();
})();
