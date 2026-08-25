# Homework download helper

Double-click `run_homework.bat`. It will:

1. Open Chrome by itself.
2. Sign into the portal by itself (username/password are typed by the script,
   not by you).
3. Go to the homework section, find every submission, and download the files
   into `Desktop\Homework\<Student>\`, named with the assignment and the date.
4. Read each file (Word, PDF, photos via OCR, voice messages via offline
   transcription) and check that it came out readable.
5. Print a report: how many downloaded, which ones need a manual look, and a
   suggested feedback draft for each one.

Nothing is typed into the site and nothing is ever submitted or saved there —
this only reads and downloads. No page is left open waiting for you to check
anything while it runs.

## First run

1. Copy `config.example.json` to `config.json`.
2. If you already know the URL of the homework/submissions page, put it in
   `portal.homework_url`. If you leave it blank, the script looks for a menu
   link that says "تکالیف" / "homework" / "assignment" and follows it itself.
3. Double-click `make_desktop_icon.vbs`. This makes a **"دانلود تکالیف"**
   icon on the Desktop — that icon is what you use from now on, not this
   folder.
4. Double-click the new Desktop icon.
   - The first run installs everything (a few minutes), then starts.
   - It will ask for the portal username and password **once**, in the
     terminal window. They are saved encrypted in **Windows Credential
     Manager** (not a text file) so it isn't asked again. To change or
     remove them later: Windows Start → "Credential Manager" →
     Windows Credentials → look for `homework-automation-portal1`.

After that, every future run is just double-clicking the Desktop icon — no
clicking, no page left open to babysit.

Two extra pieces are **not** installed by pip, and are only needed for some
file types:

| Needed for | Install |
|---|---|
| OCR of photos and scanned PDFs | [Tesseract for Windows](https://github.com/UB-Mannheim/tesseract/wiki) — tick "Add to PATH" |
| Rendering scanned PDFs for OCR | [Poppler for Windows](https://github.com/oschwartz10612/poppler-windows/releases) — add its `bin` folder to PATH |

Word docs, text PDFs and voice messages work without either.

## How it finds things on the page

The portal's exact HTML wasn't available while building this, so instead of
hard-coded selectors the script looks for things by what they *are*:

- **Login**: the visible password box on the login page, and the text box
  right above it.
- **Homework section**: the configured URL, or a menu link whose text
  contains a homework-related word (Persian or English).
- **Files**: any link on that page pointing at a file (by extension, or by
  words like "دانلود"/"download" near it).
- **Student name**: Persian or Latin name-shaped text in the same table
  row/block as the link. This is the one guess worth double-checking — if a
  folder is named `نامشخص` ("unknown"), that item's name wasn't recognized
  and the file needs moving into the right folder by hand.

If the portal's layout doesn't match any of this (login page structure is
unusual, or the homework page needs a click through a different menu), the
script says exactly what it couldn't find and where, instead of failing
silently.

## The report

After every run, two things are written into `Desktop\Homework\`:

- `گزارش_<date>.txt` — student, assignment, file, and either a suggested
  feedback draft or a note on why one wasn't written (bad OCR, silent
  recording, etc).
- `run_log_<date>.json` — the machine-readable version, used to skip files
  already downloaded if you run it again the same day.

## If something goes wrong

**"کروم اجرا نشد" (Chrome would not start)** — Google Chrome isn't installed.
Get it from google.com/chrome.

**"ورود ناموفق" (sign-in failed)** — either the saved password is wrong (open
Credential Manager and remove `homework-automation-portal1` so it's asked
again), or the site is asking for something extra (a code, a captcha) that
this script can't answer. It stops rather than getting stuck.

**"هیچ فایل تکلیفی پیدا نشد" (no files found)** — either there's genuinely
nothing pending, or the homework page needs `homework_url` set explicitly in
`config.json`.

**A folder named نامشخص (unknown)** — the student-name guess failed for that
item. The file is still downloaded correctly; just move it into the right
folder.

## Voice messages

Transcription is `faster-whisper`, running on your own machine — no API key,
no cost, nothing sent anywhere. The first voice message of a run takes a
minute while the model loads.

## Better feedback drafts (optional)

The default drafter is offline and rule-based — it catches common patterns
(tense slips, missing articles, run-on sentences, repeated filler words) and
writes a short draft from them. It's a starting point, not a finished
comment.

For noticeably better drafts, set `feedback.backend` to `"anthropic"` in
`config.json`, `pip install anthropic` in the venv, and set an
`ANTHROPIC_API_KEY` environment variable. This sends the text of each
submission to the Claude API — small cost per submission — and falls back to
the offline drafter automatically if the key is missing or the call fails.
