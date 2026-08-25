# Homework download helper

Double-click `run_homework.bat`. It will:

1. Open Chrome by itself.
2. Sign into the portal by itself (username/password are typed by the script,
   not by you).
3. Go to the "لیست تکالیف تائید نشده" (pending review) list and click
   **مشاهده تکالیف** on the first row.
4. On that submission's page: download the uploaded file(s) into
   `Desktop\Homework\<Student>\`, read them (Word, PDF, photos via OCR, voice
   messages via offline transcription), and draft feedback.
5. Type the draft into the **"توضیحات شما برای زبان آموز..."** box, then
   wait. You read it, edit it if you like, choose the status, and click
   **ثبت** yourself.
6. The moment you do, the script notices and re-opens the list — which now
   has one fewer pending row — and clicks **مشاهده تکالیف** on the next one.
   No key press, nothing left for you to click except ثبت itself.
7. When the pending list is empty, it stops and prints a report: how many
   were processed, how many were submitted, and anything that needs a
   manual look.

**This script never clicks ثبت (Submit) or picks a status.** Grading is
always your decision, on every single submission — the script only fills in
the text box and waits.

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

The pending-review list, the "مشاهده تکالیف" button, the feedback box, and
the "ثبت" button are all matched by their real text/shape on the portal, not
a hard-coded selector — so small layout tweaks (a moved column, a slightly
reworded button) don't break it outright, and every fallback still degrades
to a keyword search rather than failing silently:

- **Login**: the visible password box on the login page, and the text box
  right above it.
- **Pending list**: rows containing a "مشاهده تکالیف" button (or a close
  variant - "مشاهده", "بررسی", "view", "review"). Student/class/session are
  read from that row's own table cells.
- **Uploaded files**: every link on the opened submission's page pointing at
  a file, by extension or by words like "دانلود"/"فایل" near it — this
  covers both the "فایل های آپلود شده" and "صوت های ضبط شده" sections.
  Files are fetched directly over the browser's own session rather than by
  clicking, since some file links just open inline instead of triggering a
  download.
- **The feedback box**: the visible `<textarea>` on the page, preferring one
  whose placeholder matches the portal's real wording ("توضیحات", "استاد
  عزیز") over any other textarea that might be on the page.
- **"You submitted it"**: the script never clicks ثبت — it watches for the
  page navigating away (the normal case, since ثبت returns to the pending
  list) or the feedback box disappearing/becoming disabled. If it sees
  neither within 30 minutes it moves on anyway and flags that submission in
  the report.

If the portal's layout doesn't match any of this (login page structure is
unusual, or the pending list needs a different starting page), the script
says exactly what it couldn't find, instead of failing silently.

## The report

After every run, two things are written into `Desktop\Homework\`:

- `گزارش_<date>.txt` — student, assignment, file, and either a suggested
  feedback draft or a note on why one wasn't written (bad OCR, silent
  recording, etc).
- `run_log_<date>.json` — the machine-readable version, used to skip files
  already downloaded if you run it again the same day.

## If something goes wrong

**"Chrome would not start"** — Google Chrome isn't installed. Get it from
google.com/chrome.

**"Sign-in failed"** — either the saved password is wrong (open Credential
Manager and remove `homework-automation-portal1` so it's asked again), or
the site is asking for something extra (a code, a captcha) that this script
can't answer. It stops rather than getting stuck.

**Stops immediately with no rows processed** — the pending list page didn't
have a recognizable "مشاهده تکالیف" button. Set `homework_url` in
`config.json` to the exact pending-review list page and try again.

**A folder named نامشخص (unknown)** — the student-name guess failed for that
item. The files are still downloaded correctly; just move the folder's
contents into the right one.

**"no uploaded file found on this submission's page"** — the script opened
a submission but found nothing file-shaped to download. Worth a manual look
at that one.

**"no feedback box found on this submission's page"** — couldn't find a
`<textarea>` on the opened submission's page. The draft is still saved in
the report file, so it can be pasted in by hand.

**"no Submit detected after 30 minutes"** — the script waited half an hour
for the page to change after you clicked Submit and didn't see it. Either the
portal took the click without navigating or disabling the box (in which case
the submission likely still went through fine — just check on the site), or
the click didn't land. It moves to the next student regardless rather than
hanging forever.

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
