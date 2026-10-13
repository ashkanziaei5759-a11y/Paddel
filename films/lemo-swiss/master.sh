#!/bin/sh
# Master and mux: two-pass loudnorm to −14 LUFS / true peak −1.2 dB, no grain (Swiss: none), 24 fps H.264 + AAC.
# (Same steps as $LIB/core/render/mux.sh, whose decoded-length check misfires with this machine's ffmpeg 6.1.)
#   sh master.sh video.mp4 mix.wav out.mp4
set -e
V=$1; A=$2; O=$3
J=$(ffmpeg -hide_banner -nostats -i "$A" -af loudnorm=I=-14:TP=-1.2:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$J" | grep "\"$1\"" | sed 's/.*: "\(.*\)".*/\1/'; }
F="loudnorm=I=-14:TP=-1.2:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true"
T=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$V")
ffmpeg -v error -y -i "$V" -i "$A" -map 0:v -map 1:a -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 24 -af "$F,aresample=48000" -c:a aac -b:a 192k -t "$T" -movflags +faststart "$O.tmp.mp4"
mv "$O.tmp.mp4" "$O"
ffmpeg -hide_banner -nostats -i "$O" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):" | tr -s ' '
