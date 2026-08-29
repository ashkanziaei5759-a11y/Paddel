"""Open Chrome, sign into the portal, and go through the pending-homework
list one submission at a time: open it, download its file(s), draft
feedback, type the draft into the feedback box, and wait. The moment the
teacher clicks Submit/ثبت on the site herself, the script notices and
re-reads the (now one-shorter) pending list to open the next one - no key
press needed. This script never clicks Submit/ثبت itself; that is always
the teacher's action, every single time.

Terminal output is kept in English on purpose: the classic Windows Command
Prompt (conhost.exe) that a double-clicked .bat file opens uses a raster
font that has no Persian glyphs, so Persian text there renders as empty
boxes even though it's correct data. The report file written to disk, and
the desktop-icon script's message boxes, use a real font and show Persian
fine - only this console does not.
"""
import json
import re
import sys
from datetime import date, datetime
from pathlib import Path
from urllib.parse import unquote, urlparse

import extract
import feedback
import portal
from manifest import Manifest, desktop

# Student and assignment names come from the portal and are Persian text.
# The classic Windows console can't encode every character its codepage
# doesn't have, which otherwise crashes print() mid-run with
# UnicodeEncodeError. Swap unencodable characters for '?' instead of dying.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(errors="replace")
    except (AttributeError, ValueError):
        pass

HERE = Path(__file__).parent
CONFIG_PATH = HERE / "config.json"
KEYRING_SERVICE = "homework-automation-portal1"
MAX_SUBMISSIONS_PER_RUN = 500  # a hard ceiling so a stuck loop can't run forever


def _stored_credentials() -> tuple[str | None, str | None]:
    try:
        import keyring
    except ImportError:
        return None, None
    try:
        username = keyring.get_password(KEYRING_SERVICE, "username")
        password = keyring.get_password(KEYRING_SERVICE, "password") if username else None
        return username, password
    except Exception:
        return None, None


def _store_credentials(username: str, password: str) -> bool:
    try:
        import keyring

        keyring.set_password(KEYRING_SERVICE, "username", username)
        keyring.set_password(KEYRING_SERVICE, "password", password)
        return True
    except Exception:
        return False


def load_config() -> dict:
    defaults = json.loads((HERE / "config.example.json").read_text(encoding="utf-8"))
    if not CONFIG_PATH.exists():
        config = defaults
        CONFIG_PATH.write_text(json.dumps(config, indent=2), encoding="utf-8")
    else:
        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        # An existing config.json from before the pending-list URL was known
        # would have this blank - fill it in from the shipped default rather
        # than falling back to menu-guessing every run.
        if not config.get("portal", {}).get("homework_url"):
            config.setdefault("portal", {})["homework_url"] = defaults["portal"]["homework_url"]

    saved_user, saved_pass = _stored_credentials()
    username = config["portal"].get("username") or saved_user
    password = config["portal"].get("password") or saved_pass

    if not username or not password:
        print("First run - the portal username and password are needed.")
        print("They are saved encrypted in Windows Credential Manager (not a")
        print("text file), so this is only asked once.\n")
        username = input("  Username: ").strip()
        password = input("  Password: ").strip()
        if not username or not password:
            sys.exit("Both are needed. Run the desktop icon again.")
        if _store_credentials(username, password):
            print("\nSaved. Continuing.\n")
        else:
            print(
                "\n! Could not save to Credential Manager; continuing without "
                "saving - you'll be asked again next time.\n"
            )

    config["_username"] = username
    config["_password"] = password
    return config


def safe_name(value: str, fallback: str = "unknown") -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", value).strip().strip(".")
    cleaned = " ".join(cleaned.split())
    return cleaned[:70] or fallback


def download_submission_files(context, urls: list[str], student: str, assignment: str, root: Path) -> list[str]:
    """Fetch each file straight over HTTP using the browser's own session
    (cookies included), rather than relying on a click triggering a
    download event - a plain <a href="...jpg"> often just opens the image
    instead of downloading it, and this works either way."""
    folder = root / safe_name(student, "نامشخص")
    folder.mkdir(parents=True, exist_ok=True)
    today = date.today().isoformat()
    saved: list[str] = []

    for i, url in enumerate(urls, start=1):
        ext = Path(unquote(urlparse(url).path)).suffix or ".bin"
        suffix = f"_{i}" if len(urls) > 1 else ""
        target = folder / f"{safe_name(assignment, 'تکلیف')}_{today}{suffix}{ext}"
        counter = 2
        while target.exists():
            target = folder / f"{safe_name(assignment)}_{today}{suffix}_{counter}{ext}"
            counter += 1
        try:
            response = context.request.get(url)
            if not response.ok:
                print(f"    ! download failed (HTTP {response.status}): {url}")
                continue
            target.write_bytes(response.body())
            saved.append(str(target))
        except Exception as exc:
            print(f"    ! download failed: {exc}")
    return saved


def write_report(root: Path, rows: list[dict], problems: list[str]) -> Path:
    lines = [
        "گزارش دانلود و بازخورد تکالیف",
        f"تاریخ: {datetime.now():%Y-%m-%d %H:%M}",
        "=" * 60,
        "",
    ]
    for row in rows:
        lines.append(f"{row['student']}  |  {row['assignment']}")
        files = row.get("files") or []
        lines.append(f"  فایل‌ها: {', '.join(files) if files else '-'}")
        if row.get("note"):
            lines.append(f"  ⚠ {row['note']}")
        elif row.get("feedback"):
            lines.append("  بازخورد پیشنهادی:")
            lines.append("    " + row["feedback"].replace("\n", "\n    "))
            if row.get("reviewed"):
                lines.append("  ✓ ثبت شد در سایت")
            elif row.get("review_note"):
                lines.append(f"  ⚠ {row['review_note']}")
        lines.append("")

    lines.append("=" * 60)
    if problems:
        lines.append(f"موارد نیازمند بررسی دستی ({len(problems)}):")
        lines.extend(f"  - {p}" for p in problems)
    else:
        lines.append("همه موارد بدون مشکل پردازش شدند.")

    path = root / f"گزارش_{date.today().isoformat()}.txt"
    path.write_text("\n".join(lines), encoding="utf-8-sig")
    return path


def process_one(page, context, item: dict, config: dict, root: Path) -> dict:
    """Download this submission's file(s), draft feedback, type it in, and
    wait for the teacher's own Submit click. Returns the record to save."""
    label = f"{item['student']} - {item['assignment']}"
    record: dict = {**item}

    urls = portal.find_submission_files(page)
    if not urls:
        record["note"] = "no uploaded file found on this submission's page"
        print(f"  ! {label}: {record['note']}")
        return record

    saved = download_submission_files(context, urls, item["student"], item["assignment"], root)
    if not saved:
        record["note"] = "found file(s) but none could be downloaded"
        print(f"  ! {label}: {record['note']}")
        return record
    record["files"] = saved
    print(f"  OK {label}  ->  {len(saved)} file(s)")

    texts, extract_notes, has_audio = [], [], False
    for file_str in saved:
        path = Path(file_str)
        text, note = extract.extract(path, config)
        if text:
            texts.append(text)
            if extract.kind_of(path) == "audio":
                has_audio = True
        if note:
            extract_notes.append(f"{path.name}: {note}")

    if not texts:
        record["note"] = "; ".join(extract_notes) or "could not read any of the downloaded files"
        print(f"    ! flagged: {record['note']}")
        return record
    if extract_notes:
        print(f"    (note: {'; '.join(extract_notes)})")

    combined_text = "\n\n".join(texts)
    record["feedback"] = feedback.draft(
        combined_text, item["student"], item["assignment"], config, has_audio=has_audio
    )

    box = portal.feedback_box(page)
    if box is None:
        record["review_note"] = "no feedback box found on this submission's page"
        print(f"  ! {label}: {record['review_note']} - draft is in the report file")
        return record

    try:
        box.click()
        box.fill(record["feedback"])
    except Exception as exc:
        record["review_note"] = f"could not type into the feedback box: {exc}"
        print(f"  ! {label}: {record['review_note']}")
        return record

    print(f"  -> {label}: feedback typed in. Waiting for you to click Submit on the site...")
    if portal.wait_for_teacher_submit(page, box):
        record["reviewed"] = datetime.now().isoformat()
        print("     submitted - moving to the next student.")
    else:
        record["review_note"] = "timed out waiting for Submit (30 min) - moved on without it"
        print("     ! no Submit detected after 30 minutes - moving on anyway.")
    return record


def main() -> None:
    config = load_config()
    root = Path(config["download_root"]) if config.get("download_root") else desktop() / "Homework"
    root.mkdir(parents=True, exist_ok=True)
    manifest = Manifest(root)
    # Only a submission the teacher actually clicked ثبت on is truly done.
    # One flagged with a "note" (a failed download, missing OCR tool, etc.)
    # is still pending on the real portal - it must be retried next run,
    # not silently skipped forever because an earlier attempt failed.
    already_done = {i["submission_id"] for i in manifest.items if i.get("reviewed")}

    from playwright.sync_api import sync_playwright

    problems: list[str] = []
    rows: list[dict] = []

    with sync_playwright() as playwright:
        print("Opening Chrome...")
        try:
            browser = playwright.chromium.launch(
                channel="chrome", headless=False, args=["--start-maximized"]
            )
        except Exception as exc:
            sys.exit(
                f"Chrome would not start: {exc}\n\n"
                "If Google Chrome isn't installed, get it from google.com/chrome."
            )
        context = browser.new_context(accept_downloads=True, no_viewport=True)
        page = context.new_page()

        try:
            print("Signing into the portal...")
            ok, message = portal.login(
                page, config["portal"]["login_url"], config["_username"], config["_password"]
            )
            if not ok:
                print(f"\nX Sign-in failed: {message}")
                if "rejected" in message or "did not go through" in message:
                    print("  If the password changed, open Windows Credential")
                    print("  Manager and remove the homework-automation-portal1")
                    print("  entry so you're asked again.")
                context.close()
                browser.close()
                sys.exit(1)
            print("OK - signed in.")

            ok, where = portal.go_to_homework(page, config["portal"].get("homework_url", ""))
            if not ok:
                print(f"\nX {where}")
                print("  Set homework_url in config.json to the pending-list page's URL.")
                context.close()
                browser.close()
                sys.exit(1)
            homework_url = page.url
            print(f"OK - homework list: {homework_url}")
            if not portal.looks_like_pending_list(page):
                print(
                    "  ! This page doesn't look like the pending-review list "
                    "(no 'در انتظار بررسی'/'تائید نشده' text found on it)."
                )
                print(
                    "  ! If nothing gets processed below, set homework_url in "
                    "config.json to the exact pending-review list URL - it's "
                    f"probably not {homework_url}"
                )
            print()

            for _ in range(MAX_SUBMISSIONS_PER_RUN):
                item, error = portal.open_next_pending(page, already_done)
                if error:
                    problems.append(error)
                    print(f"X {error}")
                    break
                if item is None:
                    # Nothing left on this page - if the list is paginated
                    # and there's another page, move to it and keep going
                    # rather than stopping early.
                    if portal.try_advance_page(page):
                        print("  (moved to the next page of the pending list)")
                        continue
                    break

                record = process_one(page, context, item, config, root)
                already_done.add(item["submission_id"])
                manifest.upsert(record)
                rows.append(record)
                if record.get("note"):
                    problems.append(f"{record['student']} - {record['assignment']}: {record['note']}")
                if record.get("review_note"):
                    problems.append(
                        f"{record['student']} - {record['assignment']}: {record['review_note']}"
                    )

                # Back to the (now shorter) pending list for the next one.
                page.goto(homework_url, wait_until="domcontentloaded")
                page.wait_for_timeout(1000)

            print("\nNo more pending submissions found." if not problems else "")
        finally:
            manifest.save()
            try:
                context.close()
                browser.close()
            except Exception:
                pass

    report = write_report(root, rows, problems)
    reviewed = sum(1 for r in rows if r.get("reviewed"))

    print("\n" + "=" * 60)
    print(f"Processed: {len(rows)}   Submitted: {reviewed}")
    print(f"Folder: {root}")
    if problems:
        print(f"Needs a manual look: {len(problems)}")
        for line in problems:
            print(f"  - {line}")
    else:
        print("Everything went through without problems.")
    print(f"Full report (in Persian): {report.name}")
    print("=" * 60)


if __name__ == "__main__":
    main()
