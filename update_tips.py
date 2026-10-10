#!/usr/bin/env python3
"""Bella Betting – daily site updater (no dependencies, Python 3.8+).

MEMBERS-ONLY (since 10 Oct 2026): full cards are NOT published in this public repo any more.
  * Full cards (with results) are kept privately in ../cards/YYYY-MM-DD.json and uploaded to the members store
    (Twilio Sync map 'tips' + doc 'tips_index' in service bella-betting-members), served to logged-in members by /member.
  * The public site only gets data/teaser.json (date, counts, meetings; no selections) and data/results.json
    (settled main selections only, after results are recorded) for the public Results/ROI page.

Usage
  python3 update_tips.py                      # today's (Sydney) ../tips/YYYY-MM-DD.json -> ../cards/, Sync, public teaser/results
  python3 update_tips.py 2026-10-11           # copy a specific date from ../tips/
  python3 update_tips.py path/to/file.json    # copy a specific file (its "date" field names it)
  python3 update_tips.py --reindex            # only rebuild site/tips/index.json
  python3 update_tips.py result 2026-10-10 "Sheza Alibi" won 1.22
                                              # record a result (won|lost|placed|scratched, settled odds)

Behaviour
  * Validates the JSON (date, selections with required fields).
  * Keeps any results already recorded in the site copy when a card is re-copied.
  * Rebuilds the manifest {"generated_at", "dates": [newest first], "days": [...]} (uploaded as Sync doc 'tips_index').
  * Never pushes git; it edits ../cards/, site/data/ and the members store (Sync) only.
"""
import base64, gzip, json, re, shutil, sys, urllib.error, urllib.parse, urllib.request
from datetime import datetime
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
    SYD = ZoneInfo("Australia/Sydney")
except Exception:  # pragma: no cover
    SYD = None

SITE = Path(__file__).resolve().parent
# MEMBERS_ONLY=False (main, until Twilio AU SMS registration is approved): cards stay public in site/tips/ as before,
# AND are uploaded to the members store so the phone agent has them. Branch 'members-only-tips' sets True.
MEMBERS_ONLY = False
SITE_TIPS = (SITE.parent / "cards") if MEMBERS_ONLY else (SITE / "tips")
SITE_DATA = SITE / "data"                   # public: teaser.json + results.json
TWILIO_ENV = Path("/workspace/project-vaults/MatchMyAgent/secrets/twilio-api.env")
MEMBERS_DEPLOY = SITE.parent / "members" / "last_deploy.json"
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
    SPORT_REQ = ("sport", "competition", "event", "start_time_aedt", "market", "selection", "reasoning",
                 "confidence", "best_odds", "odds_source", "odds_checked_at")
    sports = data.get("sports")
    if sports is not None and not isinstance(sports, list):
        die(f"{src}: 'sports' must be a list")
    for i, s in enumerate(sports or [], 1):
        missing = [k for k in SPORT_REQ if s.get(k) in (None, "")]
        if missing:
            die(f"{src}: sport selection {i} missing {', '.join(missing)}")
        if not re.match(r"^\d{1,2}:\d{2}$", str(s["start_time_aedt"])):
            die(f"{src}: sport selection {i} start_time_aedt must be HH:MM (AEDT)")
        mk = (s.get("market", "") + " " + s.get("selection", "")).lower()
        if re.search(r"in[- ]?play|\blive\b|cash ?out", mk):
            die(f"{src}: sport selection {i} looks like an in-play/live market; sport tips must be pre-match only")
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
    stamp = now_syd().isoformat(timespec="seconds")
    idx = SITE_TIPS / "index.json"
    if idx.exists():
        try:
            prev = load(idx)
            if prev.get("days") == days:
                stamp = prev.get("generated_at", stamp)  # nothing changed: keep the stamp so publish.sh sees no diff
        except Exception:
            pass
    manifest = {"generated_at": stamp, "dates": [d["date"] for d in days], "days": days}
    save(idx, manifest)
    print(f"index.json rebuilt: {len(days)} day(s); newest {days[0]['date'] if days else '-'}")
    if MEMBERS_ONLY:
        write_public(manifest)
    return manifest


# ---------- public outputs (no selections before results) ----------
def write_public(manifest):
    SITE_DATA.mkdir(parents=True, exist_ok=True)
    teaser = {"generated_at": manifest["generated_at"], "days": []}
    rdays = []
    for d in manifest["days"]:
        card = load(SITE_TIPS / f"{d['date']}.json")
        sels = card.get("selections", [])
        meetings = sorted({re.split(r"\s+[–-]\s+|\s+R(?:ace)?\s*\d", s.get("event", ""))[0].strip() for s in sels if s.get("event")})
        teaser["days"].append({"date": d["date"], "racing_selections": len(sels), "roughies": len(card.get("roughies") or []),
                               "sport_selections": len(card.get("sports") or []), "meetings": meetings, "generated_at": card.get("generated_at"),
                               "results_recorded": d["results_recorded"]})
        settled = [{"event": s.get("event"), "start_time_aedt": s.get("start_time_aedt"), "selection": s.get("selection"), "result": s["result"]}
                   for s in sels if (s.get("result") or {}).get("outcome")]
        if settled:
            rdays.append({"date": d["date"], "selections": settled})
    teaser["days"] = teaser["days"][:30]
    save(SITE_DATA / "teaser.json", teaser)
    save(SITE_DATA / "results.json", {"generated_at": manifest["generated_at"], "method": "All main selections, 1 unit win stake each; scratchings excluded; only settled selections are listed.", "days": rdays})
    print(f"public data/teaser.json + data/results.json written ({len(rdays)} day(s) with results)")


# ---------- members store (Twilio Sync) ----------
def _twilio_auth():
    v = {}
    for line in TWILIO_ENV.read_text().splitlines():
        m = re.match(r"^(TWILIO_ACCOUNT_SID|TWILIO_AUTH_TOKEN)=(.*)$", line.strip())
        if m: v[m.group(1)] = m.group(2).strip().strip("\"'")
    return v["TWILIO_ACCOUNT_SID"], v["TWILIO_AUTH_TOKEN"]


def _tw(method, url, data=None):
    sid, tok = _twilio_auth()
    req = urllib.request.Request(url, data=urllib.parse.urlencode(data).encode() if data else None, method=method)
    req.add_header("Authorization", "Basic " + base64.b64encode(f"{sid}:{tok}".encode()).decode())
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code


def sync_upload(dates, manifest):
    """Upload cards (gzip+base64, Sync item limit is 16 KB) and the manifest to the members store."""
    ss = json.loads(MEMBERS_DEPLOY.read_text())["sync_service_sid"]
    base = f"https://sync.twilio.com/v1/Services/{ss}"
    for date in dates:
        card = load(SITE_TIPS / f"{date}.json")
        z = base64.b64encode(gzip.compress(json.dumps(card, ensure_ascii=False, separators=(",", ":")).encode())).decode()
        data = json.dumps({"z": z, "date": date})
        if len(data) > 15500: die(f"card {date} too large for Sync even compressed ({len(data)} bytes)")
        st = _tw("POST", f"{base}/Maps/tips/Items/{date}", {"Data": data})
        if st == 404: st = _tw("POST", f"{base}/Maps/tips/Items", {"Key": date, "Data": data})
        if st >= 300: die(f"Sync upload of {date} failed: HTTP {st}")
    data = json.dumps(manifest)
    st = _tw("POST", f"{base}/Documents/tips_index", {"Data": data})
    if st == 404: st = _tw("POST", f"{base}/Documents", {"UniqueName": "tips_index", "Data": data})
    if st >= 300: die(f"Sync upload of tips_index failed: HTTP {st}")
    if _tw("GET", f"{base}/Documents/tips_index") != 200: die("tips_index not readable after upload")
    print(f"members store updated: {', '.join(dates)} + tips_index (verified)")


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
    print(f"copied {src} -> {dest} (private)")
    sync_upload([date], reindex())


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
    sync_upload([date], reindex())


def main(argv):
    if argv and argv[0] in ("-h", "--help"):
        print(__doc__)
    elif argv and argv[0] == "--reindex":
        reindex()
    elif argv and argv[0] == "--sync-all":
        m = reindex(); sync_upload(m["dates"], m)
    elif argv and argv[0] == "result":
        if len(argv) not in (4, 5):
            die('usage: update_tips.py result YYYY-MM-DD "Selection" won|lost|placed|scratched [odds]')
        record_result(*argv[1:])
    else:
        copy_card(argv[0] if argv else None)


if __name__ == "__main__":
    main(sys.argv[1:])
