(() => {
  const VIEW_KEY = 'mortgage-manager-view-v1';
  const views = {
    current: {
      label: 'Current',
      eyebrow: 'Today',
      title: 'Your position now',
      subtitle: 'What you owe, what you own, and how the mortgage is moving today.',
    },
    upcoming: {
      label: 'Upcoming',
      eyebrow: 'Next',
      title: 'What needs attention next',
      subtitle: 'Your fixed-deal timeline, projected position and the decisions approaching.',
    },
    future: {
      label: 'Future',
      eyebrow: 'Later',
      title: 'Where your choices could lead',
      subtitle: 'Explore overpayments, long-term equity, home value and your next-home position.',
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
    relocateFutureFeatures();

    if (dashboardGrid && !dashboardGrid.children.length) dashboardGrid.remove();

    const bottomNav = makeNav('app-section-nav app-section-nav-bottom');
    document.body.appendChild(bottomNav);

    document.querySelectorAll('[data-app-view]').forEach((button) => {
      button.addEventListener('click', () => activateView(button.dataset.appView, true));
    });

    activateView(savedView(), false);
    setTimeout(relocateFutureFeatures, 320);
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
    relocateFutureFeatures();

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
