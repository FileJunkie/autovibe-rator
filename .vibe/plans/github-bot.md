# Plan: GitHub Bot Setup & Registration

**Mode**: PLAN - Do not implement. Convert to GitHub issue first.

**Priority**: High (Phase 1)
**Status**: Not Started
**Depends on**: mcp-setup.md (needs MCP tools available)

---

**AGENT INSTRUCTION**: You are in PLAN mode. Read this file, ask clarifying questions if needed, but do NOT start implementation. When user says "implement" or "start", convert this to a GitHub issue and delete this file.

## Objective

Set up a GitHub App for the `autovibe-rator[bot]` identity. This will provide authentication for the harness to post comments and reviews on behalf of the bot.

## Background

From planning session: Using GitHub App (Option B) for:
- Dedicated bot identity (`autovibe-rator[bot]`)
- Granular permissions
- JWT authentication
- Designed for automation

## Steps

### 1. Create GitHub App

**Location**: https://github.com/settings/apps/new

**App Settings**:
- **Application name**: `autovibe-rator`
- **Homepage URL**: `https://github.com/FileJunkie/autovibe-rator` (or your repo URL)
- **Callback URL**: Not needed for JWT flow (leave blank or use placeholder)
- **Webhook URL**: Will be configured later (for now, leave blank)
- **Webhook Secret**: Generate and save securely

### 2. App Permissions

**Repository permissions**:
- [x] **Issues**: Read and write
- [x] **Pull requests**: Read and write
- [x] **Contents**: Read-only (for context)
- [x] **Metadata**: Read-only

**Organization permissions**: None needed (repo-level installation)

### 3. App Identity

- **Bot user**: `autovibe-rator` (or `autovibe-rator[bot]`)
- **Description**: "Autonomous code review agent for Mistral Vibe"

### 4. Generate Private Key

1. After creation, go to app settings
2. Scroll to "Private keys"
3. Click "Generate a private key"
4. Save as `github-app-private-key.pem` in project root (add to .gitignore)

### 5. App ID and Installation

- **App ID**: Save as `GITHUB_APP_ID` in `.env`
- **Installation**: Install app on your target repository (or organization)
- **Installation ID**: Save as `GITHUB_APP_INSTALLATION_ID` in `.env`

### 6. Environment Variables

Create `.env` file (add to `.gitignore`):
```bash
# GitHub App Authentication
GITHUB_APP_ID=123456
GITHUB_APP_INSTALLATION_ID=789012
GITHUB_APP_PRIVATE_KEY_PATH=./github-app-private-key.pem

# MCP Server
GITHUB_TOKEN=ghp_...  # Fallback for MCP server (optional)
```

Create `.env.example` (commit to git):
```bash
# Copy this to .env and fill in values
GITHUB_APP_ID=
GITHUB_APP_INSTALLATION_ID=
GITHUB_APP_PRIVATE_KEY_PATH=./github-app-private-key.pem
```

### 7. JWT Authentication Helper

Create `src/utils/github-auth.ts`:
```typescript
import { createAppAuth } from "@octokit/auth-app";

export function getGitHubAuth() {
  return createAppAuth({
    appId: process.env.GITHUB_APP_ID!,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
    installationId: process.env.GITHUB_APP_INSTALLATION_ID!,
  });
}
```

### 8. Update MCP Server

Modify GitHub tools to use App authentication instead of PAT:
```typescript
import { Octokit } from "@octokit/rest";
import { getGitHubAuth } from "../utils/github-auth";

const auth = await getGitHubAuth();
const octokit = new Octokit({ auth });
```

### 9. Test Authentication

Create a test script `scripts/test-auth.ts`:
```typescript
import { getGitHubAuth } from "../src/utils/github-auth";

async function test() {
  const auth = await getGitHubAuth();
  const octokit = new Octokit({ auth });
  const { data } = await octokit.rest.users.getAuthenticated();
  console.log("Authenticated as:", data.login);
}

test();
```

Run: `npx ts-node scripts/test-auth.ts`

Expected output: `Authenticated as: autovibe-rator[bot]`

## Bot Identity Verification

1. Create a test issue in your repo
2. Have the bot post a comment
3. Verify the comment shows author as `autovibe-rator[bot]`

## Repository Webhook Setup

1. Go to repository: https://github.com/FileJunkie/autovibe-rator/settings/hooks/new
2. **Payload URL**: `https://your-webhook-url/webhook` (or ngrok URL for local dev)
3. **Content type**: `application/json`
4. **Secret**: Same as app webhook secret
5. **Events**: Select individual events:
   - [x] Issues
   - [x] Issue comments
   - [x] Pull requests
   - [x] Pull request reviews
   - [x] Pull request review comments
6. **Active**: Checked

## Success Criteria

- [ ] GitHub App created with correct permissions
- [ ] Private key generated and stored securely
- [ ] App installed on target repository
- [ ] Bot can authenticate and make API calls
- [ ] Bot identity shows as `autovibe-rator[bot]`
- [ ] Webhook configured on repository

## Next Steps

After this plan is complete and tested, convert to a GitHub issue and delete this file.
