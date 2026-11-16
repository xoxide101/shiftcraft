  // ---------- One person's contact QR code ----------
  // The QR icon on a Staff row: that person's contact (vCard: name, role, company, phone, email, Employee ID) as a QR code
  // to scan with a phone right off the screen, print on its own card, save (SVG in real millimetres, or the .vcf contact
  // itself) or put in the shared barcode library for the other Craft apps.
  function qrSvg(text, mm) {
    const q = qrOf(text); if (!q) return '';
    const n = q.getModuleCount(), N = n + 8; let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${mm}mm" height="${mm}mm" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges"><rect width="${N}" height="${N}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }
  const qrPic = (svg, cls) => { const e = h('div', { class: cls }); e.innerHTML = svg; return e; };
  function contactCard(p, svg) {
    return h('div', { class: 'qr-card' }, qrPic(svg, 'qr-pic'),
      h('div', { class: 'qr-who' }, h('b', null, p.name), h('div', null, ROLES[p.role].label + (p.empId ? ` · ID ${p.empId}` : '')),
        h('div', { class: 'qr-big' }, p.phone || ''), h('div', null, p.email || ''),
        h('div', { class: 'small muted' }, [plan.company, plan.location].filter(Boolean).join(' · ')),
        h('div', { class: 'small muted', style: { marginTop: '6px' } }, 'Scan with a phone camera to add to contacts.')));
  }
  function contactQrDialog(p) {
    const vc = vcardOf(p), svg = qrSvg(vc, 40);
    if (!svg) { toast('The QR code maker is missing from this copy of ShiftCraft.'); return; }
    const name = safe(p.name) || 'contact';
    const printCard = () => {
      if (blockedHere()) return;
      const area = $('#print-area');
      area.replaceChildren(h('style', null, '@page { size: letter portrait; margin: 0.5in; } #print-area .qr-card { border: 1px dashed #999; padding: 0.25in; width: 5in; color: #000; background: #fff; } #print-area .qr-pic svg { width: 1.8in; height: 1.8in; }'), contactCard(p, svg));
      document.body.classList.add('print-people');
      const done = () => { document.body.classList.remove('print-people'); area.replaceChildren(); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      setTimeout(() => window.print(), 60);
    };
    modal({ title: `Contact QR code · ${p.name}`, wide: true, body: [
      contactCard(p, svg),
      !p.phone && !p.email ? h('p', { class: 'warn small' }, 'No phone number or email yet: add them on Staff › Contact & training so the code has a way to reach them.') : null,
      h('p', { class: 'hint' }, `Holds their name${CARD_FIELDS.filter(([k]) => cardOn('qr', k)).map(([, l]) => ', ' + l.toLowerCase()).join('')} as a contact card (vCard): what goes in the code is chosen in Print & share › Print or save › Contact cards.`)],
    actions: [
      { label: 'Add to barcode library', left: true, onClick: () => { cardsToLibrary([p]); return false; } },
      { label: 'Save QR (.svg)', onClick: () => { saveBlob(`${name} contact QR.svg`, new Blob([svg], { type: 'image/svg+xml' }), { description: 'SVG picture', accept: { 'image/svg+xml': ['.svg'] } }).then((n) => n && toast('Saved ' + n)); return false; } },
      { label: 'Save contact (.vcf)', onClick: () => { saveBlob(`${name}.vcf`, new Blob([vc + '\r\n'], { type: 'text/vcard' }), { description: 'Contact card', accept: { 'text/vcard': ['.vcf'] } }).then((n) => n && toast('Saved ' + n)); return false; } },
      { label: 'Print', onClick: () => { setTimeout(printCard, 50); } },
      { label: 'Close', primary: true }] });
  }

  // ---------- What the availability and contact list adds from the newer parts ----------
  // in the last column: school (while the term is on or coming) and time off in the next 8 weeks
  // book: give each entry its number for the numbered notes (16-contact-sheet.js, 29-page-notes.js)
  function comingUpLines(p, book) {
    const num = (t) => (book ? supNum(book.add(noteKey.to(p, t), noteTimeOff(p, t))) : '');
    const today = iso(new Date()), until = addDays(today, 56), out = [];
    const sc = p.school;
    if (sc && sc.on !== false && (!sc.to || sc.to >= today)) out.push(`School${sc.name ? ': ' + sc.name : ''}${sc.to ? ` (to ${shortDate(sc.to)})` : ''}`);
    const off = (p.timeOff || []).filter((t) => t.status !== 'denied' && t.to >= today && t.from <= until);
    off.slice(0, 3).forEach((t) => out.push(`${t.from === t.to ? shortDate(t.from) : `${shortDate(t.from)}–${shortDate(t.to)}`}${t.hours ? ` ${clockShort(t.hours[0])}–${clockShort(t.hours[1])}` : ''} ${(TIME_OFF_WHY[t.why] || 'off').toLowerCase()}${t.status === 'requested' ? ' (asked)' : ''}${num(t)}`));
    if (off.length > 3) out.push(`+${off.length - 3} more time off${book ? ' ' + off.slice(3).map(num).join(',') : ''}`);
    return out;
  }
  // under the table: special store hours and events in the next 8 weeks
  function storeComingUp(book) {
    const num = (key, text) => (book ? ' ' + supNum(book.add(key, text)) : '');
    const today = iso(new Date()), until = addDays(today, 56), on = (x) => x.to >= today && x.from <= until;
    const sp = (plan.specialHours || []).filter(on).map((x) => `${datesOnly(x)}: ${x.name || 'special hours'} – ${x.closed ? 'closed' : `open ${clockShort(x.open)}–${clockShort(x.close)}`}${num(noteKey.sp(x), noteSpecial(x))}`);
    const ev = eventsIn(today, until).map((x) => `${datesOnly(x)}${x.hours ? ' ' + clockShort(x.hours[0]) : ''}: ${x.title}${num(noteKey.ev(x), noteEvent(x))}`);
    return { sp, ev };
  }
