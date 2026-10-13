# Score + foley + mix for the Swiss reel. Everything is synthesized (no samples) and driven by events.json,
# the same numbers the picture uses. Output: out/mix.wav (stereo, 48 kHz), voice on top, music ducked under it.
#   $LIB/.venv/bin/python sound.py
import json, os, sys, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
HERE = os.path.dirname(os.path.abspath(__file__))
SR, END, BEAT = 48000, 40.0, .5
N = int(END * SR)
rng = np.random.default_rng(11)
ev = json.load(open(os.path.join(HERE, 'events.json')))['ev']
timing = json.load(open(os.path.join(HERE, 'timing.json')))
W = timing['words']

def t_(d): return np.arange(int(d * SR)) / SR
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def noise(d): return rng.standard_normal(int(d * SR))
def add(buf, x, at, gain=1.0, pan=0.0):
    s = int(round(at * SR))
    if s >= len(buf) or s + len(x) <= 0: return
    if s < 0: x = x[-s:]; s = 0
    e = min(len(buf), s + len(x)); l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[s:e, 0] += x[:e - s] * gain * l * 1.414; buf[s:e, 1] += x[:e - s] * gain * r * 1.414
hz = lambda m: 440 * 2 ** ((m - 69) / 12)

# ───────── instruments
def marimba(m, d=.9, v=1.0):
    f, tt = hz(m), t_(d)
    x = (np.sin(2 * np.pi * f * tt) * np.exp(-tt / .45) + .35 * np.sin(2 * np.pi * f * 3.93 * tt) * np.exp(-tt / .07)
         + .12 * np.sin(2 * np.pi * f * 9.2 * tt) * np.exp(-tt / .02))
    k = noise(.006) * np.linspace(1, 0, int(.006 * SR)) * .25; x[:len(k)] += bp(k, 1500, 5000)
    return x * v * np.minimum(1, tt / .002)
def vibes(m, d=2.2, v=1.0):
    f, tt = hz(m), t_(d)
    x = (np.sin(2 * np.pi * f * tt) + .25 * np.sin(2 * np.pi * f * 4.0 * tt) * np.exp(-tt / .3)) * np.exp(-tt / 1.1)
    return x * (1 - .25 * (1 + np.sin(2 * np.pi * 5.2 * tt)) / 2) * v * np.minimum(1, tt / .004)
def bass(m, d=.42, v=1.0):
    f, tt = hz(m), t_(d)
    x = np.sin(2 * np.pi * f * tt) + .45 * np.sin(4 * np.pi * f * tt) + .2 * np.sin(6 * np.pi * f * tt)
    return np.tanh(1.4 * x) * np.exp(-tt / .18) * np.minimum(1, tt / .004) * v
def kick(v=1.0):
    tt = t_(.32); f = 46 + 70 * np.exp(-tt / .03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / .13) * v
def hat(v=1.0): return hp(noise(.04), 7500, 4) * np.exp(-t_(.04) / .009) * v
def rim(v=1.0): tt = t_(.05); return (np.sin(2 * np.pi * 1750 * tt) * .6 + hp(noise(.05), 3000)) * np.exp(-tt / .008) * v

# ───────── print foley (dry, close)
def clack(v=1.0):                                  # letterpress: metal transient + resonances + wooden tray
    tt = t_(.12); x = hp(noise(.12), 2000) * np.exp(-tt / .004)
    x += (np.sin(2 * np.pi * 3300 * tt) * .5 + np.sin(2 * np.pi * 5100 * tt) * .3) * np.exp(-tt / .018) + np.sin(2 * np.pi * 180 * tt) * np.exp(-tt / .03) * .6
    return x * v * .5
def snick(v=1.0):                                  # guillotine: a quick band-pass sweep + a metal snick
    d = .16; tt = t_(d); n = noise(d); out = np.zeros_like(n)
    for i in range(0, len(n), 240): f = 1200 + 5000 * i / len(n); out[i:i + 240] = bp(n[max(0, i - 1200):i + 240], f * .7, min(f * 1.4, 20000))[-len(n[i:i + 240]):]
    out *= np.sin(np.pi * tt / d) ** 2; out[-int(.03 * SR):] += np.sin(2 * np.pi * 4200 * t_(.03)) * np.exp(-t_(.03) / .006) * 1.5
    return out * v * .55
def tss(d=.5, v=1.0): tt = t_(d); return bp(noise(d), 4000, 11000) * np.sin(np.pi * tt / d) ** 1.5 * v * .22
def thunk(v=1.0):
    tt = t_(.2); x = (np.sin(2 * np.pi * 95 * tt) + .4 * np.sin(2 * np.pi * 190 * tt)) * np.exp(-tt / .05) * v * .7
    c = clack(.25); x[:len(c)] += c; return x
def slap(v=1.0): tt = t_(.14); return bp(noise(.14), 300, 3500) * np.exp(-tt / .02) * v * .7
def slide(d=.5, v=1.0): tt = t_(d); return bp(noise(d), 600, 2600) * np.sin(np.pi * tt / d) ** 2 * v * .18
def snapb(v=1.0): tt = t_(.08); return (hp(noise(.08), 1500) * np.exp(-tt / .006) + np.sin(2 * np.pi * 240 * tt) * np.exp(-tt / .02) * .5) * v * .6
def tick(v=1.0): tt = t_(.03); return hp(noise(.03), 3000) * np.exp(-tt / .004) * v * .35
def stamp(v=1.0): tt = t_(.18); return (np.sin(2 * np.pi * 70 * tt) * np.exp(-tt / .05) + bp(noise(.18), 200, 1800) * np.exp(-tt / .02)) * v * .8
def key(v=1.0): tt = t_(.09); return (hp(noise(.09), 1800) * np.exp(-tt / .01) + np.sin(2 * np.pi * 900 * tt) * np.exp(-tt / .012) * .4) * v * .6

mus, fol = np.zeros((N, 2)), np.zeros((N, 2))
M = lambda x, at, g=1.0, p=0.0: add(mus, x, at, g, p)
Fo = lambda x, at, g=1.0, p=0.0: add(fol, x, at, g, p)

# ───────── score: 120 BPM, E minor; chords every 2 bars (Em C G D); one instrument added per rule
ROOT = {0: 40, 1: 36, 2: 43, 3: 38}                 # E2 C2 G2 D2
TRI = {0: [64, 67, 71], 1: [60, 64, 67], 2: [62, 67, 71], 3: [62, 66, 69]}
chord = lambda t: int(t // 4) % 4
OST = [0, 2, 1, 2, 3, 2, 1, 2]                      # ostinato over the triad (+ octave for index 3)
def ost_note(t, i):
    tri = TRI[chord(t)]; k = OST[i % 8]; return tri[k] if k < 3 else tri[0] + 12
SEC = dict(hook=(0, 5.5), intro=(6.5, 17.0), how=(17.5, 32.0), end=(35.5, 39.6))
def on(t, a, b): return a <= t < b
for i in range(int(END / (BEAT / 2))):
    t = i * BEAT / 2; beat = i % 2 == 0
    if on(t, .5, 5.5): M(hat(.35 if beat else .2), t)                                           # hook: hats only
    if on(t, 9.0, 17.0) or on(t, 17.5, 26.75) or on(t, 35.5, 39.0): M(marimba(ost_note(t, i), .7, .5), t, 1, -.25 + .5 * ((i % 8) / 7))
    if on(t, 8.0, 17.0) or on(t, 17.5, 26.75):
        if beat: M(kick(.9), t)
        M(hat(.28 if beat else .18), t, 1, .3)
        if i % 8 == 6: M(rim(.4), t, 1, -.2)
    if on(t, 19.5, 26.75) and True: M(bass(ROOT[chord(t)] + (12 if i % 4 == 3 else 0), .4, .55), t)          # rule ۱: + bass
    if on(t, 35.5, 38.5) and beat: M(bass(ROOT[chord(t)], .45, .4), t)
for b in range(int(23.5 / 2), int(26.75 / 2)):                                                     # rule ۲: + vibraphone counter-line
    t = b * 2.0
    if t >= 23.5: tri = TRI[chord(t)]; M(vibes(tri[2] + 12, 1.8, .35), t + .75, 1, .35); M(vibes(tri[1] + 12, 1.6, .28), t + 1.75, 1, -.35)
# the «۰» lands: a low marimba chord after a hard stop; the named styles: ascending marimba notes
M(marimba(40, 1.6, 1.0) + marimba(52, 1.6, .6), 5.75)
for e in ev:
    if e['type'] == 'block' and e['t'] < 17: M(marimba([71, 74, 76, 79, 83][e['i']], .8, .6), e['t'] + .0625, 1, .3)
    if e['type'] == 'tick': M(marimba(88 + (e['n'] % 5) * 2, .25, .12), e['t'] + .0625, 1, -.4 + .8 * (e['n'] % 6) / 5)
# rule ۳: the drums drop; the dot is the only thing that sings (a sine glide following its position)
for e in ev:
    if e['type'] == 'glide':
        d = e['dur']; tt = t_(d); u = tt / d
        if e.get('track'):                                                                        # a glance back mid-flight: pitch holds
            prog = np.where(u < .44, u / .44 * .5, np.where(u < .56, .5, .5 + (u - .56) / .44 * .5))
            f = hz(76 + 2 * e['i']) * 2 ** (prog * 7 / 12)
        else: f = hz(79) * 2 ** (u * 5 / 12)
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, np.minimum(tt / .03, (d - tt) / .05)) * .22
        M(x, e['t'], 1, .15)
    if e['type'] == 'stamp' and e['t'] < 32: M(marimba([64, 67, 71][e['i'] % 3] + 12, 1.0, .55), e['t'] + .0625)
# the wall: thinned to a held vibraphone chord; then the end resolves on E minor with the logo
M(vibes(64, 3.0, .35) + vibes(67, 3.0, .3) + vibes(71, 3.0, .28), 33.0)
tr = timing['words']['repo'][0]
for x in (marimba(40, 2.5, .9), marimba(52, 2.5, .6), vibes(71, 3.5, .35), vibes(76, 3.5, .3)): M(x, tr)
M(vibes(64, 3.0, .3) + vibes(71, 3.0, .25), 36.25)

# ───────── foley from events
for e in ev:
    t, ty, p = e['t'], e['type'], e.get('pan', 0) or 0
    if ty == 'clack': Fo(clack(e.get('v', 1)), t + .25, 1, p)          # the sound lands with the snap (one 8th after its start)
    elif ty == 'snick': Fo(snick(), t, 1, p)
    elif ty == 'tss': Fo(tss(e['dur']), t)
    elif ty == 'thunk4': [Fo(thunk(.6 + .15 * k), t + e['dur'] * (k + 1) / 4 - .02) for k in range(4)]
    elif ty == 'zero': Fo(thunk(1.4), t); Fo(stamp(.8), t)
    elif ty == 'slide': Fo(slide(e['dur']), t)
    elif ty == 'snap': Fo(snapb(e.get('v', 1)), t + .25)
    elif ty == 'slap': Fo(slap(), t)
    elif ty == 'block': Fo(snapb(.9), t + .125)
    elif ty == 'tick': Fo(tick(), t + .125, 1, -.4 + .8 * (e['n'] % 6) / 5)
    elif ty == 'stamp': Fo(stamp(), t + .125)
    elif ty == 'type': [Fo(key(.5), t + k * .14 + rng.random() * .02) for k in range(int(e['dur'] / .14))]
    elif ty == 'pull': Fo(slide(e['dur'], 1.3), t)
    elif ty == 'wipe': Fo(slap(1.2), t + .25)
    elif ty == 'rebuild': Fo(slap(.8), t); [Fo(tick(.8), t + .05 + k * .07, 1, -.5 + k * .2) for k in range(6)]
    elif ty == 'key': Fo(key(1.0), t)

# ───────── voice, room, ducking, mix
v, sr = sf.read(os.path.join(HERE, 'audio', 'voice_edit.wav')); assert sr == SR
v = np.pad(v, (0, max(0, N - len(v))))[:N]
room = lp(rng.standard_normal(N) * .0025, 900)
env = np.sqrt(np.convolve(v ** 2, np.ones(int(.05 * SR)) / int(.05 * SR), 'same'))
env = np.convolve(env, np.ones(int(.25 * SR)) / int(.25 * SR), 'same')
duck = 1 - .68 * np.clip(env / (env.max() * .25), 0, 1)              # ~−10 dB under speech
rms = lambda x: np.sqrt(np.mean(x[np.abs(x) > 1e-6] ** 2)) if np.any(np.abs(x) > 1e-6) else 1e-9
vr = rms(v); mr = rms(mus.mean(1)); fr = rms(fol.mean(1))
mus *= (vr / mr) * 10 ** (-12 / 20)                                  # music 12 dB under the voice before ducking
fol *= (vr / fr) * 10 ** (-13 / 20)                                  # foley ~13 dB under the voice
mix = mus * duck[:, None] + fol + np.stack([v, v], 1) + np.stack([room, room], 1)
fade = np.ones(N); fade[int(39.4 * SR):] = np.linspace(1, 0, N - int(39.4 * SR)) ** 2
mix *= fade[:, None]
mix /= max(1.0, np.abs(mix).max() / .95)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix, SR, subtype='PCM_24')
d = lambda x: 20 * np.log10(rms(x) + 1e-12)
print(f"voice {d(v):.1f} dB · music (ducked) {d((mus * duck[:, None]).mean(1)):.1f} dB · foley {d(fol.mean(1)):.1f} dB · peak {20*np.log10(np.abs(mix).max()):.1f} dBFS")
