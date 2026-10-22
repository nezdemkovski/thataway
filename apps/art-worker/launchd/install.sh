#!/usr/bin/env bash
# Installs (or reinstalls) the art worker as a launchd user agent on this Mac.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
label=cloud.nezdemkovski.thataway.art-worker
plist="$HOME/Library/LaunchAgents/$label.plist"
[ -f "$here/.env" ] || { echo "apps/art-worker/.env is missing (see .env.example)"; exit 1; }
bun="$(command -v bun)"
sed -e "s#__BUN__#$bun#g" -e "s#__WORKDIR__#$here#g" -e "s#__HOME__#$HOME#g" \
  "$here/launchd/$label.plist" > "$plist"
launchctl bootout "gui/$(id -u)" "$plist" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$plist"
launchctl kickstart -k "gui/$(id -u)/$label"
echo "installed $label; logs: ~/Library/Logs/thataway-art-worker.log"
