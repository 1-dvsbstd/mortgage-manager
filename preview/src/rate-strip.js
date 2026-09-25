(() => {
  const hero = document.querySelector('.hero-panel');
  if (!hero || document.getElementById('dashboardRateStrip')) return;

  const strip = document.createElement('section');
  strip.id = 'dashboardRateStrip';
  strip.className = 'dashboard-rate-strip';
  strip.innerHTML = `
    <div class="dashboard-rate-head">
      <div>
        <p class="eyebrow">Rate check</p>
        <h2>Your rate vs the market</h2>
      </div>
      <span class="source-date">Moneyfacts · 1 Sep 2026</span>
    </div>
    <div class="dashboard-rate-grid">
      <div class="dashboard-rate-card current">
        <span>Your rate</span>
        <strong id="dashYourRate">—</strong>
        <small id="dashLtvBand">—</small>
      </div>
      <div class="dashboard-rate-card">
        <span>Avg 2-year fix</span>
        <strong id="dash2yRate">—</strong>
        <small id="dash2yPayment">—</small>
      </div>
      <div class="dashboard-rate-card">
        <span>Avg 5-year fix</span>
        <strong id="dash5yRate">—</strong>
        <small id="dash5yPayment">—</small>
      </div>
    </div>
  `;

  hero.insertAdjacentElement('afterend', strip);

  const mappings = [
    ['marketCurrentRate', 'dashYourRate'],
    ['marketLtvBand', 'dashLtvBand'],
    ['market2yRate', 'dash2yRate'],
    ['market2yPayment', 'dash2yPayment'],
    ['market5yRate', 'dash5yRate'],
    ['market5yPayment', 'dash5yPayment'],
  ];

  const sync = () => {
    mappings.forEach(([sourceId, targetId]) => {
      const source = document.getElementById(sourceId);
      const target = document.getElementById(targetId);
      if (source && target) target.textContent = source.textContent;
    });
  };

  sync();
  const observer = new MutationObserver(sync);
  mappings.forEach(([sourceId]) => {
    const source = document.getElementById(sourceId);
    if (source) observer.observe(source, { childList: true, characterData: true, subtree: true });
  });
})();
