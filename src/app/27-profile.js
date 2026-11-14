  // ===================================================================
  // Company & location: one profile used everywhere on this computer
  // ===================================================================
  const PLACE_KEY = KEY + '-place';
  const PLACE_FIELDS = [['company', 'Company name', 'e.g. Sunny Bowl Cafe'], ['location', 'Location name', 'e.g. Main & 5th'], ['storeNo', 'Store number', 'e.g. 0042'], ['address', 'Address', 'e.g. 1234 Main St, Denver CO'], ['phone', 'Phone', 'e.g. (303) 555-0142'], ['email', 'Email', 'e.g. manager@example.com'], ['website', 'Website', 'e.g. www.example.com']];
  function loadPlace() { try { return JSON.parse(localStorage.getItem(PLACE_KEY)) || null; } catch (e) { return null; } }
  function applyPlace(pl) { PLACE_FIELDS.forEach(([k]) => { plan[k] = (pl && pl[k]) || ''; }); }
  const samePlace = (a, b) => a && b && String(a.company || '').trim().toLowerCase() === String(b.company || '').trim().toLowerCase() && String(a.location || '').trim().toLowerCase() === String(b.location || '').trim().toLowerCase();
  // Positions (stations and jobs) at this location: the standard list, which each location can change.
  // (functions, so the start-up check can use them before this point)
  function standardPositions() { return ['Open', 'Close', 'Hot Prep', 'Cold Prep', 'Juices & Smoothies', 'Dish', 'Greeting', 'Salad Line', 'Sandwich Line', 'Bowls & Wrapping', 'Cashier & Register', 'Online', 'Dining Room', 'Catering']; }
  function defaultPositions() { return standardPositions().map((name) => ({ id: uid(), name, active: true })); }
  const placeLine = () => [plan.storeNo ? `Store #${plan.storeNo}` : '', plan.address, plan.phone].filter(Boolean).join('  ·  ');
  function placeDialog() {
    const inputs = {};
    const err = h('p', { class: 'error bad', hidden: true });
    const body = [h('p', { class: 'hint' }, 'Used on every plan, printout and file name on this computer, and saved inside Location files. Opening someone else’s files won’t change it unless you choose to.'),
      ...PLACE_FIELDS.map(([k, label, ph]) => { inputs[k] = h('input', { class: 'input', value: plan[k] || '', placeholder: ph, maxLength: 80 }); return h('label', { class: 'field' }, h('span', null, label), inputs[k]); }), err];
    modal({ title: 'Company & location', body, actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: () => {
      const v = Object.fromEntries(PLACE_FIELDS.map(([k]) => [k, inputs[k].value.replace(/\s+/g, ' ').trim()]));
      const problem = !v.company && !v.location ? 'Enter a company name, a location name, or both.'
        : /[\\/:*?"<>|]/.test(v.company + v.location) ? 'Company and location names can’t contain \\ / : * ? " < > | (they are used in file names).'
          : v.phone && !/^[\d\s()+.\-x]{7,}$/i.test(v.phone) ? 'The phone number has characters that don’t look like a phone number.' : '';
      if (problem) { err.textContent = problem; err.hidden = false; return false; }
      try { localStorage.setItem(PLACE_KEY, JSON.stringify(v)); } catch (e) { /* ignore */ }
      change(() => applyPlace(v));
      toast(`Saved: ${[v.company, v.location].filter(Boolean).join(' · ')}`);
    } }] });
  }
  // After opening a file from another store, offer to switch.
  function offerFilePlace(data) {
    const mine = loadPlace();
    const theirs = Object.fromEntries(PLACE_FIELDS.map(([k]) => [k, data[k] || '']));
    if (!theirs.company && !theirs.location) { if (mine) change(() => applyPlace(mine), { keepUndo: true }); return; }
    if (!mine) { try { localStorage.setItem(PLACE_KEY, JSON.stringify(theirs)); } catch (e) { /* ignore */ } return; }
    if (samePlace(mine, theirs)) { change(() => applyPlace({ ...theirs, ...Object.fromEntries(Object.entries(mine).filter(([, v]) => v)) }), { keepUndo: true }); return; }
    change(() => applyPlace(mine), { keepUndo: true });
    modal({ title: 'Different company or location', body: [
      h('p', null, `This file is for ${[theirs.company, theirs.location].filter(Boolean).join(' · ')}. Yours is ${[mine.company, mine.location].filter(Boolean).join(' · ')}.`),
      h('p', { class: 'hint' }, 'Switch if you are now planning for that store. You can change it any time with File › Company & location.')],
    actions: [{ label: `Keep ${mine.location || mine.company}` }, { label: `Switch to ${theirs.location || theirs.company}`, primary: true, onClick: () => {
      try { localStorage.setItem(PLACE_KEY, JSON.stringify(theirs)); } catch (e) { /* ignore */ }
      change(() => applyPlace(theirs), { keepUndo: true });
    } }] });
  }

