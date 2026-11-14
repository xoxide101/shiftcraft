  // ===================================================================
  // Dialogs and toast
  // ===================================================================
  function modal({ title, body, actions = [], wide, onClose }) {
    const dlg = h('div', { class: 'dialog' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
    const back = h('div', { class: 'backdrop' }, dlg);
    const prev = document.activeElement;
    const close = () => { back.remove(); document.removeEventListener('keydown', key, true); prev && prev.focus && prev.focus(); onClose && onClose(); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    dlg.append(h('h2', null, title), h('div', { class: 'dialog-body' }, body),
      h('div', { class: 'dialog-actions' }, actions.map((a) => h('button', { class: 'btn' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : ''), style: a.left ? { marginRight: 'auto' } : null,
        onclick: () => { if (a.onClick && a.onClick() === false) return; close(); } }, a.label))));
    document.addEventListener('keydown', key, true);
    document.body.append(back);
    setTimeout(() => (dlg.querySelector('select, input, textarea') || dlg.querySelector('.btn.primary'))?.focus(), 0);
    return { close, el: dlg };
  }
  function confirmBox(title, text, ok, fn) { modal({ title, body: h('p', null, text), actions: [{ label: 'Cancel' }, { label: ok, danger: true, onClick: fn }] }); }
  let toastT;
  function toast(msg, action) {
    $('.toast')?.remove(); clearTimeout(toastT);
    const t = h('div', { class: 'toast', role: 'status' }, msg, action ? h('button', { onclick: () => { t.remove(); action.fn(); } }, action.label) : null);
    document.body.append(t);
    toastT = setTimeout(() => t.remove(), action ? 6000 : 3000);
  }
  // Hour / minute / AM-PM picker. Returns element with .value (minutes).
  function timePicker(min, label) {
    const hSel = h('select', { class: 'input', 'aria-label': label + ' hour' }, Array.from({ length: 12 }, (_, i) => h('option', { value: i + 1 }, i + 1)));
    const mSel = h('select', { class: 'input', 'aria-label': label + ' minutes' }, ['00', '15', '30', '45'].map((m) => h('option', { value: m }, m)));
    const aSel = h('select', { class: 'input', 'aria-label': label + ' AM or PM' }, h('option', { value: 'AM' }, 'AM'), h('option', { value: 'PM' }, 'PM'));
    const set = (v) => { const h24 = Math.floor(v / 60) % 24; hSel.value = h24 % 12 || 12; mSel.value = String(snap(v % 60) % 60).padStart(2, '0'); aSel.value = h24 < 12 ? 'AM' : 'PM'; };
    set(min);
    const el = h('div', { class: 'timepick' }, hSel, ':', mSel, aSel);
    Object.defineProperty(el, 'value', { get: () => ((+hSel.value % 12) + (aSel.value === 'PM' ? 12 : 0)) * 60 + +mSel.value, set });
    el.onchange = null;
    return el;
  }

