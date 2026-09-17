(() => {
  const reveal = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove('app-hydrating');
        document.documentElement.classList.add('app-ready');
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reveal, { once:true });
  } else {
    reveal();
  }
})();
