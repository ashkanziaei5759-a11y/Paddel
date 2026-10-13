# Storyboard sheet: key shots rendered with the real engine, captioned with shot, framing, timing and line.
import sys
from PIL import Image, ImageDraw, ImageFont
F = sys.argv[1]
shots = [
 ("3.3",  "1 · Medium · slow push",      "0–6s",   "Camera, Editor, Footage struck"),
 ("5.9",  "2 · Medium · hold",           "5.4–6s", "all of it = a big 0"),
 ("10.4", "3 · Ride the line down",      "6.5–11s","Lemo-Opuscar · open source · 39"),
 ("16.8", "4 · Pull back · burst",       "11–17s", "5 styles, then many more"),
 ("22.9", "5 · Whip · track down",       "17.5–23s","How it works · 1: link to Claude Code"),
 ("26.9", "6 · Track down",              "23.5–27.5s","2: pick a style · tell the story"),
 ("31.2", "7 · Slow push",               "27.5–32s","3: code, render, music tick"),
 ("33.4", "8 · Full board · no pens",    "32.5–35s","board redraws itself"),
 ("39.5", "9 · Push in · end card",      "35–40s", "comment «ریپو» · Claude Code"),
]
w, h = 330, 587
ft = ImageFont.truetype(f"{F}/fonts/ArchitectsDaughter-Regular.ttf", 17)
fa = ImageFont.truetype(f"{F}/fonts/Vazirmatn.ttf", 19)
sheet = Image.new("RGB", (w * 9 + 10 * 10, h + 120), "#f3f1ec"); d = ImageDraw.Draw(sheet)
for i, (t, a, b, c) in enumerate(shots):
    im = Image.open(f"{F}/frames/t_{t}.jpg").resize((w, h)); x = 10 + i * (w + 10)
    sheet.paste(im, (x, 10)); d.rectangle([x, 10, x + w - 1, 10 + h - 1], outline="#b9b2a4")
    d.text((x + 4, h + 16), a, font=ft, fill="#23262c"); d.text((x + 4, h + 42), b, font=ft, fill="#d97757")
    if "«" in c:
        en, rest = c.split("«"); word, tail = rest.split("»")
        d.text((x + 4, h + 68), en, font=ft, fill="#2a5cb3"); ex = x + 4 + d.textlength(en, font=ft)
        d.text((ex, h + 66), word, font=fa, fill="#2a5cb3", direction="rtl", features=["-kern"]) if False else d.text((ex, h + 66), "«ریپو»", font=fa, fill="#2a5cb3")
        d.text((ex + d.textlength("«ریپو»", font=fa) + 4, h + 68), tail, font=ft, fill="#2a5cb3")
    else: d.text((x + 4, h + 68), c, font=ft, fill="#2a5cb3")
sheet.save(f"{F}/storyboard.jpg", quality=90); print(sheet.size)
