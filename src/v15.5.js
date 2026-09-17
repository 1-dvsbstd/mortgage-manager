(() => {
  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;

  function removeDuplicateAction(){
    $('.app-view-current .v15-action-card')?.remove();
  }

  function integrateFutureAssumption(){
    const future = $('.app-view-future');
    const heading = $('.app-view-heading', future);
    const assumption = $('#futureOverpaymentAssumption', future) || document.getElementById('futureOverpaymentAssumption');
    if(!heading || !assumption) return;
    heading.classList.add('future-heading-integrated');
    if(assumption.parentElement !== heading) heading.appendChild(assumption);
  }

  function refineFutureWaitCopy(){
    const wait = document.getElementById('futureWaitPlanner');
    if(!wait) return;
    const eyebrow = $('.future-wait-heading .eyebrow', wait);
    const title = $('.future-wait-heading h2', wait);
    if(eyebrow) eyebrow.textContent = 'Looking ahead';
    if(title) title.textContent = 'How your next-home budget could grow over time';
  }

  function run(){
    removeDuplicateAction();
    integrateFutureAssumption();
    refineFutureWaitCopy();
  }

  if(window.MortgageStore?.subscribe) MortgageStore.subscribe(() => requestAnimationFrame(run));
  document.addEventListener('click', (event) => {
    if(event.target.closest('[data-app-view="current"],[data-app-view="future"]')) setTimeout(run, 80);
  });

  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => [250,700,1300].forEach((delay) => setTimeout(run, delay)), { once:true });
  } else {
    [0,350,900].forEach((delay) => setTimeout(run, delay));
  }
})();
