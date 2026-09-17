(() => {
  const MARKET_CHOICE_KEY='mortgage-manager-market-choice-v1';
  const SETUP_KEY='mortgage-manager-personal-setup-v1';

  function setText(node,text){
    if(node&&node.textContent!==text) node.textContent=text;
  }

  function isolateEnhancedChart(){
    const canvas=document.getElementById('chart');
    if(!canvas||canvas.dataset.enhancedIsolated==='true') return;

    /* chart-enhance.js has already captured this canvas by reference. Keep it as the
       visible chart, but move the legacy app.js renderer onto an off-screen sink. */
    canvas.dataset.enhancedIsolated='true';
    canvas.id='chartEnhanced';

    const sinkWrap=document.createElement('div');
    sinkWrap.setAttribute('aria-hidden','true');
    sinkWrap.style.cssText='position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:0;';
    const sink=document.createElement('canvas');
    sink.id='chart';
    sink.width=1;
    sink.height=1;
    sinkWrap.appendChild(sink);
    document.body.appendChild(sinkWrap);
  }

  function ensureMarketChoiceStyle(){
    if(document.getElementById('marketChoiceStyle')) return;
    const style=document.createElement('style');
    style.id='marketChoiceStyle';
    style.textContent=`
      .live-rate-card{cursor:pointer;position:relative;transition:border-color .16s ease,background .16s ease,transform .16s ease}.live-rate-card::after{content:"Select";position:absolute;right:10px;top:9px;color:var(--muted-2);font-size:9px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.live-rate-card:hover{border-color:rgba(84,224,180,.22);background:rgba(84,224,180,.05)}.live-rate-card:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.live-rate-card.is-selected{border-color:rgba(84,224,180,.34);background:rgba(84,224,180,.09)}.live-rate-card.is-selected::after{content:"Selected";color:var(--accent)}.live-rate-delta{margin-top:5px!important;color:var(--text)!important;font-weight:700}.live-rate-delta.is-higher{color:var(--warm)!important}.live-rate-delta.is-lower{color:var(--accent)!important}.live-rate-selection-note{margin:9px 0 0;color:var(--muted-2);font-size:10px;line-height:1.4}.rate-buttons.has-market-choice{opacity:.45}.rate-buttons.has-market-choice button.active{background:rgba(255,255,255,.06);color:var(--text)}.setup-first-run-note{margin:12px 0 0;padding:12px 14px;border:1px solid rgba(84,224,180,.14);border-radius:13px;background:rgba(84,224,180,.045);color:var(--muted);font-size:11px;line-height:1.45}.setup-first-run-note strong{display:block;margin-bottom:3px;color:var(--text);font-size:12px}.clear-local-data{margin-left:auto}.clear-local-data.danger{border-color:rgba(232,124,124,.24);color:#e9b3b3}@media(max-width:700px){.live-rate-card{min-height:86px}.clear-local-data{margin-left:0}}
    `;
    document.head.appendChild(style);
  }

  function parseMoney(text){
    const value=Number(String(text||'').replace(/[^0-9.-]/g,''));
    return Number.isFinite(value)?value:0;
  }

  function choiceType(card){
    const label=card?.querySelector('span')?.textContent||'';
    return /5-year/i.test(label)?'five-year':'two-year';
  }

  function decorateMarketChoices(){
    const box=document.getElementById('liveRateChoices');
    if(!box) return;
    ensureMarketChoiceStyle();
    const currentPayment=Math.max(0,Number(window.MortgageStore?.get?.().payment)||0);
    const saved=localStorage.getItem(MARKET_CHOICE_KEY)||'';
    const cards=[...box.querySelectorAll('.live-rate-card')];
    cards.forEach((card)=>{
      const type=choiceType(card);
      card.dataset.marketChoice=type;
      card.setAttribute('role','button');
      card.setAttribute('tabindex','0');
      card.setAttribute('aria-pressed',String(saved===type));
      card.classList.toggle('is-selected',saved===type);
      const payment=parseMoney(card.querySelector('small')?.textContent);
      let delta=card.querySelector('.live-rate-delta');
      if(!delta){
        delta=document.createElement('small');
        delta.className='live-rate-delta';
        card.appendChild(delta);
      }
      const difference=payment-currentPayment;
      delta.classList.toggle('is-higher',difference>0.5);
      delta.classList.toggle('is-lower',difference<-0.5);
      setText(delta,Math.abs(difference)<0.5?'About the same as your current payment':`${difference>0?'+':'−'}£${Math.round(Math.abs(difference))}/month vs current payment`);
    });
    let note=box.querySelector('.live-rate-selection-note');
    if(!note){
      note=document.createElement('p');
      note.className='live-rate-selection-note';
      box.appendChild(note);
    }
    setText(note,saved?'Selected benchmark is mirrored in the next-rate estimate above. These are planning figures, not personalised offers.':'Select a benchmark to mirror it in the next-rate estimate above.');
    document.getElementById('rateButtons')?.classList.toggle('has-market-choice',Boolean(saved));
    if(saved){
      const selected=cards.find((card)=>card.dataset.marketChoice===saved);
      applyMarketChoice(selected,false);
    }
  }

  function applyMarketChoice(card,persist=true){
    if(!card) return;
    const type=choiceType(card);
    const rate=Number(String(card.querySelector('strong')?.textContent||'').replace('%',''));
    const payment=parseMoney(card.querySelector('small')?.textContent);
    if(!Number.isFinite(rate)||rate<=0||payment<=0) return;
    if(persist) localStorage.setItem(MARKET_CHOICE_KEY,type);
    document.querySelectorAll('.live-rate-card').forEach((item)=>{
      const selected=item===card;
      item.classList.toggle('is-selected',selected);
      item.setAttribute('aria-pressed',String(selected));
    });
    const paymentTarget=document.getElementById('nextRatePayment');
    const labelTarget=document.getElementById('nextRateLabel');
    const noteTarget=document.getElementById('rateNote');
    setText(paymentTarget,new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(payment));
    setText(labelTarget,`${type==='five-year'?'5-year':'2-year'} benchmark · ${rate.toFixed(2)}%`);
    setText(noteTarget,'Indicative payment at your projected deal-end balance, using the selected market benchmark. Fees, eligibility and lender criteria are not included.');
    document.querySelectorAll('#rateButtons button').forEach((button)=>button.classList.remove('active'));
    document.getElementById('rateButtons')?.classList.add('has-market-choice');
    setText(document.querySelector('#liveRateChoices .live-rate-selection-note'),'Selected benchmark is mirrored in the next-rate estimate above. These are planning figures, not personalised offers.');
  }

  function clearAllMortgageData(){
    const confirmed=window.confirm('Clear all Mortgage Manager data saved on this device? Export a backup first if you may want it later.');
    if(!confirmed) return;
    const keys=[];
    for(let i=0;i<localStorage.length;i+=1){
      const key=localStorage.key(i);
      if(key?.startsWith('mortgage-manager')) keys.push(key);
    }
    keys.forEach((key)=>localStorage.removeItem(key));
    window.location.reload();
  }

  function polishSetupModal(){
    ensureMarketChoiceStyle();
    document.getElementById('dataBackupSection')?.remove();
    const modal=document.querySelector('.personal-modal');
    if(!modal) return;
    const firstRun=!localStorage.getItem(SETUP_KEY);
    const title=modal.querySelector('#personalModalTitle');
    const intro=modal.querySelector('.personal-modal-head p:last-of-type');
    if(firstRun){
      setText(title,'Set up your mortgage');
      setText(intro,'Enter the figures from your latest mortgage statement. Everything is saved only on this device.');
      if(!modal.querySelector('.setup-first-run-note')){
        const note=document.createElement('div');
        note.className='setup-first-run-note';
        note.innerHTML='<strong>About two minutes to set up</strong>Start with your current balance, payment and rate. Add your fixed-rate end and home value if you have them; you can change anything later.';
        modal.querySelector('.personal-modal-head')?.insertAdjacentElement('afterend',note);
      }
    }
    const sections=[...modal.querySelectorAll('.personal-section')];
    const backupSection=sections.find((section)=>section.querySelector('h3')?.textContent.trim()==='Backup');
    if(backupSection){
      setText(backupSection.querySelector('h3'),'Backup & restore');
      setText(backupSection.querySelector('p'),'Export a portable copy of everything saved by Mortgage Manager before changing device, clearing browser data or resetting the app.');
      const actions=backupSection.querySelector('.personal-actions');
      if(actions&&!actions.querySelector('.clear-local-data')){
        const clear=document.createElement('button');
        clear.type='button';
        clear.className='personal-button danger clear-local-data';
        clear.textContent='Clear all local data';
        clear.addEventListener('click',clearAllMortgageData);
        actions.appendChild(clear);
      }
    }
  }

  function refineConnectivityCopy(){
    const control=document.getElementById('connectivityMode');
    if(!control) return;
    const online=control.querySelector('[data-connectivity-switch]')?.getAttribute('aria-checked')==='true';
    setText(control.querySelector('[data-connectivity-title]'),online?'Online':'Offline');
    setText(control.querySelector('[data-connectivity-subtitle]'),online?'Refresh market benchmarks':'Private on this device');
  }

  function wireMarketChoices(){
    ensureMarketChoiceStyle();
    document.addEventListener('click',(event)=>{
      const card=event.target.closest?.('.live-rate-card');
      if(card) applyMarketChoice(card,true);
      if(event.target.closest?.('#personalDataButton')) window.setTimeout(polishSetupModal,0);
      if(event.target.closest?.('[data-connectivity-switch]')) window.setTimeout(refineConnectivityCopy,0);
    });
    document.addEventListener('keydown',(event)=>{
      const card=event.target.closest?.('.live-rate-card');
      if(!card||(event.key!=='Enter'&&event.key!==' ')) return;
      event.preventDefault();
      applyMarketChoice(card,true);
    });
    const observer=new MutationObserver(()=>{
      decorateMarketChoices();
      polishSetupModal();
      refineConnectivityCopy();
    });
    observer.observe(document.body,{childList:true,subtree:true});
    decorateMarketChoices();
    polishSetupModal();
    refineConnectivityCopy();
    window.MortgageStore?.subscribe?.(()=>window.setTimeout(decorateMarketChoices,20));
  }

  const settle = () => {
    isolateEnhancedChart();
    wireMarketChoices();
    /* page-refine performs its final layout pass at ~1300ms */
    window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.documentElement.classList.remove('app-hydrating','app-settling');
          document.documentElement.classList.add('app-ready');
        });
      });
    }, 1360);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', settle, { once:true });
  } else {
    settle();
  }
})();
