---
name: sanity-check
description: Use when a user wants to verify their development environment is ready, set up a new machine, or asks whether they have the required tools — checks Homebrew, Node.js, GitHub CLI, the Claude Code CLI, and the Supabase MCP connector on macOS or Windows, and guides installation of whatever is missing.
---

# Environment Sanity Check

Verify a machine has the tools required to start work, and guide the user through installing anything missing. Works on macOS and Windows.

**Core principle:** probe everything in one pass, then remediate one tool at a time with the user's approval. Never install without asking.

## Flow

1. **Determine the OS.** Read it from the environment, then state what you found and let the user correct it: "Detected macOS — is that right?" Do not silently assume.
2. **Run the probe script** for that OS (see Quick Reference). It emits `name|status|detail` lines and installs nothing.
3. **macOS only — Homebrew is a gate.** If Homebrew is `MISSING`, stop and fix it first. Every other macOS install command depends on it — including Python — so reporting the rest as "failed" is misleading. The probe *reports* Python first, but on macOS you still *fix* Homebrew first.
4. **Remediate each remaining failure** in order: Python, pip, Node.js, then GitHub CLI.
5. **Run the GitHub CLI live check** once `gh` is present — see below. Installed is not the same as working.
6. **Check the Supabase MCP connector.** This is a Claude Code session check, not a shell check — see below.
7. **Print the final report table.**

## Quick Reference

| Check | Probe | macOS fix | Windows fix |
|---|---|---|---|
| Python | both scripts | `brew install python` | `winget install --id Python.Python.3.13 --source winget` |
| pip | both scripts | ships with `brew install python` | ships with the winget package |
| Homebrew | `scripts/check-macos.sh` | `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` | n/a — `winget` ships with Windows |
| Node.js | both scripts | `brew install node` | `winget install --id OpenJS.NodeJS --source winget` |
| GitHub CLI | both scripts | `brew install gh` | `winget install --id GitHub.cli --source winget` |
| Claude Code CLI | both scripts | see below | see below |
| Supabase MCP | `claude mcp list` | see below | see below |

Run the probe with `bash scripts/check-macos.sh` or `pwsh -File scripts/check-windows.ps1`, resolving the path relative to this skill's directory.

## Remediation Rules

For every missing tool:

1. Show the exact command for the detected OS.
2. Ask the user to approve it before running. One approval covers one tool — never batch several installs behind a single yes.
3. Run it on approval, or step aside if the user prefers their own terminal.
4. Re-probe that one tool afterward and report the version. An install that reported success but left the binary unreachable is a failure, not a pass.

**`NOT_ON_PATH` is not `MISSING`.** The macOS probe reports this when Homebrew exists on disk but the shell can't see it. Installing again won't help — the fix is adding it to the shell profile:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile && eval "$(/opt/homebrew/bin/brew shellenv)"
```

Use `/usr/local/bin/brew` instead if that is the path the probe reported.

## Python and pip

pip ships with every supported Python, so `python|OK` alongside `pip|MISSING` almost never means pip needs installing separately. It usually means one of:

- **pip exists under a different name.** Try `python3 -m pip --version` before installing anything.
- **A partial or system Python.** Repair with `python3 -m ensurepip --upgrade`.
- **Windows App Execution Alias.** Windows stubs `python` to open the Microsoft Store. The probe already rejects that stub by requiring real version output, so it reports `MISSING` — correctly. Fix it in Settings → Apps → App execution aliases, or install Python properly with winget.

**Do not run bare `pip install` to test it.** On Homebrew and most Linux Pythons the environment is externally managed (PEP 668) and the command fails by design, which looks like a broken pip when nothing is wrong. `pip --version` is the check; a venv is the fix for actually installing packages.

Never suggest `sudo pip install`. It writes into a package-manager-owned tree and breaks the interpreter that other tools depend on.

## GitHub CLI Live Check

An installed `gh` proves nothing about whether it works. Once the presence check passes, run these — they are read-only and identical on macOS and Windows:

```bash
gh api user --jq .login                       # auth + network reach the API
gh auth status                                # token scopes
git ls-remote --heads "$(git remote get-url origin)"   # git transport + credentials
```

`git ls-remote` is the point of this check. It opens the same HTTPS connection, presents the same credentials through the same credential helper, and performs the same handshake a `git push` does — it just reads the ref list instead of uploading. If it succeeds, a push would reach the server.

Skip the `ls-remote` line when there is no `origin` (`git remote get-url origin` exits non-zero outside a repo, or in one with no remote). That is not a failure — report the first two and say the transport check was skipped for lack of a remote.

| Symptom | Meaning |
|---|---|
| `gh api user` fails with `HTTP 401` | Token expired or revoked → `gh auth login` |
| `gh auth status` lacks `repo` in scopes | Reads work, pushes will be rejected → `gh auth refresh -s repo` |
| Either command hangs, then times out | Network, proxy, or firewall — not credentials. Retry once before concluding; transient GitHub timeouts are common. |
| `ls-remote` fails but `gh api user` succeeds | API reachable, git transport is not — usually a proxy that allows HTTPS to the API but blocks git, or a broken credential helper |

**Never verify by pushing.** A health check must not write. Do not create a scratch repo, do not push the user's pending commits, do not commit anything to make something to push. Read the `repo` scope to determine whether a push is permitted; that answers the question without touching a remote.

## Claude Code CLI

The probe reports the version and how it was installed, e.g. `claude-code|OK|2.1.220 (Claude Code) (native)`.

**A missing `claude` binary is not a contradiction.** You are running inside Claude Code, so it exists — but users on the IDE extension or desktop app often never put the CLI on their `PATH`. Report it as a real gap; `claude mcp list` and every other CLI step depends on it.

| Situation | Fix |
|---|---|
| Present, want the latest | `claude update` — checks and installs in one step. Works for both install methods. |
| Missing, macOS/Linux | `curl -fsSL https://claude.ai/install.sh \| bash` |
| Missing, Windows | `irm https://claude.ai/install.ps1 \| iex` |
| Missing, prefers npm | `npm install -g @anthropic-ai/claude-code` — requires the Node.js check above to pass first |

Do not claim a version is outdated unless `claude update` says so. Determining the latest release needs a network call, and the probe deliberately makes none — it reports the installed version and nothing more.

## Supabase MCP Connector

This is a session check, not a shell check. Run `claude mcp list` — it reports both registration and auth state per server, which is what you actually need:

```
plugin:supabase:supabase: https://mcp.supabase.com/mcp (HTTP) - ! Needs authentication
```

Then act on the status:

1. **`✔ Connected`** — done. Record it as passing.
2. **`! Needs authentication` or a connection failure** — tell the user to run `/mcp`, select Supabase, and complete the auth flow. It is interactive and browser-based, so the user must do it; you cannot, and no tool call will do it for them.
3. **No `supabase` entry at all** — give them:

   ```
   claude mcp add --transport http supabase https://mcp.supabase.com/mcp
   ```

   Then `/mcp` to authenticate. Point them at https://supabase.com/docs/guides/getting-started/mcp if the endpoint has moved — that page is authoritative, this command is a convenience.

## Final Report

Always end with a table, even when everything passes:

```
| Check        | Status | Detail                    |
|--------------|--------|---------------------------|
| macOS        | ✅     | 14.5 (arm64)              |
| Homebrew     | ✅     | Homebrew 4.3.8            |
| Node.js      | ✅     | v22.3.0                   |
| GitHub CLI   | ❌     | not installed             |
| Supabase MCP | ⚠️      | registered, not signed in |
```

Follow it with one line naming exactly what is left to do, or "Environment is ready." if nothing is.

## Common Mistakes

| Mistake | Do this instead |
|---|---|
| Concluding Supabase is ready because `mcp__*supabase*` tools exist | Those tools appear even when unauthenticated — an exposed `authenticate` tool is a sign it is *not* connected. Trust `claude mcp list`. |
| Asking "Mac or Windows?" when the environment already says | Detect, state it, invite correction |
| Reporting Node and `gh` as failures when Homebrew is missing on macOS | Fix Homebrew first; the rest are blocked, not broken |
| Treating `NOT_ON_PATH` as a missing install | Fix the shell profile — reinstalling changes nothing |
| Running installs without asking | Show the command, get a yes, then run it |
| Claiming an install worked because the command exited 0 | Re-probe the binary and report its version |
| Reading `brew install X` → "already installed and up-to-date" as a contradiction of a `MISSING` probe | Both are true: the formula was in the Cellar but unlinked, so the binary was genuinely unreachable. `brew install` silently re-links it. Re-probe — it will now pass. |
| Trying to authenticate the Supabase MCP for the user | Hand off — the OAuth flow needs a human in a browser |
