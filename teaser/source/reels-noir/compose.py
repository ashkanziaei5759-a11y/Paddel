"""Original score for the reel: 120 BPM, F minor, 48 s. Every hit is placed on the edit grid."""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 44100
DUR = 48.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
BEAT = 0.5
BAR = 2.0

def buf():
    return np.zeros((N, 2))

def t_arr(d):
    return np.arange(int(SR * d)) / SR

def lp(x, fc, order=2):
    return sosfilt(butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos'), x, axis=0)

def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x, axis=0)

def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x, axis=0)

def place(dst, sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N:
        return
    if sig.ndim == 1:
        l, r = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
        sig = np.stack([sig * l * 1.414, sig * r * 1.414], 1)
    n = min(len(sig), N - i)
    dst[i:i + n] += sig[:n] * gain

def hz(note):  # MIDI -> Hz
    return 440.0 * 2 ** ((note - 69) / 12)

def reverb(x, secs=2.2, mix=0.3, bright=6000):
    t = t_arr(secs)
    ir = rng.standard_normal((len(t), 2)) * np.exp(-t * 6.9 / secs)[:, None]
    ir = lp(ir, bright)
    ir /= np.sqrt((ir ** 2).sum(0))
    wet = np.stack([fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1)
    return x * (1 - mix) + wet * mix * 2.2

# ---------------------------------------------------------------- instruments
def kick(punch=1.0):
    t = t_arr(0.5)
    f = 45 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 7)
    click = lp(rng.standard_normal(len(t)), 6000) * np.exp(-t * 300) * 0.4
    return np.tanh((body + click) * 1.6 * punch) * 0.9

def clap():
    t = t_arr(0.35)
    n = rng.standard_normal(len(t))
    env = np.zeros_like(t)
    for d in (0, 0.011, 0.022):
        env += np.where(t >= d, np.exp(-(t - d) * 60), 0)
    env += np.exp(-t * 14) * 0.5
    s = bp(n * env, 900, 5200)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.4
    return (s * 0.9 + tone) * 0.8

def hat(open_=False):
    t = t_arr(0.35 if open_ else 0.07)
    s = hp(rng.standard_normal(len(t)), 7500, 4) * np.exp(-t * (9 if open_ else 70))
    return s * (0.35 if open_ else 0.28)

def sub808(note, dur=0.7, glide=0.0):
    t = t_arr(dur)
    f = hz(note) * (1 + glide * np.exp(-t * 20))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.minimum(1, t * 200) * np.exp(-t * 2.2)
    return np.tanh(s * 2.2) * 0.62

def pluck(note, dur=0.45, bright=1.0):
    # Karplus-Strong
    f = hz(note)
    period = int(SR / f)
    n = int(SR * dur)
    b = rng.uniform(-1, 1, period)
    out = np.zeros(n)
    for i in range(n):
        out[i] = b[i % period]
        b[i % period] = 0.5 * (b[i % period] + b[(i + 1) % period]) * 0.996
    t = t_arr(dur)
    saw = (2 * ((t * f) % 1) - 1) * np.exp(-t * 16) * 0.35
    s = out * 0.7 + saw
    return lp(s, 2500 + 5000 * bright) * np.exp(-t * 2.5) * 0.5

def pad(notes, dur, fc=1800, attack=0.6):
    t = t_arr(dur)
    s = np.zeros((len(t), 2))
    for n in notes:
        for det, pan in ((-0.09, -0.7), (0.0, 0.0), (0.08, 0.7)):
            f = hz(n + det)
            w = 2 * ((t * f + rng.random()) % 1) - 1
            s[:, 0] += w * np.sqrt(0.5 * (1 - pan))
            s[:, 1] += w * np.sqrt(0.5 * (1 + pan))
    env = np.minimum(1, t / attack) * np.minimum(1, (dur - t) / 0.4)
    s = lp(s, fc, 2) * env[:, None]
    return s / (len(notes) * 3) * 0.9

def riser(dur, up=True):
    t = t_arr(dur)
    k = t / dur
    n = rng.standard_normal((len(t), 2))
    # time-varying filter: do in chunks
    out = np.zeros_like(n)
    chunk = 1024
    for i in range(0, len(t), chunk):
        kk = k[i] if up else 1 - k[i]
        out[i:i + chunk] = bp(n[i:i + chunk], 300 + 7000 * kk ** 2, 900 + 12000 * kk ** 2)
    sweep = np.sin(2 * np.pi * np.cumsum(200 + 1400 * k ** 2) / SR) * 0.15
    amp = (k ** 2 if up else (1 - k) ** 2)
    return (out * 0.5 + sweep[:, None]) * amp[:, None] * 0.7

def impact(size=1.0):
    t = t_arr(3.0)
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t * 9)) / SR) * np.exp(-t * 1.6)
    crack = lp(rng.standard_normal(len(t)), 3500) * np.exp(-t * 12) * 0.6
    s = np.tanh((boom + crack) * 1.8) * size
    s = np.stack([s, s], 1)
    return reverb(s, 3.0, 0.45, 3000) * 0.95

def swell(dur):
    s = impact(0.6)[:int(SR * dur)][::-1]
    return hp(s, 200) * 0.7

def tick():
    t = t_arr(0.03)
    return hp(np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 180), 1500) * 0.35

def hit():  # text-punch hit
    t = t_arr(0.6)
    thump = np.sin(2 * np.pi * np.cumsum(55 + 90 * np.exp(-t * 35)) / SR) * np.exp(-t * 9)
    snap = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 40) * 0.5
    s = np.tanh((thump + snap) * 1.5) * 0.75
    return reverb(np.stack([s, s], 1), 1.4, 0.3)

# ---------------------------------------------------------------- arrangement
drums, bass, music, fx = buf(), buf(), buf(), buf()
CH = [[53, 56, 60], [49, 53, 56], [56, 60, 63], [51, 55, 58]]  # Fm Db Ab Eb
ROOT = [41, 37, 44, 39]                                          # F1 Db1 Ab1 Eb1 (+12 below)
HOOK = [65, 68, 72, 68, 70, 68, 65, 63, 65, 68, 72, 75, 72, 70, 68, 70]  # 16 x 16ths per bar (sparse)
HOOK_MASK = [1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1]

# Intro 0-4: tension ticks, heartbeat, text hits on 0.5 1.5 2.5 3.5
for i in range(16):
    place(fx, tick(), i * 0.25, 1.0 if i % 4 == 0 else 0.55, pan=0.3 if i % 2 else -0.3)
for b in (0, 1.0, 2.0, 3.0):
    place(drums, lp(kick(0.8), 700), b, 0.6)
for b in (0.5, 1.5, 2.5, 3.5):
    place(fx, hit(), b, 0.9)
place(music, pad([29, 41], 5.75, 350, 1.5), 0, 0.9)          # sub drone
# 4-5.75 build + roll, 5.75-6 silence
place(fx, riser(1.75), 4.0, 1.0)
k = 0
tt = 4.0
while tt < 5.72:
    place(drums, clap() * 0.6, tt, 0.25 + 0.6 * (tt - 4) / 1.75)
    tt += 0.25 if tt < 4.75 else (0.125 if tt < 5.25 else 0.0625)
place(fx, swell(0.9), 5.1, 0.8)

# 6-10 reveal: impact + pads
place(fx, impact(1.1), 6.0, 1.0)
place(music, pad(CH[0] + [41], 2.0, 1400, 0.05), 6.0, 1.1)
place(music, pad(CH[1] + [37], 2.0, 1600, 0.3), 8.0, 1.1)
for i in range(8):
    place(music, pluck(HOOK[i * 2] + 12, 0.5, 0.4), 6.0 + i * 0.5, 0.35, pan=(-0.5 if i % 2 else 0.5))
place(bass, sub808(29, 2.0), 6.0, 0.9)
place(bass, sub808(25, 2.0), 8.0, 0.9)

# 10-12 build
place(fx, riser(2.0), 10.0, 1.2)
tt = 10.0
while tt < 11.87:
    place(drums, clap() * 0.7, tt, 0.3 + 0.7 * (tt - 10) / 2)
    tt += 0.25 if tt < 11 else 0.125
place(music, lp(pad(CH[2] + [44], 1.9, 3000, 0.1), 2500), 10.0, 0.8)
place(fx, swell(1.0), 11.0, 0.9)

def groove(start, bars, energy=1.0):
    for b in range(bars):
        t0 = start + b * BAR
        ci = b % 4
        # kick / 808
        for e in (0, 3, 5) if b % 2 == 0 else (0, 3, 6, 7):
            place(drums, kick(), t0 + e * 0.25, 1.0 if e == 0 else 0.85)
            place(bass, sub808(ROOT[ci] - 12 + (12 if e == 7 else 0), 0.6 if e else 0.9, 0.3 if e == 7 else 0), t0 + e * 0.25, 1.0)
        for e in (2, 6):
            place(drums, clap(), t0 + e * 0.25, 0.95)
        for s in range(16):
            v = 1.0 if s % 2 == 0 else 0.55
            if energy > 1 and s in (13, 14, 15) and b % 2 == 1:
                place(drums, hat(), t0 + s * 0.125 + 0.0625, 0.5, pan=0.4)
            place(drums, hat(open_=(s == 14 and energy > 1)), t0 + s * 0.125, v * 0.8, pan=-0.35 if s % 2 else 0.35)
        # chords + hook
        place(music, pad(CH[ci], BAR, 2200 if energy > 1 else 1600, 0.05), t0, 0.75)
        for s in range(16):
            if HOOK_MASK[s]:
                place(music, pluck(HOOK[s] + (0 if ci in (0, 2) else -2), 0.35, 0.6 + 0.3 * energy), t0 + s * 0.125, 0.55, pan=(0.35 if s % 2 else -0.35))
        if energy > 1:
            for s in range(0, 16, 2):
                place(music, pluck(CH[ci][s // 2 % 3] + 24, 0.25, 1.0), t0 + s * 0.125 + 0.0625, 0.22, pan=0.6)

place(fx, impact(0.9), 12.0, 0.9)
groove(12.0, 8, 1.0)
# 28-30 break
place(music, pad(CH[0] + [65], 2.0, 900, 0.2), 28.0, 1.0)
for s in range(16):
    if HOOK_MASK[s]:
        place(music, lp(pluck(HOOK[s], 0.4, 0.3), 1500), 28.0 + s * 0.125, 0.45)
place(fx, riser(2.0), 28.0, 1.2)
place(fx, swell(0.9), 29.0, 0.8)
place(drums, kick(), 28.0, 0.9)
# 30-38 drop B
place(fx, impact(1.0), 30.0, 0.9)
groove(30.0, 4, 1.4)
# 38-40 stop
place(fx, impact(0.8), 38.0, 0.7)
place(music, pad(CH[3] + [63], 1.87, 1200, 0.05), 38.0, 0.9)
place(fx, riser(1.85), 38.0, 1.2)
tt = 38.0
while tt < 39.85:
    place(drums, clap() * 0.7, tt, 0.25 + 0.7 * (tt - 38) / 1.9)
    tt += 0.25 if tt < 39 else 0.125
# 40-48 outro
place(fx, impact(1.25), 40.0, 1.1)
place(music, pad(CH[0] + [41, 65], 8.0, 1500, 0.05), 40.0, 1.1)
place(bass, sub808(29, 3.5), 40.0, 1.0)
for b in range(3):
    t0 = 40.0 + b * BAR
    place(drums, kick(0.8), t0, 0.7)
    place(drums, clap() * 0.8, t0 + 1.0, 0.5)
    for s in range(0, 16, 2):
        place(drums, hat(), t0 + s * 0.125, 0.45)
    for s in range(16):
        if HOOK_MASK[s] and s % 2 == 0:
            place(music, pluck(HOOK[s] + 12, 0.5, 0.5), t0 + s * 0.125, 0.3)
place(fx, hit(), 46.0, 0.8)

# ---------------------------------------------------------------- mix
kick_times = []
for start, bars in ((12.0, 8), (30.0, 4)):
    for b in range(bars):
        for e in ((0, 3, 5) if b % 2 == 0 else (0, 3, 6, 7)):
            kick_times.append(start + b * BAR + e * 0.25)
duck = np.ones(N)
tt = np.arange(N) / SR
for k in kick_times:
    i = int(k * SR)
    seg = np.arange(int(0.28 * SR))
    j = min(N, i + len(seg))
    duck[i:j] = np.minimum(duck[i:j], 0.35 + 0.65 * (seg[:j - i] / len(seg)) ** 0.7)
music = reverb(music, 2.4, 0.28) * duck[:, None]
drums = reverb(drums, 0.9, 0.12, 8000)
bass = lp(bass, 180) * 1.0
mix = drums * 0.9 + bass * 0.95 + music * 0.8 + fx * 0.85
# gentle fades
mix[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]
fo = int(2.0 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5
mix = np.tanh(mix * 0.9)
mix /= np.abs(mix).max() * 1.05
wavfile.write('score.wav', SR, (mix * 32767).astype(np.int16))
print('ok', mix.shape)
