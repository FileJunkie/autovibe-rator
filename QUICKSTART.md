# autovibe-rator Quick Start

## Prerequisites
- Node.js 22+
- Docker
- GitHub App with **Contents**, **Issues**, and **Pull requests** all set to
  Read & write (Repository permissions)
- ngrok

---

## Setup

### 1. Get Your GitHub App ID
Go to https://github.com/settings/apps and find your app. Copy the **App ID**.

### 2. Update Environment Configuration
Edit `.env` and set:
```bash
GITHUB_APP_ID=123456
ALLOWED_OWNERS=your-username
```
(Keep the rest as-is - webhook secret and private key path are already configured.)

**Note**: `ALLOWED_OWNERS` is a list of GitHub user/org logins whose repos the
bot may work on (comma-separated). The harness refuses to start without at
least one, so it never runs the agent for unexpected GitHub App installations.
Add more logins to grant more users. By default only repo collaborators
(`OWNER`/`MEMBER`/`COLLABORATOR`) can trigger the bot; see
`ALLOWED_ASSOCIATIONS` in `.env.example`.

### 3. Build Docker Image
```bash
npm run docker:build
```
This builds the `autovibe-agent` image used for sandboxed Vibe execution.

### 4. Start ngrok
In a separate terminal:
```bash
ngrok http 3000
```
Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`).

### 5. Update GitHub App Webhook
In your GitHub App settings:
- **Webhook URL**: `<your-ngrok-url>/webhook` (e.g., `https://abc123.ngrok.io/webhook`)
- **Webhook Secret**: use the value of `GITHUB_WEBHOOK_SECRET` from your `.env`
- **Events**: `issue_comment`, `pull_request`, `issues`

### 6. Run the Harness
```bash
npm run agent:dev
```
You should see: `autovibe-rator listening on port 3000`

---

## Test Installation

### 7. Install App on Test Repository
Go to your GitHub App settings → **Install App** → Select your test repo.

**Note**: The installation ID is automatically extracted from webhook payloads. No manual configuration needed.

### 8. Trigger the Bot
In your test repo, create a PR or issue and mention `@autovibe-rator` in:
- PR description
- Issue description  
- Any comment

Example:
```
@autovibe-rator please review this PR
```

---

## Verify It Works

1. Check your harness terminal for structured log lines:
   ```
   2026-10-03T19:33:20.344Z INFO  [vibe] Using Docker sandbox invocation
   2026-10-03T19:33:20.345Z INFO  [vibe] Cloning https://github.com/<owner>/<repo>.git into /tmp/vibe-runs/...
   2026-10-03T19:33:21.232Z INFO  [docker] sandbox run: autovibe-... (autovibe-agent)
   2026-10-03T19:34:02.178Z INFO  [vibe] push outcome: pushed 2 commit(s) to autovibe-rator/issue-42
   2026-10-03T19:34:02.732Z INFO  [webhook] issue_comment: Event processed successfully
   ```

2. Check GitHub:
   - The issue/PR has the bot's comment (the agent's response plus a
     footer stating the push outcome)
   - If the agent made changes, the branch (e.g. `autovibe-rator/issue-42`)
     appeared on the repository

---

## Important Notes

- **Private Key**: `github-app.pem` is in `.gitignore` - never commit it
- **Webhook Secret**: Already configured in `.env`
- **Docker**: Each Vibe invocation runs in an isolated container with `--rm` (auto-cleanup)
- **Port**: Default is 3000. Change in `.env` if needed.

---

## Troubleshooting

### Webhook not received?
- Verify ngrok is running and accessible
- Check GitHub App webhook URL is correct
- Verify webhook secret matches

### 401 Invalid signature?
- Ensure `GITHUB_WEBHOOK_SECRET` in `.env` matches your GitHub App webhook secret

### No response from bot?
- Check harness logs for errors
- Verify you're mentioning `@autovibe-rator` (case insensitive)
- Ensure your bot isn't replying to itself (filtered out)
- `Author association ... is not allowed` in the logs means the trigger
  author isn't a repo collaborator (or the permission lookup failed)

### 403 Permission denied on push?
- The GitHub App needs **Contents: Read & write** (Repository permissions)
- After changing App permissions, the **installation** must accept the new
  permissions: Settings → Applications → Installed GitHub Apps → your app →
  Configure, or uninstall/reinstall. Until then the installation token still
  carries the old permissions.

### Agent runs but the comment says nothing / missing MISTRAL_API_KEY?
- The sandbox gets its API key from the harness environment; add
  `MISTRAL_API_KEY=...` to the project `.env` and restart the harness

### Docker errors?
- Verify Docker is running
- Check the image was built: `docker images | grep autovibe-agent`
- Test the image directly: `docker run --rm --entrypoint vibe autovibe-agent --version`
