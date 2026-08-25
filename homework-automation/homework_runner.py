"""Open Chrome, sign into the portal, download every homework file, check it,
and print a report. Runs start to finish without stopping to ask anything.

Nothing is ever submitted or saved on the portal - this only reads and
downloads.

Terminal output is kept in English on purpose: the classic Windows Command
Prompt (conhost.exe) that a double-clicked .bat file opens uses a raster
font that has no Persian glyphs, so Persian text there renders as empty
boxes even though it's correct data. The report file written to disk, and
the desktop-icon script's message boxes, use a real font and show Persian
fine - only this console does not.
"""
import json
import sys
from datetime import date, datetime
from pathlib import Path

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


def _stored_credentials() -> tuple[str | None, str | None]:
    """Read the saved username/password from the OS credential store
    (Windows Credential Manager). Nothing touches disk in plain text."""
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
    if not CONFIG_PATH.exists():
        config = json.loads((HERE / "config.example.json").read_text(encoding="utf-8"))
        CONFIG_PATH.write_text(json.dumps(config, indent=2), encoding="utf-8")
    else:
        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))

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
    import re

    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", value).strip().strip(".")
    cleaned = " ".join(cleaned.split())
    return cleaned[:70] or fallback


def download_file(page, item, root: Path) -> tuple[Path | None, str]:
    folder = root / safe_name(item["student"], "نامشخص")
    folder.mkdir(parents=True, exist_ok=True)
    today = date.today().isoformat()
    link = page.locator("a").nth(item["index"])
    try:
        with page.expect_download(timeout=90000) as info:
            link.click()
        result = info.value
        ext = Path(result.suggested_filename).suffix or ".bin"
        target = folder / f"{safe_name(item['assignment'], 'تکلیف')}_{today}{ext}"
        counter = 2
        while target.exists():
            target = folder / f"{safe_name(item['assignment'])}_{today}_{counter}{ext}"
            counter += 1
        result.save_as(str(target))
        return target, ""
    except Exception as exc:
        return None, f"download failed: {exc}"


def write_report(root: Path, rows: list[dict], problems: list[str]) -> Path:
    # The report file itself is Persian - a real editor/Notepad renders it
    # fine, unlike the console.
    lines = [
        "گزارش دانلود تکالیف",
        f"تاریخ: {datetime.now():%Y-%m-%d %H:%M}",
        "=" * 60,
        "",
    ]
    for row in rows:
        lines.append(f"{row['student']}  |  {row['assignment']}")
        lines.append(f"  فایل: {row.get('file', '-')}")
        if row.get("note"):
            lines.append(f"  ⚠ {row['note']}")
        elif row.get("feedback"):
            lines.append("  بازخورد پیشنهادی:")
            lines.append("    " + row["feedback"].replace("\n", "\n    "))
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


def main() -> None:
    config = load_config()
    root = Path(config["download_root"]) if config.get("download_root") else desktop() / "Homework"
    root.mkdir(parents=True, exist_ok=True)
    manifest = Manifest(root)

    from playwright.sync_api import sync_playwright

    downloaded = 0
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
                print("  Set homework_url in config.json to the homework page's URL.")
                context.close()
                browser.close()
                sys.exit(1)
            print(f"OK - homework page: {page.url}")

            items = portal.find_files(page)
            if not items:
                print("\nNo homework files found on this page.")
            print(f"OK - {len(items)} file(s) found.\n")

            for item in items:
                record = manifest.find(item["submission_id"]) or {}
                item = {**item, **record}
                label = f"{item['student']} - {item['assignment']}"

                path = Path(item["file"]) if item.get("file") else None
                if path and path.exists():
                    print(f"  {label}: already downloaded")
                else:
                    path, error = download_file(page, item, root)
                    if not path:
                        problems.append(f"{label}: {error}")
                        print(f"  X {label}: {error}")
                        manifest.upsert({**item, "error": error})
                        rows.append({**item, "note": error})
                        continue
                    downloaded += 1
                    print(f"  OK {label}  ->  {path.relative_to(root)}")
                item["file"] = str(path)

                if not item.get("text") and not item.get("note"):
                    text, note = extract.extract(path, config)
                    item["text"], item["note"] = text, note

                if item.get("note"):
                    problems.append(f"{label}: {item['note']}")
                    print(f"    ! flagged: {item['note']}")
                elif item.get("text") and not item.get("feedback"):
                    item["feedback"] = feedback.draft(
                        item["text"], item["student"], item["assignment"], config
                    )

                manifest.upsert(item)
                rows.append(item)
        finally:
            manifest.save()
            try:
                context.close()
                browser.close()
            except Exception:
                pass

    report = write_report(root, rows, problems)

    print("\n" + "=" * 60)
    print(f"Downloaded: {downloaded}")
    print(f"Folder: {root}")
    if problems:
        print(f"Needs a manual look: {len(problems)}")
        for line in problems:
            print(f"  - {line}")
    else:
        print("Everything was read without problems.")
    print(f"Full report (in Persian): {report.name}")
    print("=" * 60)


if __name__ == "__main__":
    main()
