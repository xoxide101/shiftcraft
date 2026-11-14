  // ===================================================================
  // Emailable file: ShiftCraft with the schedule inside one .html file
  // ===================================================================
  function portableHtml() {
    const data = JSON.stringify({ ...plan, kind: 'month', version: 3, savedAt: new Date().toISOString() }).replace(/</g, '\\u003c');
    const marker = '<script>\n(function () {';
    const at = SOURCE.indexOf(marker);
    if (at < 0) throw new Error('Could not copy the app.');
    return SOURCE.slice(0, at) + `<script id="embedded-plan" type="application/json">${data}<\/script>\n` + SOURCE.slice(at);
  }
  const portableName = () => baseName(...planRange()) + ' (ShiftCraft).html';
  async function saveEmailable() {
    let html;
    try { html = portableHtml(); } catch (e) { toast(e.message); return; }
    const name = await saveBlob(portableName(), new Blob([html], { type: 'text/html' }), { description: 'ShiftCraft schedule (opens in any browser)', accept: { 'text/html': ['.html'] } });
    if (name) toast(`Saved ${name}. Double-click it to open, or attach it to an email.`);
  }
  function emailDialog() {
    const incHtml = h('input', { type: 'checkbox', checked: true });
    const incTable = h('input', { type: 'checkbox' });
    const incTimeline = h('input', { type: 'checkbox' });
    const range = h('select', { class: 'input' }, h('option', { value: 'week' }, `This week (week ${weekOf(ui.day) + 1})`), h('option', { value: 'all' }, `All ${plan.weeks} weeks`));
    modal({ title: 'Email or share the schedule', wide: true, body: [
      h('label', { class: 'check' }, incHtml, ' The schedule file (.html). Opens by double-click in any browser, with ShiftCraft built in, so it can be viewed and edited anywhere.'),
      h('label', { class: 'check' }, incTable, ' Week table pictures (PNG)'),
      h('label', { class: 'check' }, incTimeline, ' Visual timeline pictures (PNG, one per day)'),
      h('label', { class: 'field' }, h('span', null, 'Pictures for'), range),
      h('p', { class: 'hint' }, 'On Windows this opens the Share window, where you can pick Mail or Outlook. If sharing isn’t available, the files are saved and an email is started for you to attach them to.')],
    actions: [{ label: 'Cancel' }, { label: 'Share…', primary: true, onClick: () => {
      if (blockedHere()) return;
      (async () => {
        const files = [];
        const weeks = range.value === 'week' ? [weekOf(ui.day)] : Array.from({ length: plan.weeks }, (_, k) => k);
        const o = { format: 'png', paper: 'letter', orient: 'landscape', dpi: 200, notes: true, coverage: true };
        if (incHtml.checked) files.push(new File([portableHtml()], portableName(), { type: 'text/html' }));
        if (incTable.checked) for (const w of weeks) files.push(new File([await canvasBlob(drawWeekSheet(w, o), o)], `${baseName(...weekRange(w))}.png`, { type: 'image/png' }));
        if (incTimeline.checked) for (const w of weeks) for (const d of weekDays(w)) if (shiftsOn(d).length) files.push(new File([await canvasBlob(drawDaySheet(d, o), o)], `${baseName(d, d)} timeline.png`, { type: 'image/png' }));
        if (!files.length) { toast('Pick at least one thing to send.'); return; }
        const title = `Schedule ${placeName()} ${fileDate(planRange()[0])} to ${fileDate(planRange()[1])}`;
        if (navigator.canShare && navigator.canShare({ files })) {
          try { await navigator.share({ files, title, text: title }); return; }
          catch (e) { if (e.name === 'AbortError') return; }
        }
        const n = await saveMany(files.map((f) => ({ name: f.name, blob: f, type: { description: 'File', accept: { [f.type]: ['.' + f.name.split('.').pop()] } } })));
        if (!n) return;
        const body = `Hi,\n\nThe schedule for ${placeName()} is attached (${files.map((f) => f.name).join(', ')}).\nDouble-click the .html file to open it in a browser.\n`;
        modal({ title: 'Files saved', body: [h('p', null, `Saved ${n} file${n > 1 ? 's' : ''}. Attach ${n > 1 ? 'them' : 'it'} to your email.`),
          h('p', null, h('a', { href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}` }, 'Start an email'))], actions: [{ label: 'Close', primary: true }] });
      })();
    } }] });
  }
  // When this page was saved with a schedule inside, offer to open it (once per saved copy).
  function checkEmbedded() {
    const el = document.getElementById('embedded-plan');
    if (!el) return;
    let data; try { data = JSON.parse(el.textContent); } catch (e) { return; }
    if (!data || data.app !== 'ShiftCraft') return;
    const stamp = data.savedAt || 'x';
    let seen = []; try { seen = JSON.parse(localStorage.getItem(KEY + '-seen') || '[]'); } catch (e) { /* ignore */ }
    if (seen.includes(stamp)) return;
    const remember = () => { try { localStorage.setItem(KEY + '-seen', JSON.stringify([...seen, stamp].slice(-50))); } catch (e) { /* ignore */ } };
    const open = () => { snapshot(); plan = data; delete plan.kind; normalize(plan); ui.day = plan.startDate; ui.fileName = 'Schedule saved ' + new Date(stamp).toLocaleString(); remember(); persist(); render(); toast('Opened the schedule saved in this file'); };
    if (plan.example || !Object.values(plan.shifts).some((l) => l.length)) { open(); return; }
    const [a, b] = [data.startDate, addDays(data.startDate, (data.weeks || 1) * 7 - 1)];
    modal({ title: 'Open the schedule in this file?', body: [
      h('p', null, `This file holds the schedule for ${[data.company, data.location].filter(Boolean).join(' · ') || 'a store'}, ${shortDate(a)} – ${shortDate(b)}, saved ${new Date(stamp).toLocaleString()}.`),
      h('p', { class: 'hint' }, 'Opening it replaces the weeks you have open in ShiftCraft on this computer. You can undo this.')],
    actions: [{ label: 'Keep my current schedule', onClick: remember }, { label: 'Open it', primary: true, onClick: open }] });
  }

