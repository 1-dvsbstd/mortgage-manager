(() => {
  const MARKET_CACHE_KEY='mortgage-manager-market-cache-v1';
  const SETUP_KEY='mortgage-manager-personal-setup-v1';

  function setText(node,text){
    if(node&&node.textContent!==text) node.textContent=text;
  }

  function isolateEnhancedChart(){
    const canvas=document.getElementById('chart');
    if(!canvas||canvas.dataset.enhancedIsolated==='true') return;
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

  function relocateMarketChoices(){
    const box=document.getElementById('liveRateChoices');
    if(!box) return;
    const host=document.querySelector('.upcoming-rates .upcoming-section-body');
    if(host&&box.parentElement!==host) host.appendChild(box);
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

  function ensureMethodologySection(modal){
    if(!modal||modal.querySelector('#methodologySection')) return;
    const section=document.createElement('details');
    section.id='methodologySection';
    section.className='personal-section methodology-section';
    section.innerHTML=`<summary><span><strong>How calculations work</strong><small>Assumptions behind your projections</small></span><span class="history-summary-chevron">+</span></summary><div class="mortgage-history-body methodology-body"><div class="methodology-grid"><div class="methodology-item"><strong>Mortgage projection</strong><p>Repayment projections use your current balance, interest rate, monthly payment and any selected regular overpayment. Interest is modelled monthly and results are illustrative rather than a lender statement.</p></div><div class="methodology-item"><strong>Overpayments</strong><p>Interest saved and term reduction compare the selected overpayment scenario with the same mortgage continuing without that extra payment. One-off overpayments are applied from their recorded date where the history model supports it.</p></div><div class="methodology-item"><strong>Home value & equity</strong><p>Equity and LTV use the home value you enter plus any growth assumption you choose. Future property values are estimates, not valuations, and actual sale or lender valuations may differ materially.</p></div><div class="methodology-item"><strong>Market-rate projections</strong><p>Online mode fetches dated Bank of England quoted household mortgage-rate benchmarks. Your mortgage data stays on this device; the benchmark is combined locally with your projected balance to estimate a future payment. The current feed uses directly comparable 75% and 95% LTV two- and five-year series, with the 95% rate used as a conservative proxy above 75% LTV.</p></div></div><p class="methodology-disclaimer"><strong>Planning tool, not financial advice.</strong> Mortgage Manager provides estimates to help you explore scenarios. It does not assess eligibility, affordability, fees, early-repayment charges, lender criteria, taxes or whether a particular mortgage is suitable for you. Check important decisions against your lender, broker or other appropriate professional information.</p></div>`;
    const backup=[...modal.querySelectorAll('.personal-section')].find((item)=>['Backup','Backup & restore'].includes(item.querySelector('h3,strong')?.textContent?.trim()));
    if(backup) backup.insertAdjacentElement('beforebegin',section);
    else modal.appendChild(section);
  }

  function polishSetupModal(){
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
    const backupSection=sections.find((section)=>['Backup','Backup & restore'].includes(section.querySelector('h3')?.textContent.trim()));
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
    ensureMethodologySection(modal);
  }

  function readMarketSnapshot(){
    try{return JSON.parse(localStorage.getItem(MARKET_CACHE_KEY)||'null');}
    catch(_){return null;}
  }

  function migrateLegacyMarketCache(){
    const cached=readMarketSnapshot();
    if(!cached) return;
    if(Number(cached.schema||0)<2||/Moneyfacts/i.test(String(cached.source||''))) localStorage.removeItem(MARKET_CACHE_KEY);
  }

  function refineMarketSourceCopy(){
    const source=document.querySelector('.market-block .source-date');
    if(!source) return;
    const cached=readMarketSnapshot();
    const label=cached?.sourceShort||cached?.source||'Bank of England';
    const text=source.textContent||'';
    if(/Moneyfacts|UK benchmark/i.test(text)) setText(source,text.replace(/Moneyfacts|UK benchmark/ig,label));
  }

  function refineConnectivityCopy(){
    const control=document.getElementById('connectivityMode');
    if(!control) return;
    const online=control.querySelector('[data-connectivity-switch]')?.getAttribute('aria-checked')==='true';
    setText(control.querySelector('[data-connectivity-title]'),online?'Online':'Offline');
    const subtitle=!online?'Private on this device':(!navigator.onLine?'No connection · using saved data':'Refresh market benchmarks');
    setText(control.querySelector('[data-connectivity-subtitle]'),subtitle);
  }

  function refreshPolish(){
    relocateMarketChoices();
    polishSetupModal();
    refineMarketSourceCopy();
    refineConnectivityCopy();
  }

  function wireOfflineV1Polish(){
    document.addEventListener('click',(event)=>{
      if(event.target.closest?.('#personalDataButton')) requestAnimationFrame(polishSetupModal);
      if(event.target.closest?.('[data-connectivity-switch]')) requestAnimationFrame(refineConnectivityCopy);
    });
    window.addEventListener('online',refineConnectivityCopy);
    window.addEventListener('offline',refineConnectivityCopy);

    const observer=new MutationObserver((mutations)=>{
      let shouldRefresh=false;
      for(const mutation of mutations){
        for(const node of mutation.addedNodes){
          if(node.nodeType!==1) continue;
          if(node.id==='liveRateChoices'||node.matches?.('.personal-modal')||node.querySelector?.('#liveRateChoices,.personal-modal')){
            shouldRefresh=true;
            break;
          }
        }
        if(shouldRefresh) break;
      }
      if(shouldRefresh) requestAnimationFrame(refreshPolish);
    });
    observer.observe(document.body,{childList:true,subtree:true});
    refreshPolish();
  }

  const settle=()=>{
    migrateLegacyMarketCache();
    isolateEnhancedChart();
    wireOfflineV1Polish();
    requestAnimationFrame(()=>{
      window.dispatchEvent(new Event('resize'));
      document.documentElement.classList.remove('app-hydrating','app-settling');
      document.documentElement.classList.add('app-ready');
    });
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',settle,{once:true});
  else settle();
})();
