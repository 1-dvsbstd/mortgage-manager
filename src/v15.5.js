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

  function refineModelRange(){
    const panel = $('#futureModelRange');
    const range = $('#homeProfileRange');
    if(!panel || !range) return;

    const eyebrow = $('.future-model-heading .eyebrow', panel);
    const title = $('.future-model-heading h2', panel);
    if(eyebrow) eyebrow.textContent = 'Estimate range';
    if(title) title.textContent = 'A sensible range for today’s home value';

    if(range.dataset.rangeRefined !== 'true'){
      const low = $('#homeRangeLow', range)?.textContent || '—';
      const centre = $('#homeRangeTrend', range)?.textContent || '—';
      const high = $('#homeRangeHigh', range)?.textContent || '—';
      const note = $('#homeProfileRangeNote', range)?.textContent || 'Based on your purchase details and growth assumptions.';

      range.dataset.rangeRefined = 'true';
      range.innerHTML = `
        <div class="v157-range-copy">
          <span>Planning range today</span>
          <strong><span id="homeRangeLow">${low}</span> <i>to</i> <span id="homeRangeHigh">${high}</span></strong>
          <small id="homeProfileRangeNote">${note}</small>
        </div>
        <div class="v157-range-scale" aria-label="Lower, centre and higher home value estimates">
          <div class="v157-range-line"><i class="v157-centre-marker"></i></div>
          <div class="v157-range-labels">
            <div><span>Lower growth</span><strong data-range-low>${low}</strong></div>
            <div class="is-centre"><span>Centre estimate</span><strong id="homeRangeTrend">${centre}</strong></div>
            <div><span>Higher growth</span><strong data-range-high>${high}</strong></div>
          </div>
        </div>`;
    }

    const lowMirror = $('[data-range-low]', range);
    const highMirror = $('[data-range-high]', range);
    if(lowMirror) lowMirror.textContent = $('#homeRangeLow', range)?.textContent || '—';
    if(highMirror) highMirror.textContent = $('#homeRangeHigh', range)?.textContent || '—';
  }

  function run(){
    removeDuplicateAction();
    integrateFutureAssumption();
    refineFutureWaitCopy();
    refineModelRange();
  }

  if(window.MortgageStore?.subscribe) MortgageStore.subscribe(() => requestAnimationFrame(run));
  document.addEventListener('click', (event) => {
    if(event.target.closest('[data-app-view="current"],[data-app-view="future"]')) setTimeout(run, 80);
  });

  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => [250,700,1300,2100].forEach((delay) => setTimeout(run, delay)), { once:true });
  } else {
    [0,350,900,1700].forEach((delay) => setTimeout(run, delay));
  }
})();
