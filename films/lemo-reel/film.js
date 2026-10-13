// Lemo-Opuscar reel: Whiteboard Explainer, vertical 1080×1920, 40 s. One continuous board read top to bottom.
// All times in seconds. Voice segments are placed by audio/edit.py (timing.json); visual beats hang off the
// anchors in A below, which come from the narration's word timings.
import * as W from './engine/wb.js';
import { clamp, lerp, TAU, mulberry } from '/core/lib.js';

export const SW = 1080, SH = 1920;
W.setScreen(SW, SH, 820);                         // frame centre sits high: subtitles + Instagram UI below
const { INK } = W;
export const END = 40, BPM = 120, BEAT = .5;
const BREATH = [[6.0, 6.5], [17.0, 17.5], [32.0, 32.5]];

export async function build(timing) {
  await W.loadFont('tech', 'fonts/EMSTech.json');
  const LOGO = new Path2D((await (await fetch('assets/claude-logo.svg')).text()).match(/ d="([^"]+)"/)[1]);   // Claude mark, Simple Icons
  const A = timing.anchors;                       // word anchors in film time (see audio/edit.py)
  const tl = new W.Timeline();
  const K = new W.Pen('black', INK.black, { park: [1180, 1500] });
  const B = new W.Pen('blue', INK.blue, { park: [1200, 1250] });
  const O = new W.Pen('orange', INK.orange, { park: [1220, 1700] });
  const B2 = new W.Pen('blue2', INK.blue, { park: [-140, 1400] });
  const B3 = new W.Pen('blue3', INK.blue, { park: [-160, 900] });
  const PENS = [K, B, O, B2, B3];
  const T = W.text, D = (pen, shapes, a, b, o = {}) => tl.draw(pen, shapes, a, { by: b, ...o });
  const CX = 1100, LX = 640, RX = 1560;            // board centre column, left/right content edges
  const BW = 2200, BH = 8400;

  // ghost marks of old lessons
  const ghosts = [], gR = mulberry(31);
  for (let i = 0; i < 70; i++) {
    const x = gR() * (BW - 300) + 150, y = gR() * (BH - 300) + 150, k = gR();
    const o = { w: 11, alpha: .045 + gR() * .05, color: gR() < .25 ? '#8aa0c8' : '#9aa0a8' };
    if (k < .3) ghosts.push(...T(['sprint 4', 'v0.2', 'todo', 'fix bg', 'x = 12', 'mon', '→ api', 'ok!', 'draft'][i % 9], x, y, { h: 44 + gR() * 36, ...o }));
    else if (k < .55) ghosts.push(W.circle(x, y, 40 + gR() * 100, o));
    else if (k < .8) ghosts.push(...W.arrow(x, y, x + (gR() - .5) * 420, y + (gR() - .5) * 260, o));
    else ghosts.push(W.line(x, y, x + 160 + gR() * 420, y + (gR() - .5) * 70, o));
  }
  const strikes = [];                              // for the sound: strike-throughs get their own scratch
  const word = (pen, str, x, y, h, a, b, o = {}) => D(pen, T(str, x, y, { h, align: 'center', ...o }), a, b);

  // ═════════ R1 · HOOK (0–6): Camera, Editor, Footage written and struck; a big 0 is left
  const R1 = [{ s: 'CAMERA', y: 740 }, { s: 'EDITOR', y: 960 }, { s: 'FOOTAGE', y: 1180 }];
  const wH = 104;
  R1.forEach((r, i) => {
    const [w0, w1, s0, s1] = A.hook[i];            // write window, strike window
    word(K, r.s, CX, r.y, wH, w0, w1);
    const half = T(r.s, CX, r.y, { h: wH, align: 'center' }).width / 2 + 34;
    const st = W.line(CX - half, r.y - wH * .42 + 10, CX + half, r.y - wH * .5 - 6, { w: 15 + i * 2, over: 18, bow: .02 });
    D(K, st, s0, s1); strikes.push(st);
  });
  const [z0, z1] = A.zero;
  const zero = [W.circle(CX, 960, 235, { ry: 345, w: 40, lap: .5, a0: -1.75, dir: -1 })];
  D(O, zero, z0, z1);

  // ═════════ R2 · INTRO (6.5–17): ride the line down to the title; 39 styles arrive as magnets
  const lead = W.curve([[CX, 1340], [CX - 60, 1520], [CX + 40, 1700], [CX, 1810]], { w: 9 });
  D(B, lead, A.zero[1] + .02, A.open[0]);
  const tH = 120, tY = 2330;
  // open-source mark: </> plus a little branch graph
  const [os0, os1] = A.open;
  const osY = 1990;
  D(B, T('</>', CX - 190, osY, { h: 100, align: 'center' }), os0 + .02, lerp(os0, os1, .45));
  const nodes = [[CX + 80, osY - 90], [CX + 80, osY + 10], [CX + 230, osY - 40]];
  D(K, [W.line(nodes[0][0], nodes[0][1], nodes[1][0], nodes[1][1], { w: 8 }), W.curve([[nodes[0][0], nodes[0][1] + 25], [nodes[2][0] - 10, nodes[2][1] - 60], nodes[2]], { w: 8 }),
    ...nodes.map(([x, y]) => W.circle(x, y, 22, { w: 8 }))], lerp(os0, os1, .45), os1);
  D(B, T('open source', CX, osY + 115, { h: 46, align: 'center' }), lerp(os0, os1, .45) + .03, os1 + .1);
  const parts = [['Lemo-', K], ['O', O], ['puscar', K]];
  const ws = parts.map(([s]) => T(s, 0, 0, { h: tH }).width), tot = ws.reduce((a, b) => a + b, 0);
  let tx = CX - tot / 2;
  const [ti0, ti1] = A.title;
  parts.forEach(([s, pen], i) => {
    const a = lerp(ti0, ti1, ws.slice(0, i).reduce((p, q) => p + q, 0) / tot), b = lerp(ti0, ti1, ws.slice(0, i + 1).reduce((p, q) => p + q, 0) / tot);
    D(pen, T(s, tx, tY, { h: tH }), a, b - .02); tx += ws[i];
  });
  // 39
  const [n0, n1] = A.n39;
  D(O, T('39', CX - 150, 3020, { h: 330, align: 'center', w: 30 }), n0, n1);
  D(K, T('styles', CX + 300, 3010, { h: 86, align: 'center' }), n1 + .02, n1 + .55);
  // style magnets: hero five, then the burst
  const mags = [];
  const heroIcons = ['watercolor', 'pictogram', 'silent', 'pixel', 'whiteboard'];
  heroIcons.forEach((ic, i) => mags.push({ icon: ic, x: CX - 440 + i * 220, y: 3330, r: 84, t: A.styles[i], hero: 1 }));
  const burstIcons = ['star', 'brush', 'umbrella', 'cube', 'leaf', 'ghost', 'game', 'wave', 'sun', 'rocket', 'note', 'scissors', 'moon', 'brick'];
  const [b0, b1] = A.burst;
  const slots = [];                                // left and right columns beside the content, then a row below it
  for (let j = 0; j < 5; j++) { const y = 2230 + j * 300; slots.push([CX - 700 - (j % 2) * 140, y], [CX + 700 + ((j + 1) % 2) * 140, y + 150]); }
  slots.push([CX - 330, 3540], [CX - 110, 3580], [CX + 110, 3540], [CX + 330, 3580]);
  burstIcons.forEach((ic, i) => mags.push({ icon: ic, x: slots[i][0], y: slots[i][1], r: 60, t: b0 + (b1 - b0) * (i / (burstIcons.length - 1)) ** .8, hero: 0 }));
  for (const m of mags) tl.cue(m.t, 'magnet', { x: Math.round(m.x), y: Math.round(m.y), hero: m.hero });

  // ═════════ R3 · HOW IT WORKS (17.5–32)
  const [h0, h1] = A.how;
  const hY = 4330;
  D(K, T('How it works', CX, hY, { h: 96, align: 'center' }), h0, h1);
  D(B, W.line(CX - 420, hY + 38, CX + 420, hY + 30, { w: 10, over: 14 }), h1 + .02, h1 + .32);
  D(B, W.dashed([[LX, 4500], [LX, 6260]], { w: 6, dash: 30, gap: 30, alpha: .7 }), h1 + .3, h1 + 1.0, { minGap: .005, maxGap: .01 });
  const num = (n, y, a) => { D(K, W.circle(LX, y, 54, { w: 9, lap: .25 }), a, a + .3); D(K, T(String(n), LX, y + 27, { h: 58, align: 'center' }), a + .3, a + .52); };
  // ① copy a link → paste into the Claude Code terminal
  const S1 = A.step1, y1 = 4680;
  num(1, y1, S1[0]);
  const pill = [W.roundRect(LX + 130, y1 - 60, 800, 120, 58, { w: 8 })];
  const chain = [W.roundRect(LX + 170, y1 - 22, 70, 40, 20, { w: 7, color: INK.blue }), W.roundRect(LX + 215, y1 - 18, 70, 40, 20, { w: 7, color: INK.blue })];
  D(K, pill, S1[0] + .54, S1[0] + .92); D(B, chain, S1[0] + .92, S1[0] + 1.15);
  D(K, T('lemo-opuscar', LX + 320, y1 + 17, { h: 50 }), S1[0] + .95, S1[1]);
  // copy: a blue copy glyph flicks on, then the arrow carries it down into the terminal
  const cp = [W.roundRect(LX + 860, y1 - 34, 44, 52, 8, { w: 6 }), W.roundRect(LX + 874, y1 - 20, 44, 52, 8, { w: 6 })];
  D(B, cp, S1[1] + .02, S1[1] + .35);
  const tm = { x: LX + 130, y: y1 + 150, w: 800, h: 330 };
  D(B, W.arrow(LX + 880, y1 + 70, LX + 700, tm.y + 150, { w: 8, curve: [LX + 880, y1 + 200], head: 28 }), S1[1] + .36, S1[2] + .2);
  D(K, [W.roundRect(tm.x, tm.y, tm.w, tm.h, 26, { w: 9 }), W.line(tm.x + 6, tm.y + 70, tm.x + tm.w - 6, tm.y + 70, { w: 7 })], S1[2] - .5, S1[2] + .2);
  D(K, [0, 1, 2].map(i => W.circle(tm.x + 44 + i * 40, tm.y + 36, 9, { w: 6 })), S1[2] + .2, S1[2] + .45);
  D(K, T('Claude Code', tm.x + tm.w / 2 + 50, tm.y + 52, { h: 34, align: 'center' }), S1[2] + .45, S1[2] + .95);
  D(B, T('>', tm.x + 50, tm.y + 185, { h: 60 }), S1[3] - .25, S1[3]);
  D(B, [W.roundRect(tm.x + 120, tm.y + 130, 520, 76, 36, { w: 7 }), ...T('lemo-opuscar', tm.x + 160, tm.y + 185, { h: 40 })], S1[3], S1[4]);
  D(B, T('↓', tm.x + 700, tm.y + 205, { h: 60 }), S1[4], S1[4] + .25);
  // ② pick a style · tell the story
  const S2 = A.step2, y2 = 5340;
  num(2, y2, S2[0]);
  const thumbs = [0, 1, 2, 3].map(i => ({ x: LX + 140 + i * 205, y: y2 - 95, s: 160 }));
  D(K, thumbs.map(q => W.roundRect(q.x, q.y, q.s, q.s, 18, { w: 7 })), S2[0] + .45, S2[1]);
  const doodle = [
    q => [W.curve([[q.x + 80, q.y + 30], [q.x + 50, q.y + 85], [q.x + 60, q.y + 120], [q.x + 80, q.y + 128], [q.x + 100, q.y + 120], [q.x + 110, q.y + 85], [q.x + 80, q.y + 30]], { w: 6 })],
    q => [W.circle(q.x + 80, q.y + 45, 16, { w: 6 }), W.line(q.x + 80, q.y + 62, q.x + 80, q.y + 105, { w: 6 }), W.line(q.x + 50, q.y + 80, q.x + 110, q.y + 80, { w: 6 }), W.line(q.x + 80, q.y + 105, q.x + 58, q.y + 135, { w: 6 }), W.line(q.x + 80, q.y + 105, q.x + 102, q.y + 135, { w: 6 })],
    q => [W.poly([[q.x + 40, q.y + 115], [q.x + 80, q.y + 40], [q.x + 120, q.y + 115], [q.x + 40, q.y + 115]], { w: 6 }), W.circle(q.x + 110, q.y + 45, 12, { w: 6 })],
    q => [W.curve([[q.x + 30, q.y + 90], [q.x + 55, q.y + 60], [q.x + 80, q.y + 90], [q.x + 105, q.y + 120], [q.x + 130, q.y + 90]], { w: 6 }), W.curve([[q.x + 30, q.y + 120], [q.x + 55, q.y + 95], [q.x + 80, q.y + 120], [q.x + 105, q.y + 140], [q.x + 130, q.y + 120]], { w: 6 })],
  ];
  D(B, thumbs.map((q, i) => doodle[i](q)), S2[1], S2[1] + .7);
  const pk = thumbs[2];
  D(O, W.circle(pk.x + pk.s / 2, pk.y + pk.s / 2, 118, { w: 12, lap: .35 }), S2[2], S2[2] + .45);
  const bb = { x: LX + 160, y: y2 + 130, w: 760, h: 230 };
  const bubble = new W.Stroke([bb.x + 40, bb.y, bb.x + bb.w - 40, bb.y, bb.x + bb.w, bb.y + 40, bb.x + bb.w, bb.y + bb.h - 40, bb.x + bb.w - 40, bb.y + bb.h,
    bb.x + 190, bb.y + bb.h, bb.x + 110, bb.y + bb.h + 70, bb.x + 130, bb.y + bb.h, bb.x + 40, bb.y + bb.h, bb.x, bb.y + bb.h - 40, bb.x, bb.y + 40, bb.x + 40, bb.y, bb.x + 60, bb.y], { w: 9, smooth: 2, wav: 400 });
  D(K, bubble, S2[3], S2[3] + .6);
  const wav = (y, len) => { const p = []; for (let i = 0; i <= 16; i++) p.push([bb.x + 70 + i * len / 16, y + Math.sin(i * 1.3) * 9]); return W.curve(p, { w: 7 }); };
  D(B, [wav(bb.y + 65, 600), wav(bb.y + 115, 560), wav(bb.y + 165, 380)], S2[3] + .65, S2[4]);
  // ③ the agent works by itself: code → render → music, three pens tick at once
  const S3 = A.step3, y3 = 6010;
  num(3, y3, S3[0]);
  const box = [0, 1, 2].map(i => ({ x: LX + 150 + i * 280, y: y3 - 90, w: 200, h: 170 }));
  D(K, box.map(q => W.roundRect(q.x, q.y, q.w, q.h, 22, { w: 8 })), S3[0] + .45, S3[1] - .5);
  D(K, [W.arrow(box[0].x + box[0].w + 12, y3 - 5, box[1].x - 12, y3 - 5, { w: 7, head: 20 }), W.arrow(box[1].x + box[1].w + 12, y3 - 5, box[2].x - 12, y3 - 5, { w: 7, head: 20 })], S3[1] - .5, S3[1]);
  const q0 = box[0], q1 = box[1], q2 = box[2];
  D(B, T('{ }', q0.x + q0.w / 2, y3 + 25, { h: 80, align: 'center' }), S3[1], S3[1] + .4);
  D(B, W.poly([[q1.x + 75, y3 - 45], [q1.x + 140, y3 - 5], [q1.x + 75, y3 + 35], [q1.x + 75, y3 - 45]], { w: 8 }), S3[1] + .35, S3[1] + .65);
  D(B, [W.circle(q2.x + 75, y3 + 25, 20, { w: 8 }), W.line(q2.x + 95, y3 + 25, q2.x + 95, y3 - 50, { w: 8 }), W.curve([[q2.x + 95, y3 - 50], [q2.x + 125, y3 - 35], [q2.x + 135, y3 - 10]], { w: 8 })], S3[1] + .6, S3[1] + .95);
  const ticks = box.map(q => T('✓', q.x + q.w / 2, q.y + q.h + 105, { h: 92, align: 'center', w: 13 }));
  [B, B2, B3].forEach((p, i) => D(p, ticks[i], S3[2 + i], S3[2 + i] + .32));

  // ═════════ R4 · END (32.5–40): the whole board, it redraws itself, then the end card
  const E = A.end;                                 // {pull0, rw0, rw1, ff1, push0, push1, box0, word0, word1, cc0, cc1, cap}
  const eY = 7080;
  const cb = { x: CX - 450, y: eY - 120, w: 900, h: 240 };
  D(K, W.roundRect(cb.x, cb.y, cb.w, cb.h, 120, { w: 10 }), E.box0, E.box0 + .55);
  D(K, [W.circle(cb.x + cb.w - 120, eY, 70, { w: 9, lap: .2 }), W.circle(cb.x + cb.w - 120, eY - 22, 24, { w: 7 }), W.arc(cb.x + cb.w - 120, eY + 50, 42, Math.PI * 1.15, Math.PI * 1.85, { w: 7 })], E.box0 + .5, E.box0 + .85);
  D(B, [W.poly([[cb.x + 150, eY - 50], [cb.x + 80, eY], [cb.x + 150, eY + 50], [cb.x + 128, eY], [cb.x + 150, eY - 50]], { w: 8 })], E.box0 + .85, E.box0 + 1.1);
  // «ریپو» is set in Vazirmatn (no single-line Persian font exists) and revealed right to left by the orange pen
  const fa = { x1: cb.x + cb.w - 230, x0: cb.x + cb.w - 230 - 360, y: eY + 40, size: 150 };
  const faStroke = new W.Stroke([fa.x1, fa.y - 40, fa.x0, fa.y - 40], { w: 4, jitter: 0, alpha: 0 });
  tl.draw(O, faStroke, E.word0, { by: E.word1 });
  const tile = { x: CX - 420, y: eY + 250, w: 140, h: 122 };
  const logo = { x: tile.x + 66, y: tile.y + 60, s: 76, t: E.cc0 };    // the official Claude mark (Simple Icons path), on a magnet
  tl.cue(logo.t, 'magnet', { x: Math.round(logo.x), y: Math.round(logo.y), hero: 1 });
  D(K, T('Claude Code', tile.x + tile.w + 36, tile.y + 98, { h: 74 }), E.cc0 + .1, E.cc1);
  tl.end();

  // ───────── the board redrawing itself: strokes before 32 s rewind, then replay fast, with no pens
  const WARP_END = 32.0;
  const warp = (t, s) => {
    if (s.t0 >= WARP_END || t < E.rw0 || t >= E.ff1) return t;
    if (t < E.rw1) { const u = (t - E.rw0) / (E.rw1 - E.rw0); return lerp(WARP_END, 0, u * u * (3 - 2 * u)); }
    const u = (t - E.rw1) / (E.ff1 - E.rw1); return lerp(0, WARP_END, u < .5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
  };
  const warpT = t => warp(t, { t0: 0 });
  tl.cue(E.rw0, 'rewind', { dur: +(E.rw1 - E.rw0).toFixed(3) }); tl.cue(E.rw1, 'replay', { dur: +(E.ff1 - E.rw1).toFixed(3) });

  // ───────── camera (x, y, zoom): a vertical board ridden top to bottom
  const FB = [CX, 4000, .215];                      // full-board view
  const cam = new W.Camera([
    [0, CX, 960, 1.0], [A.zero[0], CX, 960, 1.14, 0, 's'], [A.zero[1] + .05, CX, 980, 1.12, 0, 's'],
    [os1 - .1, CX, 2060, .80, 0, 'io'],             // ride the blue line down to the open-source mark
    [ti1 - .05, CX, 2240, .74, 0, 's'],             // the title
    [n0 + .3, CX, 2860, .74, 0, 'io'],              // pan down to the 39 and the magnets (title and mark stay fully in)
    [b0 - .15, CX, 2900, .76, 0, 's'],
    [16.9, CX, 2960, .52, 0, 'o'],                  // pull back: the burst
    [17.05, CX, 2965, .51, 0, 's'],
    [17.5, CX + 10, 4630, .86, 0, 'io'],            // whip to How it works
    [S1[0] - .05, CX + 10, 4660, .86, 0, 's'],
    [S1[4] + .2, CX + 10, 4820, .88, 0, 's'],            // track down step 1
    [S2[0] + .35, CX + 10, 5420, .86, 0, 'io'],
    [S2[4] + .1, CX + 10, 5450, .88, 0, 's'],
    [S3[0] + .35, CX + 10, 6000, .86, 0, 'io'],
    [S3[4] + .4, CX + 10, 6040, .95, 0, 's'],           // slow push on the three ticks
    [E.pull0, CX + 10, 6040, .95, 0, 's'],
    [E.rw0, ...FB, 0, 'io'],                        // pull back to the whole board
    [E.push0, ...FB, 0, 's'],
    [E.push1, CX, 7220, .98, 0, 'io'],              // push down into the end card
    [END, CX, 7240, 1.02, 0, 's'],
  ]);

  // ───────── props: style magnets (cream discs with printed icons)
  const magAt = (m, t) => { const u = clamp((t - m.t + .3) / .3); return { vis: t > m.t - .3, lift: 1 - u * u }; };
  const board = new W.Board(tl, { ghosts, W: BW, H: BH, warp });
  board.objs.push({ draw: (ctx, t, c) => { const tw = warpT(t); for (const m of mags) { const s = magAt(m, tw); if (s.vis) drawMagnet(ctx, m, c, s.lift); } } });
  board.objs.push({ draw: (ctx, t, c) => { const s = magAt(logo, t); if (s.vis) drawLogoMagnet(ctx, logo, c, s.lift); } });
  // burned subtitles: Persian, Vazirmatn, right to left; off-white label with an orange marker dash
  const cues = timing.cues || [];
  board.overlays.push({ draw: (ctx, t) => {
    const s = cues.find(s => t >= s.t0 && t < s.t1); if (!s) return;
    const a = Math.min(1, (t - s.t0) / .12, (s.t1 - t) / .12), X = 510, Y = 1500;
    ctx.font = '700 46px Vazirmatn'; ctx.direction = 'rtl';
    let rows = [s.text];
    if (ctx.measureText(s.text).width > 800) {
      const ws = s.text.split(' '); let best = 1, bd = 1e9;
      for (let i = 1; i < ws.length; i++) { const d = Math.abs(ctx.measureText(ws.slice(0, i).join(' ')).width - ctx.measureText(ws.slice(i).join(' ')).width); if (d < bd) { bd = d; best = i; } }
      rows = [ws.slice(0, best).join(' '), ws.slice(best).join(' ')];
    }
    const w = Math.max(...rows.map(r => ctx.measureText(r).width)) + 70, h = 84 + (rows.length - 1) * 66, y0 = Y - h / 2;
    ctx.globalAlpha = a * .92; ctx.fillStyle = '#fdfcf8'; ctx.shadowColor = 'rgba(30,30,40,.18)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
    ctx.beginPath(); ctx.roundRect(X - w / 2, y0, w, h, 18); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.globalAlpha = a;
    ctx.fillStyle = INK.orange; ctx.fillRect(X + w / 2 - 62, y0 + h - 13, 38, 5);
    ctx.fillStyle = INK.black; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    rows.forEach((r, i) => ctx.fillText(r, X, y0 + 44 + i * 66));
  } });
  const noPens = new URLSearchParams(location.search).has('nopens');
  const pose = (p, t) => (t > E.rw0 - .05 && t < E.ff1 + .05) ? null : W.penPose(p, t, cam);
  if (!noPens) board.objs.push({ draw: (ctx, t, c) => { for (const p of PENS) W.drawMarker(ctx, p, pose(p, t), c, t); } });
  // the Persian word: real glyph shaping, revealed by the pen moving right → left
  const faLayer = new OffscreenCanvas(SW, SH);
  board.objs.push({
    draw: (ctx, t, c) => {
      if (t < E.word0) return;
      const u = clamp(faStroke.prog(t));
      // the word is set on its own layer first (source-over), then multiplied onto the board: no seams where glyphs join
      const lg = faLayer.getContext('2d'); lg.setTransform(1, 0, 0, 1, 0, 0); lg.clearRect(0, 0, SW, SH); W.applyCam(lg, c);
      const xr = lerp(fa.x1 + 30, fa.x0 - 30, u);
      lg.beginPath(); lg.rect(xr, fa.y - 220, fa.x1 + 60 - xr, 330); lg.clip();
      lg.direction = 'rtl'; lg.textAlign = 'right'; lg.textBaseline = 'alphabetic';
      lg.font = `800 ${fa.size}px Vazirmatn`; lg.fillStyle = '#da7d5e';
      lg.fillText('ریپو', fa.x1, fa.y);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(faLayer, 0, 0); ctx.restore();
      if (u >= 1 && Math.floor((t - E.word1) * 2.4) % 2 === 0) {   // blinking text cursor after the word (on its left, RTL)
        ctx.save(); W.applyCam(ctx, c); ctx.globalAlpha = .85; ctx.fillStyle = INK.black;
        ctx.fillRect(fa.x0 - 40, fa.y - 128, 10, 150); ctx.restore();
      }
    }
  });


  // ───────── frame render with camera motion blur
  const off = new OffscreenCanvas(SW, SH), oc = off.getContext('2d');
  const q = new URLSearchParams(location.search);
  const posterCam = new W.Camera([[0, CX, 2700, .62]]);
  function render(ctx, t) {
    if (q.has('poster')) { board.render(ctx, t, posterCam); return; }
    const dt = 1 / 24, a = cam.at(t), b = cam.at(Math.max(0, t - dt));
    const sp = Math.hypot((a.x - b.x) * a.z, (a.y - b.y) * a.z) + Math.abs(Math.log(a.z / b.z)) * 900;
    const N = sp > 14 ? Math.min(12, Math.ceil(sp * .5 / 4)) : 1;
    if (N === 1) { board.render(ctx, t, cam); return; }
    for (let i = 0; i < N; i++) {
      board.render(oc, t - dt * .5 * i / (N - 1), cam);
      ctx.globalAlpha = 1 / (i + 1); ctx.drawImage(off, 0, 0);
    }
    ctx.globalAlpha = 1;
  }

  // on-screen texts for readcheck (board words that must be readable)
  const box2 = (x0, y0, x1, y1, t) => { const c = cam.at(t), [ax, ay] = W.toScreen(c, x0, y0), [bx, by] = W.toScreen(c, x1, y1); return [ax, ay, bx, by]; };
  const TX = [
    { id: 'title', text: 'Lemo-Opuscar', t0: ti1, t1: 17.2, b: [CX - tot / 2, tY - tH, CX + tot / 2, tY + 10] },
    { id: '39', text: '39 styles', t0: n1 + .55, t1: 17.2, b: [CX - 260, 2690, CX + 380, 3030] },
    { id: 'how', text: 'How it works', t0: h1, t1: E.rw0, b: [CX - 440, hY - 100, CX + 440, hY + 30] },
    { id: 'cc', text: 'Claude Code', t0: E.cc1, t1: END, b: [tile.x, tile.y, tile.x + 1000, tile.y + 130] },
    { id: 'repo', text: 'ریپو', t0: E.word1, t1: END, b: [fa.x0, fa.y - 150, fa.x1, fa.y + 40] },
  ];
  const texts = t => TX.filter(x => t >= x.t0 && t < x.t1).map(x => { const [x0, y0, x1, y1] = box2(...x.b, t); return { id: x.id, text: x.text, x0, y0, x1, y1 }; });

  const ev = [...tl.ev];
  for (const e of ev) if (e.x != null) { const tt = e.t, c = cam.at(tt), [px, py] = W.toScreen(c, e.x, e.y); e.pan = +clamp((px - SW / 2) / 900, -.7, .7).toFixed(2); e.z = +c.z.toFixed(2); e.on = px > -100 && px < SW + 100 && py > -100 && py < SH + 100 ? 1 : 0; }
  for (const s of strikes) ev.push({ t: +s.t0.toFixed(3), type: 'strike', dur: +(s.t1 - s.t0).toFixed(3), x: 0, pan: 0, z: 1, on: 1 });
  // replayed strokes (the board drawing itself) for the sound: map every early stroke through the inverse warp
  const replay = [];
  for (const s of tl.strokes) if (s.t0 < WARP_END) {
    const v = s.t0 / WARP_END;                       // forward replay is ease-in-out over [rw1, ff1]
    let lo = 0, hi = 1; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2, e = m < .5 ? 2 * m * m : 1 - (-2 * m + 2) ** 2 / 2; if (e < v) lo = m; else hi = m; }
    replay.push({ t: +(E.rw1 + lo * (E.ff1 - E.rw1)).toFixed(3), type: 'replay_stroke', len: Math.round(s.len), pen: s.pen.id });
  }
  ev.push(...replay); ev.sort((a, b) => a.t - b.t);
  return { dur: END, render, ev, texts, cues: { BEAT, BREATH, A } };

  // ───────── the Claude logo magnet: a glossy cream rounded square with the mark printed in its brand orange
  function drawLogoMagnet(ctx, m, c, lift) {
    const [sx, sy] = W.toScreen(c, m.x, m.y), s = m.s * c.z, up = lift * 46 * c.z;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save(); ctx.filter = `blur(${(5 + lift * 16) * c.z}px)`; ctx.fillStyle = `rgba(40,40,52,${.34 - lift * .18})`;
    ctx.beginPath(); ctx.roundRect(sx - s + 6 + up * .7, sy - s + 10 * c.z + up * .9, 2 * s, 2 * s, s * .38); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(sx, sy - up); const k = 1 + lift * .1; ctx.scale(k, k);
    const g = ctx.createLinearGradient(-s, -s, s, s); g.addColorStop(0, '#ffffff'); g.addColorStop(.6, '#f1ede4'); g.addColorStop(1, '#d3ccbf');
    ctx.fillStyle = '#b9b2a4'; ctx.beginPath(); ctx.roundRect(-s, -s + s * .06, 2 * s, 2 * s, s * .38); ctx.fill();
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-s * .97, -s * .97, s * 1.94, s * 1.94, s * .36); ctx.fill();
    ctx.save(); const ls = s * 1.36 / 24; ctx.scale(ls, ls); ctx.translate(-12, -12); ctx.fillStyle = '#D97757'; ctx.fill(LOGO); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-s * .45, -s * .62, s * .32, s * .1, -.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // ───────── magnet drawer: glossy cream disc + printed icon
  function drawMagnet(ctx, m, c, lift) {
    const [sx, sy] = W.toScreen(c, m.x, m.y), s = m.r * c.z, up = lift * 46 * c.z;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save(); ctx.filter = `blur(${(5 + lift * 16) * c.z}px)`; ctx.fillStyle = `rgba(40,40,52,${.34 - lift * .18})`;
    ctx.beginPath(); ctx.ellipse(sx + (6 + up * .7) * 1, sy + 10 * c.z + up * .9, s * (1 + lift * .1), s * (1 + lift * .1), 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(sx, sy - up); const k = 1 + lift * .1; ctx.scale(k, k);
    const g = ctx.createRadialGradient(-s * .35, -s * .4, s * .1, 0, 0, s * 1.05);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.55, '#f1ede4'); g.addColorStop(1, '#cfc8ba');
    ctx.fillStyle = '#b9b2a4'; ctx.beginPath(); ctx.arc(0, s * .06, s, 0, TAU); ctx.fill();      // rim
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * .97, 0, TAU); ctx.fill();
    ctx.save(); ctx.scale(s / 100, s / 100); drawIcon(ctx, m.icon); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-s * .38, -s * .52, s * .3, s * .12, -.55, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // icons in a 200×200 box centred on 0 (printed on the magnet face)
  function drawIcon(g, ic) {
    const K_ = INK.black, B_ = INK.blue;
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 9; g.strokeStyle = K_; g.fillStyle = K_;
    const P = (f) => { g.beginPath(); f(); };
    switch (ic) {
      case 'watercolor': {
        const gr = g.createRadialGradient(-12, 0, 4, 0, 10, 62); gr.addColorStop(0, 'rgba(42,92,179,.25)'); gr.addColorStop(1, 'rgba(42,92,179,.85)');
        P(() => { g.moveTo(0, -58); g.bezierCurveTo(30, -18, 46, 6, 46, 26); g.arc(0, 26, 46, 0, Math.PI); g.bezierCurveTo(-46, 6, -30, -18, 0, -58); });
        g.fillStyle = gr; g.fill(); g.strokeStyle = B_; g.lineWidth = 6; g.stroke();
        g.fillStyle = 'rgba(255,255,255,.7)'; P(() => g.ellipse(-16, 22, 8, 14, -.3, 0, TAU)); g.fill(); break;
      }
      case 'pictogram':
        P(() => g.arc(0, -42, 16, 0, TAU)); g.fill(); g.lineWidth = 15;
        P(() => { g.moveTo(0, -18); g.lineTo(0, 22); g.moveTo(-30, -6); g.lineTo(0, -12); g.lineTo(30, 6); g.moveTo(0, 22); g.lineTo(-22, 58); g.moveTo(0, 22); g.lineTo(26, 54); }); g.stroke(); break;
      case 'silent':
        g.fillRect(-52, -8, 104, 62);
        g.save(); g.translate(-52, -14); g.rotate(-.32); g.fillRect(0, -18, 106, 20);
        g.fillStyle = '#f1ede4'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(10 + i * 26, -18); g.lineTo(22 + i * 26, -18); g.lineTo(14 + i * 26, 2); g.lineTo(2 + i * 26, 2); g.fill(); }
        g.restore(); g.fillStyle = '#f1ede4'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-42 + i * 26, -8); g.lineTo(-30 + i * 26, -8); g.lineTo(-38 + i * 26, 12); g.lineTo(-50 + i * 26, 12); g.fill(); } break;
      case 'pixel': {
        const H = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
        H.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') { g.fillStyle = (i + j) % 3 ? K_ : B_; g.fillRect(-56 + i * 16, -44 + j * 16, 15, 15); } })); break;
      }
      case 'whiteboard':
        g.save(); g.rotate(-.7); g.fillStyle = '#fff'; g.strokeStyle = K_; g.lineWidth = 5;
        P(() => g.roundRect(-58, -14, 92, 28, 5)); g.fill(); g.stroke(); g.fillStyle = B_; g.fillRect(-10, -14, 26, 28); g.fillRect(34, -16, 26, 32);
        P(() => { g.moveTo(-58, -8); g.lineTo(-74, -3); g.lineTo(-74, 3); g.lineTo(-58, 8); }); g.fillStyle = B_; g.fill(); g.restore();
        g.strokeStyle = B_; g.lineWidth = 6; P(() => { g.moveTo(-50, 52); g.bezierCurveTo(-30, 36, -10, 64, 10, 48); }); g.stroke(); break;
      case 'star': P(() => { for (let i = 0; i <= 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 22 : 54; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } }); g.stroke(); break;
      case 'brush': g.lineWidth = 8; P(() => { g.moveTo(40, -50); g.lineTo(-6, 6); }); g.stroke(); P(() => { g.moveTo(-6, 6); g.bezierCurveTo(-30, 10, -34, 40, -54, 52); g.bezierCurveTo(-20, 54, 4, 40, 4, 16); }); g.fill(); break;
      case 'umbrella': P(() => { g.arc(0, 0, 54, Math.PI, 0); g.lineTo(-54, 0); }); g.stroke(); P(() => { g.moveTo(0, 0); g.lineTo(0, 46); g.arc(-12, 46, 12, 0, Math.PI); }); g.stroke(); break;
      case 'cube': P(() => { g.moveTo(0, -52); g.lineTo(46, -26); g.lineTo(46, 28); g.lineTo(0, 54); g.lineTo(-46, 28); g.lineTo(-46, -26); g.closePath(); g.moveTo(-46, -26); g.lineTo(0, 0); g.lineTo(46, -26); g.moveTo(0, 0); g.lineTo(0, 54); }); g.stroke(); break;
      case 'leaf': P(() => { g.moveTo(-46, 46); g.bezierCurveTo(-50, -30, 10, -56, 50, -50); g.bezierCurveTo(54, 10, 10, 50, -46, 46); g.moveTo(-46, 46); g.lineTo(26, -26); }); g.stroke(); break;
      case 'ghost': P(() => { g.moveTo(-40, 50); g.lineTo(-40, -10); g.arc(0, -10, 40, Math.PI, 0); g.lineTo(40, 50); g.lineTo(26, 38); g.lineTo(13, 50); g.lineTo(0, 38); g.lineTo(-13, 50); g.lineTo(-26, 38); g.closePath(); }); g.stroke(); P(() => { g.arc(-14, -12, 6, 0, TAU); g.arc(14, -12, 6, 0, TAU); }); g.fill(); break;
      case 'game': P(() => g.roundRect(-58, -30, 116, 64, 30)); g.stroke(); g.lineWidth = 8; P(() => { g.moveTo(-32, 2); g.lineTo(-12, 2); g.moveTo(-22, -8); g.lineTo(-22, 12); }); g.stroke(); P(() => { g.arc(24, -4, 6, 0, TAU); g.arc(38, 10, 6, 0, TAU); }); g.fill(); break;
      case 'wave': g.strokeStyle = B_; P(() => { g.moveTo(-58, 10); g.bezierCurveTo(-30, -40, 0, 50, 26, -10); g.bezierCurveTo(36, -30, 50, -20, 58, -6); }); g.stroke(); P(() => { g.moveTo(-58, 40); g.bezierCurveTo(-30, 0, 0, 70, 58, 26); }); g.stroke(); break;
      case 'sun': P(() => g.arc(0, 0, 24, 0, TAU)); g.stroke(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; P(() => { g.moveTo(Math.cos(a) * 38, Math.sin(a) * 38); g.lineTo(Math.cos(a) * 56, Math.sin(a) * 56); }); g.stroke(); } break;
      case 'rocket': P(() => { g.moveTo(0, -58); g.bezierCurveTo(26, -30, 24, 10, 16, 30); g.lineTo(-16, 30); g.bezierCurveTo(-24, 10, -26, -30, 0, -58); g.moveTo(-16, 18); g.lineTo(-34, 44); g.lineTo(-14, 34); g.moveTo(16, 18); g.lineTo(34, 44); g.lineTo(14, 34); }); g.stroke(); P(() => g.arc(0, -16, 9, 0, TAU)); g.stroke(); break;
      case 'note': P(() => { g.ellipse(-20, 36, 18, 13, -.4, 0, TAU); }); g.fill(); g.lineWidth = 8; P(() => { g.moveTo(-4, 34); g.lineTo(-4, -50); g.bezierCurveTo(20, -38, 34, -26, 36, -4); }); g.stroke(); break;
      case 'scissors': P(() => { g.arc(-26, 34, 16, 0, TAU); }); g.stroke(); P(() => g.arc(26, 34, 16, 0, TAU)); g.stroke(); P(() => { g.moveTo(-16, 22); g.lineTo(30, -54); g.moveTo(16, 22); g.lineTo(-30, -54); }); g.stroke(); break;
      case 'moon': P(() => { g.arc(0, 0, 50, .9, Math.PI * 2 - .9 + Math.PI * .0, false); g.arc(26, -10, 40, -1.1, 1.6, true); }); g.stroke(); break;
      case 'brick': g.lineWidth = 7; P(() => g.roundRect(-56, -24, 112, 56, 6)); g.stroke(); for (const x of [-30, 0, 30]) { P(() => g.arc(x, -34, 11, Math.PI, 0)); g.stroke(); } break;
    }
  }
}
