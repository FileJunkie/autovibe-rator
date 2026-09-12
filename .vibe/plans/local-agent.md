# Plan: Locally Runnable Agent for Testing

**Mode**: PLAN - Do not implement. Convert to GitHub issue first.

**Priority**: Medium (Phase 2)
**Status**: Not Started
**Depends on**: mcp-setup.md, github-bot.md

---

**AGENT INSTRUCTION**: You are in PLAN mode. Read this file, ask clarifying questions if needed, but do NOT start implementation. When user says "implement" or "start", convert this to a GitHub issue and delete this file.

## Objective

Create a locally runnable agent/harness that can:
- Receive GitHub webhook events
- Filter them using two-stage logic
- Invoke Mistral Vibe with proper context in an isolated Docker container
- Post responses back to GitHub
- Automatically clean up after execution

This allows testing the full workflow before packaging.

## Background

From planning session:
- Trigger: GitHub Webhooks (real-time)
- Filtering: Two-stage (keyword + validation)
- Response: Comments + Reviews via GitHub App
- Safety: Docker sandboxing with automatic cleanup per invocation

## Architecture

Directory structure:
- src/agent/index.ts - Main harness entry point
- src/agent/webhook/server.ts - Express webhook receiver
- src/agent/webhook/verify.ts - GitHub webhook signature verification
- src/agent/webhook/handler.ts - Route events to appropriate processors
- src/agent/filter/stage1.ts - Keyword/ping filter
- src/agent/filter/stage2.ts - Event type, author, repo validation
- src/agent/vibe/invoke.ts - Invoke Vibe with context in Docker container
- src/agent/vibe/persona.md - Reviewer persona configuration
- src/agent/github/post-comment.ts - Post comment handler
- src/agent/github/post-review.ts - Post review handler
- src/utils/github-auth.ts - GitHub App authentication helper
- Dockerfile - Container image definition

## Implementation Steps

### 1. Express Webhook Server

Create an Express server that:
- Listens on a configurable port (default 3000)
- Has a POST /webhook endpoint
- Verifies GitHub webhook signatures
- Routes events to the appropriate handler
- Returns appropriate HTTP status codes

### 2. Webhook Verification

Implement signature verification that:
- Extracts x-hub-signature-256 header from request
- Uses the configured webhook secret
- Compares against the computed HMAC-SHA256 hash of the payload
- Uses timing-safe comparison to prevent timing attacks

### 3. Event Handler

Create a handler that processes GitHub events:
- Parse the x-github-event header to determine event type
- Route to specific handlers based on event type and action
- Handle issues:opened, issue_comment:created, pull_request:opened, pull_request:synchronize
- Wrap everything in try/catch with proper error logging

### 4. Two-Stage Filtering

Stage 1 Filter:
- Check if event is from the bot itself (autovibe-rator[bot]) - skip to avoid loops
- For issue comments: check if body contains @autovibe-rator or @autovibe-rator[bot]
- For new issues: check if title or body contains ping, or if issue has labels: needs-review or autovibe-rator
- Return true if any ping/label is found, false otherwise

Stage 2 Filter:
- Check if repository is in the allowed repos whitelist
- Verify the event action is one of the supported types
- Return true if valid, false otherwise

### 5. Vibe Invocation in Docker Container

Create a Docker-based invocation module that:
- Generates a unique container name per invocation (using timestamp + random string)
- Builds a prompt based on the event context (issue, comment, or PR)
- Prepends the reviewer persona to the prompt
- Runs Docker container with the --rm flag for automatic cleanup
- Passes the event payload and configuration to the container via environment variables
- Captures Vibe's output from the container
- Handles errors from the Docker process

The container will:
- Receive the event context via environment variables
- Clone the repository into its own isolated filesystem
- Run Vibe with the --agent auto-approve flag
- Post the response back to GitHub
- Exit, triggering automatic cleanup

The persona should define:
- Identity as autovibe-rator, a senior code reviewer
- Guidelines for thoroughness, constructiveness, respectfulness
- Response format for issues and PRs
- Available tools that Vibe can use

### 6. GitHub Response Handlers

Create handlers for posting to GitHub:
- postComment: posts a comment to an issue or PR using the GitHub App auth
- postReview: creates a PR review with APPROVE, REQUEST_CHANGES, or COMMENT event

### 7. Main Entry Point

Create src/agent/index.ts that:
- Imports the Express app from webhook/server
- Starts the server on the configured port
- Logs the webhook endpoint URL

### 8. Dockerfile

Create a Dockerfile that:
- Uses a Node.js base image (version 20 or later)
- Installs git for repository cloning
- Copies the project files
- Installs dependencies with npm ci
- Sets up the entry point to run the Vibe invocation
- Runs as non-root user for security

### 9. Docker Configuration

The harness needs Docker installed on the host system. The container should be run with:
- --rm flag for automatic cleanup on exit
- Unique container name per invocation for identification
- Environment variables for configuration and event data
- No volume mounts needed as the repo is cloned inside the container

### 10. Dependencies

Add to package.json:
- express for the webhook server
- @octokit/webhooks-types for type definitions

System dependencies:
- Docker daemon running on the host

### 11. Environment Variables

Required environment variables:
- GITHUB_WEBHOOK_SECRET: for verifying webhook signatures
- PORT: server port (default 3000)
- DOCKER_CMD: path to docker command (default "docker")

## Testing Setup

### Local Testing with ngrok

1. Install ngrok and Docker
2. Build the Docker image: docker build -t autovibe-agent .
3. Start the agent: npm run agent:dev
4. Start ngrok: ngrok http 3000
5. Copy the HTTPS URL from ngrok
6. Configure GitHub webhook with this URL + /webhook

### Test Scenarios

1. Create an issue with @autovibe-rator please review
2. Comment on an issue with @autovibe-rator
3. Add needs-review label to an issue
4. Open a PR with @autovibe-rator in the description

### Expected Behavior

- Stage 1 filter passes (ping or label detected)
- Stage 2 filter passes (repo in whitelist)
- Unique Docker container created for each event
- Vibe is invoked with proper context inside the container
- Response is posted as bot comment
- For PRs, also create a formal review
- Container automatically cleaned up after execution

## Success Criteria

- [ ] Webhook server receives and verifies GitHub events
- [ ] Two-stage filtering works correctly
- [ ] Docker container created per invocation with unique name
- [ ] Vibe runs successfully inside container
- [ ] Responses are posted back to GitHub
- [ ] Bot identity is correct (autovibe-rator[bot])
- [ ] Containers automatically cleaned up after execution
- [ ] Local testing with ngrok works
- [ ] Multiple concurrent invocations handled without conflicts

## Next Steps

After this plan is complete and tested, convert to a GitHub issue and delete this file.
