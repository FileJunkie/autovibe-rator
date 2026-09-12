# Project Instructions for Mistral Vibe

## Current Process (Updated)

**We are currently in PLAN mode finishing the documentation.**

After plans are finalized:

1. **I will explain** how to set up MCP so we can create GitHub issues from the plans in `.vibe/plans/`

2. **You will create GitHub issues** for each plan file:
   - mcp-setup.md
   - github-bot.md
   - local-agent.md (harness + ngrok setup)
   - debian-package.md
   - publishing.md

3. **You will tell me which issue to work on** - I will switch to IMPLEMENT mode for that specific issue only

4. **The implementation order will be**:
   - Issue 1: Create the locally runnable harness (from local-agent.md and mcp-setup.md)
   - Issue 2: Ask you to set up GitHub so callbacks to ngrok work (from github-bot.md)
   - Issue 3: Generate .deb package (from debian-package.md)
   - Issue 4: Tell you how to deploy and work with it on server (from publishing.md)

## Mode Tracking

### Current Mode: PLAN

You should:
- Review plans in `.vibe/plans/`
- Request clarifications
- Approve the plans

### Mode Transition

**PLAN mode** → **IMPLEMENT mode** when you explicitly say: "implement issue #X" or "work on issue #X"

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
1. Review all plans in `.vibe/plans/` - they now include Docker sandboxing
2. Ask me any clarifying questions about the plans
3. Once satisfied, ask me to explain MCP setup for issue creation
4. Create GitHub issues from each plan file
5. Delete the plan files after issue creation
6. Tell me which issue to start with (e.g., "implement issue #1")

### Implementation Order:
The issues should be created and worked on in this order:
1. Local harness + MCP server (local-agent.md + mcp-setup.md combined)
2. GitHub bot setup (github-bot.md) - you will need to do manual steps
3. Debian package (debian-package.md)
4. Publishing workflow (publishing.md)

## Auto-Update

This file may be automatically updated as the project evolves.

---

**Mode Check**: If you see plan files in `.vibe/plans/`, you are in PLAN mode. Do not implement.
