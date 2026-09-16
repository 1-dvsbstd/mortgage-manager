(() => {
  const $=(selector,root=document)=>root.querySelector(selector);

  function money(value){
    return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Math.max(0,Number(value)||0));
  }

  function finalizeCurrent(){
    const hero=$('.app-view-current .hero-panel');
    if(hero) hero.classList.add('current-hero-condensed');

    const scenario=$('.trajectory-what-if');
    if(!scenario) return;

    let inline=$('.whatif-regular-inline',scenario);
    if(!inline){
      inline=document.createElement('div');
      inline.className='whatif-regular-inline';
      inline.innerHTML='<div class="whatif-regular-label"><span>Current regular overpayment</span><strong class="whatif-regular-value">—</strong></div><div class="whatif-regular-live"></div>';
      const source=$('#extraSlider',scenario);
      if(source) source.insertAdjacentElement('beforebegin',inline); else scenario.appendChild(inline);
    }

    const host=$('.whatif-regular-live',inline);
    const panel=$('#currentOverpaymentPanel');
    const savings=$('#currentSavingsSummary');
    const control=$('.current-overpay-control');

    if(savings&&host&&savings.parentElement!==host) host.appendChild(savings);
    if(control&&host&&control.parentElement!==host){
      control.classList.remove('source-fields-only');
      host.appendChild(control);
    }
    panel?.remove();

    const state=window.MortgageStore?.get?.();
    const value=$('.whatif-regular-value',scenario);
    if(value&&state) value.textContent=`${money(state.currentOverpayment)}/month`;

    const legend=$('.chart-panel .legend');
    if(legend){
      legend.innerHTML='<span><i class="dot scheduled-line"></i>Scheduled only</span><span><i class="dot regular-line"></i>Current overpayment</span><span><i class="dot selected-line"></i>Selected What-if</span><span><i class="dot equity-line"></i>Projected equity</span>';
    }
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