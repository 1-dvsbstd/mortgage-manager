(() => {
  function removeLegacyRateStrip() {
    document.getElementById('dashboardRateStrip')?.remove();
  }

  removeLegacyRateStrip();
  const bodyObserver = new MutationObserver(removeLegacyRateStrip);
  if (document.body) bodyObserver.observe(document.body, { childList: true, subtree: true });

  const chart = document.getElementById('chart');
  const trajectory = document.querySelector('[data-expandable-card="trajectory"]');

  function nudgeChart() {
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });
  }

  if (chart) {
    chart.addEventListener('pointerup', (event) => {
      if (event.pointerType !== 'touch') return;
      event.preventDefault();
      const rect = chart.getBoundingClientRect();
      chart.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        clientX: Math.max(rect.left, Math.min(rect.right, event.clientX)),
        clientY: Math.max(rect.top, Math.min(rect.bottom, event.clientY)),
      }));
    }, { passive: false });
  }

  if (trajectory) {
    new MutationObserver(nudgeChart).observe(trajectory, {
      attributes: true,
      attributeFilter: ['class', 'aria-expanded'],
    });
  }

  window.addEventListener('pageshow', nudgeChart);
  window.addEventListener('orientationchange', nudgeChart);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) nudgeChart();
  });
  nudgeChart();
})();
