(() => {
  const VIEW_KEY = 'mortgage-manager-view-v1';
  const views = {
    current: {
      label: 'Current',
      eyebrow: 'Today',
      title: 'Your position now',
      subtitle: 'What you owe, what you own, what you already overpay, and the progress you have made.',
    },
    upcoming: {
      label: 'Upcoming',
      eyebrow: 'Next',
      title: 'What needs attention next',
      subtitle: 'Your fixed-deal timeline, projected position and the next mortgage decision approaching.',
    },
    future: {
      label: 'Future',
      eyebrow: 'Later',
      title: 'Where your choices could lead',
      subtitle: 'Explore hypothetical overpayments, long-term equity, future home value and your next-home position.',
    },
  };

  const $ = (selector, root = document) => root.querySelector(selector);

  function savedView() {
    try {
      const value = localStorage.getItem(VIEW_KEY);
      return views[value] ? value : 'current';
    } catch (_) {
      return 'current';
    }
  }

  function saveView(value) {
    try { localStorage.setItem(VIEW_KEY, value); } catch (_) {}
  }

  function makeNav(className) {
    const nav = document.createElement('nav');
    nav.className = className;
    nav.setAttribute('aria-label', 'Mortgage Manager sections');
    nav.innerHTML = Object.entries(views).map(([key, meta]) => `
      <button type="button" data-app-view="${key}" aria-controls="view-${key}">
        <span>${meta.label}</span>
      </button>`).join('');
    return nav;
  }

  function makeView(key, meta) {
    const section = document.createElement('section');
    section.id = `view-${key}`;
    section.className = `app-view app-view-${key}`;
    section.dataset.view = key;
    section.setAttribute('aria-labelledby', `view-${key}-title`);
    section.innerHTML = `
      <header class="app-view-heading">
        <p class="eyebrow">${meta.eyebrow}</p>
        <h1 id="view-${key}-title">${meta.title}</h1>
        <p>${meta.subtitle}</p>
      </header>
      <div class="app-view-content"></div>`;
    return section;
  }

  function cardifyFeature(element, kind) {
    if (!element) return;
    element.classList.add('panel', 'temporal-feature-card', `temporal-feature-${kind}`);
    element.removeAttribute('open');
  }

  function ensureCurrentOverpaymentPanel() {
    const current = $('.app-view-current .app-view-content');
    if (!current) return;
    let panel = document.getElementById('currentOverpaymentPanel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'currentOverpaymentPanel';
      panel.className = 'panel current-overpayment-panel';
      panel.innerHTML = `
        <div class="current-overpayment-heading">
          <div><p class="eyebrow">Overpayments</p><h2>Your regular overpayment</h2><p>This is part of your current mortgage, not a hypothetical scenario.</p></div>
        </div>
        <div class="current-overpayment-body"></div>`;
      const home = $('.home-panel', current);
      if (home) home.insertAdjacentElement('afterend', panel); else current.appendChild(panel);
    }

    const body = $('.current-overpayment-body', panel);
    const savings = document.getElementById('currentSavingsSummary');
    const control = document.querySelector('.current-overpay-control');
    if (savings && savings.parentElement !== body) body.appendChild(savings);
    if (control) {
      control.classList.remove('source-fields-only');
      if (control.parentElement !== body) body.appendChild(control);
    }
  }

  function relocateCurrentFeatures() {
    const current = $('.app-view-current .app-view-content');
    if (!current) return;
    ensureCurrentOverpaymentPanel();
    const progress = document.getElementById('personalProgress');
    if (progress && progress.parentElement !== current) current.appendChild(progress);
  }

  function relocateUpcomingFeatures() {
    const upcoming = $('.app-view-upcoming .app-view-content');
    if (!upcoming) return;
    const next = $('.next-panel');
    if (next && next.parentElement !== upcoming) upcoming.appendChild(next);

    // The mortgage deep-dive market block remains as the data source for the
    // copied rate figures, but Current should not present remortgage content.
    const sourceMarket = $('.hero-panel .market-block');
    if (sourceMarket) sourceMarket.classList.add('market-source-only');
  }

  function relocateFutureFeatures() {
    const future = $('.app-view-future .app-view-content');
    if (!future) return;
    const candidates = [
      ['homeProjection', 'home-projection'],
      ['propertyCostComparison', 'cost-comparison'],
      ['nextHomePlanner', 'next-home'],
    ];
    candidates.forEach(([id, kind]) => {
      const element = document.getElementById(id);
      if (!element) return;
      cardifyFeature(element, kind);
      future.appendChild(element);
    });
  }

  function restoreProfileSettings(profileSettings, originParent, originNext) {
    if (!profileSettings || !originParent || originParent.contains(profileSettings)) return;
    if (originNext && originNext.parentElement === originParent) originParent.insertBefore(profileSettings, originNext);
    else originParent.appendChild(profileSettings);
  }

  function mountProfileSettingsInSetup() {
    const backdrop = $('.personal-backdrop');
    const modal = $('.personal-modal', backdrop || document);
    const profileSettings = $('.projection-assumptions');
    if (!backdrop || !modal || !profileSettings || modal.contains(profileSettings)) return;

    const originParent = profileSettings.parentElement;
    const originNext = profileSettings.nextElementSibling;
    const section = document.createElement('div');
    section.className = 'personal-section personal-home-profile-section';
    section.innerHTML = '<h3>Home profile</h3><p>Purchase details, improvements and valuation assumptions used by the Future projections.</p><div class="personal-home-profile-host"></div>';

    const mortgageForm = $('.personal-form', modal);
    if (mortgageForm) mortgageForm.insertAdjacentElement('afterend', section);
    else modal.appendChild(section);

    $('.personal-home-profile-host', section).appendChild(profileSettings);
    profileSettings.open = true;

    const restoreSoon = () => requestAnimationFrame(() => {
      if (!document.body.contains(backdrop)) restoreProfileSettings(profileSettings, originParent, originNext);
    });
    backdrop.addEventListener('click', restoreSoon, true);
  }

  function wireSetupProfileSettings() {
    const button = document.getElementById('personalDataButton');
    if (button && !button.dataset.profileSettingsWired) {
      button.dataset.profileSettingsWired = 'true';
      button.addEventListener('click', () => requestAnimationFrame(mountProfileSettingsInSetup));
    }
    // Also covers the automatic first-run setup modal.
    setTimeout(mountProfileSettingsInSetup, 520);
  }

  function organiseViews() {
    relocateCurrentFeatures();
    relocateUpcomingFeatures();
    relocateFutureFeatures();
    wireSetupProfileSettings();
  }

  function buildShell() {
    const main = $('.app-shell');
    const topbar = $('.topbar', main);
    const footer = $('.footer', main);
    if (!main || !topbar || !footer || $('.app-view-shell', main)) return;

    const topNav = makeNav('app-section-nav app-section-nav-top');
    topbar.insertAdjacentElement('afterend', topNav);

    const shell = document.createElement('div');
    shell.className = 'app-view-shell';
    Object.entries(views).forEach(([key, meta]) => shell.appendChild(makeView(key, meta)));
    footer.insertAdjacentElement('beforebegin', shell);

    const current = $('.app-view-current .app-view-content', shell);
    const upcoming = $('.app-view-upcoming .app-view-content', shell);
    const future = $('.app-view-future .app-view-content', shell);

    const hero = $('.hero-panel', main);
    const home = $('.home-panel', main);
    const next = $('.next-panel', main);
    const scenario = $('.scenario-panel', main);
    const chart = $('.chart-panel', main);
    const edit = $('.edit-panel', main);
    const dashboardGrid = $('.dashboard-grid', main);

    if (hero) current.appendChild(hero);
    if (home) current.appendChild(home);
    if (edit) current.appendChild(edit);
    if (next) upcoming.appendChild(next);
    if (scenario) future.appendChild(scenario);
    if (chart) future.appendChild(chart);

    organiseViews();

    if (dashboardGrid && !dashboardGrid.children.length) dashboardGrid.remove();

    const bottomNav = makeNav('app-section-nav app-section-nav-bottom');
    document.body.appendChild(bottomNav);

    document.querySelectorAll('[data-app-view]').forEach((button) => {
      button.addEventListener('click', () => activateView(button.dataset.appView, true));
    });

    activateView(savedView(), false);
    setTimeout(organiseViews, 320);
    setTimeout(organiseViews, 720);
  }

  function closeExpandedCards() {
    document.querySelectorAll('.expandable-card.is-expanded').forEach((card) => {
      card.classList.remove('is-expanded');
      card.setAttribute('aria-expanded', 'false');
    });
    document.body.classList.remove('card-open');
    document.querySelector('.card-backdrop')?.remove();
  }

  function activateView(key, userInitiated) {
    if (!views[key]) key = 'current';
    closeExpandedCards();
    organiseViews();

    document.querySelectorAll('.app-view').forEach((view) => {
      const active = view.dataset.view === key;
      view.hidden = !active;
      view.classList.toggle('is-active', active);
    });

    document.querySelectorAll('[data-app-view]').forEach((button) => {
      const active = button.dataset.appView === key;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });

    document.body.dataset.appView = key;
    if (userInitiated) {
      saveView(key);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(buildShell), { once: true });
  } else {
    requestAnimationFrame(buildShell);
  }
})();
