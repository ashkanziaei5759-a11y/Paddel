const timing = await (await fetch('timing.json')).json();
const mod = await import('./film.js');
await document.fonts.load('800 150px Vazirmatn', 'ریپو');
const F = await mod.build(timing);
const ctx = document.getElementById('c').getContext('2d');
window.DUR = F.dur; window.EV = [...F.ev, { t: 0, type: 'cues', ...F.cues }];
window.TEXTS = F.texts;
window.render = t => F.render(ctx, t);
window.READY = true;
