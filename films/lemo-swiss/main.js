const timing = await (await fetch('timing.json')).json();
timing.cues = await (await fetch('out/cues.json')).json();
for (const w of [300, 500, 700, 900]) await document.fonts.load(`${w} 60px Vazirmatn`, 'فیلم ۰۱۲۳۹');
const mod = await import('./film.js');
const F = await mod.build(timing);
const ctx = document.getElementById('c').getContext('2d');
window.DUR = F.dur; window.EV = F.ev; window.TEXTS = F.texts;
window.render = t => F.render(ctx, t);
window.READY = true;
