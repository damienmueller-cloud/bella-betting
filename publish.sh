#!/usr/bin/env bash
# Bella Betting – daily update + publish to GitHub Pages.
# Usage: ./publish.sh [YYYY-MM-DD]     (default: today in Australia/Sydney)
#        ./publish.sh --no-update      (just commit & push whatever changed, e.g. after recording results)
# Repo:  https://github.com/damienmueller-cloud/bella-betting  (this site/ folder is the repo root)
# Live:  https://bellabetting.com.au/  (GitHub Pages custom domain; old URL https://damienmueller-cloud.github.io/bella-betting/ redirects)
set -euo pipefail
cd "$(dirname "$0")"

if [[ "${1:-}" == "--no-update" ]]; then
  MSG="Update site $(TZ=Australia/Sydney date +%F' '%H:%M) AEDT"
else
  DATE="${1:-$(TZ=Australia/Sydney date +%F)}"
  python3 update_tips.py "$DATE"          # validates + lints the card, uploads it to the members store, writes public data/*.json
  MSG="Tips for $DATE"
fi

git add -A
# Members-only guard: full cards must never reach the public repo (they live in ../cards and the members store).
if git ls-files | grep -Eq '^(tips|cards)/|^data/.*(card|tips)'; then
  echo "ABORT: tip card files are staged for the PUBLIC repo; unstaging. Cards belong in ../cards only." >&2
  git rm -rq --cached tips cards 2>/dev/null || true
  exit 1
fi
if git diff --cached -U0 -- data/teaser.json | grep -Eq '"(selection|horse|best_odds|win_odds|odds)"'; then
  echo "ABORT: data/teaser.json contains selections or odds." >&2; exit 1
fi
if ! git diff --cached --quiet; then
  git commit -q -m "$MSG"
fi
git fetch -q origin main
if [[ "$(git rev-list --count origin/main..HEAD)" == "0" ]]; then
  echo "Nothing changed; nothing to publish."
  exit 0
fi
git pull -q --rebase origin main   # other workers may push to this repo; never force-push
git push -q origin main
echo "Pushed: $(git log -1 --format=%s)"

# Wait (up to ~3 min) for GitHub Pages to rebuild and serve the pushed commit's public data/teaser.json.
# (Full cards are members-only: update_tips.py uploads them to the members store; nothing private is committed.)
want=$(sha1sum data/teaser.json | cut -d' ' -f1)
for i in $(seq 1 36); do
  live=$(curl -fsSL "https://bellabetting.com.au/data/teaser.json?nocache=$RANDOM" 2>/dev/null | sha1sum | cut -d' ' -f1 || true)
  if [[ "$live" == "$want" ]]; then echo "Live site updated: https://bellabetting.com.au/"; exit 0; fi
  sleep 5
done
echo "Pushed, but the live site has not refreshed yet (Pages/CDN can take a few minutes). Check https://bellabetting.com.au/"
