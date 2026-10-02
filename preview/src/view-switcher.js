(() => {
  const VIEW_KEY='mortgage-manager-view-v1';
  const valid=new Set(['current','upcoming','future']);

  const readSaved=()=>{
    try{
      const value=localStorage.getItem(VIEW_KEY);
      return valid.has(value)?value:'current';
    }catch(_){
      return 'current';
    }
  };

  const save=(key)=>{
    try{ localStorage.setItem(VIEW_KEY,key); }catch(_){}
  };

  function activate(key,{persist=false,scroll=false}={}){
    if(!valid.has(key)) key='current';

    document.querySelectorAll('.app-view').forEach((view)=>{
      const active=view.dataset.view===key;
      view.hidden=!active;
      view.classList.toggle('is-active',active);
    });

    document.querySelectorAll('[data-app-view]').forEach((button)=>{
      const active=button.dataset.appView===key;
      button.classList.toggle('is-active',active);
      if(active) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });

    document.body.dataset.appView=key;
    if(persist) save(key);
    if(scroll) window.scrollTo({top:0,behavior:'smooth'});

    requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
    document.dispatchEvent(new CustomEvent('mortgage-view-changed',{detail:{view:key}}));
  }

  document.addEventListener('click',(event)=>{
    const button=event.target.closest?.('[data-app-view]');
    if(!button) return;
    event.preventDefault();
    activate(button.dataset.appView,{persist:true,scroll:true});
  });

  const start=()=>activate(readSaved());
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();

  window.MortgageViews={activate};
})();
