#!/bin/bash
# Rebuild the 30s promo: Remotion (0-24s) + HyperFrames outro (24-30s) + ffmpeg music/mix.
# Needs: node 22+, ffmpeg 6.1+, python3, kajisho5/ffmpeg-skill cloned at $FFSKILL.
# Screens in remotion/public/shots come from shots.cjs (after data.mjs fills a demo database).
set -e
cd "$(dirname "$0")"; FFSKILL=${FFSKILL:-../ffmpeg-skill}; mkdir -p out
(cd remotion && npm i && npx remotion render Promo ../out/main.mp4 --codec=h264 --crf=16)
(cd hyperframes && npx --yes hyperframes@0.9.23 render -o ../out/outro.mp4 -q delivery -f 30)
bash music.sh out/music_raw.wav
ffmpeg -y -i out/main.mp4 -i out/outro.mp4 -i out/music_raw.wav -filter_complex \
 "[0:v]scale=in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,setsar=1,format=yuv420p[a];[1:v]scale=in_color_matrix=bt601:out_color_matrix=bt709,setsar=1,format=yuv420p[b];[a][b]concat=n=2:v=1:a=0[v];[2:a]atrim=0:30[m]" \
 -map "[v]" -map "[m]" -c:v libx264 -preset slow -crf 17 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -r 30 -c:a aac -b:a 192k -t 30 out/premix.mp4
python3 $FFSKILL/scripts/loudness.py out/premix.mp4 -I -14 --tp -1 -o out/persian-padel-promo-30s.mp4 --overwrite
python3 $FFSKILL/scripts/check.py out/persian-padel-promo-30s.mp4 --platform youtube
