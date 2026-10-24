#!/usr/bin/env bash
# SessionStart hook (written by Claude Code for Kiro): whatever this prints is added to Kiro's context at the start of
# every headless wave, so Kiro begins each wave knowing the uncommitted changes, the test result and the open tasks.
cd "$(dirname "$0")/../.." || exit 0
echo "## Session context from the wave-context hook"
echo "### Uncommitted changes (git status --short)"
git status --short 2>/dev/null | head -40
if [ -f package.json ]; then
  echo "### npm test"
  npm test --silent 2>&1 | grep -E '^# (tests|pass|fail)|^not ok' | head -20
fi
if [ -f .kiro/specs/headway-hold/tasks.md ]; then
  echo "### Open tasks in .kiro/specs/headway-hold/tasks.md"
  grep -nE '^[[:space:]]*- \[ \]' .kiro/specs/headway-hold/tasks.md | head -40
fi
exit 0
