(() => {
  const mainViews = ['current','upcoming','future'];

  function disableMainExpansion(){
    mainViews.forEach((view) => {
      document.querySelectorAll(`.app-view-${view} [data-expandable-card]`).forEach((card) => {
        card.dataset.expandableDisabled = 'true';
        card.classList.remove('is-expanded');
        card.setAttribute('aria-expanded','false');
        card.removeAttribute('tabindex');
        card.querySelector('.card-close-bar')?.remove();
      });
    });
    document.body.classList.remove('card-open');
    document.querySelector('.card-backdrop')?.remove();
  }

  function exposeMortgageSummary(){
    const hero = document.querySelector('.app-view-current .hero-panel');
    const tiles = document.getElementById('mortgageExtraTiles');
    if (!hero || !tiles) return;
    tiles.classList.add('is-always-visible');
    tiles.querySelectorAll('[data-mortgage-tile]').forEach((tile) => {
      const target = tile.dataset.mortgageTile;
      if (!target) return;
      tile.dataset.summaryEdit = target;
      tile.classList.add('summary-editable');
      tile.setAttribute('role','button');
      tile.setAttribute('tabindex','0');
      tile.setAttribute('aria-label',`Edit ${tile.querySelector('span')?.textContent?.toLowerCase() || 'mortgage detail'}`);
    });
  }

  function run(){
    disableMainExpansion();
    exposeMortgageSummary();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-app-view]')) setTimeout(run,80);
    if (event.target.closest('#personalDataButton')) setTimeout(run,120);
  });
  if (window.MortgageStore?.subscribe) MortgageStore.subscribe(() => requestAnimationFrame(run));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => [0,250,700,1300].forEach((delay) => setTimeout(run,delay)), { once:true });
  } else {
    [0,250,700].forEach((delay) => setTimeout(run,delay));
  }
})();
