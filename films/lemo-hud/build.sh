#!/bin/sh
# Rebuild the reel from this folder:  sh build.sh   (LIB = the Lemo-Opuscar library folder)
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
LIB=${LIB:-/root/lemo-opuscar}; PY="$LIB/.venv/bin/python"
export PLAYWRIGHT_CHROME=${PLAYWRIGHT_CHROME:-/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell}
sh "$HERE/audio/enhance.sh"                                   # clean the recording
"$PY" "$HERE/audio/edit.py"                                   # cut + place the voice; word map; subtitle cues
node "$HERE/models/gen.mjs"                                   # wireframe models
cd "$LIB"
node core/render/events.mjs "$HERE" --size 1080x1920
node core/render/video.mjs "$HERE" --fps 24 --workers 5 --size 1080x1920 --out "$HERE/out/video.mp4"
"$PY" "$HERE/sound.py"                                        # score + foley + mix → out/mix.wav
sh "$HERE/master.sh" "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/lemo-hud.mp4"
"$PY" core/render/srt.py "$HERE/out/cues.json" "$HERE/lemo-hud.srt"
node core/render/still.mjs "$HERE" 10.0 --size 1080x1920 --prefix poster_ --out "$HERE/out" && cp "$HERE/out/poster_10.0.jpg" "$HERE/poster.jpg"
echo "built $HERE/lemo-hud.mp4"
