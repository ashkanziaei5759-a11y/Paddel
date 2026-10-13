// Lemo-Opuscar reel · Swiss Motion Graphics · vertical 1080×1920 · 40 s · all text Persian (Vazirmatn, flush right).
// One system (a 6-column grid of square modules), one exception: the orange Persian zero «۰», a dot that is the agent.
// Every snap uses the precise ease and lands on a beat; lines, the dot and playheads move linearly. No fades.
import { E, snap, lin, steps, seg, clamp, lerp, BEAT, E8, E16 } from './ease.js';

export const SW = 1080, SH = 1920, END = 40;
const C = { page: '#F2F0EA', paper: '#FFFFFF', ink: '#141414', g1: '#D9D6CE', g2: '#BEBAB1', g3: '#8F8B83', wall: '#DEDBD3', sig: '#D97757' };
const M = 72, CW = 136, GU = 24, R = SW - M, TOP = 216;          // margins, column, gutter, right edge, first row
const cellX = k => R - k * (CW + GU) - CW;                         // k-th column counted from the right (RTL)
const rowY = j => TOP + j * (CW + GU);
const PW = SW + 80, PH = SH + 80;                                   // pages on the wall, with gaps
const PAGES = { A: [2, 0], B: [1, 0], C: [0, 0], D: [2, 1], E: [1, 1], F: [0, 1], G: [1, 2] };   // reading order runs right → left
const org = id => [PAGES[id][0] * PW, PAGES[id][1] * PH];
const ctr = id => { const [x, y] = org(id); return [x + SW / 2, y + SH / 2]; };

let g;                                                              // current 2D context
const font = (wt, size) => { g.font = `${wt} ${size}px Vazirmatn`; g.direction = 'rtl'; g.textAlign = 'right'; g.textBaseline = 'alphabetic'; };
const tw = s => g.measureText(s).width;
// clip-reveal: the word rises out of a clip box from below its baseline (p 0→1) and leaves upward (q 0→1)
function reveal(s, xr, y, size, p, q = 0, color = C.ink, desc = .5) {   // desc: clip depth below the baseline (numerals: ~0)
  if (p <= 0 || q >= 1) return;
  const w = tw(s) + size * .12;
  g.save(); g.beginPath(); g.rect(xr - w, y - size * 1.12, w + size * .06, size * (1.12 + desc)); g.clip();
  g.fillStyle = color; g.fillText(s, xr, y + (1 - p) * size * 1.15 - q * size * 1.6); g.restore();
}
// knife cut: a hairline crosses the word right → left (1/16), then the word collapses to its midline (1/8)
function knifed(s, xr, y, size, p, tc, t, color = C.ink) {
  const w = tw(s), mid = y - size * .3, k = lin(t, tc, tc + E16), c = snap(t, tc + E16 + E8, E8);
  if (c >= 1) return;
  g.save(); g.translate(0, mid); g.scale(1, 1 - c); g.translate(0, -mid); reveal(s, xr, y, size, p, 0, color); g.restore();
  if (k > 0) { g.fillStyle = C.ink; g.fillRect(xr + 18 - (w + 36) * k, mid - 1.5, (w + 36) * k, 3); }
}
const hline = (x1, x0, y, p, col = C.ink, h = 1) => { if (p > 0) { g.fillStyle = col; g.fillRect(x1 - (x1 - x0) * p, y, (x1 - x0) * p, h); } };   // grows right → left
const vline = (x, y0, y1, p, col = C.g1) => { if (p > 0) { g.fillStyle = col; g.fillRect(x, y0, 1, (y1 - y0) * p); } };
const wipeRect = (x, y, w, h, p, col) => { if (p > 0) { g.fillStyle = col; g.fillRect(x + w * (1 - p), y, w * p + .5, h); } };   // right → left wipe
function gridLines(t, t0, y1 = 1312) {                            // column edges grow down, rippling right → left on sixteenths
  for (let k = 0; k < 6; k++) { const a = t0 + k * E16 * .5; vline(cellX(k) + CW, TOP, y1, lin(t, a, a + .5)); vline(cellX(k), TOP, y1, lin(t, a + E16 * .25, a + .5 + E16 * .25)); }
}

export async function build(timing) {
  const F = timing.words, cues = timing.cues;
  const ws = k => F[k][0], we = k => F[k][1];
  const q8 = x => Math.round(x * 8) / 8;                            // put onsets on whole 8ths / frames
  const logo = new Path2D((await (await fetch('assets/claude-logo.svg')).text()).match(/ d="([^"]+)"/)[1]);
  const ev = [], cue = (t, type, o = {}) => ev.push({ t: +t.toFixed(3), type, ...o });

  // ───────── the zero glyph: measured once so the dot can be drawn at any size
  const mc = new OffscreenCanvas(8, 8).getContext('2d'); mc.font = '900 1000px Vazirmatn';
  const zm = mc.measureText('۰'), ZW = zm.actualBoundingBoxLeft + zm.actualBoundingBoxRight, ZH = zm.actualBoundingBoxAscent + zm.actualBoundingBoxDescent;
  function zeroGlyph(cx, cy, h, col = C.sig) {                       // draw «۰» with its ink box centred at (cx, cy), ink height h
    const s = h / ZH * 1000; g.save(); g.font = `900 ${s}px Vazirmatn`; g.direction = 'ltr'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = col; g.fillText('۰', cx - (zm.actualBoundingBoxRight - zm.actualBoundingBoxLeft) / 2 * s / 1000 - 0, cy + (zm.actualBoundingBoxAscent - zm.actualBoundingBoxDescent) / 2 * s / 1000); g.restore();
  }

  // ═════════ timing (film seconds), derived from the voice's word map
  const T = {
    grid0: .15,
    words: [['دوربین', 'dorbin', 620], ['ادیتور', 'editor', 880], ['فوتیج', 'footage', 1140]].map(([s, k, y]) => ({ s, y, tin: q8(ws(k)), tcut: q8(we(k) + .1) })),
    zero: 5.75, note: 6.0,
    pan1: 6.5, rule: 6.25, tag: q8(ws('matnbaz')), name: [q8(ws('lemo')), q8(ws('lemo') + .38)], n39: q8(ws('n39')), sabk: q8(ws('sabk')),
    pan2: 11.0, named: ['abrang', 'icon', 'silent', 'pixel', 'wb'].map(k => q8(ws(k))), more: q8(ws('more') + .1),
    pan3: 17.5, how: q8(ws('how')), link: q8(ws('link')), copy: q8(ws('copy')), term: q8(ws('claude')), paste: q8(ws('paste')),
    pan4: 23.5, style: q8(ws('sabk2')), pick: q8(ws('sabk2') + .5), story: q8(ws('story')),
    pan5: 26.75, self: q8(ws('claude2')), tracks: [[28.0, 29.0], [29.25, 30.25], [30.5, 31.5]],
    wall0: 32.5, wall1: 33.0, rebuild: 33.25, push0: 35.0, push1: 35.5,
    box: 35.5, logo: 36.25, repo: [ws('repo'), we('repo')], send: q8(ws('comment')),
  };

  // ═════════ pages (each draws in its own coordinates; its clock is t)
  const P = {};
  P.A = t => {                                                       // hook: three needs, knife-cut; a zero is left
    gridLines(t, T.grid0);
    font(900, 112); reveal('فیلم', R, 330, 112, snap(t, q8(ws('film')), E8)); reveal('ساختم', R - tw('فیلم '), 330, 112, snap(t, q8(ws('film') + .42), E8));
    hline(R, M, 376, lin(t, ws('film') + .3, ws('film') + .8));
    font(900, 210);
    for (const w of T.words) knifed(w.s, R, w.y, 210, snap(t, w.tin, E8), w.tcut, t);
    if (t > 6.0) zeroGlyph(R - 250, 860, 470, C.g1);                 // the zero's print stays behind when the dot leaves
    font(300, 26); hline(R, R - 560, 1262, snap(t, T.note, E8));
    reveal('۰ دوربین   ·   ۰ ادیتور   ·   ۰ ثانیه فوتیج', R, 1306, 26, snap(t, T.note + E16, E16), 0, C.g3);
  };
  P.B = t => {                                                       // open source · the name · 39
    gridLines(t, T.rule - .1);
    hline(R, M, TOP - 1, lin(t, T.rule, T.rule + .5));
    wipeRect(cellX(0), TOP + 24, CW, CW, snap(t, T.tag, E8), C.ink);
    if (t > T.tag) { g.save(); g.beginPath(); g.rect(cellX(0) + CW * (1 - snap(t, T.tag, E8)), TOP + 24, CW, CW); g.clip();
      g.fillStyle = C.paper; g.font = '700 54px Vazirmatn'; g.direction = 'ltr'; g.textAlign = 'center'; g.fillText('</>', cellX(0) + CW / 2, TOP + 24 + 86); g.restore(); }
    font(700, 52); reveal('متن‌باز', cellX(0) - GU, TOP + 24 + 86, 52, snap(t, T.tag + E8, E8));
    font(900, 200); reveal('لمو', R, 600, 200, snap(t, T.name[0], E8)); reveal('اوپوس‌کار', R, 830, 200, snap(t, T.name[1], E8));
    font(900, 500); const w39 = tw('۳۹');
    reveal('۳۹', R + 8, 1300, 500, steps(t, T.n39 - BEAT, T.n39, 4), 0, C.ink, .03);
    font(300, 30); hline(R - w39 - 32, M, 1240, snap(t, T.sabk, E8));
    reveal('سبک فیلم‌سازی', R - w39 - 32, 1290, 30, snap(t, T.sabk + E16, E16), 0, C.ink);
  };
  const cellOf = n => [cellX(n % 6), rowY(Math.floor(n / 6))];
  const NAMES = ['آبرنگ', 'آیکون‌نگاری', 'سینمای صامت', 'پیکسل‌آرت', 'وایت‌بورد'];
  const ripple = n => { const [x, y] = cellOf(n), [x4, y4] = cellOf(4); return T.more + Math.floor(Math.hypot(x - x4, y - y4) / (CW + GU) * 2) / 2 * E16 * 2; };
  P.C = t => {                                                       // the grid means something: 39 cells = 39 styles
    font(500, 30); hline(R, M, TOP - 40, lin(t, T.pan2 - .25, T.pan2 + .25)); reveal('۳۹ سبک', R, TOP - 56, 30, snap(t, T.pan2 + E8, E8));
    for (let n = 0; n < 39; n++) {
      const [x, y] = cellOf(n), a = T.pan2 + (Math.floor(n / 6) + (n % 6) * .5) * E16 * .5;
      const p = lin(t, a, a + E8);
      if (p > 0) { g.strokeStyle = C.g2; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, CW - 1, (CW - 1) * p); }
      if (n < 5) {
        const f = snap(t, T.named[n], E16); wipeRect(x, y, CW, CW, f, C.ink);
        if (f > 0) { g.save(); g.beginPath(); g.rect(x + CW * (1 - f), y, CW * f, CW); g.clip(); icon(n, x + CW / 2, y + 54); font(500, 19); g.fillStyle = C.paper; g.fillText(NAMES[n], x + CW - 10, y + CW - 14); g.restore(); }
      } else {
        const f = snap(t, ripple(n), E16); wipeRect(x, y, CW, CW, f, C.g1);
        if (f >= 1) { font(300, 18); g.fillStyle = C.g3; g.fillText((n + 1).toLocaleString('fa-IR'), x + CW - 10, y + 28); }
      }
    }
  };
  function icon(n, cx, cy) {                                         // tiny flat glyphs, paper on ink
    g.fillStyle = C.paper; g.strokeStyle = C.paper; g.lineWidth = 5; g.lineCap = 'butt';
    if (n === 0) { g.beginPath(); g.moveTo(cx, cy - 30); g.bezierCurveTo(cx + 20, cy - 4, cx + 24, cy + 6, cx + 24, cy + 14); g.arc(cx, cy + 14, 24, 0, Math.PI); g.bezierCurveTo(cx - 24, cy + 6, cx - 20, cy - 4, cx, cy - 30); g.fill(); }
    if (n === 1) { g.beginPath(); g.arc(cx, cy - 24, 9, 0, Math.PI * 2); g.fill(); g.fillRect(cx - 4, cy - 12, 8, 26); g.fillRect(cx - 22, cy - 8, 44, 7); g.fillRect(cx - 14, cy + 12, 8, 22); g.fillRect(cx + 6, cy + 12, 8, 22); }
    if (n === 2) { g.fillRect(cx - 30, cy - 22, 60, 44); g.fillStyle = C.ink; for (let i = 0; i < 4; i++) { g.fillRect(cx - 26 + i * 15, cy - 19, 7, 6); g.fillRect(cx - 26 + i * 15, cy + 13, 7, 6); } g.fillRect(cx - 22, cy - 9, 44, 18); }
    if (n === 3) { const H = ['.##.##.', '#######', '.#####.', '..###..', '...#...']; H.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '#') g.fillRect(cx - 28 + i * 8, cy - 20 + j * 8, 8, 8); })); }
    if (n === 4) { g.strokeRect(cx - 30, cy - 24, 60, 40); g.fillRect(cx - 18, cy - 10, 30, 4); g.fillRect(cx - 18, cy - 1, 20, 4); g.fillRect(cx - 34, cy + 20, 68, 5); }
  }
  const ruleNum = (d, t, t0) => { font(900, 520); reveal(d, R + 6, 760, 520, steps(t, t0 - BEAT, t0, 4), 0, C.ink, .03); return tw(d); };
  P.D = t => {                                                       // how it works · rule ۱: copy the link, paste it into Claude Code
    gridLines(t, T.pan3 - .25);
    font(900, 112); const how = ['چطور', 'کار', 'می‌کنه؟']; let x = R;
    how.forEach((w, i) => { reveal(w, x, 330, 112, snap(t, q8(T.how + i * .42), E8)); x -= tw(w + ' '); });
    hline(R, M, 376, lin(t, T.how + .4, T.how + .9));
    const nx = R - ruleNum('۱', t, T.link) - 40; font(900, 120);
    reveal('کپی', nx, 600, 120, snap(t, T.copy, E8)); reveal('پیست', nx, 740, 120, snap(t, T.paste, E8));
    const lb = { x: R - 620, y: 880, w: 620, h: 72 }, f = lin(t, T.link, T.link + .5);
    const tb = { x: M, y: 1040, w: R - M, h: 270 }, tp = snap(t, T.term, E8);
    if (tp > 0) { g.fillStyle = C.ink; g.fillRect(tb.x, tb.y, tb.w, tb.h * tp);
      if (tp >= 1) { g.fillStyle = C.g3; g.fillRect(tb.x, tb.y + 64, tb.w, 1); font(500, 30); g.fillStyle = C.paper; g.fillText('کلاد کد', tb.x + tb.w - 28, tb.y + 44);
        for (let i = 0; i < 3; i++) { g.fillStyle = C.g3; g.fillRect(tb.x + 26 + i * 26, tb.y + 26, 12, 12); } } }
    // copy → a grey duplicate snaps out; paste → it snaps into the terminal
    const cpy = snap(t, T.copy, E8), pst = snap(t, T.paste, E8);
    if (cpy > 0) {
      const A0 = [lb.x, lb.y, lb.w, lb.h], A1 = [lb.x - 40, lb.y + 96, lb.w, lb.h], B1 = [M + 200, 1222, 560, 44];
      const r = A0.map((v, i) => lerp(lerp(v, A1[i], cpy), B1[i], pst));
      g.fillStyle = pst >= 1 ? C.paper : C.g2; g.fillRect(...r);
    }
    // the link: an ink bar with a chain glyph and a label
    wipeRect(lb.x, lb.y, lb.w, lb.h, f, C.ink);
    if (f >= 1) { font(500, 32); g.fillStyle = C.paper; g.fillText('لینک ریپو', lb.x + lb.w - 90, lb.y + 47); g.strokeStyle = C.paper; g.lineWidth = 5; g.strokeRect(lb.x + lb.w - 66, lb.y + 24, 26, 22); g.strokeRect(lb.x + lb.w - 52, lb.y + 28, 26, 22); }
  };
  P.E = t => {                                                       // rule ۲: pick a style, tell the story
    gridLines(t, T.pan4 - .25);
    const nx = R - ruleNum('۲', t, T.style) - 40; font(900, 120);
    reveal('سبک', nx, 600, 120, snap(t, T.style + E8, E8)); reveal('داستان', nx, 740, 120, snap(t, T.story, E8));
    const gx = R - 6 * 64 + 8, gy = 900;                             // the 39-grid, small (a callback)
    for (let n = 0; n < 39; n++) { const x = R - (n % 6) * 64 - 56, y = gy + Math.floor(n / 6) * 64, a = T.pan4 + n * .012;
      if (t > a) { g.strokeStyle = C.g2; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, 55, 55); } }
    const pk = 9, px = R - (pk % 6) * 64 - 56, py = gy + Math.floor(pk / 6) * 64;
    wipeRect(px, py, 56, 56, snap(t, T.pick, E16), C.ink);
    const sx = gx - 48;                                              // the story: lines of type, set right → left
    for (let i = 0; i < 6; i++) { const a = T.story + i * .14, L = [430, 400, 440, 380, 420, 250][i];
      hline(sx, sx - L, gy + 8 + i * 64, lin(t, a, a + .3), i % 2 ? C.g2 : C.ink, 18); }
  };
  P.F = t => {                                                       // rule ۳: the agent works by itself
    gridLines(t, T.pan5 - .25);
    const nx = R - ruleNum('۳', t, T.self) - 40; font(900, 120); reveal('خودش', nx, 600, 120, snap(t, T.self + E8, E8));
    const labs = ['کد', 'رندر', 'موزیک'];
    labs.forEach((s, i) => {
      const y = 900 + i * 150, [a, b] = T.tracks[i];
      font(700, 60); reveal(s, R, y + 24, 60, snap(t, T.self + .5 + i * E8, E8));
      const x1 = R - 210, x0 = M + 60;
      hline(x1, x0, y, lin(t, T.self + .5 + i * E8, T.self + 1.0 + i * E8), C.g2);
      const p = clamp(dotTrack(t, a, b));
      if (p > 0) { g.fillStyle = C.ink; g.fillRect(x1 - (x1 - x0) * p, y - 14, (x1 - x0) * p, 28); }
      const ok = snap(t, b + E8, E16);                               // the tick stamps in when the dot arrives
      if (ok > 0) { g.save(); g.translate(M + 20, y); g.scale(ok, ok); g.fillStyle = C.ink; g.beginPath(); g.moveTo(-26, -2); g.lineTo(-8, 16); g.lineTo(26, -22); g.lineTo(26, -10); g.lineTo(-8, 26); g.lineTo(-26, 8); g.fill(); g.restore(); }
    });
  };
  // the dot pauses for one eighth mid-flight on each track (a glance back): linear, unsnapped
  function dotTrack(t, a, b) { const m = (a + b) / 2; if (t < a) return 0; if (t < m - E16) return lin(t, a, m - E16) * .5; if (t < m + E16) return .5; return .5 + lin(t, m + E16, b) * .5; }
  P.G = t => {                                                       // end card: comment «ریپو» · Claude Code
    hline(R, M, 560, lin(t, T.box - .25, T.box + .25));
    font(300, 30); reveal('کامنت', R, 540, 30, snap(t, T.box, E16), 0, C.g3);
    const fb = { x: M, y: 600, w: R - M, h: 200 };
    const f = snap(t, T.box + E8, E8); wipeRect(fb.x, fb.y, fb.w, fb.h, f, C.paper);
    if (f >= 1) {
      g.fillStyle = C.g1; g.beginPath(); g.arc(R - 84, fb.y + 100, 50, 0, Math.PI * 2); g.fill();
      const sent = snap(t, T.send, E16);                              // send key: ink square with a paper arrow (points left: RTL)
      g.fillStyle = sent > 0 ? C.ink : C.g2; g.fillRect(M + 36, fb.y + 68, 64, 64);
      g.fillStyle = C.paper; g.beginPath(); g.moveTo(M + 52, fb.y + 100); g.lineTo(M + 84, fb.y + 80); g.lineTo(M + 84, fb.y + 120); g.fill();
      const word = 'ریپو', n = Math.min(4, Math.floor(seg(t, T.repo[0] - .05, T.repo[1]) * 4 + (t >= T.repo[0] - .05 ? 1 : 0)));
      font(900, 120); g.fillStyle = C.ink; const typed = word.slice(0, n), xr = R - 170; if (n > 0) g.fillText(typed, xr, fb.y + 142);
      if (Math.floor(t * 2.5) % 2 === 0) g.fillRect(xr - (n ? tw(typed) : 0) - 18, fb.y + 46, 6, 112);   // the field's cursor
    }
    const lp = snap(t, T.logo, E8);                                   // the dot becomes the logo (a wipe, never a fade)
    if (lp > 0) { g.save(); g.beginPath(); g.rect(R - 170 + 170 * (1 - lp), 900, 170 * lp, 170); g.clip(); g.translate(R - 170, 900); g.scale(170 / 24, 170 / 24); g.fillStyle = C.sig; g.fill(logo); g.restore(); }
    font(900, 120); reveal('کلاد کد', R - 210, 1035, 120, snap(t, T.logo + E8, E8));
  };
  const PAGE_T = { A: [0, 6.25], B: [6.25, 11.0], C: [11.0, 17.25], D: [17.25, 23.5], E: [23.5, 26.75], F: [26.75, 32.0], G: [35.0, 40.0] };

  // ═════════ the wall: every page wipes away and rebuilds itself in sequence (pages A–F)
  const ORDER = ['A', 'B', 'C', 'D', 'E', 'F'];
  const rb = id => { const i = ORDER.indexOf(id); return [T.rebuild + .25 + i * .25, T.rebuild + .25 + i * .25 + .5]; };
  function pageClock(id, t) {
    if (id === 'G' || t < T.rebuild) return t;
    const [a, b] = rb(id), [ps, pe] = PAGE_T[id];
    if (t < a) return -1;                                             // wiped: blank paper
    if (t < b) return lerp(ps, pe, lin(t, a, b));
    return Math.max(t, pe);
  }

  // ═════════ the dot (the exception): world position and ink height, linear between keys
  const DK = [];
  const dk = (t, id, x, y, h) => { const [ox, oy] = org(id); DK.push([t, ox + x, oy + y, h]); };
  dk(0, 'A', R - 250, 860, 0); dk(T.zero - .25, 'A', R - 250, 860, 0);
  dk(6.0, 'A', R - 250, 860, 470);                                   // the giant zero (climbs in, below)
  dk(6.45, 'B', M + 20, TOP, 26); dk(T.pan2 - .5, 'B', M + 20, TOP, 26);
  dk(T.pan2 + .4, 'C', M + 20, TOP - 48, 26); dk(T.pan3 - .5, 'C', M + 20, TOP - 48, 26);
  dk(T.pan3 + .4, 'D', M + 20, 140, 26); dk(T.paste, 'D', M + 20, 140, 26);
  dk(T.paste + .45, 'D', M + 170, 1244, 36); dk(T.pan4 - .5, 'D', M + 170, 1244, 36);
  dk(T.pan4 + .4, 'E', M + 20, 140, 26); dk(T.pan5 - .5, 'E', M + 20, 140, 26);
  dk(T.pan5 + .4, 'F', M + 20, 140, 26);
  T.tracks.forEach(([a, b], i) => { dk(a - .35, 'F', R - 210, 900 + i * 150, 34); });
  dk(31.9, 'F', M + 60, 1200, 34); dk(T.wall1, 'F', M + 60, 1200, 34);
  ORDER.forEach(id => { const [a] = rb(id); dk(a, id, R - 40, 120, 70); });
  dk(T.push0, 'G', SW / 2, 300, 60); dk(T.push1, 'G', R - 85, 985, 60); dk(T.logo, 'G', R - 85, 985, 150);
  function dotAt(t) {
    if (t >= T.logo + E8) return null;
    if (t < DK[0][0]) return null;
    let i = 0; while (i < DK.length - 1 && t > DK[i + 1][0]) i++;
    const a = DK[i], b = DK[Math.min(i + 1, DK.length - 1)];
    // on tracks the dot follows the track progress (with its mid-flight pause), elsewhere it moves linearly
    for (let k = 0; k < 3; k++) { const [ta, tb] = T.tracks[k]; if (t >= ta && t <= tb + .01) { const [ox, oy] = org('F'), x1 = R - 210, x0 = M + 60; return [ox + lerp(x1, x0, dotTrack(t, ta, tb)), oy + 900 + k * 150, 34]; } }
    const u = b[0] > a[0] ? clamp((t - a[0]) / (b[0] - a[0])) : 1;
    let h = lerp(a[3], b[3], u);
    if (t >= T.zero - .5 && t < 6.0) h = 470 * steps(t, T.zero - .5, T.zero, 4);   // the numeral climbs in four eased steps
    return [lerp(a[1], b[1], u), lerp(a[2], b[2], u), h];
  }

  // ═════════ camera: centre + zoom, snapping on beats with the precise ease
  const WALL = [1.5 * PW - 40, 1.5 * PH - 40 + 200, .305];
  const CK = [[0, ...ctr('A'), 1], [T.pan1, ...ctr('B'), 1, BEAT], [T.pan2, ...ctr('C'), 1, BEAT], [T.pan3, ...ctr('D'), 1, BEAT],
    [T.pan4, ...ctr('E'), 1, BEAT], [T.pan5, ...ctr('F'), 1, BEAT], [T.wall1, ...WALL, BEAT], [T.push1, ...ctr('G'), 1, BEAT]];
  function cam(t) {
    let v = CK[0].slice(1, 4);
    for (let i = 1; i < CK.length; i++) { const [t1, x, y, z, d] = CK[i]; if (t < t1 - d) break; const p = snap(t, t1, d);
      v = [lerp(v[0], x, p), lerp(v[1], y, p), Math.exp(lerp(Math.log(v[2]), Math.log(z), p))]; if (p < 1) break; }
    return v;
  }
  const view = c => [c[0] - SW / 2 / c[2], c[1] - SH / 2 / c[2], c[0] + SW / 2 / c[2], c[1] + SH / 2 / c[2]];

  // ═════════ captions: part of the layout (flush right, 1 px rule above), word-by-word clip-reveal
  for (const c of cues) { const W = c.text.split(' '), L = W.join('').length; let acc = 0;
    c.wt = W.map(w => { const at = c.s0 + (c.s1 - c.s0) * acc / L; acc += w.length; return at; }); c.words = W;
    if (c.t1 - c.t0 < 1.79) throw new Error('caption too short: ' + c.text); }
  function captions(t) {
    const c = cues.find(c => t >= c.t0 && t < c.t1); if (!c) return;
    const q = snap(t, c.t1, E16), lineP = lin(t, c.t0, c.t0 + .25);
    hline(R, M, 1418, lineP, C.ink, 1);
    font(700, 46); const idx = c.words.map((_, i) => i); let rows = [idx];
    if (tw(c.text) > R - M) {                                        // two balanced lines
      let best = 1, bd = 1e9; for (let i = 1; i < idx.length; i++) { const d = Math.abs(tw(c.words.slice(0, i).join(' ')) - tw(c.words.slice(i).join(' '))); if (d < bd) { bd = d; best = i; } }
      rows = [idx.slice(0, best), idx.slice(best)];
    }
    rows.forEach((r, j) => { let x = R; for (const i of r) { reveal(c.words[i], x, 1488 + j * 64, 46, snap(t, c.wt[i] + E16, E16), q); x -= tw(c.words[i] + ' '); } });
  }

  // ═════════ frame
  function render(ctx, t) {
    g = ctx; g.setTransform(1, 0, 0, 1, 0, 0);
    const c = cam(t), V = view(c);
    g.fillStyle = C.wall; g.fillRect(0, 0, SW, SH);
    g.setTransform(c[2], 0, 0, c[2], SW / 2 - c[0] * c[2], SH / 2 - c[1] * c[2]);
    for (const id of Object.keys(PAGES)) {
      const [ox, oy] = org(id); if (ox > V[2] || ox + SW < V[0] || oy > V[3] || oy + SH < V[1]) continue;   // only pages on screen
      const pt = pageClock(id, t);
      g.save(); g.translate(ox, oy);
      if (t >= T.rebuild && id !== 'G') { const [a] = rb(id), wp = snap(t, T.rebuild + .25, E8);   // the wipe that clears every page
        g.fillStyle = C.page; g.fillRect(0, 0, SW, SH); if (pt >= 0) P[id](pt); else if (wp < 1) { P[id](PAGE_T[id][1]); g.fillStyle = C.page; g.fillRect(SW * (1 - wp), 0, SW * wp, SH); } }
      else if (id === 'G' && t < T.push0) { g.fillStyle = C.page; g.fillRect(0, 0, SW, SH); }
      else { g.fillStyle = C.page; g.fillRect(0, 0, SW, SH); P[id](id === 'G' ? t : Math.min(pt, t)); }
      g.restore();
    }
    const d = dotAt(t); if (d && d[2] > 0) zeroGlyph(d[0], d[1], d[2]);
    g.setTransform(1, 0, 0, 1, 0, 0);
    captions(t);
  }

  // ═════════ sound events (picture and sound share these numbers)
  cue(q8(ws('film')) - E8, 'clack'); cue(q8(ws('film') + .42) - E8, 'clack'); cue(ws('film') + .3, 'tss', { dur: .5 });
  T.words.forEach(w => { cue(w.tin - E8, 'clack', { pan: .3 }); cue(w.tcut, 'snick', { pan: .3 }); });
  cue(T.grid0, 'tss', { dur: .9 }); cue(T.zero - .5, 'thunk4', { dur: .5 }); cue(T.zero, 'zero');
  [T.pan1, T.pan2, T.pan3, T.pan4, T.pan5].forEach(p => cue(p - BEAT, 'slide', { dur: BEAT }));
  cue(T.rule, 'tss', { dur: .5 }); cue(T.tag, 'snap'); T.name.forEach(x => cue(x - E8, 'clack')); cue(T.n39 - BEAT, 'thunk4', { dur: BEAT }); cue(T.sabk, 'clack', { v: .5 });
  T.named.forEach((x, i) => cue(x - E16, 'block', { i }));
  for (let n = 5; n < 39; n++) cue(ripple(n) - E16, 'tick', { n });
  cue(T.how - E8, 'clack'); cue(T.link - BEAT, 'thunk4', { dur: BEAT }); cue(T.link, 'slap'); cue(T.copy - E8, 'snap'); cue(T.term - E8, 'slap'); cue(T.paste - E8, 'snap');
  cue(T.paste, 'glide', { dur: .45 });
  cue(T.style - BEAT, 'thunk4', { dur: BEAT }); cue(T.pick - E16, 'block', { i: 2 }); cue(T.story, 'type', { dur: 1.0 });
  cue(T.self - BEAT, 'thunk4', { dur: BEAT }); T.tracks.forEach(([a, b], i) => { cue(a, 'glide', { dur: b - a, i, track: 1 }); cue(b + E8 - E16, 'stamp', { i }); });
  cue(32.0, 'stop'); cue(T.wall1 - BEAT, 'pull', { dur: BEAT }); cue(T.rebuild, 'wipe');
  ORDER.forEach((id, i) => { const [a, b] = rb(id); cue(a, 'rebuild', { dur: b - a, i }); });
  cue(T.push1 - BEAT, 'slide', { dur: BEAT }); cue(T.box, 'slap'); cue(T.logo - E8, 'snap', { v: 1.2 });
  [0, 1, 2, 3].forEach(i => cue(T.repo[0] - .05 + i * (T.repo[1] - T.repo[0] + .05) / 4, 'key', { i })); cue(T.send - E16, 'stamp', { i: 3 });
  ev.sort((a, b) => a.t - b.t);

  // texts that must be readable (readcheck): screen boxes of the main statements
  const box = (id, x0, y0, x1, y1, t) => { const c = cam(t), [ox, oy] = org(id), s = c[2], f = (x, y) => [(ox + x - c[0]) * s + SW / 2, (oy + y - c[1]) * s + SH / 2];
    const [a, b] = f(x0, y0), [cc, d] = f(x1, y1); return [a, b, cc, d]; };
  const TX = [
    { id: 'name', text: 'لمو اوپوس‌کار', page: 'B', t0: T.name[1] + E8, t1: T.pan2 - BEAT, b: [R - 900, 400, R, 860] },
    { id: '39', text: '۳۹ سبک فیلم‌سازی', page: 'B', t0: T.sabk + E8, t1: T.pan2 - BEAT, b: [M, 900, R, 1310] },
    { id: 'how', text: 'چطور کار می‌کنه؟', page: 'D', t0: T.how + 1.0, t1: T.pan4 - BEAT, b: [M, 200, R, 360] },
    { id: 'repo', text: 'ریپو', page: 'G', t0: T.repo[1], t1: END, b: [R - 500, 620, R - 160, 780] },
    { id: 'cc', text: 'کلاد کد', page: 'G', t0: T.logo + E8 * 2, t1: END, b: [M, 900, R, 1070] },
  ];
  const texts = t => TX.filter(x => t >= x.t0 && t < x.t1).map(x => { const [x0, y0, x1, y1] = box(x.page, ...x.b, t); return { id: x.id, text: x.text, x0, y0, x1, y1 }; });
  return { dur: END, render, ev, texts, T };
}
