(() => {
  function standardiseSetupClose() {
    const button = document.querySelector('.personal-modal .personal-close');
    if (!button) return;
    button.textContent = 'Close';
    button.setAttribute('aria-label', 'Close setup and data');
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('#personalDataButton')) requestAnimationFrame(standardiseSetupClose);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const button = document.querySelector('.personal-modal .personal-close');
    if (button) button.click();
  });

  requestAnimationFrame(standardiseSetupClose);
})();
