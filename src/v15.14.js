(() => {
  function loadFinalPolish(){
    if(!document.getElementById('offlineV1FinalStyle')){
      const link=document.createElement('link');
      link.id='offlineV1FinalStyle';
      link.rel='stylesheet';
      link.href='src/offline-v1-final.css?v=01515';
      document.head.appendChild(link);
    }
    if(!document.getElementById('offlineV1FinalScript')){
      const script=document.createElement('script');
      script.id='offlineV1FinalScript';
      script.src='src/offline-v1-final.js?v=01515';
      script.defer=true;
      document.body.appendChild(script);
    }
  }

  const reveal = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove('app-hydrating');
        document.documentElement.classList.add('app-ready');
      });
    });
  };

  const ready=()=>{
    reveal();
    window.setTimeout(loadFinalPolish,0);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready, { once:true });
  } else {
    ready();
  }
})();
