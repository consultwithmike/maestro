#!/bin/sh
# Maestro SubagentStop audit hook.
#
# Appends a one-line record each time a Maestro role subagent finishes, giving a
# quick chronological trace independent of the orchestrator's own history log.
#
# NOTE: The SubagentStop payload does NOT include the subagent's output — only its
# identity. So this is a convenience trail, not the routing mechanism. Routing and the
# authoritative audit live in the orchestrator's `status.json` -> history.
#
# Requires a POSIX shell. On Windows, Claude Code invokes this via the bundled shell /
# Git Bash. Failure here never blocks the pipeline (the hook exits 0 regardless).

payload="$(cat 2>/dev/null)"

# Best-effort extraction without a JSON dependency.
agent="$(printf '%s' "$payload" | sed -n 's/.*"agent_type"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
[ -z "$agent" ] && agent="unknown"

dir="${CLAUDE_PROJECT_DIR:-.}/.maestro"
mkdir -p "$dir" 2>/dev/null
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)"

printf '%s  subagent_stop  %s\n' "$ts" "$agent" >> "$dir/audit.log" 2>/dev/null

exit 0
