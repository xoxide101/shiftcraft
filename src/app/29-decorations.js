  // ===================================================================
  // Decorations: small seasonal line drawings laid over printed pages (an overlay: the page itself never moves)
  // ===================================================================
  // Each month has 5 pictures; every week turns them around (Random: a different look each week of the month), or one
  // design is kept (Design 1–5). A week with a holiday (ticked) uses that holiday's pictures. Corners: none to 4
  // (top right, bottom left, top left, bottom right, in that order); Border: a thin frame in the theme's colour.
  // Everything is outlines in one colour, so it prints cleanly on a black and white printer too.
  const DC = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  const DECO_ART = {
    snowflake: 'M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5M4 10.5l3.3-.3-1.2-3.1M20 13.5l-3.3.3 1.2 3.1M4 13.5l3.3.3-1.2 3.1M20 10.5l-3.3-.3 1.2-3.1',
    mitten: 'M7 21h8v-3l3-4c1.5-2 0-4-2-3l-1 1V6a4 4 0 0 0-8 0v12zM7 18h8',
    snowman: DC(12, 17, 5) + DC(12, 8.5, 3.5) + 'M10.7 8h.01M13.3 8h.01M8.5 4.5h7M10 4.5V2h4v2.5M12 15v.01M12 18v.01M7.5 13.5 4 11M16.5 13.5 20 11',
    cocoa: 'M5 9h11v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3c-1 1.5 1 2 0 4M12 3c-1 1.5 1 2 0 4',
    star: 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z',
    heart: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z',
    hearts: 'M8 15s-5-3-5-7a2.8 2.8 0 0 1 5-1.7A2.8 2.8 0 0 1 13 8c0 4-5 7-5 7zM17 21s-4-2.5-4-5.5a2.2 2.2 0 0 1 4-1.3 2.2 2.2 0 0 1 4 1.3c0 3-4 5.5-4 5.5z',
    heartArrow: 'M12 19s-6.5-4-6.5-8.8a3.6 3.6 0 0 1 6.5-2.2 3.6 3.6 0 0 1 6.5 2.2c0 4.8-6.5 8.8-6.5 8.8zM2.5 21.5 21.5 2.5M17.5 2.5h4v4M2.5 21.5l1-3.5M2.5 21.5l3.5-1',
    envelope: 'M3 6h18v12H3zM3 6l9 7 9-7M12 17.2s-2-1.2-2-2.5a1 1 0 0 1 2-.6 1 1 0 0 1 2 .6c0 1.3-2 2.5-2 2.5z',
    balloon: 'M12 15c-4 0-6-4-6-7a6 6 0 0 1 12 0c0 3-2 7-6 7zM11 15h2l-1 1.5zM12 16.5c-1 2 1 3 0 5.5',
    shamrock: DC(12, 7, 3.5) + DC(7.5, 12.5, 3.5) + DC(16.5, 12.5, 3.5) + 'M12 13.5c0 3 1 6 2.5 8.5',
    clover4: DC(9, 9, 3) + DC(15, 9, 3) + DC(9, 15, 3) + DC(15, 15, 3) + 'M15 18c1 2 2 3 4 4',
    rainbow: 'M2 18a10 10 0 0 1 20 0M5.5 18a6.5 6.5 0 0 1 13 0M9 18a3 3 0 0 1 6 0',
    pot: 'M5 11h14l-1.5 8a2 2 0 0 1-2 1.5h-7a2 2 0 0 1-2-1.5zM4 11h16M8 8a1.5 1.5 0 0 1 3 0M13 8a1.5 1.5 0 0 1 3 0M10.5 5.5a1.5 1.5 0 0 1 3 0',
    kite: 'M12 2 18 9l-6 9-6-9zM12 2v16M6 9h12M12 18c1 1.5-1 2.5 0 4',
    raindrop: 'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11zM9 14a3 3 0 0 0 3 3',
    umbrella: 'M3 12a9 9 0 0 1 18 0zM12 12v7a2 2 0 0 1-4 0M12 3V2',
    tulip: 'M12 13c-4 0-6-3-6-8l3 2 3-4 3 4 3-2c0 5-2 8-6 8zM12 13v9M12 19c-2-2.5-4.5-3-6-3 1 3 3.5 4 6 4M12 18c2-2 4-2.5 5.5-2.5-1 2-2.5 3-5.5 3',
    chick: DC(12, 13, 6) + 'M10 11h.01M14 11h.01M11 14l1 1.2 1-1.2zM9.5 7.5 10.5 5l1.5 2 1.5-2 1 2.5',
    butterfly: 'M12 7v12M12 9C9 3 3 4 4 9s5 4 8 3M12 9c3-6 9-5 8 0s-5 4-8 3M12 12c-3 1-6 3-5 6s4 1 5-2M12 12c3 1 6 3 5 6s-4 1-5-2M10.5 4.5 12 7l1.5-2.5',
    flower: DC(12, 10, 2.2) + DC(12, 5.6, 2.2) + DC(16.2, 8.7, 2.2) + DC(14.6, 13.6, 2.2) + DC(9.4, 13.6, 2.2) + DC(7.8, 8.7, 2.2) + 'M12 15.8V22M12 19c-1.5-1.5-3.5-2-5-1.5',
    bee: 'M7 13a5 3.5 0 1 0 10 0 5 3.5 0 1 0-10 0M10.5 9.7v6.6M13.5 9.7v6.6M11 9.7C9.5 5 5.5 5.5 7 9M13 9.7c1.5-4.7 5.5-4.2 4 -.7M17 13h2',
    sun: DC(12, 12, 4) + 'M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
    sunglasses: 'M2 9h20M3 9l1 5a2.5 2.5 0 0 0 5 0l1-5M14 9l1 5a2.5 2.5 0 0 0 5 0l1-5M10 10.5h4',
    beachball: DC(12, 12, 9) + 'M12 3c-3 4-3 14 0 18M3.5 9c5 1 12 1 17 0M4 16c5-2 11-2 16 0',
    icecream: 'M8 11l4 11 4-11M7 11h10M7.5 11a4.5 4.5 0 1 1 9 0M10 14l3.5 2M9.5 11.5 14 14',
    palm: 'M12 22c1-6 1-10 0-13M12 9C9 6 5 6 3 8M12 9c3-3 7-3 9-1M12 9c-2-3-2-6 0-7M12 9c-4-1-7 1-8 4M12 9c4-1 7 1 8 4M8 22h8',
    wave: 'M2 15c2.5-3 5-3 7.5 0s5 3 7.5 0 4-2 5-1M2 20c2.5-3 5-3 7.5 0s5 3 7.5 0 4-2 5-1M13 10c0-3 3-5.5 7-4.5-2 1-2.5 3-1 4.5',
    sunflower: DC(12, 8, 3) + 'M12 2.5V1.5M16 4l.8-.8M17.5 8h1M16 12l.8.8M8 12l-.8.8M6.5 8h-1M8 4l-.8-.8M12 11v11M12 18c-2-2-4-2.3-6-1.5 2 2 4 2.3 6 1.5M12 15c2-1.5 4-1.7 5.5-1-1.5 1.6-3.5 1.8-5.5 1',
    flag: 'M5 22V3M5 4h15v10H5M5 4h7v5H5M12 6h8M12 8h8M5 11h15M7 5.6h.01M9.5 5.6h.01M8.2 7.4h.01M10.6 7.4h.01',
    firework: 'M12 12V3M12 12l6.4-6.4M12 12h9M12 12l6.4 6.4M12 12v9M12 12l-6.4 6.4M12 12H3M12 12 5.6 5.6M12 1v.01M20 4v.01M23 12v.01M20 20v.01M12 23v.01M4 20v.01M1 12v.01M4 4v.01',
    apple: 'M12 7c-2-1.5-7-1.5-7 4.5 0 5 3 9.5 5.5 9.5 1 0 1-.5 1.5-.5s.5.5 1.5.5c2.5 0 5.5-4.5 5.5-9.5 0-6-5-6-7-4.5zM12 7c0-2 1-4 3-4.5M12 6.5c-1-2-3-2.5-4-2 1 1.5 2.5 2 4 2',
    pencil: 'M4 20l1.5-5L16 4.5a2.1 2.1 0 0 1 3 3L8.5 18zM14 6.5l3 3M4 20l4-1.5',
    book: 'M4 5c3-1.5 6-1.5 8 0v14c-2-1.5-5-1.5-8 0zM20 5c-3-1.5-6-1.5-8 0v14c2-1.5 5-1.5 8 0z',
    bus: 'M3 6h15l3 5v6H3zM3 11h18M6.5 6v5M10.5 6v5M14.5 6v5' + DC(7, 17.5, 1.9) + DC(17, 17.5, 1.9),
    leaf: 'M12 22v-7M12 15 5 16l2-3-4-2 3-1-1-4 4 2 1-4 2 3 2-3 1 4 4-2-1 4 3 1-4 2 2 3z',
    oakleaf: 'M5 19C5 10 10 5 19 5c0 9-5 14-14 14zM5 19 15 9M9 15h3M12 12V9',
    acorn: 'M5.5 10h13a6.5 3.5 0 0 0-13 0zM7 10c0 6 3 10 5 11 2-1 5-5 5-11M12 6.5V3.5',
    pumpkin: 'M12 7c-6 0-8 4-8 7.5S6 21 12 21s8-3 8-6.5S18 7 12 7zM12 7c-2.5 0-3.5 4-3.5 7s1 7 3.5 7 3.5-4 3.5-7-1-7-3.5-7zM12 7V4l2.5-1',
    bat: 'M12 8c-1.5 0-2 2-2 3.5S11 15 12 15s2-2 2-3.5S13.5 8 12 8zM10 10.5C8 8 4 8 2 10c1.5.5 2 2 1.5 3.5 1.5-1 3-.8 4 .5.5-1.5 1.5-2.5 2.5-2.5M14 10.5c2-2.5 6-2.5 8-.5-1.5.5-2 2-1.5 3.5-1.5-1-3-.8-4 .5-.5-1.5-1.5-2.5-2.5-2.5M11 8l-.6-1.6M13 8l.6-1.6',
    ghost: 'M6 21V10a6 6 0 0 1 12 0v11l-2-2-2 2-2-2-2 2-2-2zM10 10h.01M14 10h.01M10.5 14a1.5 1.5 0 0 0 3 0',
    web: 'M12 2v20M2 12h20M5 5l14 14M19 5 5 19M12 6l4.2 1.8L18 12l-1.8 4.2L12 18l-4.2-1.8L6 12l1.8-4.2zM12 9.5l1.8.7.7 1.8-.7 1.8-1.8.7-1.8-.7-.7-1.8.7-1.8z',
    turkey: 'M3.5 15a8.5 8.5 0 0 1 17 0M12 15 6 9M12 15 8.6 7M12 15V6.5M12 15l3.4-8M12 15l6-6' + DC(12, 15.5, 4.2) + DC(12, 12, 1.7) + 'M12 13.7l-.9 1.1.9.5M10.4 19.5 9.4 22M13.6 19.5l1 2.5',
    pie: 'M3 14h18M4 14c0 4 3 6 8 6s8-2 8-6M4 14c1-4 4-6 8-6s7 2 8 6M8 11l1 1M12 10v1.5M16 11l-1 1',
    holly: 'M12 13C9 10 4 10 2 13c2 3 7 3 10 0zM12 13c3-3 8-3 10 0-2 3-7 3-10 0zM3.5 13H12h8.5' + DC(12, 9, 1.6) + DC(9.6, 7.6, 1.6) + DC(14.4, 7.6, 1.6),
    ornament: DC(12, 14, 7) + 'M10 7h4V4.5h-4zM12 4.5V3M5.5 12.5h13M6 16h12',
    tree: 'M12 2 7.5 8.5h2.5L6 14h3l-4 5.5h14L15 14h3l-4-5.5h2.5zM12 19.5V22',
    gift: 'M3 9h18v4H3zM5 13h14v8H5zM12 9v12M12 9c-2-4-6-4-6-2s4 2 6 2zM12 9c2-4 6-4 6-2s-4 2-6 2z',
    candycane: 'M10 22V8a4 4 0 0 1 8 0v1.5M10 12l3-2M10 16l3-2M10 20l3-2M14 5.2l2.5-.8',
    bell: 'M6 17v-6a6 6 0 0 1 12 0v6l2 2H4zM10 21a2 2 0 0 0 4 0M12 3V5',
    egg: 'M12 3c-4 0-7 6-7 11a7 7 0 0 0 14 0c0-5-3-11-7-11zM5.5 12l2.5-1.5 2.5 1.5 2.5-1.5 2.5 1.5 2.5-1.5M5.3 16h13.4',
    bunny: DC(12, 16, 5) + 'M10 11.5C8 8 8 3 9.5 2.5 11 3 11.5 7 11 11.2M14 11.5c2-3.5 2-8.5.5-9-1.5.5-2 4.5-1.5 8.7M10.5 15.5h.01M13.5 15.5h.01M12 17.5v.01',
    champagne: 'M8 3h8l-.5 5a3.5 3.5 0 0 1-7 0zM12 11.5V20M8.5 21h7M9 6h6M18 3.5h.01M19.5 6h.01M17.5 8h.01',
    clock: DC(12, 12, 9) + 'M12 7v5l3 2M12 3.5v1M20.5 12h-1M12 20.5v-1M3.5 12h1',
    partyhat: 'M12 3 5 21h14zM8 14l5-2M7 18l9-3M10 9l3-1M12 3V1.5',
    tie: 'M10 3h4l-1 3h-2zM11 6l-2.5 11L12 21l3.5-4L13 6',
  };
  // [theme colour, five pictures]; a week's design turns the five around (the corners take them in order)
  const DECO_MONTHS = [
    ['#2f5f9e', ['snowflake', 'mitten', 'snowman', 'cocoa', 'star']],
    ['#b0204f', ['heart', 'hearts', 'heartArrow', 'envelope', 'balloon']],
    ['#2e7d32', ['shamrock', 'clover4', 'rainbow', 'pot', 'kite']],
    ['#5b6bb5', ['raindrop', 'umbrella', 'tulip', 'chick', 'butterfly']],
    ['#a2457a', ['flower', 'bee', 'butterfly', 'tulip', 'sun']],
    ['#d07a00', ['sun', 'sunglasses', 'icecream', 'beachball', 'wave']],
    ['#b3261e', ['flag', 'firework', 'star', 'icecream', 'palm']],
    ['#c08a00', ['sunflower', 'beachball', 'palm', 'sunglasses', 'wave']],
    ['#a33a1c', ['apple', 'pencil', 'book', 'bus', 'oakleaf']],
    ['#d0600a', ['pumpkin', 'bat', 'leaf', 'ghost', 'web']],
    ['#9a4a12', ['leaf', 'acorn', 'turkey', 'pie', 'oakleaf']],
    ['#1f7a3d', ['holly', 'ornament', 'tree', 'gift', 'candycane']],
  ];
  // the holidays with their own pictures: [key, label, built-in holiday names, colour, pictures]; the first ticked one in
  // the week (in this order) wins
  const DECO_HOLIDAYS = [
    ['christmas', 'Christmas', ['Christmas Eve', 'Christmas Day'], '#1f7a3d', ['tree', 'gift', 'ornament', 'holly', 'bell']],
    ['newyear', 'New Year’s', ['New Year’s Day', 'New Year’s Eve'], '#9a7400', ['champagne', 'clock', 'firework', 'partyhat', 'star']],
    ['thanksgiving', 'Thanksgiving', ['Thanksgiving'], '#9a4a12', ['turkey', 'pie', 'leaf', 'acorn', 'oakleaf']],
    ['july4', 'July 4th', ['Independence Day'], '#b3261e', ['firework', 'flag', 'star', 'firework', 'flag']],
    ['halloween', 'Halloween', ['Halloween'], '#d0600a', ['pumpkin', 'ghost', 'bat', 'web', 'pumpkin']],
    ['easter', 'Easter', ['Easter Sunday'], '#5b6bb5', ['egg', 'bunny', 'chick', 'tulip', 'egg']],
    ['valentine', 'Valentine’s Day', ['Valentine’s Day'], '#b0204f', ['heart', 'heartArrow', 'hearts', 'envelope', 'heart']],
    ['stpat', 'St. Patrick’s Day', ['St. Patrick’s Day'], '#2e7d32', ['shamrock', 'pot', 'rainbow', 'clover4', 'shamrock']],
    ['mother', 'Mother’s Day', ['Mother’s Day'], '#a2457a', ['flower', 'tulip', 'heart', 'butterfly', 'flower']],
    ['father', 'Father’s Day', ['Father’s Day'], '#2f5f9e', ['tie', 'sunglasses', 'star', 'tie', 'book']],
    ['memorial', 'Memorial and Veterans Day', ['Memorial Day', 'Veterans Day'], '#2f5f9e', ['flag', 'star', 'flag', 'star', 'flag']],
  ];
  // the choices, kept in this browser: on, corners (0–4), border, design ('random' or 1–5), holidays { key: on }
  const DECO_KEY = KEY + '-deco';
  const deco = { on: true, corners: 2, border: true, pick: 'random', holidays: Object.fromEntries(DECO_HOLIDAYS.map(([k]) => [k, true])) };
  try { const c = JSON.parse(localStorage.getItem(DECO_KEY) || '{}'); if (typeof c.on === 'boolean') deco.on = c.on; if ([0, 1, 2, 3, 4].includes(c.corners)) deco.corners = c.corners; if (typeof c.border === 'boolean') deco.border = c.border; if (c.pick === 'random' || [1, 2, 3, 4, 5].includes(c.pick)) deco.pick = c.pick; if (c.holidays) Object.keys(deco.holidays).forEach((k) => { if (typeof c.holidays[k] === 'boolean') deco.holidays[k] = c.holidays[k]; }); } catch (e) { /* blocked */ }
  const decoSave = () => { try { localStorage.setItem(DECO_KEY, JSON.stringify(deco)); } catch (e) { /* blocked */ } };
  // the design for the days a to b: a ticked holiday among them, or the month of a (of b's week when a is a Monday
  // late in the month that mostly falls in the next); the week of the year turns the five pictures around
  function decoTheme(a, b = a) {
    const days = daysFrom(a, Math.min(62, dayDiff(a, b) + 1)), pick = deco.pick === 'random' ? null : deco.pick - 1;
    const weekNo = Math.floor(dayDiff(`${a.slice(0, 4)}-01-01`, mondayOf(a)) / 7) + 53 * +a.slice(0, 4);
    const turn = (list) => { const k = pick != null ? pick : ((weekNo % 5) + 5) % 5; return list.map((_, i) => list[(i + k) % list.length]); };
    for (const [key, label, names, col, art] of DECO_HOLIDAYS) {
      if (!deco.holidays[key]) continue;
      if (days.some((d) => builtinOn(d).some((x) => names.includes(x.name)))) return { col, art: turn(art), holiday: label };
    }
    const mid = days[Math.floor(days.length / 2)] || a, [col, art] = DECO_MONTHS[+mid.slice(5, 7) - 1];
    return { col, art: turn(art) };
  }
  // laid over a drawn page (a canvas, or a vector page): corners and the border, sized from the page's dots per inch
  // a page's margin (inches) with the decorations on: wide enough that the frame and the corner pictures (out to
  // 0.43 in) never sit on what is printed. Pages with narrow margins (the week in tiles, contact cards) use it.
  const decoMargin = (m) => (deco.on && (deco.corners || deco.border) ? Math.max(m, 0.45) : m);
  function decorateSurface(c, a, b, dpi) {
    if (!deco.on || (!deco.corners && !deco.border) || !c) return c;
    const g = c.getContext('2d'); if (!g) return c;
    const W = c.width, H = c.height, inch = dpi || 96, t = decoTheme(a, b), lw = Math.max(1, inch / 72 * 1.1);
    const icon = (name, x, y, size) => {
      const d = DECO_ART[name]; if (!d) return;
      const s = size / 24;
      if (typeof g.toSVG === 'function') { g.decoPath(d, x, y, s, t.col, lw); return; }
      g.save(); g.translate(x, y); g.scale(s, s); g.lineWidth = lw / s; g.strokeStyle = t.col; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(new Path2D(d)); g.restore();
    };
    if (deco.border) {
      const m = inch * 0.2, r = inch * 0.08;
      g.save(); g.strokeStyle = t.col; g.lineWidth = lw * 0.8; g.beginPath(); g.roundRect(m, m, W - 2 * m, H - 2 * m, r); g.stroke();
      g.lineWidth = lw * 0.4; g.beginPath(); g.roundRect(m + inch * 0.04, m + inch * 0.04, W - 2 * m - inch * 0.08, H - 2 * m - inch * 0.08, r * 0.6); g.stroke(); g.restore();
    }
    // the corners: top right, bottom left, top left, bottom right, in the page's margin (a picture over the frame's corner)
    const size = inch * 0.36, o = inch * 0.05;
    const spots = [[W - o - size, o], [o, H - o - size], [o, o], [W - o - size, H - o - size]];
    spots.slice(0, deco.corners).forEach(([x, y], i) => {
      if (deco.border) { g.save(); g.fillStyle = '#ffffff'; g.fillRect(x - inch * 0.02, y - inch * 0.02, size + inch * 0.04, size + inch * 0.04); g.restore(); }
      icon(t.art[i], x, y, size);
    });
    return c;
  }
  // a picture as inline SVG (the Calendar's printed page, the controls)
  const decoSvg = (name, col, size) => { const s = h('span', { class: 'deco-ic', style: { color: col } }); s.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${DECO_ART[name] || ''}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`; return s; };
  // the overlay for a printed web page (the Calendar tab): fixed, so it lands on every printed page
  function decoOverlay(a, b) {
    if (!deco.on || (!deco.corners && !deco.border)) return null;
    const t = decoTheme(a, b), pos = [{ top: '0', right: '0' }, { bottom: '0', left: '0' }, { top: '0', left: '0' }, { bottom: '0', right: '0' }];
    return h('div', { class: 'deco-overlay print-only', 'aria-hidden': 'true' },
      deco.border ? h('div', { class: 'deco-frame', style: { borderColor: t.col } }) : null,
      pos.slice(0, deco.corners).map((p, i) => h('div', { class: 'deco-corner', style: p }, decoSvg(t.art[i], t.col, 34))));
  }
  // the controls, the same in every print window: On, Corners, Border, Design, and the holidays' own pictures
  function decoControls(onChange) {
    const wrap = h('div', { class: 'deco-ctl' });
    const done = () => { decoSave(); draw(); if (onChange) onChange(); };
    const sel = (label, val, opts, set) => { const s = h('select', { class: 'input', 'aria-label': label, style: { width: 'auto' }, onchange: () => { set(s.value); done(); } }, opts.map(([v, l]) => h('option', { value: v, selected: String(val) === String(v) }, l))); return h('label', { class: 'field' }, h('span', null, label), s); };
    const draw = () => {
      const t = decoTheme(iso(new Date()));
      wrap.replaceChildren(
        sel('Decorations', deco.on ? 'on' : 'off', [['on', 'On'], ['off', 'Off']], (v) => { deco.on = v === 'on'; }),
        ...(deco.on ? [
          sel('Corners', deco.corners, [[0, 'None'], [1, '1'], [2, '2'], [3, '3'], [4, '4']], (v) => { deco.corners = +v; }),
          sel('Border', deco.border ? 'on' : 'off', [['on', 'On'], ['off', 'Off']], (v) => { deco.border = v === 'on'; }),
          sel('Design', deco.pick, [['random', 'Random (new each week)'], [1, 'Design 1'], [2, 'Design 2'], [3, 'Design 3'], [4, 'Design 4'], [5, 'Design 5']], (v) => { deco.pick = v === 'random' ? 'random' : +v; }),
          h('details', { class: 'deco-hol' }, h('summary', null, `Holiday pictures (${DECO_HOLIDAYS.filter(([k]) => deco.holidays[k]).length} of ${DECO_HOLIDAYS.length})`),
            h('div', { class: 'deco-hol-list' }, DECO_HOLIDAYS.map(([k, l, , col, art]) => h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: !!deco.holidays[k], onchange: (e) => { deco.holidays[k] = e.target.checked; decoSave(); if (onChange) onChange(); } }), ' ', decoSvg(art[0], col, 16), ' ' + l)))),
          h('span', { class: 'deco-now', title: 'This week’s pictures' }, t.art.slice(0, 4).map((n) => decoSvg(n, t.col, 20))),
        ] : []));
    };
    draw();
    return wrap;
  }
