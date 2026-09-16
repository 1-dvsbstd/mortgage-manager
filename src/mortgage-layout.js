(() => {
  // Compact dashboard is read-first. Editing stays in expanded/detail views.
  document.querySelectorAll('.hero-balance-row [data-edit-target], .home-panel > .panel-heading [data-edit-target], .next-panel > .next-heading-row [data-edit-target]').forEach((el) => {
    el.removeAttribute('data-edit-target');
    el.removeAttribute('role');
    el.removeAttribute('tabindex');
    el.classList.remove('inline-edit-trigger', 'editable-metric');
  });

  const heroRow = document.querySelector('.hero-balance-row');
  if (heroRow && !document.getElementById('currentOverpayDisplay')) {
    const overpay = document.createElement('div');
    overpay.className = 'hero-overpay-summary';
    overpay.innerHTML = '<span>Overpayment</span><strong id="currentOverpayDisplay"><span class="current-overpay-amount">£0</span><span class="current-overpay-suffix">/month</span></strong>';
    heroRow.appendChild(overpay);
  }

  const scenario = document.querySelector('.scenario-panel');
  if (!scenario) return;

  const top = scenario.querySelector('.scenario-top');
  const slider = document.getElementById('extraSlider');
  const chips = document.getElementById('overpayButtons');
  const detail = scenario.querySelector('.expand-detail');

  if (top) {
    const first = top.querySelector('div:first-child');
    if (first) first.innerHTML = '<span id="overpayHeadline" hidden></span>';
    const summary = document.getElementById('scenarioSummary');
    if (summary && !scenario.querySelector('.what-if-label')) summary.insertAdjacentHTML('beforebegin', '<span class="what-if-label">What if?</span>');
  }

  if (detail && slider && chips && !document.getElementById('currentOverpayment')) {
    detail.insertAdjacentHTML('afterbegin', `
      <div class="current-overpay-control">
        <label>Current regular overpayment (£/month)
          <input id="currentOverpayment" type="number" min="0" step="10" inputmode="decimal" value="0">
        </label>
        <small>This is what you already pay above the scheduled monthly payment.</small>
      </div>
      <div class="deep-heading what-if-heading"><div><p class="eyebrow">What if?</p><h2>Try an extra overpayment</h2></div></div>
    `);
    detail.querySelector('.what-if-heading')?.insertAdjacentElement('afterend', slider);
    slider.insertAdjacentElement('afterend', chips);
  }
})();