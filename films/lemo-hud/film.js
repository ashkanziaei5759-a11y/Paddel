// Lemo-Opuscar reel · Sci-fi Hologram HUD · vertical 1080×1920 · 40 s.
// "LEMO-OPUSCAR" in English (Rajdhani); every other word in Persian (Vazirmatn, right to left, Persian digits).
// Hue: ice-cyan lines and plates. Accent: red, spent only on values at the frame they lock.
// Kept colours: the project's own GitHub imagery and the Claude logo (orange).
import { Holo, prepModel, normalizeModel, drawPad, drawScanPlane, makeCamera } from './engine/holo.js';
import * as U from './engine/hud.js';

export const SW = 1080, SH = 1920, END = 40, FPS = 24;
const T = U.theme(190, 354);                                         // cyan + red
const VIOLET = a => `hsla(258,100%,74%,${a})`;
const clamp = U.clamp, lerp = (a, b, t) => a + (b - a) * t, seg = (t, a, b) => clamp((t - a) / (b - a));
const eo = t => 1 - Math.pow(1 - clamp(t), 3), eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const FA_DIG = '۰۱۲۳۴۵۶۷۸۹', FA_LET = 'ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی';
const fa = n => String(n).replace(/\d/g, d => FA_DIG[d]);
// rolling Persian text: characters lock in reading order (right to left on screen); unlocked ones scramble every frame
function rollFa(str, k, frame, seed = 0) {
  if (k >= 1) return str; const n = str.length; let out = '';
  for (let i = 0; i < n; i++) {
    const ch = str[i], lockAt = .2 + (i / Math.max(1, n)) * .7;
    if (k >= lockAt || ch === ' ' || ch === '‌' || '«»٪،؟'.includes(ch)) { out += ch; continue; }
    if (k <= 0) { out += ' '; continue; }
    const set = FA_DIG.includes(ch) ? FA_DIG : FA_LET; out += set[Math.floor(hash(frame * 13.7 + i * 7.1 + seed) * set.length)];
  }
  return out;
}
const faFont = (ctx, wt, size) => { ctx.font = `${wt} ${size}px Vazirmatn`; ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; };

export async function build(timing) {
  const Fw = timing.words, cues = timing.cues, ws = k => Fw[k][0], we = k => Fw[k][1];
  const load = async u => { const im = new Image(); im.src = u; await im.decode(); return im; };
  const [studioJ, clapJ] = await Promise.all(['models/studio.json', 'models/clapper.json'].map(async u => (await fetch(u)).json()));
  const studio = normalizeModel(prepModel(studioJ), 2.3117), clap = normalizeModel(prepModel(clapJ), 1.5);
  const cover = await load('assets/cover.jpg');
  const FR = ['watercolor', 'pictogram-motion', 'silent-film', 'pixel-rpg', 'whiteboard'];
  const OTHER = ['crayon-book', 'ink-wash', 'impasto', 'one-line', 'urban-sketch', 'shadow-puppet', 'ukiyoe', 'papercut-red', 'paper-lantern', 'risograph',
    'halftone-dossier', 'woodcut', 'engraving', 'silkscreen-poster', 'swiss-motion', 'spy-titles', 'art-deco', 'blueprint', 'stained-glass', 'ascii-crt',
    'dataviz', 'iso-infographic', 'dark-keynote', 'living-screencast', 'hologram-hud', 'rubber-hose', 'cel-anime-80s', 'scifi-toon', 'midcentury-toon',
    'pixel-rpg', 'hd-2d', 'microgame', 'game-show', 'backrooms', 'brick-toy', 'paper-popup', 'tilt-shift', 'lowpoly-island', 'glass-product'].filter(s => !FR.includes(s));
  const IMG = {}; await Promise.all([...FR, ...OTHER].map(async s => { IMG[s] = await load(`assets/frames/${s}.jpg`); }));
  const logo = new Path2D((await (await fetch('assets/claude-logo.svg')).text()).match(/ d="([^"]+)"/)[1]);
  const holo = new Holo(SW, SH);
  const ev = [], cue = (t, type, o = {}) => ev.push({ t: +t.toFixed(3), type, ...o });

  // ═════════ timing
  const S = {
    boot: 0.0, scan: [0.25, 1.9],
    locks: [['camera', 'دوربین', '۰', 'dorbin'], ['editor', 'ادیتور', '۰', 'editor'], ['reel', 'فوتیج', '۰ ثانیه', 'footage']].map(([part, label, value, k]) => ({ part, label, value, t0: ws(k) - .25, tv: we(k) })),
    erase: [5.6, 6.3],
    beam: 6.3, panel: [6.35, 7.0], tag: ws('matnbaz'), title: [ws('lemo'), we('lemo') + .1], n39: [ws('n39'), we('n39')], sabk: ws('sabk'),
    styles: ['abrang', 'icon', 'silent', 'pixel', 'wb'].map(k => ws(k)), more: [ws('more'), 17.0],
    how: [ws('how'), we('how')], link: ws('link'), copy: ws('copy'), term: ws('claude'), paste: ws('paste'), pasted: we('paste'),
    pick: ws('sabk2') + .55, story: ws('story'), s3: ws('claude2') - .3, bars: [[28.0, 29.0], [29.25, 30.25], [30.5, 31.5]],
    silence: [32.0, 32.5], ignite: 32.5, made: we('thisfilm') - .3,
    card: 35.3, repo: [ws('repo') - .1, we('repo')], logo: we('baraye') - .25, down: 39.2,
  };
  const NAMES = ['آبرنگ', 'آیکون‌نگاری', 'سینمای صامت', 'پیکسل‌آرت', 'وایت‌بورد'];

  // ═════════ camera (orbit) per scene, eased between keys
  const CK = [[0, .62, .30, 5.7, 1030], [5.5, .30, .28, 5.4, 1030], [6.3, .30, .28, 5.4, 1030], [7.0, .20, .52, 5.4, 1260], [15.5, .05, .52, 5.4, 1260],
    [17.0, -.4, .45, 5.0, 1240], [17.5, .2, .30, 5.0, 1350], [26.8, .25, .30, 5.0, 1350], [27.3, .35, .22, 5.0, 1210], [32.0, .55, .2, 4.9, 1200],
    [35.0, 1.1, .12, 4.8, 1180], [35.6, .9, .2, 6.6, 1290], [40, .7, .2, 6.8, 1290]];
  function camAt(t) {
    let i = 0; while (i < CK.length - 2 && t > CK[i + 1][0]) i++;
    const a = CK[i], b = CK[i + 1], u = eio(seg(t, a[0], b[0]));
    return { target: [0, .5, 0], yaw: lerp(a[1], b[1], u), pitch: lerp(a[2], b[2], u), dist: lerp(a[3], b[3], u), fov: .9, cx: SW / 2, cy: lerp(a[4], b[4], u) };
  }

  // ═════════ HUD pieces drawn in Persian
  function faPlate(ctx, x, y, w, h, a = 1) { U.plate(ctx, T, x, y, w, h, a); }
  // a Persian spec card (right-aligned): index · label · big value; the value is red from the frame it locks
  function faCard(ctx, xr, y, w, c, st) {
    if (st.reveal <= 0) return;
    const r = eo(st.reveal), big = c.big ?? 96, h = 62 + big * 1.05;
    faPlate(ctx, xr - w - 20, y - 18, (w + 40) * r, h + 26, clamp(st.reveal * 2));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = T.line(.9); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(xr, y); ctx.lineTo(xr - w * r, y); ctx.stroke();
    ctx.fillStyle = T.line(.9); ctx.fillRect(xr - 34 * r, y - 3, 34 * r, 6);
    faFont(ctx, 400, 22); ctx.fillStyle = T.dim(.95 * r); ctx.fillText(c.idx || '', xr, y + 36);
    faFont(ctx, 600, 34); ctx.fillStyle = T.hi(.95 * clamp(r * 2 - .6)); ctx.fillText(rollFa(c.label, clamp(st.reveal * 1.6 - .2), st.frame, 3), xr - 56, y + 40);
    if (st.roll > 0) {
      const locked = st.roll >= 1;
      faFont(ctx, 300, big); ctx.fillStyle = locked ? (st.flash ? T.hi(1) : T.acc(1)) : T.line(.85);
      ctx.fillText(rollFa(c.value, st.roll, st.frame, 11), xr, y + 50 + big * .9);
      ctx.fillStyle = T.dim(.35); ctx.fillRect(xr - w, y + h - 4, w, 2);
      ctx.fillStyle = locked ? T.acc(.9) : T.line(.9); ctx.fillRect(xr - w * clamp(st.roll), y + h - 4, w * clamp(st.roll), 2);
    }
    ctx.restore();
  }
  const frameN = t => Math.floor(t * FPS);
  const lockK = (t, t0) => seg(t, t0, t0 + .2);                     // target box snaps in ~0.2 s
  const flashAt = (t, t1) => t >= t1 && t < t1 + 3 / FPS;           // three white frames on the lock
  // a holographic image panel: the picture keeps its colour, under a cyan interlace, with plate edges and a scan-in wipe
  function holoImage(ctx, im, x, y, w, h, k = 1, src = null, a = 1) {
    if (k <= 0) return;
    const hh = h * clamp(k);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, hh); ctx.clip(); ctx.globalAlpha = .92 * a;
    if (src) ctx.drawImage(im, ...src, x, y, w, h); else ctx.drawImage(im, x, y, w, h);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(2,16,24,${.18 * a})`; ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = T.line(.06 * a);
    for (let yy = y; yy < y + hh; yy += 4) ctx.fillRect(x, yy, w, 1);
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = T.line(.7 * a); ctx.lineWidth = 1.2; ctx.strokeRect(x + .5, y + .5, w - 1, hh - 1);
    U.corners(ctx, x - 6, y - 6, x + w + 6, y + hh + 6, 18);
    if (k < 1) { ctx.fillStyle = T.hi(.9); ctx.fillRect(x - 10, y + hh - 1, w + 20, 2); }
    ctx.restore();
  }
  function chromeFa(ctx, t, tl, tr, a = 1) {
    U.chrome(ctx, SW, SH, T, { alpha: a, px: t * 30 });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    faFont(ctx, 500, 24); ctx.fillStyle = T.line(.8 * a); ctx.fillText(tr, SW - 66, 82);
    ctx.textAlign = 'left'; ctx.fillStyle = T.dim(.8 * a); ctx.fillText(tl, 66, 82);
    faFont(ctx, 400, 20); ctx.fillStyle = T.dim(.6 * a); ctx.fillText(`فریم ${fa(String(frameN(t)).padStart(4, '0'))}`, SW - 66, SH - 62);
    ctx.textAlign = 'left'; ctx.fillText(`زمان ${fa(t.toFixed(2)).replace('.', '٫')}`, 66, SH - 62);
    ctx.restore();
  }
  function subtitleFa(ctx, t) {
    const c = cues.find(c => t >= c.t0 - .08 && t < c.t1); if (!c) return;
    const a = Math.min(1, (t - c.t0 + .08) / .1, (c.t1 - t) / .1);
    faFont(ctx, 500, 40); const maxW = 840;
    let rows = [c.text];
    if (ctx.measureText(c.text).width > maxW) { const w = c.text.split(' '); let best = 1, bd = 1e9;
      for (let i = 1; i < w.length; i++) { const d = Math.abs(ctx.measureText(w.slice(0, i).join(' ')).width - ctx.measureText(w.slice(i).join(' ')).width); if (d < bd) { bd = d; best = i; } }
      rows = [w.slice(0, best).join(' '), w.slice(best).join(' ')]; }
    const tw = Math.max(...rows.map(r => ctx.measureText(r).width)), lh = 54, h = rows.length * lh + 26, yb = 1600, x1 = SW / 2 + tw / 2 + 30, x0 = SW / 2 - tw / 2 - 58;
    ctx.save(); ctx.fillStyle = `rgba(1,8,12,${.66 * a})`; ctx.fillRect(x0, yb - h, x1 - x0 + 20, h);
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = T.line(.55 * a); ctx.lineWidth = 1.2; U.corners(ctx, x0, yb - h, x1 + 20, yb, 14);
    const speaking = t >= c.s0 && t <= c.s1;
    ctx.fillStyle = T.line(.9 * a); for (let i = 0; i < 4; i++) { const hh = 6 + (speaking ? 16 : 2) * Math.abs(Math.sin(t * 9 + i * 1.7)); ctx.fillRect(x0 + 18 + i * 7, yb - h / 2 - hh / 2, 3, hh); }
    ctx.fillStyle = T.hi(.96 * a); faFont(ctx, 500, 40); rows.forEach((r, i) => ctx.fillText(r, x1, yb - h + 13 + (i + 1) * lh - 12));
    ctx.restore();
  }

  // ═════════ scenes
  const coverSrc = (t) => { const cw = 3372 / 11, x = lerp(0, cw * 5, seg(t, 6.3, 17)); return [x, 0, cw * 5, 706]; };   // 5 columns of the gallery, panning; never the title tile
  function render(ctx, t) {
    const c = camAt(t), fr = frameN(t);
    U.background(ctx, SW, SH, T, { px: -c.yaw * 300, py: c.pitch * 200, cy: c.cy });
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = VIOLET(.10);              // second, slower dot layer (violet depth)
    const off = ((-c.yaw * 120) % 96 + 96) % 96; for (let y = 40; y < SH; y += 96) for (let x = -96 + off; x < SW + 96; x += 96) ctx.fillRect(x, y, 2, 2);
    ctx.restore();
    const silent = t >= S.silence[0] && t < S.silence[1];
    const padA = t < S.boot + .6 ? eo(seg(t, S.boot, S.boot + .6)) : (t > S.down ? 1 - .5 * seg(t, S.down, END) : 1);
    drawPad(ctx, c, SW, SH, { hue: T.hue, rot: t * .25, alpha: padA });

    // ── A · the studio that isn't there
    if (t < S.erase[1] + .05) {
      const sy = lerp(-.05, studio.ymax + .1, seg(t, ...S.scan)), dy = lerp(studio.ymax + .05, -.05, seg(t, ...S.erase));
      const flash = {}; S.locks.forEach(L => { if (flashAt(t, L.tv)) flash[L.part] = 1; });
      const info = holo.draw(ctx, studio, c, { hue: T.hue, scan: t < S.erase[0] ? { y: sy } : null, scanDown: t >= S.erase[0] ? { y: dy } : null, angle: { reel: t * 1.2 }, flash });
      if (t > S.scan[0] && t < S.scan[1] + .1) drawScanPlane(ctx, c, SW, SH, sy, { hue: T.hue, rot: t, r: 1.25 });
      if (t >= S.erase[0] && t < S.erase[1]) drawScanPlane(ctx, c, SW, SH, dy, { hue: T.hue, rot: t, r: 1.25 });
      S.locks.forEach((L, i) => {
        const k = lockK(t, L.t0); if (k <= 0) return;
        const bb = info.bbox[L.part]; if (bb && t < S.erase[0]) U.targetBox(ctx, T, bb, k, { flash: flashAt(t, L.t0 + .2), tag: '' });
        const xr = [380, 700, 1020][i], cy = 330 + (i % 2) * 0, yy = 300;
        const an = info.anchor[L.part];
        if (an && t < S.erase[0]) U.leader(ctx, T, [an[0], an[1]], [an[0], yy + 250], [xr - 140, yy + 250], seg(t, L.t0 + .1, L.t0 + .5));
        faCard(ctx, xr, yy, 280, { idx: fa('0' + (i + 1)), label: L.label, value: L.value, big: 104 }, { reveal: seg(t, L.t0 + .25, L.t0 + .6), roll: seg(t, L.t0 + .35, L.tv), flash: flashAt(t, L.tv), frame: fr });
      });
    }
    // the three zeros dock as a rail and stay through the intro
    if (t >= S.erase[1] && t < 17.0) {
      const a = 1; ctx.save();
      S.locks.forEach((L, i) => { const xr = 1010 - i * 330, k = seg(t, S.erase[1] + i * .08, S.erase[1] + .3 + i * .08);
        faPlate(ctx, xr - 300, 140, 300 * eo(k), 66, a); if (k >= 1) { faFont(ctx, 600, 30); ctx.fillStyle = T.line(.9); ctx.fillText(L.label, xr - 18, 184); faFont(ctx, 300, 40); ctx.textAlign = 'left'; ctx.direction = 'rtl'; ctx.fillStyle = T.acc(1); ctx.fillText(L.value, xr - 282, 188); } });
      ctx.restore();
    }

    // ── B · the repo, from its GitHub page
    if (t >= S.beam && t < 17.25) {
      const out = seg(t, 16.75, 17.1);                                 // scan-erased at the section end
      U.beam(ctx, T, makeCamera(c, SW, SH).project, eo(seg(t, S.beam, S.beam + .6)) * (1 - out) * .8, t, { y1: 1.6 });
      const pk = seg(t, ...S.panel) * (1 - out);
      if (t < S.styles[0] - .1 || out > 0) {
        const px = 70, pw = 940, py = 250;
        faPlate(ctx, px - 14, py - 14, pw + 28, 74 + 450 + 170, pk);
        if (pk > 0) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.font = `22px ${U.FONT.mono}`; ctx.fillStyle = T.line(.85 * pk); ctx.textAlign = 'left'; ctx.direction = 'ltr';
          ctx.fillText(U.rollText('github.com/lemomo-ai/lemo-opuscar', seg(t, S.panel[0], S.panel[1] + .3), fr, 2), px + 12, py + 30);
          ctx.strokeStyle = T.line(.3 * pk); ctx.strokeRect(px + .5, py + .5, pw - 1, 46); ctx.restore();
          holoImage(ctx, cover, px, py + 70, pw, 432, seg(t, S.panel[0] + .2, S.panel[1] + .4) * (1 - out), coverSrc(t));
          // the name: rolls in like a value (English)
          const nk = seg(t, ...S.title);
          if (nk > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.font = `300 92px ${U.FONT.ui}`; ctx.letterSpacing = '10px'; ctx.textAlign = 'left'; ctx.direction = 'ltr';
            ctx.fillStyle = nk >= 1 ? (flashAt(t, S.title[1]) ? T.hi(1) : T.hi(.96)) : T.line(.85);
            ctx.fillText(U.rollText('LEMO-OPUSCAR', nk, fr, 5), px + 6, py + 600); ctx.letterSpacing = '0px'; ctx.restore(); }
          const tk = seg(t, S.tag - .1, S.tag + .25);                  // the open-source chip
          if (tk > 0) { faPlate(ctx, px + pw - 250, py + 616, 250 * eo(tk), 58, 1); if (tk >= 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; faFont(ctx, 600, 30); ctx.fillStyle = T.line(.95);
            ctx.fillText('متن‌باز', px + pw - 18, py + 655); ctx.font = `22px ${U.FONT.mono}`; ctx.textAlign = 'left'; ctx.direction = 'ltr'; ctx.fillText('</>', px + pw - 236, py + 653); ctx.restore(); } }
        }
      }
      // 39 styles: the counter locks red; then one card per named style, docking into a strip
      const nk = seg(t, S.n39[0], S.n39[1]);
      if (nk > 0 && t < S.styles[0] - .1) {
        faCard(ctx, 1010, 990, 420, { idx: '', label: 'سبک فیلم‌سازی', value: '۳۹', big: 150 }, { reveal: seg(t, S.n39[0] - .2, S.n39[0] + .2), roll: nk, flash: flashAt(t, S.n39[1]), frame: fr });
      }
      if (t >= S.styles[0] - .1) {
        const cur = S.styles.reduce((a, s, i) => t >= s - .1 ? i : a, 0);
        S.styles.forEach((s, i) => {
          if (i < cur) {                                             // docked thumbnails (right → left)
            const x = 1010 - (i + 1) * 186, k = seg(t, S.styles[i + 1] - .1, S.styles[i + 1] + .2);
            holoImage(ctx, IMG[FR[i]], x, 880, 170, 96, k * (1 - out));
            ctx.save(); faFont(ctx, 500, 20); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = T.line(.8 * (1 - out)); ctx.fillText(NAMES[i], x + 170, 1002); ctx.restore();
          }
        });
        if (t < S.more[0] + .3) {
          const i = cur, s = S.styles[i], k = seg(t, s - .1, s + .2), x = 90, y = 250, w = 900, h = 506;
          holoImage(ctx, IMG[FR[i]], x, y, w, h, k);
          U.targetBox(ctx, T, [x + 20, y + 20, x + w - 20, y + h - 20], lockK(t, s - .1), { flash: flashAt(t, s + .1), pad: 0 });
          faPlate(ctx, x + w - 330, y + h + 22, 330, 70, k);
          if (k >= 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; faFont(ctx, 700, 38); ctx.fillStyle = T.acc(1); ctx.fillText(rollFa(NAMES[i], seg(t, s, s + .3), fr), x + w - 22, y + h + 70);
            faFont(ctx, 400, 22); ctx.fillStyle = T.dim(.9); ctx.fillText(`سبک ${fa('0' + (i + 1))}`, x + w - 22 - 260, y + h + 66); ctx.restore(); }
        }
      }
      // ...and many more: a carousel of the other styles orbits the pad
      if (t >= S.more[0]) {
        const k = eo(seg(t, S.more[0], S.more[0] + .6)) * (1 - out), P = makeCamera(c, SW, SH).project, q = new Float32Array(3), items = [];
        OTHER.forEach((s, i) => { const th = i / OTHER.length * Math.PI * 2 + t * .55, R = 1.45 * k; P(Math.cos(th) * R, 1.15 + .18 * Math.sin(i * 1.7), Math.sin(th) * R, q); items.push([q[2], q[0], q[1], s, i]); });
        items.sort((a, b) => b[0] - a[0]);
        for (const [z, x, y, s, i] of items) { const sc = 1.7 / z, w = 300 * sc, h = 169 * sc, al = clamp(1.6 - z / 3.6) * k;
          ctx.save(); ctx.globalAlpha = al; holoImage(ctx, IMG[s], x - w / 2, y - h / 2, w, h, 1, null, al); ctx.restore(); }
      }
    }

    // ── C · how it works: three steps
    if (t >= 17.25 && t < S.silence[0]) {
      const hk = seg(t, S.how[0] - .1, S.how[0] + .3);
      faPlate(ctx, 70, 200, 940, 110, hk);
      if (hk > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; faFont(ctx, 700, 62); ctx.fillStyle = T.hi(.96); ctx.fillText(rollFa('چطور کار می‌کنه؟', seg(t, S.how[0], S.how[1] - .3), fr, 4), 990, 280); ctx.restore(); }
      const rail = [['۱', 'پیست شد', S.pasted], ['۲', 'انتخاب شد', S.pick + .4], ['۳', 'ساخته شد', S.bars[2][1]]];
      rail.forEach(([n, v, tl], i) => { const k = seg(t, tl + .3, tl + .6); if (k <= 0) return; const xr = 1010 - i * 314;   // finished steps dock in a rail
        faPlate(ctx, xr - 296, 880, 296 * eo(k), 64, 1); if (k >= 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; faFont(ctx, 700, 30); ctx.fillStyle = T.line(.9); ctx.fillText(`${n}`, xr - 16, 922); faFont(ctx, 500, 28); ctx.fillStyle = T.acc(1); ctx.fillText(v + ' ✓', xr - 54, 922); ctx.restore(); } });
      // step ۱: copy the link, paste it into Claude Code
      if (t >= S.link - .3 && t < S.pick - .9) {
        const k1 = seg(t, S.link - .3, S.link + .1);
        faCard(ctx, 1010, 360, 330, { idx: '۰۱', label: 'لینک', value: '', big: 10 }, { reveal: k1, roll: 0, frame: fr });
        const chipY = 440, cx0 = 90, cw = 900;
        const copyK = eo(seg(t, S.copy, S.copy + .25)), pasteK = eio(seg(t, S.paste - .1, S.paste + .35));
        const urlChip = (x, y, a, hot) => { faPlate(ctx, x, y, 720, 56, a); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.font = `24px ${U.FONT.mono}`; ctx.textAlign = 'left'; ctx.direction = 'ltr';
          ctx.fillStyle = hot ? T.hi(a) : T.line(.9 * a); ctx.fillText(U.rollText('github.com/lemomo-ai/lemo-opuscar', seg(t, S.link, S.link + .6), fr, 9), x + 22, y + 37); ctx.restore(); };
        if (k1 > 0) urlChip(cx0 + 180, chipY + 20, eo(k1), false);
        const tk = seg(t, S.term - .25, S.term + .15), ty = 640;      // the terminal plate, with the Claude logo kept in its own colour
        if (tk > 0) { faPlate(ctx, cx0, ty, cw * eo(tk), 330, 1); if (tk >= 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = T.line(.4); ctx.beginPath(); ctx.moveTo(cx0, ty + 64); ctx.lineTo(cx0 + cw, ty + 64); ctx.stroke();
          faFont(ctx, 700, 32); ctx.fillStyle = T.hi(.95); ctx.fillText('کلاد کد', cx0 + cw - 76, ty + 44); ctx.restore();
          ctx.save(); ctx.translate(cx0 + cw - 58, ty + 14); ctx.scale(36 / 24, 36 / 24); ctx.fillStyle = '#D97757'; ctx.fill(logo); ctx.restore();
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.font = `30px ${U.FONT.mono}`; ctx.textAlign = 'left'; ctx.direction = 'ltr'; ctx.fillStyle = T.line(.9); ctx.fillText('>', cx0 + 28, ty + 140);
          if (Math.floor(t * 2.5) % 2 === 0 && pasteK < 1) ctx.fillRect(cx0 + 56, ty + 116, 14, 30); ctx.restore(); } }
        if (copyK > 0) { const x = lerp(cx0 + 180 + 30 * copyK, cx0 + 60, pasteK), y = lerp(chipY + 20 + 70 * copyK, ty + 102, pasteK); urlChip(x, y, 1, pasteK > 0 && pasteK < 1); }
        if (pasteK >= 1) { const rk = seg(t, S.paste + .35, S.pasted + .1);
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; faFont(ctx, 300, 70); ctx.fillStyle = rk >= 1 ? (flashAt(t, S.pasted + .1) ? T.hi(1) : T.acc(1)) : T.line(.85);
          ctx.fillText(rollFa('پیست شد', rk, fr, 6), cx0 + cw - 30, ty + 280); ctx.restore(); }
      }
      // step ۲: pick a style (a loupe on a grid of the real frames), tell your story
      if (t >= S.pick - .9 && t < S.s3) {
        const k2 = seg(t, S.pick - .9, S.pick - .5), all = [...FR, ...OTHER].slice(0, 8);
        faCard(ctx, 1010, 360, 330, { idx: '۰۲', label: 'سبک', value: '', big: 10 }, { reveal: k2, roll: 0, frame: fr });
        all.forEach((s, i) => { const x = 1010 - 220 - (i % 4) * 230, y = 450 + Math.floor(i / 4) * 140; holoImage(ctx, IMG[s], x, y, 210, 118, seg(t, S.pick - .8 + i * .02, S.pick - .5 + i * .02)); });
        const pi = 6, px = 1010 - 220 - (pi % 4) * 230, py = 450 + Math.floor(pi / 4) * 140, lk = lockK(t, S.pick);
        if (lk > 0) { U.targetBox(ctx, T, [px, py, px + 210, py + 118], lk, { flash: flashAt(t, S.pick + .2), pad: 8 });
          if (lk >= 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = T.acc(1); ctx.lineWidth = 3; ctx.strokeRect(px - 4, py - 4, 218, 126); ctx.restore(); } }
        const sk = seg(t, S.story - .1, S.story + .25);                // the story: a voiceprint plate
        if (sk > 0) { faPlate(ctx, 90, 740, 920 * eo(sk), 120, 1); if (sk >= 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; faFont(ctx, 700, 30); ctx.fillStyle = T.hi(.95); ctx.fillText('داستان تو', 990, 790);
          for (let i = 0; i < 60; i++) { const h = 8 + 60 * Math.abs(Math.sin(i * .7 + t * 6)) * (t < we('story') + .2 ? 1 : .2) * (.4 + .6 * hash(i)); ctx.fillStyle = T.line(.85); ctx.fillRect(820 - i * 12, 800 - h * .4 / 2, 5, h * .4); }
          ctx.restore(); } }
      }
      // step ۳: the agent does the work; the clapperboard is scanned in as the bars fill
      if (t >= S.s3) {
        const k3 = seg(t, S.s3, S.s3 + .4);
        faCard(ctx, 1010, 360, 330, { idx: '۰۳', label: 'خودکار', value: '', big: 10 }, { reveal: k3, roll: 0, frame: fr });
        ['کد', 'رندر', 'موزیک'].forEach((s, i) => {
          const [a, b] = S.bars[i], y = 470 + i * 120, p = seg(t, a, b), rk = seg(t, a, b);
          faPlate(ctx, 90, y - 10, 920 * eo(seg(t, S.s3 + .2 + i * .1, S.s3 + .5 + i * .1)), 96, 1);
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; faFont(ctx, 700, 40); ctx.fillStyle = T.hi(.95); ctx.fillText(s, 990, y + 54);
          ctx.fillStyle = T.dim(.35); ctx.fillRect(330, y + 38, 500, 3); ctx.fillStyle = rk >= 1 ? T.acc(1) : T.line(.95); ctx.fillRect(830 - 500 * p, y + 34, 500 * p, 11);
          faFont(ctx, 300, 52); ctx.textAlign = 'left'; ctx.fillStyle = rk >= 1 ? (flashAt(t, b) ? T.hi(1) : T.acc(1)) : T.line(.85);
          ctx.fillText(rk >= 1 ? '✓ ۱۰۰٪' : fa(Math.floor(p * 100)) + '٪', 110, y + 58); ctx.restore();
        });
      }
    }
    // the clapperboard: built during step ۳, ignited once (solid hologram + beam), then it stays for the end card
    if (t >= S.s3 + .4) {
      const prog = seg(t, S.bars[0][0], S.bars[2][1]), ig = seg(t, S.ignite, S.ignite + .8), down = seg(t, S.down, END);
      const cc = { ...c, target: [0, .55, 0] };
      if (ig > 0 && t < S.card + .3) U.beam(ctx, T, makeCamera(cc, SW, SH).project, ig * (1 - seg(t, S.card - .2, S.card + .3)), t, { y1: 1.9 });
      const clapK = t >= S.made && t < S.made + .3 ? Math.sin(seg(t, S.made, S.made + .3) * Math.PI) : (t < S.made ? 1 : 0);   // the clap: the stick closes once
      holo.draw(ctx, clap, cc, { hue: T.hue, scan: { y: lerp(-.05, clap.ymax + .1, prog) }, solid: ig * (1 - down * .7), explode: { stick: t < S.made ? .35 : .35 * clapK },
        wave: ig > 0 && ig < 1 ? { y: ig * clap.ymax, w: .12 } : null, gain: 1 - down * .6 });
      if (prog > 0 && prog < 1) drawScanPlane(ctx, cc, SW, SH, lerp(-.05, clap.ymax + .1, prog), { hue: T.hue, rot: t, r: .9 });
      if (t >= S.ignite + .3 && t < S.card) {                           // "this film was made the same way": the value locks red
        const rk = seg(t, S.ignite + .4, S.made);
        faCard(ctx, 1010, 250, 520, { idx: '', label: 'همین فیلم', value: 'ساخته شد', big: 92 }, { reveal: seg(t, S.ignite + .3, S.ignite + .7), roll: rk, flash: flashAt(t, S.made), frame: fr });
      }
    }
    // ── E · the end card: comment «ریپو», the Claude logo
    if (t >= S.card) {
      const k = eo(seg(t, S.card, S.card + .4)), fy = 300, a = 1 - .4 * seg(t, S.down, END);
      faPlate(ctx, 90, fy, 900 * k, 150, a);
      if (k >= 1) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; faFont(ctx, 400, 24); ctx.fillStyle = T.dim(.9 * a); ctx.fillText('کامنت', 970, fy - 14);
        ctx.strokeStyle = T.line(.8 * a); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(920, fy + 75, 40, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(920, fy + 64, 13, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(920, fy + 98, 22, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        const rk = seg(t, ...S.repo); faFont(ctx, 700, 92); ctx.fillStyle = rk >= 1 ? (flashAt(t, S.repo[1]) ? T.hi(1) : T.acc(a)) : T.line(.9 * a);
        if (rk > 0) ctx.fillText(rollFa('ریپو', rk, fr, 8), 850, fy + 108);
        ctx.fillStyle = T.line(.9 * a); ctx.beginPath(); ctx.moveTo(120, fy + 75); ctx.lineTo(160, fy + 52); ctx.lineTo(160, fy + 98); ctx.fill();   // send (points left: RTL)
        if (Math.floor(t * 2.5) % 2 === 0 && rk >= 1) ctx.fillRect(850 - 4 - (faFont(ctx, 700, 92), ctx.measureText('ریپو').width) - 16, fy + 30, 6, 90);
        ctx.restore();
      }
      const lk = seg(t, S.logo, S.logo + .3);                           // the logo scans in (kept orange), then the name
      if (lk > 0) { const lx = 1010 - 120, ly = 560; ctx.save(); ctx.beginPath(); ctx.rect(lx, ly, 120, 120 * lk); ctx.clip(); ctx.translate(lx, ly); ctx.scale(5, 5); ctx.fillStyle = '#D97757'; ctx.fill(logo); ctx.restore();
        if (lk < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = T.hi(.9); ctx.fillRect(lx - 10, ly + 120 * lk, 140, 2); ctx.restore(); }
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; faFont(ctx, 700, 92); ctx.fillStyle = T.hi(.96 * a); ctx.fillText(rollFa('کلاد کد', seg(t, S.logo + .2, S.logo + .7), fr, 12), 1010 - 150, ly + 92); ctx.restore(); }
    }

    // ── foreground HUD
    const status = t < 6 ? ['اسکن // استودیو', 'در حال جستجو'] : t < 17.25 ? ['اسکن // ریپو', 'پیدا شد'] : t < 32 ? ['روند کار', 'در حال ساخت'] : t < 35.3 ? ['خروجی', 'ساخته شد'] : ['ارتباط', 'منتظر کامنت'];
    chromeFa(ctx, t, status[0], status[1], t > S.down ? 1 - .6 * seg(t, S.down, END) : 1);
    U.vignette(ctx, SW, SH, .55);
    if (t >= S.ignite && t < S.ignite + 3 / FPS) U.glitch(ctx, SW, SH, 1, Math.floor(t * FPS));   // the one glitch, on the biggest change
    subtitleFa(ctx, t);
    if (silent) { /* true digital silence is in the sound; the picture holds */ }
  }

  // ═════════ sound events (the same numbers as the picture)
  cue(S.boot, 'boot'); cue(S.scan[0], 'scan', { dur: S.scan[1] - S.scan[0] });
  S.locks.forEach((L, i) => { cue(L.t0, 'lock', { i }); cue(L.t0 + .35, 'roll', { dur: L.tv - L.t0 - .35 }); cue(L.tv, 'locked', { i }); });
  cue(S.erase[0], 'scan', { dur: S.erase[1] - S.erase[0], down: 1 }); cue(S.erase[1], 'dock');
  cue(S.beam, 'beam', { dur: .8 }); cue(S.panel[0], 'scan', { dur: .65 }); cue(S.tag, 'lock', { i: 3 }); cue(S.title[0], 'roll', { dur: S.title[1] - S.title[0] }); cue(S.title[1], 'locked', { i: 3 });
  cue(S.n39[0], 'roll', { dur: S.n39[1] - S.n39[0] }); cue(S.n39[1], 'locked', { i: 4, big: 1 });
  S.styles.forEach((s, i) => { cue(s - .1, 'lock', { i }); cue(s + .3, 'locked', { i: i + 5 }); });
  cue(S.more[0], 'whoosh', { dur: 1.2 }); cue(17.0, 'whip', { dur: .5 });
  cue(S.how[0], 'roll', { dur: S.how[1] - S.how[0] - .3 }); cue(S.link - .3, 'lock', { i: 0 }); cue(S.copy, 'blip'); cue(S.term - .25, 'scan', { dur: .4 }); cue(S.paste - .1, 'servo', { dur: .45 });
  cue(S.paste + .35, 'roll', { dur: S.pasted - S.paste - .25 }); cue(S.pasted + .1, 'locked', { i: 1 }); cue(S.pasted + .3, 'dock');
  cue(S.pick - .9, 'scan', { dur: .4 }); cue(S.pick, 'lock', { i: 2 }); cue(S.pick + .2, 'locked', { i: 2 }); cue(S.pick + .7, 'dock'); cue(S.story - .1, 'blip');
  cue(S.s3, 'lock', { i: 3 }); S.bars.forEach(([a, b], i) => { cue(a, 'fill', { dur: b - a, i }); cue(b, 'locked', { i: 6 + i }); }); cue(S.bars[2][1] + .3, 'dock');
  cue(S.silence[0], 'silence', { dur: .5 }); cue(S.ignite, 'drop'); cue(S.made, 'clap'); cue(S.made, 'locked', { i: 9, big: 1 });
  cue(S.card, 'scan', { dur: .4 }); cue(S.repo[0], 'roll', { dur: S.repo[1] - S.repo[0] }); cue(S.repo[1], 'locked', { i: 10, big: 1 }); cue(S.logo, 'scan', { dur: .3 }); cue(S.down, 'powerdown', { dur: END - S.down });
  ev.sort((a, b) => a.t - b.t);
  return { dur: END, render, ev, S };
}
