(() => {
  const BUILD='01517';

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
    if(document.getElementById('offlineV1FinalScript')) return;
    const script=document.createElement('script');
    script.id='offlineV1FinalScript';
    script.src=`src/offline-v1-final.js?v=${BUILD}`;
    document.body.appendChild(script);
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
    const style=ensureFinalStyle();
    ensureFinalScript();
    refreshServiceWorker();
    if(style.sheet){ reveal(); return; }
    let finished=false;
    const finish=()=>{ if(finished) return; finished=true; reveal(); };
    style.addEventListener('load',finish,{once:true});
    style.addEventListener('error',finish,{once:true});
    window.setTimeout(finish,700);
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',ready,{once:true});
  else ready();
})();
