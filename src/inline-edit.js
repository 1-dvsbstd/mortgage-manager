(() => {
  const $ = (id) => document.getElementById(id);
  let activeEditor = null;

  const configs = {
    balance: { label: 'Mortgage balance', suffix: '', prefix: '£' },
    payment: { label: 'Monthly payment', suffix: '', prefix: '£' },
    rate: { label: 'Interest rate', suffix: '%', prefix: '' },
    currentOverpayment: { label: 'Regular monthly overpayment', suffix: '', prefix: '£' },
    homeValue: { label: 'Property value', suffix: '', prefix: '£' },
    ownership: { label: 'Property share owned', suffix: '%', prefix: '' },
    fixedEnd: { label: 'Fixed rate end', suffix: '', prefix: '' },
  };

  const stateValue = (target) => {
    const state = window.MortgageStore?.get?.();
    if (state && Object.prototype.hasOwnProperty.call(state, target)) return state[target];
    return $(target)?.value ?? '';
  };

  function commit(target, value) {
    if (window.MortgageStore) {
      window.MortgageStore.set({ [target]: target === 'fixedEnd' ? value : Number(value) });
      window.MortgageStore.applyToDom([target], { dispatch: true });
      return;
    }
    const source = $(target);
    if (!source) return;
    source.value = value;
    source.dispatchEvent(new Event('input', { bubbles: true }));
    source.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function closeEditor({ restore = false } = {}) {
    if (!activeEditor) return;
    const { wrapper, target, originalValue } = activeEditor;
    if (restore) commit(target, originalValue);
    wrapper.remove();
    activeEditor = null;
  }

  function openEditor(trigger) {
    const target = trigger.dataset.editTarget;
    const sourceInput = $(target);
    if (!sourceInput) return;
    if (activeEditor?.trigger === trigger) return;
    closeEditor();

    const config = configs[target] || { label: 'Edit', prefix: '', suffix: '' };
    const wrapper = document.createElement('div');
    wrapper.className = 'inline-editor';
    wrapper.setAttribute('role', 'dialog');
    wrapper.setAttribute('aria-modal', 'true');
    wrapper.setAttribute('aria-label', config.label);
    wrapper.addEventListener('click', (event) => event.stopPropagation());

    const title = document.createElement('div');
    title.className = 'inline-editor-title';
    title.textContent = config.label;

    const row = document.createElement('div');
    row.className = 'inline-editor-row';

    const input = document.createElement('input');
    input.type = sourceInput.type || (target === 'fixedEnd' ? 'month' : 'number');
    input.value = stateValue(target);
    input.inputMode = sourceInput.inputMode || 'decimal';
    if (sourceInput.min) input.min = sourceInput.min;
    if (sourceInput.max) input.max = sourceInput.max;
    if (sourceInput.step) input.step = sourceInput.step;
    input.setAttribute('aria-label', config.label);

    const actions = document.createElement('div');
    actions.className = 'inline-editor-actions';

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'save-inline';
    save.textContent = 'Done';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'cancel-inline';
    cancel.textContent = 'Cancel';

    const note = document.createElement('p');
    note.className = 'inline-editor-note';
    note.textContent = config.prefix || config.suffix
      ? `${config.prefix}${config.label}${config.suffix ? ` (${config.suffix})` : ''}`
      : config.label;

    const originalValue = stateValue(target);
    const liveUpdate = () => commit(target, input.value);

    input.addEventListener('input', liveUpdate);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        liveUpdate();
        closeEditor();
      } else if (event.key === 'Escape') {
        closeEditor({ restore: true });
      }
    });

    save.addEventListener('click', () => { liveUpdate(); closeEditor(); });
    cancel.addEventListener('click', () => closeEditor({ restore: true }));

    row.append(input);
    actions.append(save, cancel);
    wrapper.append(title, row, note, actions);
    document.body.appendChild(wrapper);

    activeEditor = { trigger, wrapper, target, originalValue };
    requestAnimationFrame(() => {
      input.focus({ preventScroll: true });
      try { input.setSelectionRange(input.value.length, input.value.length); } catch (_) {}
      wrapper.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-edit-target]');
    if (!trigger) {
      if (activeEditor && !event.target.closest('.inline-editor')) closeEditor();
      return;
    }
    if (event.target.closest('.inline-editor')) return;
    event.preventDefault();
    openEditor(trigger);
  });

  document.addEventListener('keydown', (event) => {
    const trigger = event.target.closest?.('[data-edit-target]');
    if (!trigger) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openEditor(trigger);
    }
  });
})();
