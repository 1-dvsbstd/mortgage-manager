(() => {
  const MARKET_CACHE_KEY='mortgage-manager-market-cache-v1';
  const SETUP_KEY='mortgage-manager-personal-setup-v1';

  const setText=(node,text)=>{
    if(node&&node.textContent!==text) node.textContent=text;
  };

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
    const section=document.createElement('section');
    section.id='methodologySection';
    section.className='personal-section methodology-section';
    section.innerHTML=`
      <button type="button" class="methodology-toggle" aria-expanded="false" aria-controls="methodologyBody">
        <span><strong>How Mortgage Manager calculates</strong><small>See how projections, valuations and planning estimates are worked out.</small></span>
        <i aria-hidden="true"></i>
      </button>
      <div id="methodologyBody" class="mortgage-history-body methodology-body" hidden>
        <div class="methodology-grid">
          <div class="methodology-item"><strong>Mortgage projection</strong><p>Uses your balance, rate, payment and selected overpayment. Interest is modelled monthly.</p></div>
          <div class="methodology-item"><strong>Overpayments</strong><p>Compares the selected repayment path with the same mortgage without that extra payment.</p></div>
          <div class="methodology-item"><strong>Home value</strong><p>Starts from your purchase price and applies local property-type HPI movement. A recent valuation overrides the model.</p></div>
          <div class="methodology-item"><strong>Property forecast</strong><p>Uses the local historical HPI growth distribution for 1, 3 and 5-year estimates.</p></div>
          <div class="methodology-item"><strong>Next-home planning</strong><p>Combines projected equity, savings and your borrowing-multiple assumption. It is not a lender affordability check.</p></div>
          <div class="methodology-item"><strong>Market rates</strong><p>Upcoming uses dated market benchmarks when available. They are planning references, not mortgage offers.</p></div>
        </div>
        <p class="methodology-disclaimer"><strong>Planning estimates only.</strong> Actual valuations, lender affordability, fees, taxes and mortgage terms can differ.</p>
      </div>`;

    const toggle=section.querySelector('.methodology-toggle');
    const body=section.querySelector('.methodology-body');
    toggle?.addEventListener('click',()=>{
      const open=toggle.getAttribute('aria-expanded')==='true';
      toggle.setAttribute('aria-expanded',String(!open));
      if(body) body.hidden=open;
    });

    const currentPane=modal.querySelector('[data-setup-pane="current"]');
    const sections=[...modal.querySelectorAll('.personal-section')];
    const backup=sections.find((item)=>['Backup','Backup & restore'].includes(item.querySelector('h3,strong')?.textContent?.trim()));
    if(backup&&currentPane?.contains(backup)) backup.insertAdjacentElement('beforebegin',section);
    else if(currentPane) currentPane.appendChild(section);
    else if(backup) backup.insertAdjacentElement('beforebegin',section);
    else modal.appendChild(section);
  }


  function polishSetupModal(){
    const modal=document.querySelector('.personal-modal');
    if(!modal) return;

    const firstRun=!localStorage.getItem(SETUP_KEY);
    const title=modal.querySelector('#personalModalTitle');
    const intro=modal.querySelector('.personal-modal-head p:last-of-type');
    if(firstRun){
      setText(title,'Set up your mortgage');
      setText(intro,'Enter the figures from your latest mortgage statement. Everything is saved only on this device.');
    }

    const backup=[...modal.querySelectorAll('.personal-section')]
      .find((section)=>['Backup','Backup & restore'].includes(section.querySelector('h3')?.textContent?.trim()));
    const footer=modal.querySelector('.personal-footer-actions');

    if(backup&&footer){
      const actions=backup.querySelector('.personal-actions');
      if(actions){
        actions.classList.add('setup-backup-actions');
        actions.querySelector('.clear-local-data')?.remove();
        if(actions.parentElement!==footer) footer.prepend(actions);
        const theme=modal.querySelector('.theme-menu');
        if(theme&&theme.parentElement!==actions) actions.appendChild(theme);
      }
      backup.remove();
    }

    const duplicateBackup=modal.querySelector('#dataBackupSection');
    duplicateBackup?.remove();

    ensureMethodologySection(modal);
  }

  function refineConnectivityCopy(){
    const control=document.getElementById('connectivityMode');
    if(!control) return;
    const online=control.querySelector('[data-connectivity-switch]')?.getAttribute('aria-checked')==='true';
    setText(control.querySelector('[data-connectivity-title]'),online?'Online':'Offline');
    setText(
      control.querySelector('[data-connectivity-subtitle]'),
      !online?'Private on this device':(!navigator.onLine?'No connection · using saved data':'Refresh market benchmarks')
    );
  }

  function migrateLegacyMarketCache(){
    try{
      const cached=JSON.parse(localStorage.getItem(MARKET_CACHE_KEY)||'null');
      if(cached&&Number(cached.schema||0)<3){
        localStorage.removeItem(MARKET_CACHE_KEY);
      }
    }catch(_){}
  }

  function refresh(){
    polishSetupModal();
    refineConnectivityCopy();
  }

  function start(){
    migrateLegacyMarketCache();
    refresh();
    document.addEventListener('mortgage-setup-opened',()=>requestAnimationFrame(polishSetupModal));
    document.addEventListener('click',(event)=>{
      if(event.target.closest?.('#personalDataButton')) setTimeout(polishSetupModal,0);
      if(event.target.closest?.('[data-connectivity-switch]')) setTimeout(refineConnectivityCopy,0);
    });
    window.addEventListener('online',refineConnectivityCopy);
    window.addEventListener('offline',refineConnectivityCopy);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
