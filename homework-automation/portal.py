"""Finding things on the portal without being told where they are.

The portal's HTML is not known ahead of time, so nothing here relies on a
hand-written CSS selector. Each function looks for the thing by what it *is*
- a password field is an input of type password, a homework file is a link
that points at a file - and reports honestly when it cannot find it.
"""
import re
from urllib.parse import unquote, urlparse

FILE_EXTS = (
    ".pdf", ".doc", ".docx", ".rtf", ".txt",
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tif", ".tiff",
    ".mp3", ".m4a", ".ogg", ".oga", ".opus", ".wav", ".aac", ".amr",
    ".zip", ".rar",
)

# Words that mark a link as "this is the homework section", in English and
# Persian. The portal is Persian-language, so both matter.
HOMEWORK_WORDS = (
    "تکلیف", "تکالیف", "تمرین", "تمرینات", "آپلود", "ارسالی",
    "homework", "assignment", "exercise", "submission", "task",
)
DOWNLOAD_WORDS = ("دانلود", "دریافت", "فایل", "download", "attachment", "file")
LOGGED_OUT_WORDS = ("logout", "signout", "sign-out", "خروج")


def _visible(locator) -> bool:
    try:
        return locator.is_visible()
    except Exception:
        return False


def login(page, url: str, username: str, password: str) -> tuple[bool, str]:
    """Fill in the login form and submit it. Returns (ok, message)."""
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

    # Still on a page with a password box means the credentials bounced, or
    # the site wants something extra (a code, a captcha).
    visible_error = _error_text(page)
    if visible_error:
        return False, f"the site rejected the sign-in: {visible_error}"
    return False, "sign-in did not go through (wrong username/password, or the site asked for something extra)"


def _username_field_near(page, password_field):
    """The username box is the visible text input that comes before the
    password box in the document."""
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
    for selector in (
        "button[type='submit']",
        "input[type='submit']",
        "form button",
        "button",
    ):
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
            text = (node.inner_text() or "").strip()
            if text:
                return " ".join(text.split())[:200]
    return ""


def go_to_homework(page, explicit_url: str) -> tuple[bool, str]:
    """Reach the homework section: use the configured URL if there is one,
    otherwise follow the menu link that looks like homework."""
    if explicit_url:
        page.goto(explicit_url, wait_until="domcontentloaded")
        page.wait_for_timeout(1500)
        return True, explicit_url

    for link in page.locator("a").all():
        try:
            text = (link.inner_text() or "").strip()
        except Exception:
            continue
        if text and any(word in text.lower() for word in HOMEWORK_WORDS):
            try:
                link.click()
                page.wait_for_load_state("networkidle", timeout=20000)
                return True, page.url
            except Exception:
                continue
    return False, "could not find a homework/assignments link in the menu"


def find_files(page) -> list[dict]:
    """Every link on the page that points at a downloadable file, with
    whatever student and assignment text sits around it."""
    found: list[dict] = []
    seen: set[str] = set()

    for index, link in enumerate(page.locator("a").all()):
        try:
            href = link.get_attribute("href") or ""
            text = " ".join((link.inner_text() or "").split())
        except Exception:
            continue
        if not href or href.startswith(("#", "javascript:", "mailto:")):
            continue
        if not _is_file_link(href, text):
            continue
        if href in seen:
            continue
        seen.add(href)

        context = _row_text(link)
        found.append(
            {
                "submission_id": href,
                "url": href,
                "index": index,
                "link_text": text,
                "student": _guess_student(context, text),
                "assignment": _guess_assignment(context, text, href),
                "context": context,
            }
        )
    return found


def _is_file_link(href: str, text: str) -> bool:
    path = unquote(urlparse(href).path).lower()
    if path.endswith(FILE_EXTS):
        return True
    haystack = f"{href} {text}".lower()
    return any(word in haystack for word in DOWNLOAD_WORDS)


def _row_text(link) -> str:
    """Text of the table row (or nearest block) the link sits in - that is
    where the student's name usually is."""
    for ancestor in ("tr", "li", "div"):
        try:
            node = link.locator(f"xpath=ancestor::{ancestor}[1]")
            if node.count():
                text = " ".join((node.inner_text() or "").split())
                if 3 < len(text) < 400:
                    return text
        except Exception:
            continue
    return ""


PERSIAN_NAME = re.compile(r"[؀-ۿ]{2,}(?:\s+[؀-ۿ]{2,}){1,2}")
LATIN_NAME = re.compile(r"\b[A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20}){1,2}\b")


def _guess_student(context: str, link_text: str) -> str:
    """Names are the one thing worth guessing at, since folders are named
    after them. A wrong guess is visible in the report and easy to fix."""
    for pattern in (PERSIAN_NAME, LATIN_NAME):
        for match in pattern.findall(context):
            if not any(word in match.lower() for word in DOWNLOAD_WORDS + HOMEWORK_WORDS):
                return match.strip()
    return "نامشخص"


def _guess_assignment(context: str, link_text: str, href: str) -> str:
    filename = unquote(urlparse(href).path).rsplit("/", 1)[-1]
    stem = filename.rsplit(".", 1)[0]
    if stem and len(stem) > 2 and not stem.isdigit():
        return stem
    if link_text and not any(word in link_text.lower() for word in DOWNLOAD_WORDS):
        return link_text
    return "تکلیف"
