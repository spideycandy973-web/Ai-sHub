# Agent Tools & Execution Model

## v0.1.0 scope (honest)

The agent is a **real model-driven planner/executor with real on-device file tools**. It is not
a scripted demo: plans and tool calls come from the selected free model at runtime, and every
tool action actually touches the filesystem inside a sandbox.

What it does NOT do in v0.1.0: execute shell commands or run untrusted project code. That
requires an isolated cloud runner; the documented path is GitHub Actions (below). This is
listed as **Blocked** in the blocker register, not silently dropped.

## Sandbox

- Root: `filesDir/agent_projects/<sanitized-project-id>/` (app-private storage).
- `SandboxPaths.resolve` rejects absolute paths, `..` traversal, and symlink escapes via
  canonical-path containment. Unit-tested (`SandboxPathsTest`, 5 cases incl. symlink escape).
- File writes bounded to 512 KB; reads truncated to 8 KB for context; search skips files > 200 KB.

## Tool contracts

| Tool | Input | Effect | Risk |
|---|---|---|---|
| `write_file` | path, content | Create/overwrite inside sandbox | Write — approval in supervised modes |
| `read_file` | path | Read ≤ 8 KB | Read-only |
| `list_files` | — | List sandbox files | Read-only |
| `search` | query | Case-insensitive content search | Read-only |
| `done` | content | Mark step complete | None |

Model output is parsed as a typed `ToolCall` request — never as authorization. Unknown tools
are rejected. Writes in Planning/Research modes are blocked regardless of model output
(prompt-injection resistant by construction).

## Modes

| Mode | Writes | Approval |
|---|---|---|
| Planning | ✗ | — |
| Research | ✗ | — |
| Supervised | ✓ | Every write pauses for explicit Approve/Reject |
| Development | ✓ | Every write |
| Debug | ✓ | Every write |
| Autonomous | ✓ | Pre-authorized by mode selection; sandbox-only |

## Durability & recovery

- Task, plan (per-step status), and append-only log persist to Room after every transition.
- Process death: `recoverInterrupted()` moves `running` → `paused`; resume is manual to avoid
  duplicate side effects. At-least-once semantics are acknowledged; no exactly-once claim.
- Cancellation removes pending approvals and marks the task cancelled.

## Cloud execution path (next milestone, not claimed done)

GitHub Actions on an authorized repository can run builds/tests for agent-produced code:
the agent prepares files → user approves a commit → workflow runs → Developer Hub inspects
real run status/logs. Ordinary runners are **not** treated as hardened hostile-code sandboxes;
secrets are never exposed to untrusted jobs, and `pull_request_target` is not used.

## Approvals

Destructive or externally visible actions (repo mutation, release publication, deletions beyond
the sandbox) always require explicit user action in the UI. Vague goals never grant blanket
authorization.
