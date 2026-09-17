(() => {
  const BUILD='01518';
  const MIN_SETTLE_MS=850;

  function ensureCurrentStabilityStyle(){
    if(document.getElementById('currentPageStabilityStyle')) return;
    const style=document.createElement('style');
    style.id='currentPageStabilityStyle';
    style.textContent=`
      body .app-view-current{cursor:default!important;user-select:none!important;-webkit-user-select:none!important}
      body .app-view-current .hero-panel,
      body .app-view-current .scenario-panel,
      body .app-view-current .home-panel,
      body .app-view-current .chart-panel,
      body .app-view-current .v15-current-stats .v15-stat,
      body .app-view-current .expandable-card,
      body .app-view-current .expandable-card:hover,
      body .app-view-current .expandable-card:active,
      body .app-view-current .expandable-card:focus{
        transform:none!important;
        animation:none!important;
        transition:none!important;
      }
      body .app-view-current button,
      body .app-view-current [role='button'],
      body .app-view-current [data-edit-target],
      body .app-view-current [data-summary-edit],
      body .app-view-current summary{cursor:pointer!important}
      body .app-view-current input,
      body .app-view-current textarea,
      body .app-view-current select{user-select:text!important;-webkit-user-select:text!important;cursor:auto!important}
    `;
    document.head.appendChild(style);
  }

  function currentClickIsInteractive(target){
    return Boolean(target?.closest?.('button,input,label,a,summary,select,textarea,[data-edit-target],[data-summary-edit],[role="button"],canvas'));
  }

  function blockLegacyCurrentClicks(){
    document.addEventListener('click',(event)=>{
      if(!event.target?.closest?.('.app-view-current')) return;
      if(currentClickIsInteractive(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },true);
  }

  function ensureFinalStyle(){
    let link=document.getElementById('offlineV1FinalStyle');
    if(link) return link;
    link=document.createElement('link');
    link.id='offlineV1FinalStyle';
    link.rel='stylesheet';
    link.href=`src/offline-v1-final.css?v=${BUILD}`;
    document.head.appendChild(link);
    return link;
  }

  function ensureFinalScript(){
    let script=document.getElementById('offlineV1FinalScript');
    if(script) return script;
    script=document.createElement('script');
    script.id='offlineV1FinalScript';
    script.src=`src/offline-v1-final.js?v=${BUILD}`;
    document.body.appendChild(script);
    return script;
  }

  function refreshServiceWorker(){
    if(!('serviceWorker' in navigator)||location.protocol==='file:') return;
    const reloadKey=`mortgage-manager-sw-reload-${BUILD}`;
    let reloading=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(reloading||sessionStorage.getItem(reloadKey)==='1') return;
      reloading=true;
      sessionStorage.setItem(reloadKey,'1');
      location.reload();
    });
    navigator.serviceWorker.getRegistration().then((registration)=>registration?.update?.()).catch(()=>{});
  }

  const reveal=()=>{
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      document.documentElement.classList.remove('app-hydrating','app-settling');
      document.documentElement.classList.add('app-ready');
    }));
  };

  const ready=()=>{
    ensureCurrentStabilityStyle();
    blockLegacyCurrentClicks();
    const started=performance.now();
    const style=ensureFinalStyle();
    const script=ensureFinalScript();
    refreshServiceWorker();

    let styleReady=Boolean(style.sheet);
    let scriptReady=Boolean(script.dataset.loaded==='true');
    let finished=false;

    const maybeReveal=()=>{
      if(finished||!styleReady||!scriptReady) return;
      finished=true;
      const elapsed=performance.now()-started;
      window.setTimeout(reveal,Math.max(0,MIN_SETTLE_MS-elapsed));
    };

    if(!styleReady){
      style.addEventListener('load',()=>{styleReady=true;maybeReveal();},{once:true});
      style.addEventListener('error',()=>{styleReady=true;maybeReveal();},{once:true});
    }
    if(!scriptReady){
      script.addEventListener('load',()=>{script.dataset.loaded='true';scriptReady=true;maybeReveal();},{once:true});
      script.addEventListener('error',()=>{scriptReady=true;maybeReveal();},{once:true});
    }
    maybeReveal();
    window.setTimeout(()=>{
      if(finished) return;
      finished=true;
      reveal();
    },1500);
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',ready,{once:true});
  else ready();
})();
