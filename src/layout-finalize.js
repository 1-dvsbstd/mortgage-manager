(() => {
  const $=(selector,root=document)=>root.querySelector(selector);

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
    if(value&&state){
      const amount=Math.max(0,Number(state.currentOverpayment)||0);
      value.textContent=new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(amount)+'/month';
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

  function run(){
    finalizeCurrent();
    finalizeFuture();
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