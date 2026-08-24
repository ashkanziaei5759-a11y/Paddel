"""Download pending homework, draft feedback, and hand each one to the teacher.

Nothing is ever submitted on the portal by this script. It types a draft into
the feedback box and stops; clicking Save is the teacher's action.

  python homework_runner.py            normal run
  python homework_runner.py --inspect  dump page structure to help fill in
                                       the selectors in config.json
"""
import argparse
import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

import extract
import feedback
from manifest import Manifest, desktop

HERE = Path(__file__).parent
CONFIG_PATH = HERE / "config.json"


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        sys.exit(
            f"No config.json found.\n"
            f"Copy config.example.json to config.json and fill in "
            f"chrome_profile_dir first. See README.md."
        )
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    profile = config.get("chrome_profile_dir")
    if not profile or "YOURNAME" in profile:
        sys.exit(
            "chrome_profile_dir in config.json still has the placeholder in it.\n"
            "Set it to the dedicated 'Homework Bot' Chrome profile folder "
            "(see README.md, Step 1)."
        )
    if not Path(profile).exists():
        sys.exit(
            f"The Chrome profile folder does not exist:\n  {profile}\n"
            "Create the 'Homework Bot' profile in Chrome first and log into the "
            "portal once in it so Chrome saves the password."
        )
    return config


def safe_name(value: str, fallback: str = "unknown") -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", value).strip().strip(".")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned[:80] or fallback


def pause(message: str) -> None:
    print(f"\n{message}")
    try:
        input("   Press Enter here to continue... ")
    except EOFError:
        print("   (no terminal input available, continuing)")


# --- browser ---------------------------------------------------------------


def launch(playwright, config):
    return playwright.chromium.launch_persistent_context(
        user_data_dir=config["chrome_profile_dir"],
        channel="chrome",          # the teacher's real Chrome, so autofill works
        headless=False,            # she has to see and edit the feedback anyway
        accept_downloads=True,
        no_viewport=True,
        args=["--start-maximized"],
    )


def ensure_logged_in(page, config) -> None:
    selectors = config["selectors"]
    page.goto(config["portal"]["login_url"], wait_until="domcontentloaded")
    page.wait_for_timeout(2500)  # give Chrome a moment to autofill

    if page.locator(selectors["logged_in_marker"]).count():
        print("Already signed in.")
        return

    login_button = page.locator(selectors["login_button"]).first
    if login_button.count():
        try:
            login_button.click(timeout=5000)
            page.wait_for_load_state("networkidle", timeout=20000)
        except Exception:
            pass  # fall through to the manual prompt below

    if page.locator(selectors["logged_in_marker"]).count():
        print("Signed in.")
        return

    pause(
        "Could not confirm sign-in automatically. This happens when Chrome did not\n"
        "autofill, or the site is asking for a code or a CAPTCHA.\n"
        "Please sign in yourself in the Chrome window that just opened."
    )


# --- scraping --------------------------------------------------------------


def collect_submissions(page, config) -> list[dict]:
    selectors = config["selectors"]
    page.goto(config["portal"]["homework_url"], wait_until="domcontentloaded")
    page.wait_for_timeout(1500)

    rows = page.locator(selectors["submission_row"])
    count = rows.count()
    if count == 0:
        print(
            "\nNo homework rows matched the selector:\n"
            f"  {selectors['submission_row']}\n"
            "Either there is nothing pending, or the page layout is different from\n"
            "what config.json expects. Run with --inspect to see the real structure."
        )
        return []

    found = []
    for index in range(count):
        row = rows.nth(index)
        link = row.locator(selectors["download_link"]).first
        href = link.get_attribute("href") if link.count() else None
        if not href:
            continue  # a header row, or a submission with no attached file
        found.append(
            {
                "submission_id": href,
                "row_index": index,
                "student": _cell(row, selectors["student_name"], f"Student {index + 1}"),
                "assignment": _cell(row, selectors["assignment_title"], "Assignment"),
                "date": _cell(row, selectors["submission_date"], date.today().isoformat()),
                "url": href,
            }
        )
    print(f"Found {len(found)} submission(s) with a file attached.")
    return found


def _cell(row, selector: str, fallback: str) -> str:
    cell = row.locator(selector).first
    if not cell.count():
        return fallback
    return (cell.inner_text() or "").strip() or fallback


def download(page, item, root: Path, config) -> tuple[Path | None, str]:
    selectors = config["selectors"]
    row = page.locator(selectors["submission_row"]).nth(item["row_index"])
    link = row.locator(selectors["download_link"]).first
    folder = root / safe_name(item["student"])
    folder.mkdir(parents=True, exist_ok=True)
    try:
        with page.expect_download(timeout=60000) as download_info:
            link.click()
        result = download_info.value
        ext = Path(result.suggested_filename).suffix or ".bin"
        target = folder / f"{safe_name(item['assignment'])}_{safe_name(item['date'])}{ext}"
        result.save_as(str(target))
        return target, ""
    except Exception as exc:
        return None, f"download failed: {exc}"


# --- review ----------------------------------------------------------------


def review(page, item, config) -> None:
    selectors = config["selectors"]
    try:
        page.goto(item["url"], wait_until="domcontentloaded")
        page.wait_for_timeout(1000)
        box = page.locator(selectors["feedback_box"]).first
        if box.count():
            box.click()
            box.fill(item["feedback"])
            typed = True
        else:
            typed = False
    except Exception as exc:
        print(f"  ! could not open the feedback box: {exc}")
        typed = False

    print(f"\n  {item['student']} - {item['assignment']}")
    if typed:
        print("  The draft is in the feedback box in Chrome. Read it, edit anything")
        print("  you like, then click Save on the site yourself.")
    else:
        print("  The feedback box was not found, so nothing was typed. Here is the")
        print("  draft to paste in yourself:\n")
        print("  " + item["feedback"].replace("\n", "\n  "))
    pause("  When you are done with this one:")


# --- inspect ---------------------------------------------------------------


def inspect(page, config) -> None:
    page.goto(config["portal"]["homework_url"], wait_until="domcontentloaded")
    pause(
        "Navigate the Chrome window to the page with the pending homework list.\n"
        "When it is on screen, come back here."
    )
    out = HERE / "inspect_dump.html"
    out.write_text(page.content(), encoding="utf-8")
    print(f"\nSaved the page HTML to {out}")
    print(f"URL: {page.url}")
    for label, selector in (
        ("tables", "table"),
        ("table rows", "table tbody tr"),
        ("textareas", "textarea"),
        ("links with 'download' in href", "a[href*='ownload']"),
    ):
        print(f"  {label}: {page.locator(selector).count()}")
    print("\nOpen inspect_dump.html, find the real row/cell/link/textarea markup,")
    print("and put matching selectors into config.json under \"selectors\".")


# --- main ------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inspect", action="store_true", help="dump page structure and exit")
    args = parser.parse_args()

    config = load_config()
    root = Path(config["download_root"]) if config.get("download_root") else desktop() / "Homework"
    manifest = Manifest(root)

    from playwright.sync_api import sync_playwright

    downloaded = drafted = 0
    flagged: list[str] = []

    with sync_playwright() as playwright:
        try:
            context = launch(playwright, config)
        except Exception as exc:
            sys.exit(
                f"Chrome would not start: {exc}\n\n"
                "The usual cause is that this Chrome profile is already open in "
                "another window. Close it and run again."
            )
        page = context.pages[0] if context.pages else context.new_page()
        try:
            ensure_logged_in(page, config)
            if args.inspect:
                inspect(page, config)
                return

            items = collect_submissions(page, config)

            for item in items:
                record = manifest.find(item["submission_id"]) or {}
                if record.get("reviewed"):
                    print(f"  skipping {item['student']} - already done this run")
                    continue
                item = {**item, **record}

                print(f"\n{item['student']} - {item['assignment']}")

                path = Path(item["file"]) if item.get("file") else None
                if not path or not path.exists():
                    path, error = download(page, item, root, config)
                    if not path:
                        flagged.append(f"{item['student']} / {item['assignment']}: {error}")
                        print(f"  ! {error}")
                        manifest.upsert({**item, "error": error})
                        continue
                    downloaded += 1
                    print(f"  saved to {path.relative_to(root)}")
                item["file"] = str(path)

                if not item.get("text"):
                    text, note = extract.extract(path, config)
                    item["text"] = text
                    item["note"] = note
                    if note:
                        flagged.append(f"{item['student']} / {item['assignment']}: {note}")
                        print(f"  ! {note} - no feedback drafted, please look at this one")
                        manifest.upsert(item)
                        continue

                if not item.get("feedback"):
                    item["feedback"] = feedback.draft(
                        item["text"], item["student"], item["assignment"], config
                    )
                    drafted += 1
                manifest.upsert(item)
                review(page, item, config)
                manifest.upsert({**item, "reviewed": datetime.now().isoformat()})
        finally:
            manifest.save()
            try:
                context.close()
            except Exception:
                pass

    print("\n" + "-" * 60)
    print(f"Downloaded: {downloaded}    Feedback drafted: {drafted}")
    if flagged:
        print(f"Needs your eyes ({len(flagged)}):")
        for line in flagged:
            print(f"  - {line}")
    else:
        print("Nothing was flagged.")
    print(f"Run log: {manifest.path}")


if __name__ == "__main__":
    main()
