#!/bin/sh
# Clean up the user's phone recording: rumble out, clicks out, light denoise, de-mud, presence + air, de-ess, compress.
set -e
D=$(cd "$(dirname "$0")" && pwd)
ffmpeg -v error -y -i "$D/voice_raw.wav" -af "\
highpass=f=80:poles=2,\
adeclick=w=55:o=75,\
afftdn=nr=8:nf=-62:tn=1,\
equalizer=f=140:t=q:w=1.0:g=-1.5,\
equalizer=f=320:t=q:w=1.1:g=-3,\
equalizer=f=3200:t=q:w=0.8:g=4.5,\
highshelf=f=7000:g=3,\
deesser=i=0.35:m=0.5:f=0.5,\
acompressor=threshold=-26dB:ratio=3:attack=6:release=140:knee=4:makeup=5,\
agate=threshold=0.006:ratio=3:range=0.18:attack=4:release=180:knee=3,\
alimiter=limit=0.89:attack=3:release=60:level=disabled" -ar 48000 -c:a pcm_s24le "$D/voice_clean.wav"
