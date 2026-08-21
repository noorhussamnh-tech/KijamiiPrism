#!/usr/bin/env bash
# Probe the macOS dev environment. Emits one `name|status|detail` line per check.
# This script NEVER installs anything — remediation is the caller's job.

set -uo pipefail

probe() {
  local name="$1" bin="$2"
  shift 2
  if command -v "$bin" >/dev/null 2>&1; then
    printf '%s|OK|%s\n' "$name" "$("$@" 2>/dev/null | head -1)"
  else
    printf '%s|MISSING|\n' "$name"
  fi
}

printf 'os|OK|macOS %s (%s)\n' "$(sw_vers -productVersion)" "$(uname -m)"

# Python and pip. macOS ships no bare `python`/`pip` — only the 3-suffixed names —
# while Windows ships the reverse. Try both so one status line means the same
# thing on either OS. Both write --version to stderr on some builds.
for pair in "python:python3 python" "pip:pip3 pip"; do
  label="${pair%%:*}"
  found=""
  for bin in ${pair#*:}; do
    if command -v "$bin" >/dev/null 2>&1; then
      found="$bin"
      break
    fi
  done
  if [ -n "$found" ]; then
    # Presence and version are separate facts. An interpreter that exists but
    # whose --version fails is installed, not missing — saying MISSING would
    # send the user to reinstall something they already have.
    version="$("$found" --version 2>&1 | head -1)"
    printf '%s|OK|%s\n' "$label" "${version:-$found, version unavailable}"
  else
    printf '%s|MISSING|\n' "$label"
  fi
done

# Homebrew may be installed but absent from a non-login shell's PATH — most often
# on Apple Silicon, where it lives in /opt/homebrew rather than /usr/local.
if command -v brew >/dev/null 2>&1; then
  printf 'homebrew|OK|%s\n' "$(brew --version 2>/dev/null | head -1)"
elif [ -x /opt/homebrew/bin/brew ]; then
  printf 'homebrew|NOT_ON_PATH|/opt/homebrew/bin/brew\n'
elif [ -x /usr/local/bin/brew ]; then
  printf 'homebrew|NOT_ON_PATH|/usr/local/bin/brew\n'
else
  printf 'homebrew|MISSING|\n'
fi

probe node node node --version
probe github-cli gh gh --version

# Claude Code CLI. Remediation differs by install method — `claude update` for a
# native install, npm for an npm one — so report which is in play.
if command -v claude >/dev/null 2>&1; then
  resolved="$(readlink "$(command -v claude)" 2>/dev/null || command -v claude)"
  case "$resolved" in
    *node_modules*) method=npm ;;
    *) method=native ;;
  esac
  printf 'claude-code|OK|%s (%s)\n' "$(claude --version 2>/dev/null | head -1)" "$method"
else
  printf 'claude-code|MISSING|\n'
fi
