# Bella Betting – static site

Live: https://damienmueller-cloud.github.io/bella-betting/ · Repo: https://github.com/damienmueller-cloud/bella-betting (this `site/` folder is the repo root, branch `main`, Pages from `/`).

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
  tips/index.json         manifest {generated_at, dates[newest first], days[{date, selections, results_recorded, generated_at}]}
  tips/YYYY-MM-DD.json    copies of the vault cards (same schema as ../tips/*.json)
  update_tips.py          daily updater (see below)
```

## Preview locally
```
cd /workspace/project-vaults/Betting-Tips/site && python3 -m http.server 8765
# open http://127.0.0.1:8765/
```
(The pages fetch JSON, so open them via a server, not file://.)

## Daily routine
```
python3 update_tips.py              # copies ../tips/<today Sydney>.json, validates it, rebuilds tips/index.json
python3 update_tips.py 2026-10-11   # a specific date
python3 update_tips.py --reindex    # rebuild the manifest only
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
./publish.sh                 # today's (Sydney) card: update_tips.py -> git commit -> push -> waits for the live site to refresh
./publish.sh 2026-10-11      # a specific date
python3 update_tips.py result 2026-10-10 "Sheza Alibi" won 1.22 && ./publish.sh --no-update   # after recording results
```
Requires `gh` to be logged in as damienmueller-cloud (git uses `gh auth git-credential`). The commit identity is set in this repo's local git config (noreply address). publish.sh refuses nothing on its own – the compliance lint lives in update_tips.py, so always go through it.
Before publishing each day: recheck scratchings/odds, keep the RG footer untouched, and only quote odds from Australian-licensed bookmakers (see ../compliance-notes.md).
