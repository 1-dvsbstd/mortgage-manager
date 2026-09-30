(() => {
  const $=(selector,root=document)=>root.querySelector(selector);

  function money(value){
    return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Math.max(0,Number(value)||0));
  }

  function scenarioCandidates(regular){
    const base=Math.round(Math.max(0,Number(regular)||0)*100)/100;
    const preset=[base,100,250,500].filter((v)=>v>=base-.01);
    const values=preset.length>=3?preset:[base,base+100,base+250,base+500];
    return [...new Set(values.map((v)=>Math.round(v*100)/100))];
  }

  function setTotalOverpayment(total){
    const state=window.MortgageStore?.get?.();
    if(!state) return;
    const regular=Math.max(0,Number(state.currentOverpayment)||0);
    const target=Math.max(regular,Number(total)||0);
    window.MortgageStore.set({scenarioExtra:Math.max(0,target-regular)});
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
    const headingStat=$('.chart-stat',heading||chart);
    if(headingStat) headingStat.classList.add('trajectory-source-stat');

    let insight=$('.trajectory-headline-insight',heading||chart);
    if(!insight&&heading){
      insight=document.createElement('p');
      insight.className='trajectory-headline-insight';
      const copy=$(':scope > div:first-child',heading);
      if(copy) copy.appendChild(insight);
    }

    let panel=$('#trajectoryScenarioControls',chart);
    if(!panel){
      panel=document.createElement('section');
      panel.id='trajectoryScenarioControls';
      panel.className='trajectory-scenario-controls';
      panel.addEventListener('click',(event)=>{
        const button=event.target.closest('[data-total-overpay]');
        if(button) setTotalOverpayment(button.dataset.totalOverpay);
      });
      panel.addEventListener('change',(event)=>{
        if(event.target.id==='trajectoryCustomOverpay') setTotalOverpayment(event.target.value);
      });
      panel.addEventListener('keydown',(event)=>{
        if(event.target.id==='trajectoryCustomOverpay'&&event.key==='Enter') setTotalOverpayment(event.target.value);
      });
    }
    if(panel.dataset.layout!=='rail-v1'){
      panel.dataset.layout='rail-v1';
      panel.innerHTML=`
        <div class="trajectory-rail-intro">
          <p class="eyebrow">What if?</p>
          <h3>Try a different monthly overpayment</h3>
          <p>See how a little more changes your path.</p>
        </div>
        <div class="trajectory-current-saving" id="trajectoryCurrentSaving"></div>
        <div class="trajectory-overpay-row" id="trajectoryOverpayRow"></div>`;
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
    const total=regular+extra;
    const row=$('#trajectoryOverpayRow',panel);
    if(row){
      row.innerHTML=scenarioCandidates(regular).map((value)=>{
        const current=Math.abs(value-regular)<.5;
        const active=Math.abs(value-total)<.5;
        return `<button type="button" data-total-overpay="${value}" class="${active?'active':''}"><span>${current?'Current':''}</span><strong>${money(value)}</strong></button>`;
      }).join('')+`<label class="trajectory-custom-overpay"><span>Custom</span><strong>£<input id="trajectoryCustomOverpay" type="number" min="${regular}" step="10" inputmode="decimal" value="${Math.round(total*100)/100}"></strong></label>`;
    }

    const saving=$('#trajectoryCurrentSaving',panel);
    if(insight){
      const scheduled=window.MortgageMath?.amortize?.(
        Math.max(0,Number(state.balance)||0),
        Math.max(0,Number(state.rate)||0),
        Math.max(0,Number(state.payment)||0)
      );
      const current=window.MortgageMath?.amortize?.(
        Math.max(0,Number(state.balance)||0),
        Math.max(0,Number(state.rate)||0),
        Math.max(0,Number(state.payment)||0)+regular
      );
      const monthsSaved=Number.isFinite(scheduled?.months)&&Number.isFinite(current?.months)
        ? Math.max(0,scheduled.months-current.months):0;
      const years=Math.floor(monthsSaved/12), months=Math.round(monthsSaved%12);
      const duration=years&&months?`${years}y ${months}m`:years?`${years}y`:`${months}m`;
      insight.textContent=regular>0&&monthsSaved>0
        ? `Your ${money(regular)} monthly overpayment gets you mortgage-free ${duration} sooner.`
        : 'See how small monthly changes alter your mortgage path.';
    }
    if(saving){
      const scheduled=window.MortgageMath?.amortize?.(
        Math.max(0,Number(state.balance)||0),
        Math.max(0,Number(state.rate)||0),
        Math.max(0,Number(state.payment)||0)
      );
      const selected=window.MortgageMath?.amortize?.(
        Math.max(0,Number(state.balance)||0),
        Math.max(0,Number(state.rate)||0),
        Math.max(0,Number(state.payment)||0)+total
      );
      const monthsSaved=Number.isFinite(scheduled?.months)&&Number.isFinite(selected?.months)
        ? Math.max(0,scheduled.months-selected.months):0;
      const interestSaved=Number.isFinite(scheduled?.interest)&&Number.isFinite(selected?.interest)
        ? Math.max(0,scheduled.interest-selected.interest):0;
      const years=Math.floor(monthsSaved/12),months=Math.round(monthsSaved%12);
      const duration=years&&months?`${years}y ${months}m`:years?`${years}y`:`${months}m`;
      saving.innerHTML=`
        <span>${Math.abs(total-regular)<.5?'Your current plan':`With ${money(total)}/month`}</span>
        <strong>${monthsSaved>0?`${duration} sooner`:'Same payoff date'}</strong>
        <small>${interestSaved>0?`${money(interestSaved)} less interest`:'No additional interest saving'}</small>`;
    }

    if(legend){
      const showWhatIf=extra>.01;
      legend.innerHTML=
        '<span><i class="dot scheduled-line"></i>Scheduled only</span>'+
        '<span><i class="dot regular-line"></i>Current plan</span>'+
        (showWhatIf?'<span><i class="dot selected-line"></i>What if</span>':'')+
        '<span><i class="dot equity-line"></i>Projected equity</span>';
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
    const range=$('#futureModelRange');
    const home=$('#homeProjection');
    const anchor=range||home;
    if(anchor&&wait.previousElementSibling!==anchor) anchor.insertAdjacentElement('afterend',wait);
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