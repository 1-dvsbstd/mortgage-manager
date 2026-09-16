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

    let panel=$('#trajectoryScenarioControls',chart);
    if(!panel){
      panel=document.createElement('section');
      panel.id='trajectoryScenarioControls';
      panel.className='trajectory-scenario-controls';
      panel.innerHTML=`
        <div class="trajectory-scenario-copy">
          <div><p class="eyebrow">What if?</p><h3>Compare monthly overpayments</h3></div>
          <div class="trajectory-current-saving" id="trajectoryCurrentSaving"></div>
        </div>
        <div class="trajectory-overpay-row" id="trajectoryOverpayRow"></div>`;
      const chartWrap=$('.chart-wrap',chart);
      if(chartWrap) chart.insertBefore(panel,chartWrap); else chart.appendChild(panel);
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

    const regular=Math.max(0,Number(state.currentOverpayment)||0);
    const total=regular+Math.max(0,Number(state.scenarioExtra)||0);
    const row=$('#trajectoryOverpayRow',panel);
    if(row){
      row.innerHTML=scenarioCandidates(regular).map((value)=>{
        const current=Math.abs(value-regular)<.5;
        const active=Math.abs(value-total)<.5;
        return `<button type="button" data-total-overpay="${value}" class="${active?'active':''}">${current?'Current ':''}${money(value)}</button>`;
      }).join('')+`<label class="trajectory-custom-overpay">Custom £<input id="trajectoryCustomOverpay" type="number" min="${regular}" step="10" inputmode="decimal" value="${Math.round(total*100)/100}"></label>`;
    }

    const saving=$('#trajectoryCurrentSaving',panel);
    const source=$('#currentSavingsSummary');
    if(saving){
      if(source){
        const main=$('#currentSavingsMain',source)?.textContent||'—';
        const interest=$('#currentSavingsInterest',source)?.textContent||'';
        saving.innerHTML=`<span>Current ${money(regular)}/month</span><strong>${main}</strong><small>${interest}</small>`;
      }else{
        saving.innerHTML=`<span>Current regular overpayment</span><strong>${money(regular)}/month</strong>`;
      }
    }

    const legend=$('.chart-panel .legend');
    if(legend){
      legend.innerHTML='<span><i class="dot scheduled-line"></i>Scheduled only</span><span><i class="dot regular-line"></i>Current overpayment</span><span><i class="dot selected-line"></i>Selected What-if</span><span><i class="dot equity-line"></i>Projected equity</span>';
    }
  }

  function finalizeCurrent(){
    const hero=$('.app-view-current .hero-panel');
    if(hero) hero.classList.add('current-hero-condensed');
    ensureTrajectoryControls();
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