# Homework download & feedback helper

One double-click on `run_homework.bat` and this will:

1. Open Chrome in a dedicated profile and sign into the portal (Chrome's own
   saved password does the signing in — the script never reads or stores it).
2. Download every pending submission into `Desktop\Homework\<Student>\`.
3. Read them — Word, PDF, photos (OCR), voice messages (transcribed offline).
4. Draft feedback for each one.
5. Type each draft into the student's feedback box in the browser and **stop**,
   so you can read it, change it, and click Save yourself.

**It never clicks Save or Submit.** That is always your action.

---

## First-time setup

### 1. A separate Chrome profile

Chrome can't have the same profile open twice, so the script needs its own —
otherwise it will fight with your normal browsing.

- Chrome → your profile picture (top right) → **Add** → name it `Homework Bot`.
- In that new window, go to https://portal1.iran-europe.net/Login, sign in, and
  let Chrome **save the password**.
- Find the folder: in the Homework Bot window go to `chrome://version` and copy
  the **Profile Path**. It looks like
  `C:\Users\YOU\AppData\Local\Google\Chrome\User Data\Profile 2`.
- Rename that folder to `HomeworkBot` if you like, or just use the path as-is.

### 2. Fill in the config

Copy `config.example.json` to `config.json` and set:

- `chrome_profile_dir` — the profile path from above (keep the double
  backslashes).
- `portal.homework_url` — the page that lists pending homework, if it isn't the
  login page.

### 3. Install

Double-click `run_homework.bat`. The first run creates a virtual environment
and installs everything; it takes a few minutes. After that it starts in
seconds.

Two extra pieces are **not** installed by pip, and are only needed for some
file types:

| You need it for | Install |
|---|---|
| OCR of photos and scanned PDFs | [Tesseract for Windows](https://github.com/UB-Mannheim/tesseract/wiki) — tick "Add to PATH" |
| Rendering scanned PDFs for OCR | [Poppler for Windows](https://github.com/oschwartz10612/poppler-windows/releases) — add its `bin` folder to PATH |

Word docs, text PDFs and voice messages work without either.

### 4. Point it at the right page elements

The script has to know which bit of the portal page is a student name, which is
the download link, and which is the feedback box. The values shipped in
`config.example.json` are **guesses** — the portal's real HTML has not been
seen. Run:

    inspect_page.bat

It opens Chrome, waits for you to navigate to the homework list, then saves the
page as `inspect_dump.html` and prints what it found. Send that file over (or
open it yourself) and the `selectors` block in `config.json` gets filled in to
match. This is a one-time job unless the portal changes.

---

## Running it

Double-click `run_homework.bat`.

For each submission you'll see the student's name in the terminal, the draft
already typed into the browser, and a prompt. Edit it in Chrome, click Save on
the site, then press Enter in the terminal to move to the next one.

At the end you get a summary: how many downloaded, how many drafted, and
anything that needs your eyes.

## If something goes wrong

**"Chrome would not start"** — the Homework Bot profile is already open in
another window. Close it.

**"Could not confirm sign-in"** — the script pauses and asks you to sign in
manually in the window it opened. Do that, press Enter, and it carries on. This
is also what happens if the site asks for a code or a CAPTCHA.

**"No homework rows matched"** — the page layout isn't what `config.json`
expects. Run `inspect_page.bat` and update the selectors.

**Something flagged instead of drafted** — the script couldn't read that file
confidently (bad handwriting, a silent recording, an empty scan). It says so
rather than drafting feedback on a guess. Those need reading by hand.

## The run log

Everything is written to `Desktop\Homework\run_log_<date>.json` as it happens,
not at the end. If the script is interrupted, run it again — it skips anything
already downloaded and already reviewed that day.

## Voice messages

Transcription is `faster-whisper`, which runs on your own machine: no API key,
no cost, nothing sent anywhere. The first voice message of each run takes a
minute while the model loads. If it's too slow or too inaccurate, change
`transcription.model` in `config.json` — `tiny` and `base` are faster, `medium`
is slower and more accurate.

## Better feedback drafts (optional)

The default drafter is offline and rule-based. It spots common patterns
(tense slips, missing articles, over-long sentences, repeated filler words) and
assembles a draft from them. It's a starting point, not a finished comment —
it can't tell you whether the student's *argument* worked.

For noticeably better drafts, set `feedback.backend` to `"anthropic"` in
`config.json`, `pip install anthropic` in the venv, and set an
`ANTHROPIC_API_KEY` environment variable. This sends the text of each
submission to the Claude API. It costs a small amount per submission, and if
the key is missing or the call fails the script quietly falls back to the
offline drafter.
