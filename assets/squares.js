/* ---------- Squares lab: the live page, unchanged in layout, scenes and motion, on a grid ----------
   1. The background is a grid: 12px or 6px squares (graph paper), or a matrix of 6px or 4px dots where every place
      holds a dot of the same size (the empty ones dark). A band of black cells hangs from the top and drips down
      (on Graphite and Ash it stays at the top of the screen; on Black it scrolls away with the page), a second one rises at the very end, and the odd cell comes and goes on its own. The org chart's
      cards are black cells of the same grid.
   2. The pointer is the grid too: the cells under it turn white as it moves (on the finer grids they draw the usual arrow, at
      its usual size). No system cursor.
   3. The icons are redrawn as white and grey cells, every frame, from the originals: the hero pictures (the flag and
      the rest), the digits and the brain and the team icons. The originals keep their size,
      place and motion but are not painted (squares.css), so every effect still plays. The honeycomb keeps its real
      logos. The logo in the nav and the footer is drawn in cells as well.
   The panel (bottom right) switches the background colour and texture, the icon style, and shows the live site for
   comparison; the choice is kept in the address (?grid=fine&bg=c&ic=fine), so a comment can name it. */
(() => {
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const q = new URLSearchParams(location.search);

  const GRIDS = {                                       // the background's texture
    big: { name: "Big squares", cell: 12, round: false },    // graph paper, as on the reference
    small: { name: "Small squares", cell: 6, round: false }, // graph paper at half the size
    dot: { name: "Dots", cell: 6, round: true },
    fine: { name: "Fine", cell: 4, round: true },
  };
  const BGS = {                                          // sq: the band's shades; acc: its odd lighter patch; dot: an empty dot; card: the org cards; stay: the top band stays put
    a: { name: "Graphite", bg: "#141417", line: "#1d1d21", dot: "#1d1d21", sq: ["#000000", "#060607", "#0c0c0e"], acc: "#2a2a30", card: "#000000", stay: true, btn1: "#2a2a31", btn2: "#0b0b0d", edge: "#55555e" },
    b: { name: "Black", bg: "#020203", line: "#0d0d10", dot: "#0a0a0c", sq: ["#101013", "#18181c", "#212126"], acc: "#33333a", card: "#16161a", btn1: "#222228", btn2: "#0e0e11", edge: "#45454d" },
    c: { name: "Ash", bg: "#28282d", line: "#313137", dot: "#313137", sq: ["#000000", "#08080a", "#131316"], acc: "#3e3e45", card: "#000000", stay: true, btn1: "#1c1c21", btn2: "#0f0f12", edge: "#000000" },
  };
  const ICONS = {                                       // the icons' cells, measured against the big squares
    big: { name: "Big squares", pitch: 12, round: false },   // one per big square
    small: { name: "Small squares", pitch: 6, round: false }, // four per big square
    dot: { name: "Dots", pitch: 6, round: true },
    fine: { name: "Fine", pitch: 4, round: true },           // nine per big square
  };
  const INK = ["#ffffff", "#b9b9c0", "#6f6f77"];        // white, light grey, grey
  const SHADES = ["#ffffff", "#d4d4da", "#a8a8b0", "#7c7c84", "#56565d"];   // the icons: five steps, so a pixel can fade in and out smoothly
  const OLD = { grid: { sq: "big" }, ic: { sq: "small" }, trans: { flicker: "pixels" } };   // names in earlier links
  const pick = (k, list, dflt) => { const v = q.get(k), w = (OLD[k] && OLD[k][v]) || v; return list[w] ? w : dflt; };
  const opt = {
    grid: pick("grid", GRIDS, "big"),
    bg: pick("bg", BGS, "c"),
    ic: pick("ic", ICONS, "dot"),
    watch: pick("watch", { off: 1, ...GRIDS }, "off"),                                  // the honeycomb's logo tiles, in their colours
    wpart: pick("wpart", { all: 1, bg: 1 }, "all"),
    trans: pick("trans", { fly: 1, pixels: 1, steps: 1, travel: 1 }, "fly"),
    btn: pick("btn", { cur: 1, pixel: 1 }, "cur"),                                       // buttons and menu: as now, or square pixel boxes with a hard shadow                       // the hero picture's change of word: its blocks fly, or its cells swap one by one                                      // the whole tile in cells, or its colour only (the mark stays sharp)
    shape: pick("shape", { off: 1, ...GRIDS }, "off"),                                  // pills, buttons, cards and panels, in their colours
    on: q.get("live") !== "1",
  };
  const SITE = window.SQ_SITE;                                                         // the published site: settings fixed, no panel, the address left alone
  if (SITE) { Object.assign(opt, SITE, { on: true }); }
  const BAND = 6, DRIP = 9, FBAND = 2, FDRIP = 6;        // in 12px rows: the top band (as tall as the nav), its drips, the band at the end
  let G = 12, f = 1;                                     // the background's cell, and how many of them make a 12px square
  const rr = size => size * (size >= 6 ? .36 : .38);     // a dot's radius in a cell of this size

  // ---------- layers. The grid itself is the background canvas's CSS background (a repeating tile); the canvas holds
  // only the cells that are lit
  const field = Object.assign(document.createElement("canvas"), { id: "sqField" });
  const ov = Object.assign(document.createElement("canvas"), { id: "sqIcons" });
  field.setAttribute("aria-hidden", "true"); ov.setAttribute("aria-hidden", "true");
  document.body.prepend(field);
  const bm = document.getElementById("bmCanvas");
  if (bm && bm.isConnected) bm.after(ov); else document.body.append(ov);   // same stacking as the hero picture's canvas
  const fctx = field.getContext("2d");

  let W = 0, H = 0, dpr = 1, cols = 0, rows = 0, cols12 = 0, rows12 = 0;
  const seed = Math.random() * 1000;
  const hash = (x, y, z = 0) => { const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed) * 43758.5453; return n - Math.floor(n); };
  const smooth = (x, y, t) => .5 + .5 * ((Math.sin(x * 5.6 + seed * 1.3 + t * .3) * Math.cos(y * 4.7 - seed * .7 + t * .22)
    + Math.sin((x * 1.4 + y * 1.7) * 4.1 - seed + t * .16) + Math.sin(y * 9 + seed * 2.1 + x * 3) * .5) / 2.5);

  // cells are collected per shade as flat [column, row, ...] lists and drawn in one go. Squares are drawn with a one
  // screen-pixel gap (the grid line); dots are drawn as whole squares, then cut round by one pass of a dot mask over the cells drawn
  // (thousands of round paths, or stamps, a frame are far too slow)
  const lists = n => Array.from({ length: n }, () => []);
  const px = (v, of) => v.endsWith("%") ? parseFloat(v) / 100 * of : parseFloat(v) || 0;   // a CSS length, % of a size
  const masks = new Map();
  const dotTile = (size, color) => {
    const px = Math.max(1, Math.round(size * dpr)), t = Object.assign(document.createElement("canvas"), { width: px, height: px }), g = t.getContext("2d");
    g.fillStyle = color; g.beginPath(); g.arc(px / 2, px / 2, rr(size) * dpr, 0, 6.2832); g.fill();
    return t;
  };
  const mask = (ctx, size) => {
    const key = ctx.canvas.id + size + ":" + dpr;
    if (!masks.has(key)) masks.set(key, ctx.createPattern(dotTile(size, "#fff"), "repeat"));
    return masks.get(key);
  };
  const flush = (ctx, ls, size, round, colors, solid) => {                             // ctx is in CSS px (scaled by dpr); solid: squares edge to edge
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    ls.forEach((l, k) => {
      if (!l.length) return;
      ctx.fillStyle = colors[k];
      for (let i = 0; i < l.length; i += 2) {
        const c = l[i], r = l[i + 1];
        if (!round) { const g1 = solid ? 0 : 1 / dpr; ctx.fillRect(c * size + g1, r * size + g1, size - g1, size - g1); continue; }   // a one-pixel line between squares
        ctx.fillRect(c * size, r * size, size, size);
        if (c < x0) x0 = c; if (c > x1) x1 = c; if (r < y0) y0 = r; if (r > y1) y1 = r;
      }
    });
    if (!round || x1 < x0) return;
    const s = size * dpr;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "destination-in"; ctx.fillStyle = mask(ctx, size);
    ctx.fillRect(Math.round(x0 * s), Math.round(y0 * s), Math.round((x1 - x0 + 1) * s), Math.round((y1 - y0 + 1) * s));
    ctx.restore();
  };
  const setBackground = () => {
    const p = BGS[opt.bg], px = Math.round(G * dpr);
    let tile;
    if (GRIDS[opt.grid].round) tile = dotTile(G, p.dot);                               // dots: a dark dot in every cell, as big as the lit ones
    else {                                                                             // squares: graph paper, a 1px line along the top and the left of each cell
      tile = Object.assign(document.createElement("canvas"), { width: px, height: px });
      const g = tile.getContext("2d"); g.fillStyle = p.line; g.fillRect(0, 0, px, 1); g.fillRect(0, 0, 1, px);   // one screen pixel
    }
    field.style.background = `${p.bg} url(${tile.toDataURL()}) 0 0 / ${G}px ${G}px repeat`;
  };

  const opCache = new Map();
  const shown = el => {                                                                // how visible an element is, scene fades included
    let o = 1;
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      let v = opCache.get(e);
      if (v === undefined) { const cs = getComputedStyle(e); v = cs.visibility === "hidden" || cs.display === "none" ? 0 : +cs.opacity; opCache.set(e, v); }
      o *= v; if (o <= .01) return 0;
    }
    return o;
  };

  // ---------- 1. the background. The noise is read in 12px units, so the bands keep their shape on the dot grids and
  // only get finer at the edges
  const slot = (c, r, t, speed) => Math.floor(t * speed + hash(c, r, 3) * 9);          // each cell re-rolls on its own clock
  const level = (c, r, t) => {                                                         // which shade: patches, ragged at the edges
    const n = smooth(c / f / 90, r / f / 30, t * .6) + (hash(c, r, 7) - .5) * .2;
    return n < .42 ? 0 : n < .68 ? 1 : n < .9 ? 2 : 3;
  };
  const dripLen = (c, t, max) => Math.floor(f * (max * Math.pow(smooth(c / f / 14, 3.3, t * .25), 2.2) + (hash(Math.floor(c / f), 5) < .12 ? 2 : 0)));
  const bandCell = (c, r, d, t, band, max) => {                                        // d: rows from the band's edge of the page
    if (d < band * f) return hash(c, r, slot(c, r, t, .12)) < .62 + .38 * smooth(c / f / 60, band, t * .5);
    const k = d - band * f, L = dripLen(c + band * 31 * f, t, max);
    return k < L && hash(c, r, slot(c, r, t, .12)) > .1 + .55 * (k / L);
  };
  const nodes = [...document.querySelectorAll(".node")];
  // text plates: wherever a line of text sits on a shape drawn in cells, the cells under it merge into one solid plate of
  // the shape's colour (grown to whole cells, so it reads as part of the grid). Text then always sits on solid colour,
  // whatever the colour, texture or text. box: the shape's own box (and what clips it), so plates never leave it
  const textRange = document.createRange();
  const platesFor = (root, S, box, out, colour, alpha, skip) => {                     // skip: text that needs no plate
    if (!root) return;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let tn; (tn = walk.nextNode());) {
      if (!tn.data.trim()) continue;
      const el = tn.parentElement;
      if (el.closest(".sr-only") || (skip && el.closest(skip)) || shown(el) <= .05) continue;
      textRange.selectNodeContents(tn);
      for (const r of textRange.getClientRects()) {
        if (r.width < 1 || r.height < 1) continue;
        const x0 = Math.max(box.l, Math.floor((r.left - S * .5) / S) * S), x1 = Math.min(box.r, Math.ceil((r.right + S * .5) / S) * S);
        const y0 = Math.max(box.t, Math.floor(r.top / S) * S), y1 = Math.min(box.b, Math.ceil(r.bottom / S) * S);
        if (x1 > x0 && y1 > y0) out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, colour, alpha });
      }
    }
  };
  const fillPlates = (ctx, list) => {                                                  // ctx in CSS px: each plate replaces the cells under it
    for (const p of list) {
      ctx.clearRect(p.x, p.y, p.w, p.h);
      ctx.globalAlpha = p.alpha; ctx.fillStyle = p.colour; ctx.fillRect(p.x, p.y, p.w, p.h);
    }
    ctx.globalAlpha = 1;
  };
  const cardPlates = [];
  const cards = list => {                                                              // the org chart's cards: every cell whose centre is on a card
    for (const n of nodes) {
      const r = n.getBoundingClientRect();
      if (r.width < 8 || r.bottom < 0 || r.top > H || r.right < 0 || r.left > W || shown(n) < .35) continue;
      const rad = Math.min(22, r.width / 2, r.height / 2);
      platesFor(n, G, { l: r.left, t: r.top, r: r.right, b: r.bottom }, cardPlates, BGS[opt.bg].card, 1);
      const c0 = Math.ceil(r.left / G - .5), c1 = Math.floor(r.right / G - .5), r0 = Math.ceil(r.top / G - .5), r1 = Math.floor(r.bottom / G - .5);
      for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) {
        const cx = (x + .5) * G, cy = (y + .5) * G;
        const dx = Math.max(r.left + rad - cx, 0, cx - r.right + rad), dy = Math.max(r.top + rad - cy, 0, cy - r.bottom + rad);
        if (dx * dx + dy * dy <= rad * rad) list.push(x, y);                           // rounded like the card
      }
    }
  };
  // the hero's typing bar and the full stop after the word, in the background's cells on the finer textures: the bar a
  // column of cells (white, dimming to grey as it pulses), the stop the cells its glyph covers
  const measure = document.createElement("canvas").getContext("2d");
  const stopOf = caret => {                                                            // the full stop, wrapped once so it can be hidden
    const n = caret.nextSibling;
    if (n && n.nodeType === 1 && n.classList.contains("sq-stop")) return n;
    if (!n || n.nodeType !== 3 || n.data[0] !== ".") return null;
    const sp = Object.assign(document.createElement("span"), { className: "sq-stop", textContent: "." });
    n.data = n.data.slice(1); caret.after(sp);
    return sp;
  };
  const typing = (white, grey) => {
    if (G >= 12) return;                                                               // big squares: as they are
    const c = document.querySelector(".hero h1 .caret");
    if (!c) return;
    const o = shown(c), r = c.getBoundingClientRect();
    if (o < .05 || !r.height || r.bottom < 0 || r.top > H) return;
    const cb = clipBox(c);                                                             // the headline is wiped away as the hero leaves: so are they
    if (!cb) return;
    const col = Math.floor((r.left + r.width / 2) / G), list = o > .72 ? white : grey, inside = (x, y) => (x + .5) * G >= cb.l && (x + .5) * G <= cb.r && (y + .5) * G >= cb.t && (y + .5) * G <= cb.b;
    for (let y = Math.round(r.top / G); y < Math.round(r.bottom / G); y++) if (inside(col, y)) list.push(col, y);
    const sp = stopOf(c);
    if (!sp) return;
    const sr = sp.getBoundingClientRect();
    measure.font = getComputedStyle(sp).font;
    const m = measure.measureText("."), base = sr.top + m.fontBoundingBoxAscent;
    const x0 = sr.left - m.actualBoundingBoxLeft, x1 = sr.left + m.actualBoundingBoxRight, y0 = base - m.actualBoundingBoxAscent, y1 = base + m.actualBoundingBoxDescent;
    for (let y = Math.floor(y0 / G); y <= Math.floor(y1 / G); y++) for (let x = Math.floor(x0 / G); x <= Math.floor(x1 / G); x++) {
      const cover = Math.max(0, Math.min(x1, (x + 1) * G) - Math.max(x0, x * G)) * Math.max(0, Math.min(y1, (y + 1) * G) - Math.max(y0, y * G)) / (G * G);
      if (cover >= .35 && inside(x, y)) white.push(x, y);
    }
  };
  const drawField = t => {
    const p = BGS[opt.bg];
    fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.clearRect(0, 0, field.width, field.height); fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const shift = Math.round(scrollY / G), end = Math.round(root.scrollHeight / G);   // the bands belong to the page: they move with it, a cell at a time
    const topN = (BAND + DRIP) * f, botN = (FBAND + FDRIP) * f, out = lists(7);
    const ts = p.stay ? 0 : shift;                                                     // Graphite and Ash: the top band stays at the top as the page scrolls, under the nav's bar
    for (let r = Math.max(0, -ts), r9 = Math.min(rows, topN - ts); r < r9; r++) {
      const dr = r + ts;
      for (let c = 0; c < cols; c++) if (bandCell(c, dr, dr, t, BAND, DRIP)) out[level(c, dr, t)].push(c, r);
    }
    for (let r = Math.max(0, end - botN - shift), r9 = Math.min(rows, end - shift); r < r9; r++) {
      const dr = r + shift, db = end - 1 - dr;
      for (let c = 0; c < cols; c++) if (bandCell(c, dr, db, t, FBAND, FDRIP)) out[level(c, dr, t)].push(c, r);
    }
    const s12 = Math.round(scrollY / 12), mid = f >> 1;                                // the odd cell, as often on every texture: picked on the 12px grid
    for (let r = 0; r < rows12; r++) for (let c = 0; c < cols12; c++) {
      const dr = r + s12;
      if (hash(c, dr, slot(c, dr, t, .25)) > .9965) out[hash(c, dr, 11) > .5 ? 2 : 1].push(c * f + mid, r * f + mid);
    }
    cardPlates.length = 0; cards(out[4]);
    typing(out[5], out[6]);
    flush(fctx, out, G, GRIDS[opt.grid].round, [...p.sq, p.acc, p.card, "#ffffff", "#b9b9c0"]);
    fillPlates(fctx, cardPlates);
  };

  // ---------- 2. the pointer: the cells under it turn white, the ones round it grey by how near it is, and they follow
  // it cell by cell. Over anything clickable more of them light, and pressing lights the most. On top of everything,
  // in difference (black over white)
  const FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const cur = Object.assign(document.createElement("canvas"), { id: "sqCursor" }), cctx = cur.getContext("2d");
  cur.setAttribute("aria-hidden", "true"); document.body.append(cur);
  if (FINE) root.classList.add("sq-cur");
  const CLICK = 'a[href],button,[role="button"],.bub,.card,.node,summary,label,select,[onclick]';
  const pt = { x: -1e4, y: -1e4, on: false, click: false, down: false, key: "" };
  const sizeCursor = () => { cur.width = Math.round(W * dpr); cur.height = Math.round(H * dpr); pt.key = ""; };
  addEventListener("pointermove", e => {
    if (e.pointerType === "touch") return;
    pt.x = e.clientX; pt.y = e.clientY; pt.on = true;
    pt.click = !!(e.target.closest && e.target.closest(CLICK));
  }, { passive: true });
  document.addEventListener("pointerleave", () => { pt.on = false; });
  addEventListener("blur", () => { pt.on = false; });
  addEventListener("pointerdown", () => { pt.down = true; });
  addEventListener("pointerup", () => { pt.down = false; });
  const ARROW = [[0, 0], [0, 16], [4, 12.2], [7, 19], [9.6, 18], [6.6, 11.2], [11.6, 11.2]];   // the usual pointer, tip at 0,0, in px
  const inArrow = (x, y) => {
    let c = false;
    for (let i = 0, j = ARROW.length - 1; i < ARROW.length; j = i++) {
      const [xi, yi] = ARROW[i], [xj, yj] = ARROW[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const drawCursor = () => {
    const key = pt.on ? [Math.round(pt.x / 2), Math.round(pt.y / 2), pt.click, pt.down, G].join() : "off";   // redraw only when it changes
    if (key === pt.key) return;
    pt.key = key;
    cctx.setTransform(1, 0, 0, 1, 0, 0); cctx.clearRect(0, 0, cur.width, cur.height);
    if (!pt.on) return;
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const out = lists(3), c0 = Math.floor(pt.x / G), r0 = Math.floor(pt.y / G);
    if (G >= 12) {                                                                     // big squares: the one under it, a halo of its neighbours
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const c = c0 + dx, r = r0 + dy;
        if (!dx && !dy) { out[0].push(c, r); continue; }
        if (pt.down || (pt.click && (!dx || !dy))) { out[1].push(c, r); continue; }
        const d = Math.hypot(pt.x - (c + .5) * G, pt.y - (r + .5) * G) / G;          // 0.5 at the shared edge, 1.2 or more at the far corner
        if (d < .95) out[d < .72 ? 1 : 2].push(c, r);
      }
    } else {
      // small squares and dots: the usual arrow at its usual size, its tip on the pointer. Each cell lights by how much
      // of it the arrow covers, so the finer the grid the more it is the arrow. Over anything clickable a grey edge rings
      // it; pressed, it shrinks a little
      const sc = pt.down ? .86 : 1, cov = new Map();
      const c1 = c0 - 1, r1 = r0 - 1, c2 = Math.floor((pt.x + 12 * sc) / G) + 1, r2 = Math.floor((pt.y + 20 * sc) / G) + 1;
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
        let hit = 0;
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if (inArrow(((c + (i + .5) / 4) * G - pt.x) / sc, ((r + (j + .5) / 4) * G - pt.y) / sc)) hit++;
        const v = hit / 16;
        cov.set(c + "," + r, v);
        if (v >= .45) out[0].push(c, r); else if (v >= .2) out[1].push(c, r); else if (v > 0 && !pt.click) out[2].push(c, r);
      }
      if (pt.click) for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
        if ((cov.get(c + "," + r) || 0) >= .2) continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if ((cov.get(c + dx + "," + (r + dy)) || 0) >= .45) { near = true; break; }
        if (near) out[2].push(c, r);
      }
    }
    flush(cctx, out, G, GRIDS[opt.grid].round, INK);
  };

  // ---------- 3. the icons, as cells, on a layer over the scenes (as the hero canvas, in difference, so white turns
  // black over a white band). Each is drawn 4x finer, then averaged down to one value per cell
  const K = 4;
  let S = 6, gw = 0, gh = 0;
  const L = { src: document.createElement("canvas"), mid: document.createElement("canvas"), small: document.createElement("canvas"), prev: new Float32Array(0), empty: false };
  const ictx = ov.getContext("2d"), sctx = L.src.getContext("2d"), mctx = L.mid.getContext("2d"), smctx = L.small.getContext("2d", { willReadFrequently: true });
  const sizeIcons = () => {
    S = ICONS[opt.ic].pitch; gw = Math.ceil(W / S); gh = Math.ceil(H / S);
    L.src.width = gw * K; L.src.height = gh * K; L.mid.width = gw * 2; L.mid.height = gh * 2; L.small.width = gw; L.small.height = gh;
    ov.width = Math.round(W * dpr); ov.height = Math.round(H * dpr);
    L.prev = new Float32Array(gw * gh); L.empty = false;
    [sctx, mctx, smctx].forEach(x => { x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; });
  };
  const svgImage = (svg, color) => {                                                   // an inline SVG as an image, in one colour
    const c = svg.cloneNode(true), r = svg.getBoundingClientRect();
    c.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    c.setAttribute("width", Math.max(24, Math.round(r.width * 4))); c.setAttribute("height", Math.max(24, Math.round(r.height * 4)));
    c.setAttribute("color", color); c.style.cssText = "";
    c.querySelectorAll("[fill]").forEach(n => { if (n.getAttribute("fill") !== "none") n.setAttribute("fill", color); });
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(c));
    return img;
  };
  const srcs = [];
  // the agents' icons resolve like the founder's photo: coarse cells that step down in size as the Team scene scrolls on,
  // until they are the real icons; scrolling back turns them to cells again
  const agents = [...document.querySelectorAll(".node .ic")].map(box => { const s = box.querySelector("svg"); return s && { box, node: box.closest(".node"), img: svgImage(s, "#fff") }; }).filter(Boolean);
  const RES = [12, 9, 7, 5, 4, 3, 2];                                                   // the cell sizes it resolves through, in px
  const resolveK = a => {                                                              // 0: coarsest cells, 1: the real icon
    let p = window.SQ_ORGP;
    if (p == null) { const r = a.box.getBoundingClientRect(); p = (innerHeight * .85 - r.top) / (innerHeight * .6); }   // no scenes: its own way up the screen
    return Math.min(1, Math.max(0, (p - .06) / .55));
  };
  const small2 = document.createElement("canvas"), s2 = small2.getContext("2d", { willReadFrequently: true });
  const drawAgents = () => {
    let n = 0;
    for (const a of agents) {
      const k = resolveK(a), real = k >= 1;
      if (a.node.classList.contains("sq-real") !== real) a.node.classList.toggle("sq-real", real);
      if (real || !a.img.complete || !a.img.naturalWidth) continue;
      const r = a.box.getBoundingClientRect();
      if (r.width < 2 || r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue;
      const o = shown(a.box); if (o <= .01) continue;
      const size = RES[Math.min(RES.length - 1, Math.floor(Math.pow(k, 1.2) * RES.length))];
      const x0 = Math.floor(r.left / size), y0 = Math.floor(r.top / size), cw = Math.ceil(r.right / size) - x0, ch = Math.ceil(r.bottom / size) - y0;
      small2.width = cw * 4; small2.height = ch * 4;                                  // drawn 4x finer, then read per cell
      s2.setTransform(4 / size, 0, 0, 4 / size, -x0 * 4, -y0 * 4); s2.clearRect(x0 * size, y0 * size, cw * size, ch * size);
      s2.globalAlpha = o; s2.drawImage(a.img, r.left, r.top, r.width, r.height); s2.globalAlpha = 1;
      const d = s2.getImageData(0, 0, cw * 4, ch * 4).data, out = lists(5);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        let sum = 0;
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) sum += d[((y * 4 + j) * cw * 4 + x * 4 + i) * 4 + 3];
        const v = sum / (16 * 255);
        if (v >= .16) out[v > .72 ? 0 : v > .55 ? 1 : v > .4 ? 2 : v > .27 ? 3 : 4].push(x0 + x, y0 + y);
      }
      flush(ictx, out, size, ICONS[opt.ic].round, SHADES);
      n++;
    }
    return n;
  };
  if (!window.BM) {                                                                    // reduced motion: the hero's still mark
    const mk = document.getElementById("bigmark");
    if (mk) { root.classList.add("sq-still"); srcs.push({ box: mk.parentElement, img: svgImage(mk, "#fff") }); }
  }
  // Random pixels: each pixel arrives at its own moment, near-black, and brightens to white at the same speed as every
  // other, so at any instant they stand at different shades; an old one dims the same way and goes.
  // Pixel steps: each pixel starts at its own random moment and climbs three set shades, near-black, dark grey, then its
  // final white, holding each for its own length of time; the old ones climb down the same steps and go
  const FT = 2400, FADE = 1200, STEP = 480, LEAD = 300;                               // LEAD: the old picture starts going this long before the new one starts coming                                           // ms: arrivals spread over FT, each fading over FADE; a shade held about STEP
  const flick = { t0: -1e9, old: new Float32Array(0), at: new Float32Array(0), shown: new Float32Array(0) };
  let heroOut = 0;                                                                     // 0: the hero's pictures; above: its digits and the brain
  const TSPREAD = 900;                                                                  // Travel: departures spread over this many ms
  const flickLen = () => opt.trans === "travel" ? TSPREAD + 1300 + 2 * STEP * 1.35 + 60 : LEAD + FT + (opt.trans === "steps" ? 2 * STEP * 1.35 : FADE);
  // Travel: the old picture's pixels travel to the new picture's places, in straight horizontal and vertical moves one cell
  // at a time. Pixels already in place stay; the others pair with the nearest free place (spare ones split or merge).
  // On the way they darken (light grey, grey, dark grey, near-black); once there each recovers its white in three
  // stages, near-black, grey, white, at its own random pace
  const TR = { t0: -1, list: [], stay: [], nowA: null, vmap: null };
  const buildTravel = nowA => {
    const n = nowA.length, olds = [], news = [], stay = [];
    for (let i = 0; i < n; i++) { const o = flick.old[i] >= .16, w = nowA[i] >= .16; if (o && w) stay.push(i); else if (o) olds.push(i); else if (w) news.push(i); }
    const xy = i => [i % gw, (i / gw) | 0], used = new Uint8Array(olds.length), list = [];
    const add = (from, to) => {
      const [sx, sy] = xy(from), [tx, ty] = xy(to), q = Math.random();
      list.push({ sx, sy, tx, ty, h: Math.random() < .5, dep: Math.random() * TSPREAD, dur: 600 + 700 * Math.random(), pace: STEP * (.65 + .7 * q), ov: flick.old[from], fv: Math.max(.2, nowA[to]), to });
    };
    for (let k = news.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [news[k], news[j]] = [news[j], news[k]]; }
    const anyOld = olds.concat(stay), anyNew = news.concat(stay);
    for (const to of news) {                                                           // each new place takes the nearest old pixel still free
      const [tx, ty] = xy(to);
      let best = -1, bd = 1e9;
      for (let k = 0; k < olds.length; k++) if (!used[k]) { const [ox, oy] = xy(olds[k]), dd = Math.abs(ox - tx) + Math.abs(oy - ty); if (dd < bd) { bd = dd; best = k; } }
      if (best >= 0) { used[best] = 1; add(olds[best], to); }
      else if (anyOld.length) add(anyOld[Math.floor(Math.random() * anyOld.length)], to);   // more new than old: an old one splits
      else add(to, to);                                                                // nothing before: it just appears there
    }
    olds.forEach((from, k) => { if (!used[k] && anyNew.length) add(from, anyNew[Math.floor(Math.random() * anyNew.length)]); });   // more old than new: they merge
    TR.list = list; TR.stay = stay; TR.t0 = flick.t0;
  };
  const travelFrame = (fe, nowA, out) => {
    const n = nowA.length;
    if (!TR.vmap || TR.vmap.length !== n) TR.vmap = new Float32Array(n);
    const vm = TR.vmap; vm.fill(0);
    if (fe < 60 || !nowA.some(v => v >= .16)) { vm.set(flick.old); }                  // the first frames: the hero has not drawn its new picture yet
    else {
      if (TR.t0 !== flick.t0) buildTravel(nowA);
      for (const i of TR.stay) vm[i] = nowA[i];
      for (const t of TR.list) {
        const e = fe - 60 - t.dep;
        let x = t.sx, y = t.sy, v;
        if (e < 0) v = t.ov;                                                           // waiting at home, still white
        else if (e < t.dur) {                                                          // on the way, one cell at a time, darkening
          const u = e / t.dur, ease = u * u * (3 - 2 * u), dx = t.tx - t.sx, dy = t.ty - t.sy, len = Math.abs(dx) + Math.abs(dy), st = Math.round(ease * len);
          const first = t.h ? Math.abs(dx) : Math.abs(dy);
          if (t.h) { if (st <= first) x += Math.sign(dx) * st; else { x = t.tx; y += Math.sign(dy) * (st - first); } }
          else { if (st <= first) y += Math.sign(dy) * st; else { y = t.ty; x += Math.sign(dx) * (st - first); } }
          v = u < .15 ? .6 : u < .35 ? .45 : u < .6 ? .33 : .2;
        } else {                                                                       // there: near-black, grey, then its white, at its own pace
          x = t.tx; y = t.ty;
          const b = Math.floor((e - t.dur) / t.pace);
          v = b === 0 ? .2 : b === 1 ? .45 : t.fv;
        }
        if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
        const i = y * gw + x; if (v > vm[i]) vm[i] = v;
      }
    }
    let any = false;
    for (let i = 0; i < n; i++) {
      const v = flick.shown[i] = vm[i];
      if (v < .16) continue;
      any = true;
      out[v > .72 ? 0 : v > .55 ? 1 : v > .4 ? 2 : v > .27 ? 3 : 4].push(i % gw, (i / gw) | 0);
    }
    return any;
  };
  if (window.BM && BM.word) {
    const word = BM.word, ready = BM.ready;
    BM.word = i => {
      if (opt.on && opt.trans !== "fly") {
        flick.old = flick.shown.length === L.prev.length ? flick.shown.slice() : L.prev.slice();   // from what is on screen now
        flick.at = Float32Array.from(flick.old, () => Math.random()); flick.t0 = performance.now();
      }
      word(i);
    };
    const HOLD_WHOLE = 2000;                                                           // ms the new picture stands whole before the next change may start
    if (ready) BM.ready = () => ready() && performance.now() - flick.t0 > flickLen() + (opt.trans === "fly" ? 0 : HOLD_WHOLE);   // the headline waits for it
    const out = BM.out;                                                                // the hero leaving: a change in progress ends at once,
    if (out) BM.out = q => { if (q > 0) flick.t0 = -1e9; heroOut = q; out(q); };       // so every pixel flows into the brain's digits
  }
  const drawIcons = () => {
    const kx = K / S, prev = L.prev;
    sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, L.src.width, L.src.height);
    sctx.setTransform(kx, 0, 0, kx, 0, 0);
    let n = 0;
    if (bm && bm.isConnected && bm.width > 1) { sctx.drawImage(bm, 0, 0, W, H); n++; }
    for (const s of srcs) {
      if (!s.img.complete || !s.img.naturalWidth) continue;
      const r = s.box.getBoundingClientRect();
      if (r.width < 2 || r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue;
      const o = shown(s.box); if (o <= .01) continue;
      sctx.globalAlpha = o; sctx.drawImage(s.img, r.left, r.top, r.width, r.height); n++;
    }
    sctx.globalAlpha = 1;
    ictx.setTransform(1, 0, 0, 1, 0, 0); ictx.clearRect(0, 0, ov.width, ov.height); ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!n && L.empty) { drawAgents(); return; }                                       // nothing else to draw, and nothing left on it
    mctx.clearRect(0, 0, L.mid.width, L.mid.height); mctx.drawImage(L.src, 0, 0, L.mid.width, L.mid.height);
    smctx.clearRect(0, 0, gw, gh); smctx.drawImage(L.mid, 0, 0, gw, gh);
    const d = smctx.getImageData(0, 0, gw, gh).data, out = lists(5);
    const fe = performance.now() - flick.t0, flicking = opt.trans !== "fly" && fe < flickLen() && flick.old.length === prev.length;
    if (flick.shown.length !== prev.length) flick.shown = new Float32Array(prev.length);
    const travel = flicking && opt.trans === "travel";
    // big squares: a picture's square is white where a block's white face covers most of it, one dark grey where the
    // block's darker side fully covers it, else empty (with margins so edges do not blink as the picture tilts); the
    // blocks are drawn solid, with no grid lines through them, and no half-covered grey rims. The
    // digits and the brain: each square as bright as the digits that passed through it over the last moment (an average
    // in time), so the squares stay put while the digits flow and the brain stands as a steady silhouette
    const bigCells = S >= 12, brain = bigCells && heroOut > .02;
    const tNow = performance.now(), ka = 1 - Math.exp(-Math.min(100, tNow - (L.last || tNow)) / 900); L.last = tNow;   // by time, so 60 and 120Hz screens match
    if (travel && (!TR.nowA || TR.nowA.length !== prev.length)) TR.nowA = new Float32Array(prev.length);
    let any = false;
    for (let j = 0, i = 0; j < gh; j++) for (let k = 0; k < gw; k++, i++) {
      const p = i * 4, a = d[p + 3];
      const cov = a / 255, lum = a ? (d[p] * .2126 + d[p + 1] * .7152 + d[p + 2] * .0722) / 255 : 0;
      let now, v;
      if (!bigCells) { now = cov * lum; v = prev[i] = prev[i] * .35 + now * .65; }   // a little memory: edges settle instead of flickering
      else if (brain) {                                                                // the digits passing through, averaged over about 0.9s
        now = Math.min(1, cov * 2.6) * lum;
        const e = prev[i] = prev[i] + (now - prev[i]) * ka, on = flick.shown[i] >= .16;
        v = Math.min(1, e * 1.3); if (on ? v < .15 : v < .25) v = 0;                   // a margin, so a square near the edge does not blink
        if (on && v && Math.abs(v - flick.shown[i]) < .07) v = flick.shown[i];          // and a square keeps its shade until its average clearly moves
      }
      else {                                                                           // white faces; a block's darker side, where it fully covers a square, one dark shade
        const f = cov * lum, wasFace = prev[i] > .5, wasSide = prev[i] > .1 && !wasFace;
        now = (wasFace ? f > .66 : f > .75) ? .95 : (wasSide ? cov > .45 : cov > .58) ? .22 : 0; v = prev[i] = now;
      }
      if (travel) { TR.nowA[i] = now; continue; }                                      // Travel draws the whole picture below
      if (flicking) {
        // the old picture goes first: an old pixel GOES at its random moment, having dimmed through the same shades just
        // before (from the start of the change at the earliest); LEAD later the new pixels start arriving at their own
        // random moments and climb to white at the same pace, so the two overlap after the old one has had its head start
        const o = flick.old[i], r = flick.at[i], gone = o >= .16 && now < .16, comes = o < .16 && now >= .16, at = r * FT, inAt = LEAD + at;
        if (opt.trans === "steps") {                                                   // its own pace, the same three shades
          const pace = STEP * (.65 + .7 * (r * 97.31 % 1));
          if (comes) { const b = Math.floor((fe - inAt) / pace); v = b < 0 ? 0 : b === 0 ? .2 : b === 1 ? .33 : v; }
          else if (gone) { const p = Math.min(pace, at / 2); v = fe >= at ? 0 : fe >= at - p ? .2 : fe >= at - 2 * p ? .33 : o; }
        } else {                                                                       // the same speed as every other
          if (comes) v = fe < inAt ? 0 : v * (.22 + .78 * Math.min(1, (fe - inAt) / FADE));
          else if (gone) { const d = Math.min(FADE, at); v = fe >= at ? 0 : fe < at - d ? o : o * (1 - .78 * (fe - (at - d)) / (d || 1)); }
        }
      }
      flick.shown[i] = v;
      if (v < .16) continue;
      any = true;
      out[v > .72 ? 0 : v > .55 ? 1 : v > .4 ? 2 : v > .27 ? 3 : 4].push(k, j);
    }
    if (travel) any = travelFrame(fe, TR.nowA, out);
    flush(ictx, out, S, ICONS[opt.ic].round, SHADES, bigCells && !brain);            // big squares: each block solid, no grid lines through it
    L.empty = !any;
    drawAgents();
  };

  // ---------- the logo (nav and footer). On every texture but the big squares it is the arch (two up, a step up and
  // right twice, across, a step down and right twice, two down) in the background's own cells, the nav's on the same
  // places as theirs. On big squares: the arch in 6px squares with square icons, else the mark's own 11 x 7 squares in
  // small dots. The nav's is
  // fixed, so it sits on the grid; the footer's moves with its scene, so it follows the footer instead
  const MARK = 'path[d^="M137.5 0L155 0"]';
  const ARCH = [[0, 3], [0, 2], [1, 1], [2, 0], [3, 0], [4, 1], [5, 2], [5, 3]];       // [column, row], row 0 at the top
  const units = [], marks = [];
  const first = document.querySelector(".brand " + MARK);
  if (first) {
    const mark = new Path2D(first.getAttribute("d")), t = document.createElement("canvas").getContext("2d");
    for (let j = 0; j < 7; j++) for (let i = 0; i < 11; i++) if (t.isPointInPath(mark, 12.5 + 25 * i, 12.5 + 25 * j)) units.push([i, j]);
    document.querySelectorAll(".brand svg, footer svg").forEach(svg => {
      if (!svg.querySelector(MARK)) return;
      const cv = Object.assign(document.createElement("canvas"), { className: "sq-mark" });
      cv.setAttribute("aria-hidden", "true"); svg.after(cv); svg.parentElement.classList.add("sq-markbox");
      marks.push({ svg, cv, fixed: !!svg.closest(".nav"), key: "" });
    });
  }
  const drawMarks = () => {
    const own = true, arch = true;                                                     // the arch in the background's own cells, on every texture
    const shape = arch ? ARCH : units, nw = arch ? 6 : 11, nh = arch ? 4 : 7, round = own ? GRIDS[opt.grid].round : ICONS[opt.ic].round;
    for (const m of marks) {
      const P = own ? (m.fixed ? G : Math.min(G, 4)) : arch ? (m.fixed ? 6 : 4) : 3, w = nw * P, hh = nh * P;
      const r = m.svg.getBoundingClientRect(), pr = m.svg.parentElement.getBoundingClientRect();
      if (!r.width) continue;
      let x0 = r.left + r.width / 2 - w / 2, y0 = r.top + r.height / 2 - hh / 2;
      if (m.fixed) { x0 = Math.round(x0 / P) * P; y0 = Math.round(y0 / P) * P; }
      const color = m.svg.querySelector(MARK).getAttribute("fill") === "currentColor" ? getComputedStyle(m.svg).color : "#fff";
      const left = Math.round((x0 - pr.left) * 2) / 2, top = Math.round((y0 - pr.top) * 2) / 2, key = [left, top, color, opt.ic, opt.grid, dpr].join();
      if (key === m.key) continue;
      m.key = key;
      m.cv.width = Math.round(w * dpr); m.cv.height = Math.round(hh * dpr);
      Object.assign(m.cv.style, { left: left + "px", top: top + "px", width: w + "px", height: hh + "px" });
      const g = m.cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = color; g.beginPath();
      const rad = own ? rr(P) : P * .44;                                               // in its own cells: exactly the background's
      for (const [i, j] of shape) {
        if (round) { g.moveTo(i * P + P / 2 + rad, j * P + P / 2); g.arc(i * P + P / 2, j * P + P / 2, rad, 0, 6.2832); }
        else if (own) g.rect(i * P + 1 / dpr, j * P + 1 / dpr, P - 1 / dpr, P - 1 / dpr);
        else if (P >= 4) g.rect(i * P + .5, j * P + .5, P - 1, P - 1);
        else g.rect(i * P + .3, j * P + .3, P - .6, P - .6);
      }
      g.fill();
    }
  };

  // ---------- 4. colour cells: the honeycomb's logo tiles and the page's shapes (pills, buttons, tags, chips, badges,
  // stat boxes, cards, the closing card, the scene dots, the founder's white panel), each cell the average colour of
  // what it covers. Drawn 4x finer, averaged down to one pixel per cell, laid on blown up with no smoothing (one square
  // per cell) and cut to squares or dots by one mask pass: no reading back, no per-cell drawing. Under the scenes, so
  // the text stays on top; the nav's own shapes on a layer inside the nav, so its frosted glass does not blur them
  const layerCanvas = id => { const c = Object.assign(document.createElement("canvas"), { id }); c.setAttribute("aria-hidden", "true"); return c; };
  const stage = document.querySelector(".stage"), nav = document.getElementById("nav");
  const watchCv = layerCanvas("sqWatch"), shapeCv = layerCanvas("sqShapes"), navCv = layerCanvas("sqNavShapes"), barCv = layerCanvas("sqNavBar");
  const pnl = stage && stage.querySelector(".m-panel");                                // above the founder's panel, under every scene
  if (pnl) pnl.after(shapeCv, watchCv); else if (stage) stage.prepend(shapeCv, watchCv); else field.after(shapeCv, watchCv);
  if (nav) nav.prepend(barCv, navCv);                                                 // the bar under the pills
  const colourLayer = (cv, inNav) => {
    const mk = () => document.createElement("canvas"), L = { cv, inNav, ctx: cv.getContext("2d"), src: mk(), mid: mk(), small: mk(), S: 0, gw: 0, gh: 0, clean: false };
    L.sctx = L.src.getContext("2d"); L.mctx = L.mid.getContext("2d"); L.smctx = L.small.getContext("2d");
    return L;
  };
  const watchL = colourLayer(watchCv, false), shapeL = colourLayer(shapeCv, false), navL = colourLayer(navCv, true), barL = colourLayer(barCv, true);
  const sizeColour = (L, kind) => {
    L.clean = false;
    if (kind === "off" || !W) { L.cv.width = L.cv.height = 1; L.S = 0; return; }
    const S = GRIDS[kind].cell, h = L.inNav ? (nav ? nav.offsetHeight : 72) : H;
    L.S = S; L.gw = Math.ceil(W / S); L.gh = Math.ceil(h / S);
    L.src.width = L.gw * K; L.src.height = L.gh * K; L.mid.width = L.gw * 2; L.mid.height = L.gh * 2; L.small.width = L.gw; L.small.height = L.gh;
    L.cv.width = Math.round(W * dpr); L.cv.height = Math.round(h * dpr);
    if (L.inNav) Object.assign(L.cv.style, { width: W + "px", height: h + "px" });
    [L.sctx, L.mctx, L.smctx].forEach(x => { x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; });
  };
  const cellMasks = new Map();
  const cellMask = (ctx, S, round) => {                                                // one cell's shape, repeating: a dot, or a square short of the grid line
    const key = ctx.canvas.id + S + round + dpr;
    if (!cellMasks.has(key)) {
      const px = Math.max(1, Math.round(S * dpr)), t = Object.assign(document.createElement("canvas"), { width: px, height: px }), g = t.getContext("2d");
      g.fillStyle = "#fff";
      if (round) { g.beginPath(); g.arc(px / 2, px / 2, rr(S) * dpr, 0, 6.2832); g.fill(); } else g.fillRect(1, 1, px - 1, px - 1);   // a one-pixel line between squares
      cellMasks.set(key, ctx.createPattern(t, "repeat"));
    }
    return cellMasks.get(key);
  };
  const renderColour = (L, kind, fill) => {
    const ctx = L.ctx;
    if (kind === "off" || !L.S) { if (!L.clean) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, L.cv.width, L.cv.height); L.clean = true; } return; }
    const k = K / L.S;
    L.sctx.setTransform(1, 0, 0, 1, 0, 0); L.sctx.clearRect(0, 0, L.src.width, L.src.height); L.sctx.setTransform(k, 0, 0, k, 0, 0);
    L.plates = [];
    const n = fill(L.sctx, L);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!n) { if (!L.clean) { ctx.clearRect(0, 0, L.cv.width, L.cv.height); L.clean = true; } return; }
    L.clean = false;
    L.mctx.clearRect(0, 0, L.mid.width, L.mid.height); L.mctx.drawImage(L.src, 0, 0, L.mid.width, L.mid.height);
    L.smctx.clearRect(0, 0, L.gw, L.gh); L.smctx.drawImage(L.mid, 0, 0, L.gw, L.gh);
    ctx.clearRect(0, 0, L.cv.width, L.cv.height);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(L.small, 0, 0, L.gw * L.S * dpr, L.gh * L.S * dpr);
    ctx.globalCompositeOperation = "destination-in"; ctx.fillStyle = cellMask(ctx, L.S, GRIDS[kind].round); ctx.fillRect(0, 0, L.cv.width, L.cv.height);
    ctx.globalCompositeOperation = "source-over";
    if (L.plates.length) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); fillPlates(ctx, L.plates); ctx.setTransform(1, 0, 0, 1, 0, 0); }
  };
  // where the page lets an element be seen: its own and its ancestors' clip-path insets and hidden overflow, so cells
  // leave with their element when a scene wipes or clips it away
  const clipCache = new Map();
  const insetBox = (R, spec) => {
    const v = spec.split(/\s+/), cut = v.indexOf("round"), w = (cut < 0 ? v : v.slice(0, cut)).filter(t => /[\d.]/.test(t));
    const T = w[0] || "0", Rt = w[1] || T, B = w[2] || T, Lf = w[3] || Rt;
    return { l: R.left + px(Lf, R.width), t: R.top + px(T, R.height), r: R.right - px(Rt, R.width), b: R.bottom - px(B, R.height) };
  };
  const clipBox = el => {
    let l = -1e9, t = -1e9, r = 1e9, b = 1e9;
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      let c = clipCache.get(e);
      if (c === undefined) {
        c = null;
        const cs = getComputedStyle(e), m = cs.clipPath.match(/^inset\(([^)]*)\)/), hid = cs.overflowX !== "visible" || cs.overflowY !== "visible";
        if (m || hid) {
          const R = e.getBoundingClientRect();
          c = m ? insetBox(R, m[1]) : { l: R.left, t: R.top, r: R.right, b: R.bottom };
        }
        clipCache.set(e, c);
      }
      if (c) { l = Math.max(l, c.l); t = Math.max(t, c.t); r = Math.min(r, c.r); b = Math.min(b, c.b); }
    }
    return r > l && b > t ? { l, t, r, b } : null;
  };
  const clipTo = (ctx, el) => {                                                        // false when nothing of it can be seen
    const c = clipBox(el);
    if (!c) return false;
    ctx.beginPath(); ctx.rect(c.l, c.t, c.r - c.l, c.b - c.t); ctx.clip();
    return true;
  };
  const isTiles = root.classList.contains("tiles");
  const bubs = [...document.querySelectorAll(".bub-c")].map(box => {
    const img = box.querySelector("img");
    return img && { box, img, orig: img.getAttribute("src"), full: Object.assign(new Image(), { src: img.src }) };
  }).filter(Boolean);
  // a logo split once into its background colour (the commonest colour on its tile) and its mark on a clear background
  // (each pixel as solid as it is far from that colour), for the "background only" tiles
  const splitLogo = b => {
    const n = 256, c = Object.assign(document.createElement("canvas"), { width: n, height: n }), g = c.getContext("2d", { willReadFrequently: true });
    g.fillStyle = "#000"; g.fillRect(0, 0, n, n); g.drawImage(b.full, 0, 0, n, n);
    const id = g.getImageData(0, 0, n, n), d = id.data, count = new Uint32Array(4096);
    for (let i = 0; i < d.length; i += 4) count[(d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | d[i + 2] >> 4]++;
    let top = 0; for (let k = 1; k < 4096; k++) if (count[k] > count[top]) top = k;
    let R = 0, Gn = 0, B = 0, m = 0;
    for (let i = 0; i < d.length; i += 4) if (((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | d[i + 2] >> 4) === top) { R += d[i]; Gn += d[i + 1]; B += d[i + 2]; m++; }
    R /= m; Gn /= m; B /= m;
    for (let i = 0; i < d.length; i += 4) {
      const dist = Math.hypot(d[i] - R, d[i + 1] - Gn, d[i + 2] - B) / 441.7;
      d[i + 3] = 255 * Math.min(1, Math.max(0, (dist - .06) / .16));
    }
    g.putImageData(id, 0, 0);
    b.bg = `rgb(${R | 0},${Gn | 0},${B | 0})`; b.mark = c.toDataURL();
  };
  const markSrc = on => bubs.forEach(b => {                                            // the real tiles show the mark alone, or the whole logo again
    if (on && !b.mark && b.full.complete && b.full.naturalWidth) splitLogo(b);
    const want = on && b.mark ? b.mark : b.orig;
    if (b.img.getAttribute("src") !== want) b.img.setAttribute("src", want);
  });
  const drawTiles = ctx => {                                                           // the honeycomb: each tile rounded as it is
    const bgOnly = opt.wpart === "bg";
    if (bgOnly) markSrc(true);
    let n = 0;
    for (const b of bubs) {
      if (!b.full.complete || !b.full.naturalWidth || (bgOnly && !b.bg)) continue;
      const r = b.box.getBoundingClientRect();
      if (r.width < 2 || r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue;
      const o = shown(b.box); if (o <= .01) continue;
      ctx.save();
      if (clipTo(ctx, b.box)) {
        ctx.globalAlpha = o; ctx.beginPath(); ctx.roundRect(r.left, r.top, r.width, r.height, Math.min(r.width, r.height) * (isTiles ? .25 : .5)); ctx.clip();
        if (bgOnly) { ctx.fillStyle = b.bg; ctx.fillRect(r.left, r.top, r.width, r.height); }   // its colour only: the mark stays on the real tile
        else { ctx.fillStyle = "#000"; ctx.fillRect(r.left, r.top, r.width, r.height); ctx.drawImage(b.full, r.left, r.top, r.width, r.height); }
        n++;
      }
      ctx.restore();
    }
    return n;
  };
  const drawBar = (ctx, L) => {                                                        // the nav's bar once the page scrolls, in the background's cells
    if (!nav) return 0;
    const cs = getComputedStyle(nav), colour = cs.backgroundColor;
    if (!colour || colour === "transparent" || /rgba\([^)]*,\s*0\)$/.test(colour)) return 0;
    const h = nav.offsetHeight;
    ctx.fillStyle = colour; ctx.fillRect(0, 0, W, h);
    // its labels on solid plates: over the white page the gaps between its cells are white
    const solid = colour.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]*\)/, "rgb($1,$2,$3)"), a = alphaOf(colour), S = L.S;
    platesFor(nav.querySelector(".nav-in") || nav, S, { l: 0, t: 0, r: W, b: h }, L.plates, solid, a, ".brand");   // the logo and name go without
    return 1;
  };
  const SHAPES = ".m-panel,.btn,.nav-pill,.lang-btn.active,.nav-links a.cur,.badge,.chips li,.tag,.cta,.stat,.card,.scene-dots button,.modal-tag";
  const lastColour = v => { const m = v.match(/rgba?\([^)]*\)/g); return m ? m[m.length - 1] : null; };
  // shapes whose colour never changes (and whose text may be gradient text, which the clip-to-text hiding would spoil):
  // their colour is read once with the page's own styles, then they are hidden plainly
  const STATIC = ".stat,.card,.cta", staticColour = new WeakMap();
  const colourOf = (el, cs) => {
    if (!el.matches(STATIC)) return cs.backgroundImage !== "none" ? lastColour(cs.backgroundImage) : cs.backgroundColor;
    let c = staticColour.get(el);
    if (c === undefined) {
      const on = root.classList.contains("sq-shapes");
      if (on) root.classList.remove("sq-shapes");
      const s0 = getComputedStyle(el); c = s0.backgroundImage !== "none" ? lastColour(s0.backgroundImage) : s0.backgroundColor;
      if (on) root.classList.add("sq-shapes");
      staticColour.set(el, c);
    }
    return c;
  };
  const alphaOf = c => { const m = c.match(/rgba\([^)]*,\s*([\d.]+)\)$/); return m ? +m[1] : 1; };
  const drawShapes = (ctx, L, inNav) => {                                              // each shape in its own colour (a gradient: its last colour)
    let n = 0;
    for (const el of document.querySelectorAll(SHAPES)) {
      if (!!el.closest(".nav") !== inNav || el.closest(".menu-sheet")) continue;
      const cs = getComputedStyle(el), colour = colourOf(el, cs);
      if (!colour || /rgba\([^)]*,\s*0\)$/.test(colour) || colour === "transparent") continue;
      let { left: x, top: y, width: w, height: h } = el.getBoundingClientRect();
      if (el.closest(".scene-dots")) {                                                 // the scene dots paint only their content box
        x += px(cs.paddingLeft, w); y += px(cs.paddingTop, h); w -= px(cs.paddingLeft, w) + px(cs.paddingRight, w); h -= px(cs.paddingTop, h) + px(cs.paddingBottom, h);
      }
      if (w < 1 || h < 1 || y + h < 0 || y > (inNav ? 200 : H) || x + w < 0 || x > W) continue;
      const o = shown(el); if (o <= .01) continue;
      ctx.save();
      if (clipTo(ctx, el)) {                                                           // the founder's panel opening from a line, a scene wiping its buttons away
        const rad = Math.min(px(cs.borderTopLeftRadius, w), w / 2, h / 2);
        ctx.globalAlpha = o;
        if (opt.btn !== "pixel" && el.matches(".hero .hero-ctas .btn, .cta .hero-ctas .btn") && !el.matches(":active")) {   // (pixel buttons: their shadow is CSS)          // the button's 3D edge, one cell to the right and down; pressed, it is gone
          ctx.fillStyle = cs.getPropertyValue("--sq-edge-c").trim() || "#555"; ctx.beginPath(); ctx.roundRect(x + L.S, y + L.S, w, h, rad); ctx.fill();
        }
        ctx.fillStyle = colour; ctx.beginPath(); ctx.roundRect(x, y, w, h, rad); ctx.fill();
        const cb = clipBox(el), box = { l: Math.max(x, cb.l), t: Math.max(y, cb.t), r: Math.min(x + w, cb.r), b: Math.min(y + h, cb.b) };
        platesFor(el.matches(".m-panel") ? (window.SQ_WHITE === "last" ? document.querySelector(".foot") : document.getElementById("founderScene"))   /* the scenes move the footer out of <footer> */ : el, L.S, box, L.plates, colour.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]*\)/, "rgb($1,$2,$3)"), alphaOf(colour) * o);
        n++;
      }
      ctx.restore();
    }
    return n;
  };

  // ---------- size, options, loop
  const resize = () => {
    W = innerWidth; H = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
    if (!W || !H) return;                                                              // no size yet: the loop tries again
    G = GRIDS[opt.grid].cell; f = 12 / G;
    field.width = Math.round(W * dpr); field.height = Math.round(H * dpr); masks.clear();
    cols = Math.ceil(W / G) + 1; rows = Math.ceil(H / G) + 1; cols12 = Math.ceil(W / 12) + 1; rows12 = Math.ceil(H / 12) + 1;
    sizeCursor(); setBackground(); sizeIcons(); marks.forEach(m => { m.key = ""; });
    sizeColour(watchL, opt.watch); sizeColour(shapeL, opt.shape); sizeColour(navL, opt.shape); sizeColour(barL, opt.grid);
  };
  const panel = document.createElement("div");
  panel.id = "sqPanel";
  const LABEL = { btn: "Button style", trans: "Icon transition", white: "White page", grid: "Background texture", bg: "Background colour", ic: "Icons", watch: "Watch tiles", wpart: "Watch tiles: in cells", shape: "Shapes", on: "Compare" };
  const seg = (k, list) => `<div class="sq-row"><span>${LABEL[k]}</span><div class="sq-seg" data-k="${k}">`
    + list.map(([v, label]) => `<button type="button" data-v="${v}">${label}</button>`).join("") + "</div></div>";
  panel.innerHTML = `<div class="sq-top"><b>Squares lab</b><button type="button" class="sq-min">hide</button></div><div class="sq-body">`
    + seg("white", [["last", "Last page"], ["founder", "Founder"]])
    + seg("btn", [["cur", "Current"], ["pixel", "Pixel"]])
    + seg("trans", [["fly", "Fly (as now)"], ["pixels", "Random pixels"], ["steps", "Pixel steps"], ["travel", "Travel"]])
    + seg("bg", Object.entries(BGS).map(([k, v]) => [k, k.toUpperCase() + " " + v.name]))
    + seg("grid", Object.entries(GRIDS).map(([k, v]) => [k, v.name]))
    + seg("ic", Object.entries(ICONS).map(([k, v]) => [k, v.name]))
    + seg("watch", [["off", "Off"], ...Object.entries(GRIDS).map(([k, v]) => [k, v.name])])
    + seg("wpart", [["all", "Whole tile"], ["bg", "Background only"]])
    + seg("shape", [["off", "Off"], ...Object.entries(GRIDS).map(([k, v]) => [k, v.name])])
    + seg("on", [["1", "Experiment"], ["0", "Live site"]])
    + `<div class="sq-code"></div></div>`;
  if (!SITE) document.body.append(panel);
  const apply = () => {
    root.classList.toggle("sq-on", opt.on);
    root.style.setProperty("--bg", opt.on ? BGS[opt.bg].bg : "");
    const pb = BGS[opt.bg];                                                            // the hero's two buttons: dark faces, a 3D edge one cell deep
    root.style.setProperty("--sq-btn1", pb.btn1); root.style.setProperty("--sq-btn2", pb.btn2); root.style.setProperty("--sq-edge-c", pb.edge);
    root.style.setProperty("--sq-edge", (opt.shape !== "off" ? GRIDS[opt.shape].cell : 4) + "px");
    panel.querySelectorAll(".sq-seg").forEach(s => s.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === (s.dataset.k === "on" ? (opt.on ? "1" : "0") : s.dataset.k === "white" ? window.SQ_WHITE : opt[s.dataset.k]))));
    const u = new URL(location.href);
    for (const k of ["grid", "bg", "ic", "watch", "wpart", "shape", "trans", "btn"]) u.searchParams.set(k, opt[k]);
    root.classList.toggle("sq-pixbtn", opt.btn === "pixel");
    window.SQ_FLICKER = opt.on && opt.trans !== "fly";
    u.searchParams.set("white", window.SQ_WHITE || "last");
    if (opt.on) u.searchParams.delete("live"); else u.searchParams.set("live", "1");
    if (!SITE) history.replaceState(null, "", u);
    panel.querySelector(".sq-code").textContent = opt.on ? `grid=${opt.grid} · bg=${opt.bg} · ic=${opt.ic} · watch=${opt.watch} · wpart=${opt.wpart} · shape=${opt.shape} · trans=${opt.trans}` : "the live site as it is now";
    root.classList.toggle("sq-type", GRIDS[opt.grid].cell < 12);
    root.classList.toggle("sq-bigmark", GRIDS[opt.grid].cell >= 12);                  // big squares: the logo's arch is 72 x 48, the name moves over for it
    root.classList.toggle("sq-watch", opt.watch !== "off");
    root.classList.toggle("sq-watch-bg", opt.watch !== "off" && opt.wpart === "bg");
    markSrc(opt.on && opt.watch !== "off" && opt.wpart === "bg");
    root.classList.toggle("sq-shapes", opt.shape !== "off");
    if (W) resize();
  };
  panel.addEventListener("click", e => {
    e.stopPropagation();
    if (e.target.closest(".sq-min")) { const m = panel.classList.toggle("min"); e.target.textContent = m ? "show" : "hide"; return; }
    const b = e.target.closest(".sq-seg button"); if (!b) return;
    const k = b.parentElement.dataset.k;
    if (k === "white") { const u = new URL(location.href); u.searchParams.set("white", b.dataset.v); location.href = u; return; }   // the scenes read it once: reload
    if (k === "on") opt.on = b.dataset.v === "1"; else opt[k] = b.dataset.v;
    apply();
  });
  document.querySelectorAll(STATIC).forEach(el => colourOf(el, null));                // read before the page's shapes are hidden
  resize(); apply();
  addEventListener("resize", resize);
  const PHONE = matchMedia("(max-width: 900px)");
  const TM = { field: 0, icons: 0, rest: 0, n: 0 };                                  // ms spent per frame, for checks
  const loop = now => {
    requestAnimationFrame(loop);
    if (bm && bm.parentElement && ov.previousElementSibling !== bm) bm.after(ov);   // the scenes move the hero canvas onto the stage after load: follow it
    const faint = PHONE.matches && heroOut < .99 ? ".42" : "";                         // phones: the hero picture sits behind the text, faint as on the page before
    if (ov.style.opacity !== faint) ov.style.opacity = faint;
    if (W !== innerWidth || H !== innerHeight) resize();                             // also a page first laid out in a hidden or minimised window
    if (opt.on && W > 0 && H > 0) {
      opCache.clear(); clipCache.clear();
      const t0 = performance.now(); drawField(reduce ? 0 : now / 1000);
      const t1 = performance.now(); drawIcons();
      renderColour(barL, opt.grid, drawBar); renderColour(watchL, opt.watch, drawTiles); renderColour(shapeL, opt.shape, (x, L) => drawShapes(x, L, false)); renderColour(navL, opt.shape, (x, L) => drawShapes(x, L, true));
      const t2 = performance.now(); drawMarks(); drawCursor();
      const t3 = performance.now(); TM.field += t1 - t0; TM.icons += t2 - t1; TM.rest += t3 - t2; TM.n++;
    }
  };
  requestAnimationFrame(loop);
  window.SQ = { srcs, opt, shown, TM, flick, L, drawField, drawIcons, drawCursor, opCache, get dims() { return { W, H, G, S, gw, gh }; } };   // for checks from the console
})();
