(() => {
  const cards = Array.from(document.querySelectorAll('[data-expandable-card]'));
  if (!cards.length) return;

  let activeCard = null;
  let backdrop = null;
  let previousFocus = null;
  let touchStart = null;
  let dragMode = null;
  let dragDistance = 0;
  let dragStartTime = 0;

  const isInteractive = (target) => Boolean(target.closest('button, input, label, a, summary, [data-edit-target], canvas, select, textarea'));

  function resetDragStyles(card = activeCard) {
    if (!card) return;
    card.style.transition = '';
    card.style.transform = '';
    card.style.opacity = '';
    if (backdrop) {
      backdrop.style.transition = '';
      backdrop.style.opacity = '';
    }
    dragMode = null;
    dragDistance = 0;
  }

  function removeCloseBar(card) {
    card?.querySelector('.card-close-bar')?.remove();
  }

  function closeCard(options = {}) {
    if (!activeCard) return;
    const card = activeCard;
    const { animated = false, direction = 'down' } = options;

    const finish = () => {
      card.classList.remove('is-expanded');
      card.setAttribute('aria-expanded', 'false');
      removeCloseBar(card);
      if (backdrop) backdrop.remove();
      backdrop = null;
      document.body.classList.remove('card-open');
      const focusTarget = previousFocus;
      activeCard = null;
      touchStart = null;
      resetDragStyles(card);
      if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
    };

    if (!animated) {
      finish();
      return;
    }

    const distance = direction === 'right' ? Math.max(window.innerWidth, card.offsetWidth) : Math.max(window.innerHeight * .72, card.offsetHeight * .72);
    card.style.transition = 'transform 220ms cubic-bezier(.22,.8,.3,1), opacity 200ms ease';
    card.style.transform = direction === 'right' ? `translate3d(${distance}px,0,0)` : `translate3d(0,${distance}px,0)`;
    card.style.opacity = '0';
    if (backdrop) {
      backdrop.style.transition = 'opacity 200ms ease';
      backdrop.style.opacity = '0';
    }
    window.setTimeout(finish, 225);
  }

  function snapBack() {
    if (!activeCard) return;
    const card = activeCard;
    card.style.transition = 'transform 220ms cubic-bezier(.2,.8,.25,1), opacity 180ms ease';
    card.style.transform = 'translate3d(0,0,0)';
    card.style.opacity = '1';
    if (backdrop) {
      backdrop.style.transition = 'opacity 180ms ease';
      backdrop.style.opacity = '1';
    }
    window.setTimeout(() => resetDragStyles(card), 230);
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

    const closeBar = document.createElement('div');
    closeBar.className = 'card-close-bar';
    closeBar.setAttribute('aria-hidden', 'false');

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'card-close-button';
    closeButton.setAttribute('aria-label', 'Close details');
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      closeCard();
    });

    closeBar.appendChild(closeButton);
    card.insertBefore(closeBar, card.firstChild);
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

    card.addEventListener('touchstart', (event) => {
      if (!card.classList.contains('is-expanded') || event.touches.length !== 1) return;
      if (isInteractive(event.target)) return;
      const touch = event.touches[0];
      touchStart = {
        x: touch.clientX,
        y: touch.clientY,
        scrollTop: card.scrollTop,
        edgeSwipe: touch.clientX <= 32,
      };
      dragMode = null;
      dragDistance = 0;
      dragStartTime = performance.now();
      card.style.transition = 'none';
      if (backdrop) backdrop.style.transition = 'none';
    }, { passive: true });

    card.addEventListener('touchmove', (event) => {
      if (!card.classList.contains('is-expanded') || !touchStart || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;

      if (!dragMode) {
        if (touchStart.edgeSwipe && dx > 8 && Math.abs(dx) > Math.abs(dy) * 1.15) dragMode = 'right';
        else if (touchStart.scrollTop <= 4 && dy > 8 && Math.abs(dy) > Math.abs(dx) * 1.15) dragMode = 'down';
        else if (Math.abs(dx) > 18 || Math.abs(dy) > 18) return;
      }

      if (!dragMode) return;
      event.preventDefault();

      dragDistance = dragMode === 'right' ? Math.max(0, dx) : Math.max(0, dy);
      const viewport = dragMode === 'right' ? Math.max(1, window.innerWidth) : Math.max(1, window.innerHeight);
      const progress = Math.min(1, dragDistance / (viewport * .72));
      const eased = 1 - Math.pow(1 - progress, 1.15);

      card.style.transform = dragMode === 'right'
        ? `translate3d(${dragDistance}px,0,0)`
        : `translate3d(0,${dragDistance}px,0)`;
      card.style.opacity = String(1 - eased * .18);
      if (backdrop) backdrop.style.opacity = String(1 - eased * .82);
    }, { passive: false });

    card.addEventListener('touchend', (event) => {
      if (!card.classList.contains('is-expanded') || !touchStart || event.changedTouches.length !== 1) {
        touchStart = null;
        return;
      }

      const elapsed = Math.max(1, performance.now() - dragStartTime);
      const velocity = dragDistance / elapsed;
      const threshold = dragMode === 'right' ? Math.min(150, window.innerWidth * .28) : Math.min(170, window.innerHeight * .22);
      const shouldDismiss = Boolean(dragMode) && (dragDistance >= threshold || (dragDistance >= 58 && velocity > .7));
      const direction = dragMode;
      touchStart = null;

      if (shouldDismiss) closeCard({ animated: true, direction });
      else if (direction) snapBack();
      else resetDragStyles(card);
    }, { passive: true });

    card.addEventListener('touchcancel', () => {
      touchStart = null;
      if (dragMode) snapBack();
      else resetDragStyles(card);
    }, { passive: true });

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
