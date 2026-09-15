(() => {
  const HISTORY_KEY = 'mortgage-manager-history-v1';
  const HOME_KEY = 'mortgage-manager-home-projection-v4';

  function historyCount() {
    try {
      const rows = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(rows) ? new Set(rows.map((row) => row?.month).filter(Boolean)).size : 0;
    } catch (_) { return 0; }
  }

  function homeSettings() {
    try { return JSON.parse(localStorage.getItem(HOME_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }

  function refreshOptionalSections() {
    const progress = document.getElementById('personalProgress');
    if (progress) progress.hidden = historyCount() < 2;

    const cost = document.getElementById('propertyCostComparison');
    if (cost) {
      const settings = homeSettings();
      const purchasePrice = Math.max(0, Number(settings.purchasePrice) || 0);
      const improvements = Math.max(0, Number(settings.improvements) || 0);
      cost.hidden = !(purchasePrice > 0 || improvements > 0);
    }
  }

  const scheduleRefresh = () => setTimeout(refreshOptionalSections, 80);

  document.addEventListener('click', (event) => {
    if (event.target.closest('#recordSnapshot,[data-action="snapshot"],[data-action="save"],[data-action="reset-history"]')) scheduleRefresh();
  });

  document.addEventListener('input', (event) => {
    if (event.target.matches('#projectionPurchasePrice,#projectionImprovements')) scheduleRefresh();
  });

  const app = document.querySelector('.app-shell');
  if (app && 'MutationObserver' in window) {
    new MutationObserver(refreshOptionalSections).observe(app, { childList:true, subtree:true });
  }

  refreshOptionalSections();
  setTimeout(refreshOptionalSections, 500);
})();
