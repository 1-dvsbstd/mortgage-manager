(() => {
  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;

  function refineModelRange(){
    const panel = $('#futureModelRange');
    const range = $('#homeProfileRange');
    if(!panel || !range) return;

    const headingEyebrow = $('.future-model-heading .eyebrow', panel);
    const headingTitle = $('.future-model-heading h2', panel);
    if(headingEyebrow) headingEyebrow.textContent = 'Estimate range';
    if(headingTitle) headingTitle.textContent = 'A sensible range for today’s home value';

    if(range.dataset.v157 === 'true') return;

    const low = $('#homeRangeLow', range)?.textContent || '—';
    const centre = $('#homeRangeTrend', range)?.textContent || '—';
    const high = $('#homeRangeHigh', range)?.textContent || '—';
    const note = $('#homeProfileRangeNote', range)?.textContent || 'Based on your purchase details and growth assumptions.';

    range.dataset.v157 = 'true';
    range.innerHTML = `
      <div class="v157-range-copy">
        <span>Planning range today</span>
        <strong><span id="homeRangeLow">${low}</span> <i>to</i> <span id="homeRangeHigh">${high}</span></strong>
        <small id="homeProfileRangeNote">${note}</small>
      </div>
      <div class="v157-range-scale" aria-label="Low, centre and high home value estimates">
        <div class="v157-range-line"><i class="v157-centre-marker"></i></div>
        <div class="v157-range-labels">
          <div><span>Lower growth</span><strong data-range-low>${low}</strong></div>
          <div class="is-centre"><span>Centre estimate</span><strong id="homeRangeTrend">${centre}</strong></div>
          <div><span>Higher growth</span><strong data-range-high>${high}</strong></div>
        </div>
      </div>`;
  }

  function syncMirrors(){
    const range = $('#homeProfileRange');
    if(!range || range.dataset.v157 !== 'true') return;
    const low = $('#homeRangeLow', range)?.textContent || '—';
    const high = $('#homeRangeHigh', range)?.textContent || '—';
    const lowMirror = $('[data-range-low]', range);
    const highMirror = $('[data-range-high]', range);
    if(lowMirror) lowMirror.textContent = low;
    if(highMirror) highMirror.textContent = high;
  }

  function run(){
    refineModelRange();
    syncMirrors();
  }

  if(window.MortgageStore?.subscribe) MortgageStore.subscribe(() => requestAnimationFrame(run));
  document.addEventListener('click', (event) => {
    if(event.target.closest('[data-app-view="future"]')) setTimeout(run, 100);
  });

  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => [700,1300,2000].forEach((delay) => setTimeout(run, delay)), { once:true });
  } else {
    [0,700,1500].forEach((delay) => setTimeout(run, delay));
  }
})();
