(() => {
  const cards = Array.from(document.querySelectorAll('[data-expandable-card]'));
  if (!cards.length) return;

  let activeCard = null;
  let backdrop = null;
  let previousFocus = null;

  const isInteractive = (target) => Boolean(target.closest('button, input, label, a, summary, [data-edit-target]'));

  function closeCard() {
    if (!activeCard) return;
    activeCard.classList.remove('is-expanded');
    activeCard.setAttribute('aria-expanded', 'false');
    const closeButton = activeCard.querySelector('.card-close-button');
    if (closeButton) closeButton.remove();
    if (backdrop) backdrop.remove();
    backdrop = null;
    document.body.classList.remove('card-open');
    const focusTarget = previousFocus;
    activeCard = null;
    if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
  }

  function openCard(card) {
    if (activeCard === card) return;
    if (activeCard) closeCard();

    previousFocus = document.activeElement;
    activeCard = card;
    card.classList.add('is-expanded');
    card.setAttribute('aria-expanded', 'true');
    document.body.classList.add('card-open');

    backdrop = document.createElement('div');
    backdrop.className = 'card-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.addEventListener('click', closeCard);
    document.body.appendChild(backdrop);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'card-close-button';
    closeButton.setAttribute('aria-label', 'Close details');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      closeCard();
    });
    card.insertBefore(closeButton, card.firstChild);
    closeButton.focus();
  }

  cards.forEach((card) => {
    card.addEventListener('click', (event) => {
      if (card.classList.contains('is-expanded')) return;
      if (isInteractive(event.target) && !event.target.closest('[data-expand-card]')) return;
      openCard(card);
    });

    card.addEventListener('keydown', (event) => {
      if (card.classList.contains('is-expanded')) return;
      if ((event.key === 'Enter' || event.key === ' ') && !isInteractive(event.target)) {
        event.preventDefault();
        openCard(card);
      }
    });

    const expandButton = card.querySelector('[data-expand-card]');
    if (expandButton) {
      expandButton.addEventListener('click', (event) => {
        event.stopPropagation();
        openCard(card);
      });
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeCard) closeCard();
  });
})();
