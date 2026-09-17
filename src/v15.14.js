(() => {
  const BUILD='01519';
  const MIN_SETTLE_MS=850;

  function ensureFinalStyle(){
    let link=document.getElementById('offlineV1FinalStyle');
    if(link) {
      link.href=`src/offline-v1-final.css?v=${BUILD}`;
      return link;
    }
    link=document.createElement('link');
    link.id='offlineV1FinalStyle';
    link.rel='stylesheet';
    link.href=`src/offline-v1-final.css?v=${BUILD}`;
    document.head.appendChild(link);
    return link;
  }

  function ensureFinalScript(){
    let script=document.getElementById('offlineV1FinalScript');
    if(script) {
      if(!script.src.includes(`v=${BUILD}`)) {
        script.remove();
        script=null;
      } else return script;
    }
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
