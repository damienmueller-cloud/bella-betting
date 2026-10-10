#!/usr/bin/env bash
# Bella Betting – daily update + publish to GitHub Pages.
# Usage: ./publish.sh [YYYY-MM-DD]     (default: today in Australia/Sydney)
#        ./publish.sh --no-update      (just commit & push whatever changed, e.g. after recording results)
# Repo:  https://github.com/damienmueller-cloud/bella-betting  (this site/ folder is the repo root)
# Live:  https://damienmueller-cloud.github.io/bella-betting/
set -euo pipefail
cd "$(dirname "$0")"

if [[ "${1:-}" == "--no-update" ]]; then
  MSG="Update site $(TZ=Australia/Sydney date +%F' '%H:%M) AEDT"
else
  DATE="${1:-$(TZ=Australia/Sydney date +%F)}"
  python3 update_tips.py "$DATE"          # validates + compliance-lints the card, rebuilds tips/index.json
  MSG="Tips for $DATE"
fi

git add -A
if git diff --cached --quiet; then
  echo "Nothing changed; nothing to publish."
  exit 0
fi
git commit -q -m "$MSG"
git push -q origin main
echo "Pushed: $MSG"

# Wait (up to ~3 min) for GitHub Pages to rebuild and serve the new manifest.
want=$(python3 -c "import json;print(json.load(open('tips/index.json'))['generated_at'])")
for i in $(seq 1 36); do
  live=$(curl -fsS "https://damienmueller-cloud.github.io/bella-betting/tips/index.json?nocache=$RANDOM" 2>/dev/null \
         | python3 -c "import json,sys;print(json.load(sys.stdin).get('generated_at',''))" 2>/dev/null || true)
  if [[ "$live" == "$want" ]]; then echo "Live site updated."; exit 0; fi
  sleep 5
done
echo "Pushed, but the live site has not refreshed yet (Pages/CDN can take a few minutes). Check https://damienmueller-cloud.github.io/bella-betting/"
