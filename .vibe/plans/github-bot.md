# Plan: GitHub Bot Setup & Registration

**Mode**: PLAN - Do not implement. Convert to GitHub issue first.

**Priority**: High (Phase 1)
**Status**: Not Started
**Depends on**: mcp-setup.md (needs MCP tools available)

---

**PROCESS NOTE**: This plan will be converted to a GitHub issue. After all issues are created, you will tell me which one to implement. I will work in IMPLEMENT mode on that specific issue only.

**AGENT INSTRUCTION**: You are in PLAN mode. Read this file, ask clarifying questions if needed, but do NOT start implementation. When user says "implement" or "start", convert this to a GitHub issue and delete this file.

## Objective

Set up a GitHub App for the `autovibe-rator[bot]` identity. This provides authentication for the harness to post comments and reviews on GitHub.

## For Developer (@filejunkie) - Steps to Perform

**You must do these steps yourself. Vibe cannot create GitHub Apps on your behalf.**

### 1. Create GitHub App

In your browser:
1. Go to: https://github.com/settings/apps/new
2. Fill the form:
   - Application name: autovibe-rator
   - Homepage URL: https://github.com/FileJunkie/autovibe-rator
   - Callback URL: Leave blank
   - Webhook URL: Leave blank (set later)
   - Webhook Secret: Generate one and SAVE IT
3. Click "Create GitHub App"

### 2. Configure Permissions

On the app settings page:
- Under Repository permissions:
  - Check Issues: Read and write
  - Check Pull requests: Read and write
  - Check Contents: Read-only
  - Check Metadata: Read-only
- Scroll down and click Save

### 3. Generate Private Key

On the app settings page:
1. Scroll to "Private keys" section
2. Click "Generate a private key"
3. Save the downloaded .pem file as github-app-private-key.pem in project root
4. Add github-app-private-key.pem to .gitignore

WARNING: Never commit this file. It grants full access to your GitHub account.

### 4. Install App on Repository

1. Go to: https://github.com/apps/autovibe-rator/installations/new
2. Select your repository (FileJunkie/autovibe-rator)
3. Click "Install"
4. Note the Installation ID from the URL

### 5. Record Configuration

Create .env in project root (add to .gitignore) with these variables:
GITHUB_APP_ID=YOUR_APP_ID
GITHUB_APP_INSTALLATION_ID=YOUR_INSTALLATION_ID
GITHUB_APP_PRIVATE_KEY_PATH=./github-app-private-key.pem
GITHUB_WEBHOOK_SECRET=your_webhook_secret

Create .env.example (commit this to git) with empty values for the same variables.

### 6. Configure Webhook

1. Go to: https://github.com/FileJunkie/autovibe-rator/settings/hooks/new
2. Payload URL: https://your-server.com/webhook (set when deploying)
3. Content type: application/json
4. Secret: Use the webhook secret from step 1
5. Events: Check Issues, Issue comments, Pull requests, Pull request reviews, Pull request review comments
6. Active: Checked
7. Click "Add webhook"

## Notes

- You must do this yourself - Vibe cannot create GitHub Apps
- The bot will appear as autovibe-rator[bot] on GitHub
- Use ngrok for local testing: ngrok http 3000

## Success Criteria

- [ ] GitHub App created with correct permissions
- [ ] Private key saved securely (NOT in git)
- [ ] App installed on repository
- [ ] Bot identity confirmed as autovibe-rator[bot]
- [ ] .env and .env.example created
- [ ] .gitignore updated
- [ ] Webhook configured

## Next Steps

After this plan is complete and tested, convert to a GitHub issue and delete this file.
