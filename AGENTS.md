# Project Instructions for Mistral Vibe

## Project

**autovibe-rator** — an autonomous GitHub agent harness for Mistral Vibe.
It receives GitHub webhooks, filters them, runs a sandboxed Vibe agent on the
repository, posts the answer as a comment or PR review, and pushes the
agent's validated work to an issue-referencing branch.

## Current Status (Updated)

- **Local harness: implemented and tested.** Webhook verification, two-stage
  filtering, Docker sandbox, persona selection, deterministic validation +
  push, and structured logging are all in place.
- **CI: implemented.** `.github/workflows/ci.yml` runs lint, typecheck, and
  tests on every PR and every push to `main`.
- **Remaining work**: Debian package + VPS deployment (gh-pages publishing,
  systemd unit with `LOG_FORMAT=syslog`).

## Mode Tracking

The old PLAN/IMPLEMENT convention still applies: say `plan` / `let's plan` /
`stop` to switch to PLAN mode, or `implement issue #N` to switch to
IMPLEMENT mode for that issue only. In PLAN mode, do not implement.

## Commands

```
npm run agent:dev      # run the harness locally
npm test               # vitest suite
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm run docker:build   # build the autovibe-agent sandbox image
```

Required environment (see `.env.example`; the harness refuses to start
without `ALLOWED_OWNERS`): `GITHUB_APP_ID`, `GITHUB_WEBHOOK_SECRET`,
`ALLOWED_OWNERS`, `MISTRAL_API_KEY`. Never commit `.env` or `*.pem`.

## Architecture Decisions (FINALIZED)

These are fixed — do not re-discuss or weaken them:

- **Trigger**: GitHub webhooks; public URL via ngrok/Cloudflare Tunnel in dev.
- **Filtering**: two stages — stage 1 (`@autovibe-rator` ping, not the bot
  itself), stage 2 (event/action, fail-closed owner allowlist, author gate).
  The author gate defaults to repo collaborators and falls back to a
  collaborator-permission API check when the payload lacks
  `author_association`.
- **Personas**: `personas/*.md` are copied into the workspace
  (`.autovibe/personas/`, git-excluded); the agent picks the persona matching
  the request. Adding a persona = adding a file with a `# Title` and a
  `> summary` line.
- **Sandboxing**: Docker per invocation. The agent receives a scoped
  read-only installation token and runs with `--trust --auto-approve`; it can
  commit locally but never push. The harness-side push token never enters the
  container.
- **Deterministic push**: only the harness pushes, after validating: HEAD on
  the allowed branch, fast-forward history, commits present. Push goes to the
  pinned repository URL with an explicit refspec, after stripping
  agent-modified git config (`credential.helper`, `url.*`, `core.hooksPath`).
  Issue pings push `autovibe-rator/issue-N`; PR pings push the PR head branch.
- **Response**: comments on issues, formal reviews on PRs.
- **Authentication**: GitHub App (`autovibe-rator[bot]`), installation tokens;
  App needs Contents/Issues/Pull-requests read & write.
- **Logging**: leveled single-line records (`LOG_LEVEL`, `LOG_FORMAT`).
  `LOG_FORMAT=syslog` emits RFC 5424 `<PRI>` prefixes for journald/syslog.

## Security Invariants — Do Not Weaken

1. `ALLOWED_OWNERS` is fail-closed; the harness must not start without it.
2. Branch names and repo URLs pass the strict whitelists in
   `src/utils/git-branch.ts` before reaching git or any shell hook.
3. The sandbox never receives a push-capable token.
4. The harness push is pinned: validated URL, explicit refspec, sanitized
   local git config, and the workspace `pre-push` guard still applies.
5. Everything posted to GitHub passes `scrubTokens()`.
6. Docker sandboxing is the default; direct invocation (`useDocker: false`)
   is an unsandboxed dev fallback — never enable it in production paths.

## For Developer (@filejunkie)

- Setup and first-run instructions: [QUICKSTART.md](QUICKSTART.md)
- Overview and configuration reference: [README.md](README.md)
- When changing harness code, run `npm test`, `npm run lint`, and
  `npm run typecheck` before considering it done.

## Auto-Update

This file may be automatically updated as the project evolves.

---

**Mode Check**: `.vibe/plans/` no longer contains plan files (they were
converted to GitHub issues). Issue 2 work is implemented on
`4-issue-2-local-harness-github-setup`. Debian packaging (issue 3) is next.
