#!/usr/bin/env python3
"""PreToolUse hook (written by Claude Code for Kiro) on Kiro's shell tool in the HeadwayHold repo.

Exit 0 lets the command run. Exit 2 blocks it, and the reason on stderr goes back to Kiro so it can do the task another
way. Blocked: git and gh (another process commits), privilege escalation, package managers other than npm, any npm
package except fast-check, recursive deletes, writes outside the repo, and network calls to hosts outside the allowlist.
Every decision is appended to .kiro/hooks/guard.log."""
import json
import re
import shlex
import sys
import time
from pathlib import Path

ALLOWED_HOSTS = {"cdn.jsdelivr.net", "raw.githubusercontent.com", "api-v3.mbta.com"}
BLOCKED_PROGRAMS = {
    "git": "git is not available to Kiro here: Claude Code reviews and commits each wave",
    "gh": "gh is not available to Kiro here: Claude Code handles GitHub",
    "sudo": "no privilege escalation", "su": "no privilege escalation",
    "ssh": "no remote shells", "scp": "no remote copies", "rsync": "no remote copies",
    "npx": "npx runs packages from the registry; write the code instead",
    "yarn": "use npm", "pnpm": "use npm", "bun": "use npm", "brew": "no system installs",
    "pip": "no Python packages", "pip3": "no Python packages",
    "launchctl": "no system services", "crontab": "no scheduled jobs", "osascript": "no desktop automation",
    "open": "no opening apps or browsers",
}
NPM_ALLOWED = re.compile(
    r"^npm (test|t|ci|install|i|run [\w:.-]+)( --silent| -s)?( --( .*)?)?$"
    r"|^npm (install|i) (--save-dev|-D) fast-check(@[\w.^~-]+)?$"
    r"|^npm (install|i) fast-check(@[\w.^~-]+)? (--save-dev|-D)$"
)
SEPARATORS = re.compile(r"&&|\|\||;|\||\n|`|\$\(")


def segments(command):
    for part in SEPARATORS.split(command):
        part = part.strip().strip("()")
        if part:
            yield part


def check(command, repo):
    for seg in segments(command):
        try:
            words = shlex.split(seg)
        except ValueError:
            words = seg.split()
        while words and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", words[0]):  # leading VAR=value
            words = words[1:]
        if not words:
            continue
        prog = Path(words[0]).name
        if prog in BLOCKED_PROGRAMS:
            return f"`{prog}` is blocked: {BLOCKED_PROGRAMS[prog]}"
        if prog == "npm":
            flat = " ".join(words)
            if not NPM_ALLOWED.match(flat):
                return "only `npm test`, `npm run <script>`, `npm ci`, `npm install` and `npm install --save-dev fast-check` are allowed"
        if prog == "rm" and any(w.startswith("-") and ("r" in w or "R" in w) for w in words[1:]):
            targets = [w for w in words[1:] if not w.startswith("-")]
            if not targets or any(t not in ("node_modules", "./node_modules") for t in targets):
                return "recursive deletes are blocked (only `rm -rf node_modules` is allowed); delete single files instead"
        if prog in ("curl", "wget"):
            for flag in ("-X", "--request", "-d", "--data", "--data-binary", "--data-raw", "-F", "--form", "-T", "--upload-file", "--post-data", "--post-file"):
                if flag in words:
                    return f"`{prog} {flag}` is blocked: downloads only"
            hosts = re.findall(r"https?://([^/\s:'\"]+)", seg)
            if not hosts:
                return f"`{prog}` needs an explicit https URL on an allowed host"
            bad = sorted(set(hosts) - ALLOWED_HOSTS)
            if bad:
                return f"network access to {', '.join(bad)} is blocked; allowed hosts: {', '.join(sorted(ALLOWED_HOSTS))}"
        if prog == "cd" and len(words) > 1 and (words[1].startswith(("/", "~")) or ".." in words[1]):
            if not Path(words[1]).expanduser().resolve().is_relative_to(repo):
                return "stay inside the repository"
    if re.search(r">>?\s*(~|/(?!dev/null))", command):
        target = re.search(r">>?\s*(\S+)", command).group(1)
        if not Path(target).expanduser().resolve().is_relative_to(repo):
            return "writing outside the repository is blocked"
    return None


def main():
    raw = sys.stdin.read()
    try:
        event = json.loads(raw)
    except json.JSONDecodeError:
        print("shell guard: could not read the hook input, so the command is blocked to be safe", file=sys.stderr)
        sys.exit(2)
    repo = Path(event.get("cwd") or ".").resolve()
    tool_input = event.get("tool_input") or {}
    command = tool_input.get("command") if isinstance(tool_input, dict) else None
    if not isinstance(command, str):
        strings = [v for v in (tool_input.values() if isinstance(tool_input, dict) else []) if isinstance(v, str)]
        command = strings[0] if strings else ""
    reason = check(command, repo) if command else None
    try:
        with open(Path(__file__).resolve().parent / "guard.log", "a") as log:
            log.write(json.dumps({"t": time.strftime("%H:%M:%S"), "decision": "block" if reason else "allow",
                                  "command": command[:300], "reason": reason}) + "\n")
    except OSError:
        pass
    if reason:
        print(f"Blocked by the HeadwayHold shell guard (a Kiro hook): {reason}.", file=sys.stderr)
        sys.exit(2)
    sys.exit(0)


if __name__ == "__main__":
    main()
