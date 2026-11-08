#!/bin/bash
# Synthesised soundtrack (pads Am-F-C-G, bass, kick, hats, whooshes on scene cuts, impact at the outro).
set -e; OUT=$1; T=$(mktemp -d); cd $T
C='mod(t,4)'; E="min(1,$C/0.25)*min(1,(4-$C)/0.35)"
F1='if(lt(mod(t,16),4),220,if(lt(mod(t,16),8),174.61,if(lt(mod(t,16),12),261.63,196)))'
F2='if(lt(mod(t,16),4),261.63,if(lt(mod(t,16),8),220,if(lt(mod(t,16),12),329.63,246.94)))'
F3='if(lt(mod(t,16),4),329.63,if(lt(mod(t,16),8),261.63,if(lt(mod(t,16),12),392,293.66)))'
ffmpeg -loglevel error -y -f lavfi -i "aevalsrc='0.07*$E*(sin(2*PI*$F1*t)+sin(2*PI*$F1*1.003*t)+0.8*sin(2*PI*$F2*t)+0.7*sin(2*PI*$F3*t)+0.25*sin(4*PI*$F3*t))':s=44100:d=30" -af "lowpass=f=2400,aecho=0.8:0.7:180|360:0.35|0.2" pad.wav
ffmpeg -loglevel error -y -f lavfi -i "aevalsrc='0.22*$E*sin(2*PI*($F1/4)*t)*exp(-6*mod(t,0.25))*gte(t,4)':s=44100:d=30" -af "lowpass=f=500" bass.wav
ffmpeg -loglevel error -y -f lavfi -i "aevalsrc='0.9*sin(2*PI*(45+110*exp(-28*mod(t,0.5)))*mod(t,0.5))*exp(-7*mod(t,0.5))*gte(t,4)*lt(t,27.5)':s=44100:d=30" kick.wav
ffmpeg -loglevel error -y -f lavfi -i "aevalsrc='0.25*(random(0)*2-1)*exp(-55*mod(t+0.25,0.5))*gte(t,4)*lt(t,27.5)':s=44100:d=30" -af "highpass=f=7000" hat.wav
W=''; for s in 4 9 14 19 24; do W="$W+0.35*(random(1)*2-1)*exp(-pow((t-$s+0.15)/0.18,2))"; done
ffmpeg -loglevel error -y -f lavfi -i "aevalsrc='0$W':s=44100:d=30" -af "bandpass=f=1800:w=1.2,aecho=0.6:0.5:90:0.3" whoosh.wav
ffmpeg -loglevel error -y -f lavfi -i "aevalsrc='0.5*exp(-3*(t-24))*gte(t,24)*(sin(2*PI*55*t)+0.6*sin(2*PI*110*t))+0.4*(random(2)*2-1)*exp(-12*(t-24))*gte(t,24)':s=44100:d=30" -af "lowpass=f=1500" impact.wav
ffmpeg -loglevel error -y -i pad.wav -i bass.wav -i kick.wav -i hat.wav -i whoosh.wav -i impact.wav -filter_complex "[0][1][2][3][4][5]amix=inputs=6:normalize=0,afade=t=in:d=0.6,afade=t=out:st=28:d=2,acompressor=threshold=0.3:ratio=3,aformat=channel_layouts=stereo" -c:a pcm_s16le "$OLDPWD/$OUT"
