# Project Instructions for Mistral Vibe

## Current Process (Updated)

**We are currently in PLAN mode finishing the documentation.**

After plans are finalized:

1. **I will explain** how to set up MCP so we can create GitHub issues from the plans in `.vibe/plans/`

2. **You will create GitHub issues** for each plan (3 total):
   - **Issue 1**: MCP Setup (mcp-setup.md)
   - **Issue 2**: Local harness + GitHub setup (github-bot.md + local-agent.md)
   - **Issue 3**: Debian package + deployment (debian-package.md + publishing.md)

3. **You will tell me which issue to work on** - I will switch to IMPLEMENT mode for that specific issue only

## Issue Details

### Issue 1: MCP Setup
**Plan**: mcp-setup.md

**What I will do**:
- Implement the MCP server with GitHub tools
- Configure it for this project
- **I will ask you for**: GitHub access token/keys for authentication

**After completion**: I will remove the plan file from the repo.

### Issue 2: Local Harness + GitHub Setup
**Combines**: github-bot.md, local-agent.md

**What I will do**:
- Implement the webhook harness with Docker sandboxing
- Implement the two-stage filtering

**What I will ask you to do**:
- Set up GitHub App for bot identity
- Configure GitHub webhook with ngrok URL
- Create a separate sandbox GitHub repository for testing

**Result**: A working local harness that can receive webhooks, invoke Vibe in Docker, and post responses back to GitHub.

### Issue 3: Debian Package + Deployment
**Combines**: debian-package.md, publishing.md

**What I will do**:
- Create the .deb package with Docker dependency
- Set up the publishing workflow to gh-pages

**What I will tell you**:
- How to install the .deb on your VPS
- How to configure it
- How to start the service

**Result**: An installable .deb package that users can install via apt.

## Mode Tracking

### Current Mode: PLAN

You should:
- Review plans in `.vibe/plans/`
- Request clarifications
- Approve the plans

### Mode Transition

**PLAN mode** → **IMPLEMENT mode** when you explicitly say: "implement issue #1", "implement issue #2", or "implement issue #3"

**IMPLEMENT mode** → **PLAN mode** when you say "plan", "let's plan", or "stop"

## Architecture Decisions (FINALIZED)

These are fixed - do not re-discuss:

### Trigger Mechanism
- GitHub Webhooks (real-time)
- Requires public URL (ngrok/Cloudflare Tunnel for local dev)

### Reviewer Persona
- Custom system prompt for code review
- Separate bot identity (`autovibe-rator[bot]`)
- Dedicated Vibe agent profile

### Token Optimization
- Two-Stage Filtering
- Stage 1: Keyword check (`@autovibe-rator` ping)
- Stage 2: Event type, author, repo validation
- Only invoke Vibe after both stages pass

### Response Mechanism
- Both comments and reviews
- Post GitHub comments for visibility
- Create formal PR reviews for tracking

### Authentication
- GitHub App
- Bot identity: `autovibe-rator[bot]`
- Granular permissions
- JWT authentication

### Safety
- Docker sandboxing per invocation
- Automatic cleanup via Docker --rm flag
- Isolated filesystem per container

## For Developer (@filejunkie)

### Next Immediate Steps:
1. Review all plans in `.vibe/plans/`
2. Ask me any clarifying questions about the plans
3. Once satisfied, ask me to explain MCP setup for issue creation
4. Create 3 GitHub issues (one per plan grouping as described above)
5. Delete the plan files after issue creation
6. Tell me which issue to start with (e.g., "implement issue #1")

### Implementation Order:
1. Issue 1: MCP Setup (mcp-setup.md) - I'll ask you for GitHub access keys
2. Issue 2: Local harness + GitHub setup (github-bot.md + local-agent.md)
3. Issue 3: Debian package + VPS deployment (debian-package.md + publishing.md)

## Auto-Update

This file may be automatically updated as the project evolves.

---

**Mode Check**: If you see plan files in `.vibe/plans/`, you are in PLAN mode. Do not implement.
