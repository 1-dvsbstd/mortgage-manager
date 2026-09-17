(() => {
  const settle = () => {
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
