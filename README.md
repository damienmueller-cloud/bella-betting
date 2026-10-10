# Bella Betting – static site

Live: https://bellabetting.com.au/ (custom domain via `CNAME`; www.bellabetting.com.au and bellabetting.com redirect here; old https://damienmueller-cloud.github.io/bella-betting/ also redirects) · Repo: https://github.com/damienmueller-cloud/bella-betting (this `site/` folder is the repo root, branch `main`, Pages from `/`).

Plain HTML/CSS/JS, no build step, no external requests (no web fonts, analytics, trackers or bookmaker links).

```
site/
  index.html      Today's tips (latest card; ?date=YYYY-MM-DD shows a past card)
  archive.html    List of all cards from tips/index.json
  results.html    Results/ROI tracker (level 1-unit win stakes; shows figures only once results are recorded)
  about.html      About, responsible gambling, disclaimer
  assets/style.css, assets/app.js
  assets/brand/    approved BB monogram (SVG + PNG) and favicons / apple-touch / manifest icons
  site.webmanifest, .nojekyll
  publish.sh       daily update + commit + push
  data/teaser.json        PUBLIC teaser: per day date, counts, meetings (no selections)
  data/results.json       PUBLIC results: settled main selections only (written once results are recorded)
  update_tips.py          daily updater (see below)

## Members-only tips (since 10 Oct 2026)
Full cards are no longer published in this repo. `update_tips.py` keeps them privately in `../cards/` and uploads them
(gzip, Sync map `tips` + doc `tips_index`) to the `bella-betting-members` Twilio service. `index.html`/`archive.html`
show a teaser + login (mobile -> SMS code via Twilio Verify, same rate limits as /join) to visitors, and the full card
to members with a valid 30-day session (`/member`, token in localStorage). Results/ROI stay public (`data/results.json`).
The old `tips/*.json` files were deleted in a normal commit; **cards up to 2026-10-10 remain visible in git history**
(no history rewrite). The phone agent reads tips from the same members store.
```

## Preview locally
```
cd /workspace/project-vaults/Betting-Tips/site && python3 -m http.server 8765
# open http://127.0.0.1:8765/
```
(The pages fetch JSON, so open them via a server, not file://.)

## Daily routine
```
python3 update_tips.py              # ../tips/<today Sydney>.json -> ../cards/ + members store + public data/*.json
python3 update_tips.py 2026-10-11   # a specific date
python3 update_tips.py --reindex    # rebuild manifest + public data only
python3 update_tips.py --sync-all   # re-upload every card + manifest to the members store
```
The updater refuses cards with prohibited wording (e.g. "lock", "sure thing", "bonus bet", "sign up", "risk-free", "make money" other than the standard "not a way to make money" disclaimer) and keeps already-recorded results if a card is re-copied.

## Roughies
If a card has a `roughies` array (fields: rank, event, start_time_aedt, horse, barrier, jockey, win_odds, place_odds, odds_source, odds_checked_at, implied_prob_pct, est_chance_pct, reasoning, confidence, note) plus optional `roughies_generated_at` / `roughies_notes`, the home page renders a Roughies section below the main table with a higher-risk warning and an "Implied vs our estimate" column. Roughies are not counted in the results tracker.

## Recording results (feeds results.html)
```
python3 update_tips.py result 2026-10-10 "Sheza Alibi" won 1.22
python3 update_tips.py result 2026-10-10 "Warwoven" lost
python3 update_tips.py result 2026-10-10 "Lindermann" scratched
```
Stored per selection as `"result": {"outcome": "won|lost|placed|scratched", "settled_odds": 1.22, "recorded_at": ...}`.
Tracker maths: 1 unit win stake per selection; winner P/L = odds − 1, loser (incl. placed) = −1; scratched excluded; strike rate = wins ÷ settled; ROI = P/L ÷ units staked. Nothing is shown until at least one result is recorded.
Use the odds published on the card (or record a different settled price consistently and say so).

## Responsible-gambling footer
Every page has the 18+ strip and footer: a DSS tagline, the exact call to action, BetStop link and the disclaimer. The footer tagline in the HTML is "Chances are you’re about to lose."; with JS on, it rotates daily through the six taglines DSS permits for websites so each is used about equally.

## Branding
Approved logo: concept B (BB monogram tile) – source in ../artwork-proposals/approved/. The header shows `assets/brand/bb-monogram.svg` next to the CSS text wordmark. Concepts A and C are not used.

## Daily publish workflow
```
cd /workspace/project-vaults/Betting-Tips/site
./publish.sh                 # today's (Sydney) card: update_tips.py -> git commit -> pull --rebase -> push -> waits for https://bellabetting.com.au to refresh
./publish.sh 2026-10-11      # a specific date
python3 update_tips.py result 2026-10-10 "Sheza Alibi" won 1.22 && ./publish.sh --no-update   # after recording results
```
Requires `gh` to be logged in as damienmueller-cloud (git uses `gh auth git-credential`). The commit identity is set in this repo's local git config (noreply address). publish.sh refuses nothing on its own – the compliance lint lives in update_tips.py, so always go through it.
Before publishing each day: recheck scratchings/odds, keep the RG footer untouched, and only quote odds from Australian-licensed bookmakers (see ../compliance-notes.md).

## Domain
`CNAME` (repo root) = `bellabetting.com.au` – do not delete it, or GitHub Pages drops the custom domain. DNS is at GoDaddy (A @ → 185.199.108-111.153, CNAME www → damienmueller-cloud.github.io). Details: ../domain-research.md.

## Membership (LIVE since 10 Oct 2026)
- `join.html` (free members form: 18+ and consent checkboxes, mobile required and normalised to +614…), `privacy.html`, `members-terms.html`, "Join free" in the nav and a CTA on the home page. Contact: hello@bellabetting.com.au.
- The form posts to the Twilio Function `https://bella-betting-members-6300-prod.twil.io/join`. Members are stored in Twilio Sync map `members`, keyed by E.164. Twilio Verify (`VA03f59755e29556169a50f066517f9027`) texts a 6-digit code; `/verify-check` marks the member `verified`. Only verified numbers are recognised on the tips line. ACMA fictitious test numbers (0491 570 xxx) never get a real SMS.
- No email platform yet (beehiiv planned): members are stored only.
- Source, deploy and tests: `/workspace/project-vaults/Betting-Tips/members/`.
