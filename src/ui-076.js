(() => {
  const $ = (id) => document.getElementById(id);

  function collapseCostComparison() {
    const section = $('propertyCostComparison');
    if (!section || section.tagName === 'DETAILS') return;

    const details = document.createElement('details');
    details.id = section.id;
    details.className = section.className;
    details.innerHTML = `<summary><span>Additional information<span class="property-cost-subtitle">Costs & long-term value</span></span></summary><div class="property-cost-body"></div>`;
    const body = details.querySelector('.property-cost-body');
    const heading = section.querySelector('.deep-heading');
    if (heading) heading.remove();
    while (section.firstChild) body.appendChild(section.firstChild);
    section.replaceWith(details);
  }

  function removeStandaloneEquityProgress() {
    const section = $('equityGrowth');
    if (section) section.hidden = true;
  }

  function refresh() {
    collapseCostComparison();
    removeStandaloneEquityProgress();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-expand-card]')) setTimeout(refresh, 30);
  });

  requestAnimationFrame(refresh);
  setTimeout(refresh, 250);
})();