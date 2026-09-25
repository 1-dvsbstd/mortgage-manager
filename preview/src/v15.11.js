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

  // Initialise once. Do not rerun layout code for ordinary clicks: the whole
  // Current view sits inside [data-app-view], so the old delegated handler
  // caused an 80ms post-click reflow on every mouse-up.
  if (window.MortgageStore?.subscribe) {
    MortgageStore.subscribe((next, previous) => {
      if (next !== previous) requestAnimationFrame(run);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once:true });
  } else {
    run();
  }
})();
