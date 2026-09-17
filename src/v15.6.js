(() => {
  function polish(){
    document.querySelector('.v15-action-card')?.remove();
    const wait=document.getElementById('futureWaitPlanner');
    if(wait){
      const eyebrow=wait.querySelector('.future-wait-heading .eyebrow');
      const title=wait.querySelector('.future-wait-heading h2');
      if(eyebrow) eyebrow.textContent='Looking ahead';
      if(title) title.textContent='How your next-home budget could grow over time';
    }
  }
  const run=()=>{ polish(); requestAnimationFrame(polish); setTimeout(polish,350); setTimeout(polish,1000); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
  if(window.MortgageStore?.subscribe) MortgageStore.subscribe(()=>requestAnimationFrame(polish));
})();
