// Wireframe models for the reel: the studio that isn't there (camera, editor monitor, film reel) and the clapperboard
// that the agent builds. Metres, y up, x = front.   node models/gen.mjs   → models/studio.json, models/clapper.json
import { Model } from './mkmodel.mjs';
import { writeFileSync } from 'fs';
const D = new URL('.', import.meta.url).pathname;

const S = new Model('STUDIO');
// camera (left): body, lens barrel, viewfinder, two film magazines on top, a tripod head
S.part('camera', { anchor: [-0.62, 0.42, 0.13] });
S.piece('cam-body');
S.box([-0.62, 0.42, 0], [0.42, 0.28, 0.24]);
S.tube([-0.41, 0.42, 0], [-0.25, 0.42, 0], 0.085, { rings: 5, seg: 16, longs: 8 });
S.disc([-0.25, 0.42, 0], [1, 0, 0], 0.085, { rings: [0.085, 0.06, 0.03], seg: 16 });
S.box([-0.8, 0.5, 0.14], [0.08, 0.07, 0.05]);
for (const x of [-0.72, -0.5]) { S.ring([x, 0.68, 0], [0, 0, 1], 0.11, 18, 0.06); S.circle([x, 0.68, 0], [0, 0, 1], 0.03, 10); }
S.tube([-0.62, 0.28, 0], [-0.62, 0.08, 0], 0.03, { rings: 3, seg: 8, longs: 4 });
S.box([-0.62, 0.05, 0], [0.22, 0.04, 0.16]);
// editor (centre): monitor with a timeline, neck, base, keyboard
S.part('editor', { anchor: [0, 0.5, 0.05] });
S.piece('monitor');
S.box([0, 0.5, 0], [0.46, 0.3, 0.03]);
for (let i = 0; i < 4; i++) S.box([-0.12 + i * 0.07, 0.44 - (i % 2) * 0.04, 0.02], [0.06 + (i % 3) * 0.03, 0.025, 0.004]);
S.box([0.05, 0.56, 0.02], [0.3, 0.1, 0.004]);
S.tube([0, 0.35, -0.02], [0, 0.12, -0.02], 0.02, { rings: 3, seg: 8, longs: 4 });
S.box([0, 0.1, -0.02], [0.2, 0.02, 0.14]);
S.box([0, 0.06, 0.16], [0.36, 0.02, 0.12]);
// footage (right): a film reel on a spindle, with a strip of film running off it
S.part('reel', { anchor: [0.62, 0.42, 0.05] });
S.piece('reel', { axis: { c: [0.62, 0.42, 0], d: [0, 0, 1] } });
S.ring([0.62, 0.42, 0], [0, 0, 1], 0.26, 32, 0.05);
S.disc([0.62, 0.42, 0], [0, 0, 1], 0.26, { rings: [0.08, 0.04], seg: 16 });
for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; S.circle([0.62 + Math.cos(a) * 0.16, 0.42 + Math.sin(a) * 0.16, 0], [0, 0, 1], 0.045, 10); }
S.piece('strip', { box: false });
S.polyTube([[0.62, 0.16, 0.02], [0.75, 0.1, 0.06], [0.9, 0.06, 0.12]], 0.012, { seg: 6, longs: 2, ringsPer: 2 });
S.tube([0.62, 0.15, 0], [0.62, 0.02, 0], 0.02, { rings: 3, seg: 8, longs: 4 });
writeFileSync(D + 'studio.json', JSON.stringify(S.toJSON()));

const C = new Model('CLAPPER');
C.part('board', { anchor: [0, 0.35, 0.03] });
C.piece('slate'); C.box([0, 0.35, 0], [0.7, 0.45, 0.04]);
for (let i = 0; i < 3; i++) C.box([0, 0.2 + i * 0.1, 0.022], [0.62, 0.004, 0.004]);
C.box([-0.18, 0.47, 0.022], [0.004, 0.18, 0.004]);
C.part('stick', { anchor: [0, 0.66, 0.03] });
C.piece('clap', { explode: [0, 0.12, 0] });
C.box([0, 0.64, 0], [0.7, 0.1, 0.04]);
for (let i = 0; i < 6; i++) { const x = -0.3 + i * 0.12; const a = C.vtx([x, 0.6, 0.022]), b = C.vtx([x + 0.07, 0.68, 0.022]); C.edge(a, b); }
C.piece('hinge'); C.tube([-0.36, 0.56, -0.03], [-0.36, 0.6, -0.03], 0.02, { rings: 2, seg: 8, longs: 4 });
writeFileSync(D + 'clapper.json', JSON.stringify(C.toJSON()));
