(() => {
  const $=(selector,root=document)=>root.querySelector(selector);

  function money(value){
    return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Math.max(0,Number(value)||0));
  }

  function homeTrend(){
    try{
      const settings=JSON.parse(localStorage.getItem('mortgage-manager-home-projection-v4')||'{}');
      const value=Number(settings.trend);
      return Number.isFinite(value)?value:2.5;
    }catch(_){ return 2.5; }
  }

  const scenarioExtras=[50,100,250,500];

  function setScenarioExtra(extra){
    const value=Math.max(0,Number(extra)||0);
    window.MortgageStore?.set?.({scenarioExtra:value});
  }

  function durationFromMonths(value){
    const total=Math.max(0,Math.round(Number(value)||0));
    const years=Math.floor(total/12),months=total%12;
    return years&&months?`${years}y ${months}m`:years?`${years}y`:`${months}m`;
  }

  function payoffSummary(basePayment,comparisonPayment,state){
    const scheduled=window.MortgageMath?.amortize?.(
      Math.max(0,Number(state.balance)||0),
      Math.max(0,Number(state.rate)||0),
      Math.max(0,Number(basePayment)||0)
    );
    const compared=window.MortgageMath?.amortize?.(
      Math.max(0,Number(state.balance)||0),
      Math.max(0,Number(state.rate)||0),
      Math.max(0,Number(comparisonPayment)||0)
    );
    const monthsSaved=Number.isFinite(scheduled?.months)&&Number.isFinite(compared?.months)
      ? Math.max(0,scheduled.months-compared.months):0;
    const interestSaved=Number.isFinite(scheduled?.interest)&&Number.isFinite(compared?.interest)
      ? Math.max(0,scheduled.interest-compared.interest):0;
    const duration=durationFromMonths(monthsSaved);
    return {monthsSaved,interestSaved,duration};
  }

  function ensureTrajectoryControls(){
    const chart=$('.app-view-current .chart-panel');
    if(!chart) return;
    const state=window.MortgageStore?.get?.();
    if(!state) return;

    const legacy=$('.trajectory-what-if',chart);
    if(legacy) legacy.hidden=true;
    $('#currentOverpaymentPanel')?.remove();

    const heading=$(':scope > .panel-heading',chart);
    if(heading){
      const subtitle=$('.subtle',heading);
      if(subtitle) subtitle.textContent='Debt falls while projected equity builds.';
      const headingCopy=$(':scope > div:first-child',heading)||heading;
      let assumption=$('.trajectory-assumption-note',heading);
      if(!assumption){
        assumption=document.createElement('span');
        assumption.className='trajectory-assumption-note';
        headingCopy.appendChild(assumption);
      }else if(assumption.parentElement!==headingCopy){
        headingCopy.appendChild(assumption);
      }
      assumption.textContent=`Projection assumes ${homeTrend().toFixed(1)}% annual home-value growth`;
    }
    const headingStat=$('.chart-stat',heading||chart);
    if(headingStat) headingStat.classList.add('trajectory-source-stat');

    let panel=$('#trajectoryScenarioControls',chart);
    if(!panel){
      panel=document.createElement('section');
      panel.id='trajectoryScenarioControls';
      panel.className='trajectory-scenario-controls';
      panel.addEventListener('click',(event)=>{
        const button=event.target.closest('[data-scenario-extra]');
        if(button) setScenarioExtra(button.dataset.scenarioExtra);
      });
      panel.addEventListener('input',(event)=>{
        if(event.target.id==='trajectoryCustomOverpay') event.target.dataset.userValue=event.target.value;
      });
      panel.addEventListener('change',(event)=>{
        if(event.target.id==='trajectoryCustomOverpay') setScenarioExtra(event.target.value);
      });
      panel.addEventListener('keydown',(event)=>{
        if(event.target.id==='trajectoryCustomOverpay'&&event.key==='Enter'){
          event.preventDefault();
          setScenarioExtra(event.target.value);
          event.target.blur();
        }
      });
    }
    if(panel.dataset.layout!=='rail-v6'){
      panel.dataset.layout='rail-v6';
      panel.innerHTML=`
        <div class="trajectory-rail-intro">
          <p class="eyebrow">What if?</p>
          <h3>Try a different overpayment</h3>
          <p>Replace your current £${money(Math.max(0,Number(state.currentOverpayment)||0))}/month plan.</p>
        </div>
        <div class="trajectory-overpay-row" id="trajectoryOverpayRow">
          <div class="trajectory-presets">
            ${scenarioExtras.map((value)=>`<button type="button" data-scenario-extra="${value}"><strong>${money(value)}</strong><small>/month</small></button>`).join('')}
          </div>
          <label class="trajectory-custom-overpay"><span class="trajectory-custom-label">Custom</span><strong class="trajectory-custom-value">£<input id="trajectoryCustomOverpay" type="text" inputmode="decimal" autocomplete="off" value="${money(Math.max(0,Number(state.currentOverpayment)||0))}" aria-label="Custom monthly overpayment"></strong><small>/month</small></label>
        </div>`;
    }

    let workspace=$('.trajectory-workspace',chart);
    if(!workspace){
      workspace=document.createElement('div');
      workspace.className='trajectory-workspace';
      if(heading) heading.insertAdjacentElement('afterend',workspace); else chart.prepend(workspace);
    }

    let stage=$('.trajectory-chart-stage',workspace);
    if(!stage){
      stage=document.createElement('div');
      stage.className='trajectory-chart-stage';
      workspace.appendChild(stage);
    }

    const chartWrap=$(':scope > .chart-wrap',chart)||$('.chart-wrap',chart);
    const legend=$(':scope > .legend',chart)||$('.legend',chart);
    if(panel.parentElement!==workspace) workspace.insertBefore(panel,stage);
    if(chartWrap&&chartWrap.parentElement!==stage) stage.appendChild(chartWrap);
    if(legend&&legend.parentElement!==stage) stage.appendChild(legend);

    const regular=Math.max(0,Number(state.currentOverpayment)||0);
    const extra=Math.max(0,Number(state.scenarioExtra)||0);
    const railCopy=$('.trajectory-rail-intro>p:last-child',panel);
    if(railCopy) railCopy.textContent=`Replace your current ${money(regular)}/month plan.`;

    panel.querySelectorAll('[data-scenario-extra]').forEach((button)=>{
      const value=Number(button.dataset.scenarioExtra)||0;
      button.classList.toggle('active',Math.abs(value-extra)<.5);
    });
    const custom=$('#trajectoryCustomOverpay',panel);
    const customWrap=custom?.closest('.trajectory-custom-overpay');
    const isPreset=scenarioExtras.some((value)=>Math.abs(value-extra)<.5);
    customWrap?.classList.toggle('is-active',!isPreset&&extra>0);
    if(custom&&document.activeElement!==custom){
      if(!isPreset&&extra>0) custom.value=String(Math.round(extra*100)/100);
      else if(!custom.dataset.userValue) custom.value=String(Math.round(regular*100)/100);
    }

    if(heading){
      const actions=$('.card-actions',heading)||heading;
      let comparison=$('.trajectory-plan-comparison',heading);
      if(!comparison){
        comparison=document.createElement('div');
        comparison.className='trajectory-plan-comparison';
        actions.appendChild(comparison);
      }

      const basePayment=Math.max(0,Number(state.payment)||0);
      const currentSummary=payoffSummary(basePayment,basePayment+regular,state);
      const whatIfSummary=payoffSummary(basePayment,basePayment+extra,state);

      const incrementalMonths=Math.max(0,whatIfSummary.monthsSaved-currentSummary.monthsSaved);
      const incrementalInterest=Math.max(0,whatIfSummary.interestSaved-currentSummary.interestSaved);
      comparison.innerHTML=`
        <div class="trajectory-plan-card trajectory-plan-current">
          <div class="trajectory-plan-label">
            <span>Current plan</span>
            <small>${money(regular)}/month</small>
          </div>
          <strong>${regular>0&&currentSummary.monthsSaved>0?currentSummary.duration:'—'}</strong>
          <em>${regular>0&&currentSummary.interestSaved>0?`${money(currentSummary.interestSaved)} less interest`:'No regular overpayment'}</em>
        </div>
        <div class="trajectory-plan-card trajectory-plan-whatif ${extra>0?'is-active':''}">
          <div class="trajectory-plan-label">
            <span>What if</span>
            <small>${extra>0?`${money(extra)}/month`:'Choose an amount'}</small>
          </div>
          <strong>${extra>0&&whatIfSummary.monthsSaved>0?whatIfSummary.duration:'—'}</strong>
          <em>${extra>0&&whatIfSummary.interestSaved>0?`${money(whatIfSummary.interestSaved)} less interest`:'Choose an amount to compare'}</em>
          ${extra>0&&incrementalMonths>0?`<div class="trajectory-plan-gain"><span><strong>+${durationFromMonths(incrementalMonths)}</strong><small>sooner</small></span><span><strong>+${money(incrementalInterest)}</strong><small>saved</small></span></div>`:''}
        </div>`;
    }

    if(legend){
      const showWhatIf=extra>.01;
      legend.innerHTML=
        '<span><i class="dot scheduled-line"></i>Scheduled only</span>'+
        '<span><i class="dot regular-line"></i>Current plan</span>'+
        (showWhatIf?'<span><i class="dot selected-line"></i>What if</span>':'')+
        '<span><i class="dot equity-line"></i>Your equity progress</span>';
    }
  }

  function finalizeCurrent(){
    const hero=$('.app-view-current .hero-panel');
    if(hero) hero.classList.add('current-hero-condensed');
    ensureTrajectoryControls();
  }

  function finalizeUpcoming(){
    const upcoming=$('.app-view-upcoming');
    if(!upcoming) return;
    upcoming.querySelectorAll('.market-block,.market-comparison').forEach((node)=>node.classList.add('design-source-only'));
    const workspace=$('.upcoming-workspace',upcoming);
    if(workspace) workspace.classList.add('design-workspace-full');
  }

  function finalizeFuture(){
    const future=$('.app-view-future .app-view-content');
    const wait=$('#futureWaitPlanner');
    if(!future||!wait) return;
    if(future.firstElementChild!==wait) future.prepend(wait);
  }

  function disableDeadExpansion(){
    document.querySelectorAll('.app-view [data-expandable-card]').forEach((card)=>{
      card.classList.remove('expandable-card','is-expanded');
      card.removeAttribute('data-expandable-card');
      card.removeAttribute('tabindex');
      card.removeAttribute('aria-expanded');
      card.querySelectorAll('[data-expand-card],.expand-hint,.card-close-bar').forEach((el)=>el.remove());
    });
    document.body.classList.remove('card-open');
    document.querySelector('.card-backdrop')?.remove();
  }

  function run(){
    finalizeCurrent();
    finalizeUpcoming();
    finalizeFuture();
    disableDeadExpansion();
  }

  document.addEventListener('click',(event)=>{
    if(event.target.closest('[data-app-view]')) requestAnimationFrame(()=>setTimeout(run,0));
  });

  if(window.MortgageStore?.subscribe) MortgageStore.subscribe(()=>requestAnimationFrame(run));

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{
    [250,700,1200,2000].forEach((delay)=>setTimeout(run,delay));
  },{once:true});
  else [0,400,900].forEach((delay)=>setTimeout(run,delay));
})();