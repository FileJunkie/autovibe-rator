# autovibe-rator

Autonomous GitHub agent harness for [Mistral Vibe](https://github.com/mistralai/mistral-vibe).
Ping `@autovibe-rator` in an issue or pull request and a sandboxed Vibe agent
reviews the code or implements the request; the harness validates its work and
pushes it to a branch that references the issue.

## How it works

```
GitHub webhook (signed) → stage 1 + stage 2 filters
  → harness clones the repo into a per-run workspace
  → Vibe agent runs inside a Docker sandbox (read-only GitHub token, no push access)
  → harness validates the result (branch, fast-forward, commits)
  → harness pushes the branch (issue pings: autovibe-rator/issue-N; PRs: the PR's own branch)
  → answer posted as a comment (issues) or review (PRs)
```

Key properties:

- **Trigger**: `@autovibe-rator` mention in an issue body, any comment, or a PR
  description. Events: `issues:opened`, `issue_comment:created`,
  `pull_request:opened`/`synchronize`.
- **Access control**: fail-closed owner allowlist (`ALLOWED_OWNERS`), plus an
  author gate — by default only repo collaborators (`OWNER`/`MEMBER`/
  `COLLABORATOR`) can trigger a run; unrecognized authors are resolved via the
  API and rejected if they lack write access.
- **Personas**: definitions in `personas/*.md` are copied into the workspace;
  the agent picks the one matching the request (currently `code-reviewer` and
  `implementer`).
- **Least privilege**: the sandboxed agent gets a scoped, read-only
  installation token (contents/issues/pull-requests: read). It can commit
  locally but cannot push.
- **Deterministic push**: the harness — not the agent — pushes. It validates
  that HEAD is on the allowed branch, that history is a fast-forward of the
  original checkout, and that commits exist; strips agent-modified git config;
  and pushes a pinned URL with an explicit refspec. A `pre-push` hook in the
  workspace rejects any other ref.
- **Sandboxing**: one Docker container per invocation (`--rm`), Vibe pinned
  in the image, only the workspace and prompt file mounted.

## Quickstart

See [QUICKSTART.md](QUICKSTART.md). Summary:

1. Create a GitHub App (permissions: **Contents**, **Issues**,
   **Pull requests** = Read & write), install it on your repos.
2. Copy `.env.example` to `.env`, set `GITHUB_APP_ID`, `ALLOWED_OWNERS`,
   `GITHUB_WEBHOOK_SECRET`, and `MISTRAL_API_KEY` (forwarded into the
   sandbox).
3. `npm run docker:build`
4. `ngrok http <port>` and point the App webhook at `<url>/webhook`.
5. `npm run agent:dev`

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `GITHUB_APP_ID` | yes | GitHub App ID |
| `GITHUB_APP_PRIVATE_KEY_PATH` | yes | Path to the App private key (`.pem`) |
| `GITHUB_WEBHOOK_SECRET` | yes | Webhook signature verification |
| `ALLOWED_OWNERS` | yes | Comma-separated logins whose repos the bot serves; harness refuses to start without one |
| `MISTRAL_API_KEY` | yes | Mistral API key for the sandboxed agent |
| `ALLOWED_ASSOCIATIONS` | no | Author gate; default `OWNER,MEMBER,COLLABORATOR`, `ALL` disables |
| `BOT_HANDLE` | no | Bot mention handle (default `autovibe-rator`) |
| `PORT` | no | Harness port (default 3000) |
| `DOCKER_CMD` | no | Docker binary (default `docker`) |
| `LOG_LEVEL` | no | `debug`/`info`/`warn`/`error` (default `info`) |
| `LOG_FORMAT` | no | `text` (default) or `syslog` (RFC 5424 `<PRI>` prefix for journald/syslog forwarding) |

## Development

```
npm run agent:dev      # run the harness locally (tsx)
npm test               # vitest test suite
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm run docker:build   # build the sandbox image
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, and the test suite on
every pull request and every push to `main`.

Logs are single-line, leveled records; with `LOG_FORMAT=syslog` they carry an
RFC 5424 priority prefix, so a systemd unit with `StandardOutput=journal`
gives them correct journal priorities and makes them forwardable to
syslog/remote collectors.

## Security model

The sandbox is the approval boundary: the agent runs with `--auto-approve`
inside a container but has no push credentials. The harness owns all
side-effects on GitHub — comments, reviews, and the single allowed push per
run, after validation. Branch names and repository URLs are whitelisted before
they reach git or shell hooks; anything that looks like a token is scrubbed
from posted output. The container still has network egress (needed for GitHub
reads and the Mistral API); an egress allowlist is a planned hardening step.

## License

[MIT](LICENSE)
