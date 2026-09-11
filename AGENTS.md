# Project Instructions for Mistral Vibe

This file contains project-scoped instructions for Mistral Vibe when operating in this repository.

## Project Context

**Project**: autovibe-rator - An autonomous GitHub agent harness for Mistral Vibe

**Goal**: Enable Mistral Vibe to act as an autonomous code reviewer on GitHub repositories, triggered by events (issue creation, comments pinging the bot).

## Mode Tracking

### Current Mode: PLAN

This project is currently in **PLAN mode**. You should:
- Read existing plans in `.vibe/plans/`
- Ask clarifying questions when needed
- Create new plan files for additional requirements
- NOT implement anything until plans are converted to GitHub issues

### Mode Transition

**PLAN mode** → **IMPLEMENT mode** when:
1. User explicitly says "implement" or "start implementation"
2. All plans in `.vibe/plans/` are converted to GitHub issues
3. User confirms the plan is ready

**IMPLEMENT mode** → **PLAN mode** when:
1. User says "plan", "let's plan", or asks to stop implementation
2. A blocker is encountered that requires architectural decisions

## Architecture Decisions (FINALIZED)

These decisions are FINALIZED and should not be re-opened without explicit user request:

### Trigger Mechanism
- **GitHub Webhooks** (Option A)
- Real-time event detection
- Requires public URL (use ngrok/Cloudflare Tunnel for local dev)

### Reviewer Persona
- **All three approaches**:
  - Custom system prompt for code review (`src/agent/vibe/persona.md`)
  - Separate bot identity (`autovibe-rator[bot]`)
  - Dedicated Vibe agent profile

### Token Optimization
- **Two-Stage Filtering** (Option C)
- Stage 1: Keyword check (`@autovibe-rator` ping)
- Stage 2: Event type, author, repo validation
- Only invoke Vibe after both stages pass

### Response Mechanism
- **Both comments and reviews** (Option D)
- Post GitHub comments for visibility
- Create formal PR reviews for tracking

### Authentication
- **GitHub App** (Option B)
- Bot identity: `autovibe-rator[bot]`
- Granular permissions
- JWT authentication

## Plan Files Workflow

1. **Location**: `.vibe/plans/` directory
2. **Purpose**: Each file represents a unit of work to be implemented
3. **Lifecycle**:
   - Created as `.md` file in `.vibe/plans/`
   - Discussed and refined in PLAN mode
   - Converted to GitHub issue when ready
   - File deleted after issue creation
   - Implementation tracked via GitHub issue
4. **Current Plans**:
   - `mcp-setup.md` → GitHub Issue #1
   - `github-bot.md` → GitHub Issue #2
   - `local-agent.md` → GitHub Issue #3
   - `debian-package.md` → GitHub Issue #4
   - `publishing.md` → GitHub Issue #5

## Agent Configuration

When in IMPLEMENT mode:
- Use `--agent auto-approve` for autonomous operation
- Reference the GitHub issue, not the plan file

## MCP Server (Future)

Local MCP server will provide GitHub tools:
- `github_get_issue`
- `github_get_pr`
- `github_search_issues`
- `github_create_comment`
- `github_create_review`

Config will be stored in git (excluding secrets in `.env`).

## For Developer (@filejunkie)

### To Add a New Feature:
1. Create a new `.md` file in `.vibe/plans/`
2. Describe the objective, steps, success criteria
3. Discuss with Vibe (in PLAN mode)
4. Convert to GitHub issue when ready
5. Delete the plan file

### To Start Implementation:
1. Ensure all plans are converted to issues
2. `.vibe/plans/` directory should be empty or contain only future work
3. Explicitly tell Vibe to switch to IMPLEMENT mode
4. Vibe will work from GitHub issues, not plan files

## Auto-Update

This file may be automatically updated by scripts as the project evolves.

---

**Mode Check**: If you see plan files in `.vibe/plans/`, you are in PLAN mode. Do not implement.
