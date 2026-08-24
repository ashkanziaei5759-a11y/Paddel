"""Run manifest: durable record of every submission seen in a run."""
import json
import os
from datetime import date
from pathlib import Path


def desktop() -> Path:
    for candidate in (
        Path(os.environ.get("USERPROFILE", "")) / "Desktop",
        Path.home() / "Desktop",
        Path.home() / "OneDrive" / "Desktop",
    ):
        if candidate.parent.exists():
            return candidate
    return Path.home() / "Desktop"


class Manifest:
    """A list of submission records, flushed to disk after every mutation.

    Flushing eagerly is deliberate: if the teacher closes the window
    mid-review, the next run can still see what was already done.
    """

    def __init__(self, root: Path):
        self.root = root
        self.path = root / f"run_log_{date.today().isoformat()}.json"
        self.items: list[dict] = []
        if self.path.exists():
            try:
                self.items = json.loads(self.path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                backup = self.path.with_suffix(".corrupt.json")
                self.path.replace(backup)
                print(f"  ! run log was unreadable, moved to {backup.name}")

    def find(self, submission_id: str) -> dict | None:
        return next((i for i in self.items if i["submission_id"] == submission_id), None)

    def upsert(self, record: dict) -> dict:
        existing = self.find(record["submission_id"])
        if existing:
            existing.update(record)
            record = existing
        else:
            self.items.append(record)
        self.save()
        return record

    def save(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps(self.items, indent=2, ensure_ascii=False), encoding="utf-8"
        )
