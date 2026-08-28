"""Draft feedback for one submission.

Two backends:
  "anthropic"  - uses the Claude API (needs ANTHROPIC_API_KEY). Much better
                 prose. Recommended when a key is available.
  "heuristic"  - fully offline. Spots a few common patterns and assembles a
                 draft from them. It is a starting point for the teacher to
                 edit, not a finished comment.
"""
import os
import random
import re

VOICE = """You are drafting feedback for an adult ESL teacher to review and edit.

The students are adult learners, intermediate to advanced, many preparing for
IELTS around 6.5-7.0. Their weak spots are writing, speaking, grammar and
confidence, and anxiety sits under most of it.

Rules for the draft:
- Open with one specific, genuine thing that worked. Name the actual sentence,
  word choice or idea. Never generic praise.
- Then the corrections. Be direct but warm. Normalise the mistake - it is a
  normal stage, not a failure. Cover both grammar (tense, articles, word
  order) and, when the submission is a transcribed voice message, anything
  the transcript suggests about pronunciation or fluency (repeated
  self-corrections, filler words, words the transcriber flagged as unclear).
- Point out the pattern, not every instance. If a tense slips five times, say
  so once and give one example.
- If nothing worth correcting stands out, don't invent a problem - say so
  plainly and warmly, using a phrase like "well done", "way to go", or
  "excellent work" rather than a generic "good job".
- No scores, no band numbers, no grading language.
- Short enough that a student will actually read it: 80-150 words.
- Write in the teacher's voice, second person, plain English.
"""

# Used only when the heuristic drafter finds nothing worth correcting -
# rotated so a run of clean submissions doesn't read as a copy-paste.
PRAISE_PHRASES = ("Well done", "Way to go", "Excellent work", "Great job")


def draft(text: str, student: str, assignment: str, config: dict, has_audio: bool = False) -> str:
    backend = config.get("feedback", {}).get("backend", "heuristic")
    if backend == "anthropic":
        try:
            return _anthropic(text, student, assignment, config, has_audio)
        except Exception as exc:
            print(f"  ! Claude API drafting failed ({exc}); using the offline drafter")
    return _heuristic(text, student, has_audio)


def _anthropic(text: str, student: str, assignment: str, config: dict, has_audio: bool) -> str:
    import anthropic

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError("ANTHROPIC_API_KEY is not set")
    client = anthropic.Anthropic()
    source_note = (
        "Part of this submission is a transcribed voice message - the transcript "
        "reflects hesitations, self-corrections and unclear words as actually spoken, "
        "so treat repeated fillers or restarts as a fluency/pronunciation signal, not "
        "just a writing one.\n\n"
        if has_audio
        else ""
    )
    message = client.messages.create(
        model=config["feedback"].get("anthropic_model", "claude-opus-5"),
        max_tokens=600,
        system=VOICE,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Student: {student}\nAssignment: {assignment}\n\n"
                    f"{source_note}"
                    f"Their submission:\n---\n{text[:12000]}\n---\n\n"
                    "Write the feedback comment only, no preamble."
                ),
            }
        ],
    )
    return "".join(b.text for b in message.content if b.type == "text").strip()


# --- offline drafter -------------------------------------------------------

PAST_MARKERS = re.compile(
    r"\b(yesterday|last (week|year|month|night)|ago|in \d{4}|when I was)\b", re.I
)
PRESENT_VERB = re.compile(r"\b(is|are|go|goes|come|comes|say|says|take|takes|make|makes)\b", re.I)
MISSING_ARTICLE = re.compile(
    r"\b(?:in|on|at|to|for|with|about)\s+(?!the|a|an|my|his|her|their|our|your|this|that|these|those|it|them|me|him|us|you|\d)[a-z]+\b"
)
FILLERS = re.compile(r"\b(very|really|a lot of|so much|things|stuff|good|bad|nice)\b", re.I)
# In a speech transcript these are hesitation/fluency signals, not writing
# fillers - a transcriber tends to catch "um"/"uh" verbatim, and immediate
# word repeats ("I I think", "the the") usually mean a false start or a
# stumble rather than a typo.
HESITATION = re.compile(r"\b(um+|uh+|erm+)\b", re.I)
REPEATED_WORD = re.compile(r"\b(\w+)\s+\1\b", re.I)


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]


def _heuristic(text: str, student: str, has_audio: bool = False) -> str:
    sentences = _sentences(text)
    words = re.findall(r"[A-Za-z']+", text)
    notes: list[str] = []

    if has_audio:
        hesitations = HESITATION.findall(text)
        repeats = REPEATED_WORD.findall(text)
        if len(hesitations) + len(repeats) >= 3:
            notes.append(
                "In the voice message there's a fair bit of hesitating and "
                "restarting mid-sentence. That's completely normal when "
                "speaking in a second language - it usually settles down "
                "once you slow down slightly and plan the sentence one "
                "clause at a time before starting it."
            )

    if PAST_MARKERS.search(text) and PRESENT_VERB.search(text):
        notes.append(
            "There are a few places where a past-tense story slips into the present "
            "tense mid-sentence. It's one of the most common things at your level - "
            "worth reading back through just for verbs before you hand something in."
        )

    missing = MISSING_ARTICLE.findall(text)
    if len(missing) >= 3:
        notes.append(
            "Articles (a / an / the) go missing in a handful of places. It's a pattern "
            "rather than a slip, and it's the single fastest thing to tighten up."
        )

    long_ones = [s for s in sentences if len(s.split()) > 35]
    if len(long_ones) >= 2:
        notes.append(
            "A couple of sentences run long enough that the main idea gets buried. "
            "Try splitting the longest ones in two - your point lands harder."
        )

    fillers = FILLERS.findall(text)
    if len(fillers) >= 5:
        notes.append(
            "Some general words ('very', 'good', 'things') repeat. Swapping even two "
            "or three of them for something more precise lifts the whole piece."
        )

    # Quote a clean sentence, not just the longest one - praising a line that
    # contains the very errors being corrected reads as careless.
    clean = [
        s
        for s in sentences
        if 8 <= len(s.split()) <= 28 and not FILLERS.search(s)
    ]
    longest = max(clean or sentences, key=lambda s: len(s.split())) if sentences else ""
    opener = (
        f'Nice work on this, {student}. This line in particular does its job: "{_clip(longest)}" '
        f"- the idea is clear and you carried it through."
        if longest
        else f"Thanks for sending this in, {student}."
    )

    clean_submission = not notes
    if clean_submission:
        praise = random.choice(PRAISE_PHRASES)
        notes.append(
            f"{praise} - nothing here is jumping out as a recurring problem, "
            "which is a good sign. Keep writing at this length."
        )

    body = " ".join(notes[:2])
    close = (
        "Keep it up."
        if clean_submission
        else "None of this is a step backwards - it's the normal next thing to work on."
    )
    stats = f"[offline draft from ~{len(words)} words - please edit before saving]"
    return f"{opener}\n\n{body}\n\n{close}\n\n{stats}"


def _clip(sentence: str, limit: int = 90) -> str:
    return sentence if len(sentence) <= limit else sentence[:limit].rstrip() + "..."
