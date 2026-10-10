#!/usr/bin/env python3
"""Bella Betting – daily site updater (no dependencies, Python 3.8+).

Usage
  python3 update_tips.py                      # copy today's (Sydney) ../tips/YYYY-MM-DD.json into site/tips/
  python3 update_tips.py 2026-10-11           # copy a specific date from ../tips/
  python3 update_tips.py path/to/file.json    # copy a specific file (its "date" field names it)
  python3 update_tips.py --reindex            # only rebuild site/tips/index.json
  python3 update_tips.py result 2026-10-10 "Sheza Alibi" won 1.22
                                              # record a result (won|lost|placed|scratched, settled odds)

Behaviour
  * Validates the JSON (date, selections with required fields).
  * Keeps any results already recorded in the site copy when a card is re-copied.
  * Rebuilds site/tips/index.json: {"generated_at", "dates": [newest first], "days": [...]}
  * Never publishes or pushes anything; it only edits files under site/tips/.
"""
import json, re, shutil, sys
from datetime import datetime
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
    SYD = ZoneInfo("Australia/Sydney")
except Exception:  # pragma: no cover
    SYD = None

SITE = Path(__file__).resolve().parent
SITE_TIPS = SITE / "tips"
VAULT_TIPS = SITE.parent / "tips"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
REQUIRED = ["event", "start_time_aedt", "selection", "reasoning", "confidence", "best_odds", "odds_source", "odds_checked_at"]
OUTCOMES = {"won", "lost", "placed", "scratched"}
BANNED = [r"\block\b", r"sure thing", r"guarantee(d)?\s+(win|winner|profit)", r"can'?t lose", r"risk[- ]free",
          r"bonus bet", r"free bet", r"sign[- ]?up", r"deposit match", r"make money", r"easy money"]


def now_syd():
    return datetime.now(SYD) if SYD else datetime.now()


def die(msg):
    print("ERROR: " + msg, file=sys.stderr)
    sys.exit(1)


def validate(data, src):
    date = data.get("date")
    if not isinstance(date, str) or not DATE_RE.match(date):
        die(f"{src}: missing/invalid 'date' (YYYY-MM-DD)")
    sels = data.get("selections")
    if not isinstance(sels, list) or not sels:
        die(f"{src}: 'selections' must be a non-empty list")
    for i, s in enumerate(sels, 1):
        missing = [k for k in REQUIRED if not s.get(k)]
        if missing:
            die(f"{src}: selection {i} missing {', '.join(missing)}")
    for i, r in enumerate(data.get("roughies") or [], 1):
        missing = [k for k in ("event", "start_time_aedt", "horse", "win_odds", "odds_source", "odds_checked_at") if r.get(k) in (None, "")]
        if missing:
            die(f"{src}: roughie {i} missing {', '.join(missing)}")
    # Compliance lint: block obvious prohibited wording before it reaches the site.
    text = json.dumps(data, ensure_ascii=False).lower()
    text = re.sub(r"(is )?not a (way|means) to make money", "", text)  # allow the standard disclaimer
    hits = [p for p in BANNED if re.search(p, text)]
    if hits:
        die(f"{src}: contains wording not allowed on the site: {hits}. Edit the card and retry.")
    return date


def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def save(p, data):
    tmp = p.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    tmp.replace(p)


def merge_results(new, old):
    old_by_sel = {s.get("selection"): s.get("result") for s in old.get("selections", []) if s.get("result")}
    for s in new.get("selections", []):
        if "result" not in s and s.get("selection") in old_by_sel:
            s["result"] = old_by_sel[s["selection"]]


def reindex():
    SITE_TIPS.mkdir(parents=True, exist_ok=True)
    days = []
    for p in SITE_TIPS.glob("*.json"):
        if not DATE_RE.match(p.stem):
            continue
        try:
            d = load(p)
        except Exception as e:
            print(f"WARN: skipping unreadable {p.name}: {e}", file=sys.stderr)
            continue
        sels = d.get("selections", [])
        days.append({
            "date": p.stem,
            "selections": len(sels),
            "results_recorded": sum(1 for s in sels if (s.get("result") or {}).get("outcome")),
            "generated_at": d.get("generated_at"),
        })
    days.sort(key=lambda x: x["date"], reverse=True)
    manifest = {"generated_at": now_syd().isoformat(timespec="seconds"), "dates": [d["date"] for d in days], "days": days}
    save(SITE_TIPS / "index.json", manifest)
    print(f"index.json rebuilt: {len(days)} day(s); newest {days[0]['date'] if days else '-'}")


def copy_card(arg):
    if arg is None:
        src = VAULT_TIPS / f"{now_syd():%Y-%m-%d}.json"
    elif DATE_RE.match(arg):
        src = VAULT_TIPS / f"{arg}.json"
    else:
        src = Path(arg)
    if not src.is_file():
        die(f"tips file not found: {src}")
    data = load(src)
    date = validate(data, src)
    dest = SITE_TIPS / f"{date}.json"
    SITE_TIPS.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        merge_results(data, load(dest))
        save(dest, data)
    elif any(s.get("result") for s in data["selections"]):
        save(dest, data)
    else:
        shutil.copyfile(src, dest)
    print(f"copied {src} -> {dest}")
    reindex()


def record_result(date, selection, outcome, odds=None):
    outcome = outcome.lower()
    if outcome not in OUTCOMES:
        die(f"outcome must be one of {sorted(OUTCOMES)}")
    p = SITE_TIPS / f"{date}.json"
    if not p.is_file():
        die(f"no site card for {date}")
    data = load(p)
    matches = [s for s in data["selections"] if s["selection"].lower().startswith(selection.lower())]
    if len(matches) != 1:
        die(f"'{selection}' matched {len(matches)} selections on {date}")
    res = {"outcome": outcome, "recorded_at": now_syd().isoformat(timespec="seconds")}
    if odds is not None:
        res["settled_odds"] = float(odds)
    elif outcome == "won":
        die("a winning result needs the settled odds, e.g. ... won 2.15")
    matches[0]["result"] = res
    save(p, data)
    print(f"recorded {outcome} for {matches[0]['selection']} on {date}")
    reindex()


def main(argv):
    if argv and argv[0] in ("-h", "--help"):
        print(__doc__)
    elif argv and argv[0] == "--reindex":
        reindex()
    elif argv and argv[0] == "result":
        if len(argv) not in (4, 5):
            die('usage: update_tips.py result YYYY-MM-DD "Selection" won|lost|placed|scratched [odds]')
        record_result(*argv[1:])
    else:
        copy_card(argv[0] if argv else None)


if __name__ == "__main__":
    main(sys.argv[1:])
