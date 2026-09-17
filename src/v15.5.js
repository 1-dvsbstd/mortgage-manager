(() => {
  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;

  function mergeActionIntoTrajectory(){
    const current = $('.app-view-current .app-view-content');
    const action = $('.v15-action-card', current);
    const chart = $('.chart-panel.trajectory-with-what-if', current);
    if(!action || !chart || chart.contains(action)) return;
    const controls = $('.trajectory-scenario-controls', chart);
    if(controls) controls.insertAdjacentElement('afterend', action);
    else {
      const wrap = $('.chart-wrap', chart);
      if(wrap) chart.insertBefore(action, wrap); else chart.appendChild(action);
    }
  }

  function integrateFutureAssumption(){
    const future = $('.app-view-future');
    const heading = $('.app-view-heading', future);
    const assumption = $('#futureOverpaymentAssumption', future) || document.getElementById('futureOverpaymentAssumption');
    if(!heading || !assumption) return;
    heading.classList.add('future-heading-integrated');
    if(assumption.parentElement !== heading) heading.appendChild(assumption);
  }

  function run(){
    mergeActionIntoTrajectory();
    integrateFutureAssumption();
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
