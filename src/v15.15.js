(() => {
  function isolateEnhancedChart(){
    const canvas=document.getElementById('chart');
    if(!canvas||canvas.dataset.enhancedIsolated==='true') return;

    /* chart-enhance.js has already captured this canvas by reference. Keep it as the
       visible chart, but move the legacy app.js renderer onto an off-screen sink. */
    canvas.dataset.enhancedIsolated='true';
    canvas.id='chartEnhanced';

    const sinkWrap=document.createElement('div');
    sinkWrap.setAttribute('aria-hidden','true');
    sinkWrap.style.cssText='position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:0;';
    const sink=document.createElement('canvas');
    sink.id='chart';
    sink.width=1;
    sink.height=1;
    sinkWrap.appendChild(sink);
    document.body.appendChild(sinkWrap);
  }

  const settle = () => {
    isolateEnhancedChart();
    /* page-refine performs its final layout pass at ~1300ms */
    window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.documentElement.classList.remove('app-hydrating','app-settling');
          document.documentElement.classList.add('app-ready');
        });
      });
    }, 1360);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', settle, { once:true });
  } else {
    settle();
  }
})();
