"""Talking to the specific homework portal seen in screenshots:

- A "پdلیست تکالیف تائید نشده" (pending-review homework list) page: one row
  per submission, with a green "مشاهده تکالیف" button per row.
- Clicking it opens a detail page with the uploaded file(s)
  ("فایل های آپلود شده" / "صوت های ضبط شده"), a feedback textarea
  ("توضیحات شما برای زبان آموز..."), a status dropdown, and a "ثبت" button.
- Submitting normally returns to the pending list, which then has one fewer
  row (the one just handled no longer shows as pending).

Everything still degrades to a keyword/shape search rather than a fixed
selector, since even a confirmed layout can shift a little (new column, a
renamed button) without warning.
"""
import re
from urllib.parse import unquote, urljoin, urlparse

FILE_EXTS = (
    ".pdf", ".doc", ".docx", ".rtf", ".txt",
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tif", ".tiff",
    ".mp3", ".m4a", ".ogg", ".oga", ".opus", ".wav", ".aac", ".amr",
    ".zip", ".rar",
)

HOMEWORK_WORDS = (
    "تکلیف", "تکالیف", "تمرین", "تمرینات", "آپلود", "ارسالی",
    "homework", "assignment", "exercise", "submission", "task",
)
DOWNLOAD_WORDS = ("دانلود", "دریافت", "فایل", "download", "attachment", "file")
LOGGED_OUT_WORDS = ("logout", "signout", "sign-out", "خروج")

# The exact button seen on the real portal, plus generic fallbacks in case
# the wording differs elsewhere (a different class page, a future version).
REVIEW_BUTTON_WORDS = ("مشاهده تکالیف", "مشاهده", "بررسی", "view", "review")
SUBMIT_WORDS = ("ثبت", "ارسال", "ذخیره", "submit", "save", "send")
# The feedback textarea's real placeholder starts with "استاد عزیز" and
# mentions "توضیحات"/"تکالیف" - used to prefer it over any other textarea
# on the page (an upload-notes box, a search box, etc).
FEEDBACK_HINTS = ("توضیحات", "استاد عزیز", "زبان آموز")


def _visible(locator) -> bool:
    try:
        return locator.is_visible()
    except Exception:
        return False


def _text(locator) -> str:
    try:
        return (locator.inner_text() or "").strip()
    except Exception:
        return ""


# --- login -------------------------------------------------------------


def login(page, url: str, username: str, password: str) -> tuple[bool, str]:
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_timeout(1500)

    password_field = None
    for candidate in page.locator("input[type='password']").all():
        if _visible(candidate):
            password_field = candidate
            break
    if password_field is None:
        if _looks_signed_in(page):
            return True, "already signed in"
        return False, "no password box was found on the login page"

    user_field = _username_field_near(page, password_field)
    if user_field is None:
        return False, "found the password box but no username box next to it"

    user_field.fill(username)
    password_field.fill(password)

    submit = _submit_button(page)
    try:
        if submit is not None:
            submit.click()
        else:
            password_field.press("Enter")
        page.wait_for_load_state("networkidle", timeout=30000)
    except Exception:
        page.wait_for_timeout(4000)

    if _looks_signed_in(page):
        return True, "signed in"

    visible_error = _error_text(page)
    if visible_error:
        return False, f"the site rejected the sign-in: {visible_error}"
    return False, "sign-in did not go through (wrong username/password, or the site asked for something extra)"


def _username_field_near(page, password_field):
    inputs = page.locator(
        "input[type='text'], input[type='email'], input[type='tel'], input:not([type])"
    ).all()
    visible = [i for i in inputs if _visible(i)]
    if not visible:
        return None
    try:
        pw_box = password_field.bounding_box()
        above = [i for i in visible if (i.bounding_box() or {}).get("y", 1e9) < pw_box["y"]]
        if above:
            return above[-1]
    except Exception:
        pass
    return visible[0]


def _submit_button(page):
    for selector in ("button[type='submit']", "input[type='submit']", "form button", "button"):
        for candidate in page.locator(selector).all():
            if _visible(candidate):
                return candidate
    return None


def _looks_signed_in(page) -> bool:
    if any(_visible(i) for i in page.locator("input[type='password']").all()):
        return False
    body = (page.inner_text("body") or "").lower()
    return any(word in body for word in LOGGED_OUT_WORDS) or "login" not in page.url.lower()


def _error_text(page) -> str:
    for selector in (".validation-summary-errors", ".alert-danger", ".error", "[role='alert']"):
        node = page.locator(selector).first
        if node.count() and _visible(node):
            text = _text(node)
            if text:
                return " ".join(text.split())[:200]
    return ""


def go_to_homework(page, explicit_url: str) -> tuple[bool, str]:
    if explicit_url:
        page.goto(explicit_url, wait_until="domcontentloaded")
        page.wait_for_timeout(1500)
        return True, explicit_url

    for link in page.locator("a").all():
        text = _text(link)
        if text and any(word in text.lower() for word in HOMEWORK_WORDS):
            try:
                link.click()
                page.wait_for_load_state("networkidle", timeout=20000)
                return True, page.url
            except Exception:
                continue
    return False, "could not find a homework/assignments link in the menu"


# --- the pending-review list --------------------------------------------


def find_pending_reviews(page) -> list[dict]:
    """Every row in the pending list that has a 'مشاهده تکالیف' (or similar)
    button, with the student/class/session text read from its cells."""
    buttons = _review_buttons(page)
    items: list[dict] = []
    for i in range(buttons.count()):
        button = buttons.nth(i)
        row = button.locator("xpath=ancestor::tr[1]")
        if not row.count():
            continue
        cells = [_text(c) for c in row.locator("td").all()]
        student = _pick_cell(cells, 1) or "نامشخص"
        klass = _pick_cell(cells, 2)
        session = _pick_cell(cells, 4)
        submit_time = _pick_cell(cells, 5)
        assignment = f"جلسه {session} - {klass}".strip(" -") if (session or klass) else "تکلیف"
        items.append(
            {
                "submission_id": "|".join([student, klass, session, submit_time]),
                "student": student,
                "class": klass,
                "assignment": assignment,
            }
        )
    return items


def _review_buttons(page):
    """Links or buttons whose visible text matches the review-button words,
    tried most-specific phrase first."""
    for phrase in REVIEW_BUTTON_WORDS:
        found = page.locator("a, button").filter(has_text=phrase)
        if found.count():
            return found
    return page.locator("a, button").filter(has_text="مشاهده")


def _pick_cell(cells: list[str], index: int) -> str:
    return cells[index] if 0 <= index < len(cells) else ""


def open_next_pending(page, already_done: set[str]) -> tuple[dict | None, str]:
    """Re-read the pending list fresh and click into the first row not
    already handled this run. Re-reading each time (rather than working off
    a stale list) is what lets this notice the list shrinking as items get
    submitted."""
    items = find_pending_reviews(page)
    remaining = [i for i in items if i["submission_id"] not in already_done]
    if not remaining:
        return None, ""

    target = remaining[0]
    buttons = _review_buttons(page)
    for i in range(buttons.count()):
        button = buttons.nth(i)
        row = button.locator("xpath=ancestor::tr[1]")
        cells = [_text(c) for c in row.locator("td").all()] if row.count() else []
        row_id = "|".join(
            [_pick_cell(cells, 1), _pick_cell(cells, 2), _pick_cell(cells, 4), _pick_cell(cells, 5)]
        )
        if row_id == target["submission_id"]:
            try:
                button.click()
                page.wait_for_load_state("networkidle", timeout=20000)
                return target, ""
            except Exception as exc:
                return None, f"could not open the review page: {exc}"
    return None, "matched a pending row but lost it before clicking - portal may have refreshed"


# --- the detail/review page ----------------------------------------------


# Site-asset paths that happen to end in an image extension but are never
# a student's submission (logos, icons, background art). Filtered out of
# the raw-HTML fallback scan only, since the DOM walk already only looks at
# elements that are plausibly "the submitted file".
ASSET_PATH_HINTS = ("logo", "icon", "favicon", "/assets/", "/static/", "/img/site", "sprite")

FILE_URL_IN_HTML = re.compile(
    r"""(?:href|src|data-(?:src|url|file|href))\s*=\s*["']([^"']+\.(?:"""
    + "|".join(ext.lstrip(".") for ext in FILE_EXTS)
    + r"""))["']""",
    re.IGNORECASE,
)


def find_submission_files(page) -> list[str]:
    """Absolute URLs of every uploaded file on the currently open detail
    page (photos, PDFs, voice recordings).

    An uploaded image is often shown as a thumbnail with no plain
    <a href="...">, opened through a lightbox/JS click instead - so this
    doesn't only look at anchors. It walks every element that can carry a
    file URL (links, images, audio/video sources), then falls back to a
    raw-HTML regex scan to catch anything baked into an onclick handler or
    a data-* attribute this script doesn't know the name of.
    """
    found: list[str] = []
    seen: set[str] = set()

    for selector, attr in (
        ("a[href]", "href"),
        ("img[src]", "src"),
        ("source[src]", "src"),
        ("video[src]", "src"),
        ("audio[src]", "src"),
        ("[data-src]", "data-src"),
        ("[data-url]", "data-url"),
        ("[data-file]", "data-file"),
        ("[data-href]", "data-href"),
    ):
        for el in page.locator(selector).all():
            value = el.get_attribute(attr) or ""
            if not value or value.startswith(("data:", "javascript:", "#", "mailto:")):
                continue
            if not _is_file_url(value):
                continue
            absolute = urljoin(page.url, value)
            if absolute not in seen:
                seen.add(absolute)
                found.append(absolute)

    if not found:
        try:
            html = page.content()
        except Exception:
            html = ""
        for match in FILE_URL_IN_HTML.finditer(html):
            value = match.group(1)
            if any(hint in value.lower() for hint in ASSET_PATH_HINTS):
                continue
            absolute = urljoin(page.url, value)
            if absolute not in seen:
                seen.add(absolute)
                found.append(absolute)

    return found


def _is_file_url(value: str) -> bool:
    path = unquote(urlparse(value).path).lower()
    return path.endswith(FILE_EXTS)


def feedback_box(page):
    """The textarea the teacher writes feedback into. Prefers one whose
    placeholder matches the real portal's wording, so a stray textarea
    elsewhere on the page (a search box, an upload-notes field) isn't
    picked by mistake."""
    boxes = [b for b in page.locator("textarea").all() if _visible(b)]
    if not boxes:
        return None
    for box in boxes:
        placeholder = (box.get_attribute("placeholder") or "")
        if any(hint in placeholder for hint in FEEDBACK_HINTS):
            return box
    return boxes[0]


def find_submit_button(page):
    for selector in ("button", "input[type='submit']", "input[type='button']"):
        for candidate in page.locator(selector).all():
            if not _visible(candidate):
                continue
            try:
                text = (candidate.inner_text() or candidate.get_attribute("value") or "").strip()
            except Exception:
                continue
            if text in SUBMIT_WORDS or any(word in text.lower() for word in SUBMIT_WORDS):
                return candidate
    return None


def wait_for_teacher_submit(page, box, timeout_ms: int = 30 * 60 * 1000) -> bool:
    """Block until the teacher clicks ثبت herself: the page navigating away
    (the normal case - it returns to the pending list) or the feedback box
    disappearing/becoming disabled both count. Never clicks Submit itself."""
    start_url = page.url
    elapsed = 0
    interval = 500
    while elapsed < timeout_ms:
        try:
            if page.url != start_url:
                return True
            if box is not None:
                still_there = False
                try:
                    still_there = box.is_visible() and box.is_enabled()
                except Exception:
                    still_there = False
                if not still_there:
                    return True
        except Exception:
            return True
        page.wait_for_timeout(interval)
        elapsed += interval
    return False
