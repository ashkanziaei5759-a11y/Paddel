# Score + foley + mix for the HUD reel. All synthesized, driven by events.json (the picture's own numbers).
# Synth palette per the style: saw arpeggio with ping-pong delay (scooped 1–4 kHz), square pulse, 8th bass, hats/claps,
# detuned saw pads; locks = thump + clack + two-tone beep in key; rolls tick at frame rate; a projector hum.
# One beat of true digital silence at 32.0 s, then a drop on the solid hologram. Output: out/mix.wav
import json, os, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
HERE = os.path.dirname(os.path.abspath(__file__))
SR, END, BEAT = 48000, 40.0, .5
N = int(END * SR)
rng = np.random.default_rng(23)
ev = json.load(open(os.path.join(HERE, 'events.json')))['ev']
W = json.load(open(os.path.join(HERE, 'timing.json')))['words']

def t_(d): return np.arange(int(d * SR)) / SR
def sos(kind, f, o=2): return butter(o, f, kind, fs=SR, output='sos')
def bp(x, lo, hi, o=2): return sosfilt(sos('band', [lo, hi], o), x)
def hp(x, f, o=2): return sosfilt(sos('high', f, o), x)
def lp(x, f, o=2): return sosfilt(sos('low', f, o), x)
def noise(d): return rng.standard_normal(int(d * SR))
def add(buf, x, at, gain=1.0, pan=0.0):
    s = int(round(at * SR))
    if s >= len(buf) or s + len(x) <= 0: return
    if s < 0: x = x[-s:]; s = 0
    e = min(len(buf), s + len(x)); l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[s:e, 0] += x[:e - s] * gain * l * 1.414; buf[s:e, 1] += x[:e - s] * gain * r * 1.414
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
def saw(f, tt): ph = (f * tt) % 1; return 2 * ph - 1
def env(tt, a, d): return np.minimum(1, tt / a) * np.exp(-tt / d)

# ───────── instruments
def pluck(m, d=.28, v=1.0, cut=2600):
    tt = t_(d); x = saw(hz(m), tt) + .6 * saw(hz(m) * 1.004, tt); return lp(x, cut) * env(tt, .003, .09) * v
def pulse(m, d=.24, v=1.0): tt = t_(d); x = np.sign(np.sin(2 * np.pi * hz(m) * tt)); return lp(x, 1800) * env(tt, .002, .07) * v
def bass(m, d=.24, v=1.0):
    tt = t_(d); f = hz(m); x = np.sin(2 * np.pi * f * tt) + .5 * saw(f, tt); return np.tanh(1.6 * lp(x, 700)) * env(tt, .003, .12) * v
def pad(ms, d=4.0, v=1.0):
    tt = t_(d); x = sum(saw(hz(m) * k, tt) for m in ms for k in (1, 1.006, .995)); a = np.minimum(1, tt / .6) * np.minimum(1, (d - tt) / .8)
    return lp(x, 1400) * a * v / len(ms) / 3
def kick(v=1.0): tt = t_(.3); f = 45 + 90 * np.exp(-tt / .025); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / .12) * v
def hat(v=1.0): return hp(noise(.04), 8000, 4) * np.exp(-t_(.04) / .008) * v
def clap(v=1.0):
    x = np.zeros(int(.2 * SR))
    for k, o in enumerate((0, .011, .022)): n = bp(noise(.2 - o), 900, 2500) * np.exp(-t_(.2 - o) / (.012 if k < 2 else .06)); x[int(o * SR):] += n
    return x * v * .6
# ───────── foley (light = sines and FM blips in key)
KEY = [50, 53, 57, 60, 62, 64, 65, 69]               # D minor-ish set for the blips
def beep2(i, v=1.0):
    a, b = hz(74 + KEY[i % 8] % 12), hz(81 + KEY[(i + 3) % 8] % 12); tt = t_(.07)
    return np.concatenate([np.sin(2 * np.pi * a * tt), np.sin(2 * np.pi * b * tt)]) * np.concatenate([env(tt, .002, .05)] * 2) * v * .4
def lockfx(i, v=1.0):
    tt = t_(.25); th = np.sin(2 * np.pi * (60 + 40 * np.exp(-tt / .03)) * tt) * np.exp(-tt / .07)
    cl = hp(noise(.25), 2500) * np.exp(-tt / .006) * .5; x = th + cl; b = beep2(i, .9); x[int(.05 * SR):int(.05 * SR) + len(b)] += b
    return x * v * .6
def tickroll(d, v=1.0):
    x = np.zeros(int(d * SR)); tk = hp(noise(.006), 4000) * np.exp(-t_(.006) / .0015)
    for k in range(int(d * 24)): s = int(k / 24 * SR); x[s:s + len(tk)] += tk * (.6 + .4 * rng.random())
    return x * v * .35
def sweep(d, v=1.0, down=False):
    tt = t_(d); f = (1500 + 2500 * tt / d) if not down else (4000 - 2500 * tt / d)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * .12 + bp(noise(d), 2500, 7000) * .25
    return x * np.sin(np.pi * tt / d) ** 2 * v
def whoosh(d, v=1.0): tt = t_(d); return bp(noise(d), 500, 3000) * np.sin(np.pi * tt / d) ** 2 * v * .5
def servo(d, v=1.0): tt = t_(d); f = 220 + 160 * np.sin(np.pi * tt / d); return np.tanh(2 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.sin(np.pi * tt / d) * v * .12
def blip(v=1.0): tt = t_(.06); return np.sin(2 * np.pi * hz(86) * tt + 3 * np.sin(2 * np.pi * hz(86) * 2 * tt)) * env(tt, .002, .03) * v * .35
def fill(d, i, v=1.0): tt = t_(d); f = hz(62 + 5 * i) * 2 ** (tt / d); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, np.minimum(tt / .05, (d - tt) / .05)) * v * .14
def drop(v=1.0):
    tt = t_(2.4); f = 110 * 2 ** (-tt / 1.2); sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 1.3)
    return (np.tanh(1.5 * sub) + pad([50, 57, 62, 65, 69], 2.4, 1.6)[:len(tt)]) * v * .9
def clackwood(v=1.0): tt = t_(.12); return (bp(noise(.12), 800, 4000) * np.exp(-tt / .01) + np.sin(2 * np.pi * 900 * tt) * np.exp(-tt / .02) * .5) * v
def powerdown(d, v=1.0): tt = t_(d); f = 600 * 2 ** (-3 * tt / d); return np.sin(2 * np.pi * np.cumsum(f) / SR) * (1 - tt / d) * v * .12

mus, fol = np.zeros((N, 2)), np.zeros((N, 2))
M = lambda x, at, g=1.0, p=0.0: add(mus, x, at, g, p)
Fo = lambda x, at, g=1.0, p=0.0: add(fol, x, at, g, p)

# ───────── score: 120 BPM, D minor; chords per 2 bars (Dm Bb F C); density follows the information
CH = {0: [50, 53, 57], 1: [46, 50, 53], 2: [53, 57, 60], 3: [48, 52, 55]}
chord = lambda t: CH[int(t // 4) % 4]
on = lambda t, a, b: a <= t < b
for i in range(int(END / (BEAT / 4))):                # 16th grid
    t = i * BEAT / 4; c = chord(t); s16 = i % 4; s8 = i % 2 == 0
    arp = [c[0] + 24, c[1] + 24, c[2] + 24, c[1] + 24][i % 4] + (12 if (i // 4) % 4 == 3 else 0)
    if on(t, 6.25, 17.0) or on(t, 17.5, 26.75) or on(t, 35.3, 39.0):                         # saw arpeggio with ping-pong echoes
        g = .5 if on(t, 6.25, 9.0) else .8
        M(pluck(arp, .22, g), t, 1, -.3); M(pluck(arp, .22, g * .45), t + .375, 1, .5); M(pluck(arp, .22, g * .2), t + .75, 1, -.5)
    if s8 and (on(t, 0.3, 5.6)): M(pulse(c[0] + 24 + (7 if i % 8 == 4 else 0), .18, .35), t, 1, .2)   # hook: a square pulse only
    if s8 and (on(t, 9.0, 17.0) or on(t, 17.5, 32.0)): M(bass(c[0] - 12 + (12 if i % 8 == 6 else 0), .22, .7), t)
    if s16 == 0 and (on(t, 9.0, 17.0) or on(t, 19.5, 26.75)): M(kick(.9), t)               # drums out for step ۳ (half-time reading)
    if s8 and (on(t, 6.25, 17.0) or on(t, 17.5, 26.75)): M(hat(.3 if s16 == 2 else .18), t + .0, 1, .35)
    if i % 16 == 8 and (on(t, 9.0, 17.0) or on(t, 19.5, 26.75)): M(clap(.7), t, 1, -.1)
for t in np.arange(0.0, 32.0, 4.0):                   # detuned saw pads under everything but the silence
    if t < 6 or t >= 6.25: M(pad([c + 12 for c in chord(t)], 4.0, .5 if t < 17 else .35), t)
for t in np.arange(26.75, 32.0, 1.0): M(pad([chord(t)[0] + 24], 1.0, .25), t)                # step ۳: a single sustained tone climbs with the bars
M(pad([62, 65, 69, 74], 4.7, .55), 35.3)

# ───────── foley from events
for e in ev:
    t, ty, i = e['t'], e['type'], e.get('i', 0)
    if ty == 'boot': Fo(sweep(.6, .7), t)
    elif ty == 'scan': Fo(sweep(e['dur'], .8, bool(e.get('down'))), t)
    elif ty == 'lock': Fo(lockfx(i, .7), t)
    elif ty == 'locked': Fo(lockfx(i + 2, 1.2 if e.get('big') else 1.0), t)
    elif ty == 'roll': Fo(tickroll(e['dur']), t)
    elif ty == 'dock': Fo(blip(.8), t); Fo(servo(.25, .6), t)
    elif ty == 'beam': Fo(whoosh(e['dur'], .8), t); Fo(sweep(e['dur'], .4), t)
    elif ty == 'whoosh': Fo(whoosh(e['dur'], .7), t)
    elif ty == 'whip': Fo(whoosh(e['dur'], 1.1), t)
    elif ty == 'blip': Fo(blip(), t)
    elif ty == 'servo': Fo(servo(e['dur']), t)
    elif ty == 'fill': Fo(fill(e['dur'], i), t)
    elif ty == 'drop': M(drop(), t)
    elif ty == 'clap': Fo(clackwood(1.4), t)
    elif ty == 'powerdown': Fo(powerdown(e['dur']), t)

# ───────── voice, hum, held ducking, true silence, mix
v, sr = sf.read(os.path.join(HERE, 'audio', 'voice_edit.wav')); assert sr == SR
v = np.pad(v, (0, max(0, N - len(v))))[:N]
tt = t_(END)[:N]; hum = (np.sin(2 * np.pi * 40 * tt) + .5 * np.sin(2 * np.pi * 80 * tt) + .25 * np.sin(2 * np.pi * 120 * tt)) * .004
rms = lambda x: np.sqrt(np.mean(x[np.abs(x) > 1e-6] ** 2)) if np.any(np.abs(x) > 1e-6) else 1e-9
e_ = np.sqrt(np.convolve(v ** 2, np.ones(int(.05 * SR)) / int(.05 * SR), 'same'))
from scipy.ndimage import maximum_filter1d
held = maximum_filter1d(e_, size=int(.6 * SR))                       # hold the duck through word gaps (no pumping)
held = np.convolve(held, np.ones(int(.2 * SR)) / int(.2 * SR), 'same')
duck = 1 - .7 * np.clip(held / (e_.max() * .25), 0, 1)
vr = rms(v)
mus *= (vr / rms(mus.mean(1))) * 10 ** (-11 / 20); fol *= (vr / rms(fol.mean(1))) * 10 ** (-12 / 20)
fduck = 1 - .45 * np.clip(held / (e_.max() * .25), 0, 1)
mix = mus * duck[:, None] + fol * fduck[:, None] + np.stack([v, v], 1) + np.stack([hum, hum], 1)
s0, s1 = int(32.0 * SR), int(32.5 * SR); mix[s0:s1] = 0                # one beat of true digital silence (no voice speaks here)
assert np.abs(v[s0:s1]).max() < 1e-3, 'voice inside the silence window'
fade = np.ones(N); fade[int(39.3 * SR):] = np.linspace(1, 0, N - int(39.3 * SR)) ** 2; mix *= fade[:, None]
mix /= max(1.0, np.abs(mix).max() / .95)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix, SR, subtype='PCM_24')
d = lambda x: 20 * np.log10(rms(x) + 1e-12)
print(f"voice {d(v):.1f} dB · music (ducked) {d((mus * duck[:, None]).mean(1)):.1f} dB · foley {d((fol * fduck[:, None]).mean(1)):.1f} dB · peak {20*np.log10(np.abs(mix).max()):.1f} dBFS")
