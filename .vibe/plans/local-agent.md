# Plan: Locally Runnable Agent for Testing

**Mode**: PLAN - Do not implement. Convert to GitHub issue first.

**Priority**: Medium (Phase 2)
**Status**: Not Started
**Depends on**: mcp-setup.md, github-bot.md
**Becomes Issue**: #3

---

**AGENT INSTRUCTION**: You are in PLAN mode. Read this file, ask clarifying questions if needed, but do NOT start implementation. When user says "implement" or "start", convert this to a GitHub issue and delete this file.

## Objective

Create a locally runnable agent/harness that can:
- Receive GitHub webhook events
- Filter them using two-stage logic
- Invoke Mistral Vibe with proper context
- Post responses back to GitHub

This allows testing the full workflow before packaging.

## Background

From planning session:
- **Trigger**: GitHub Webhooks (real-time)
- **Filtering**: Two-stage (keyword + validation)
- **Response**: Comments + Reviews via GitHub App

## Architecture

```
src/
└── agent/
    ├── index.ts          # Main harness entry point
    ├── webhook/
    │   ├── server.ts     # Express webhook receiver
    │   ├── verify.ts     # GitHub webhook signature verification
    │   └── handler.ts    # Route events to appropriate processors
    ├── filter/
    │   ├── stage1.ts     # Keyword/ping filter
    │   └── stage2.ts     # Event type, author, repo validation
    ├── vibe/
    │   ├── invoke.ts     # Invoke Vibe with context
    │   └── persona.ts    # Reviewer persona configuration
    └── github/
        ├── post-comment.ts
        └── post-review.ts
```

## Implementation Steps

### 1. Express Webhook Server

**File**: `src/agent/webhook/server.ts`

```typescript
import express from "express";
import { verifyWebhook } from "./verify";
import { handleEvent } from "./handler";

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET!;

app.use(express.json());

app.post("/webhook", async (req, res) => {
  // Verify signature
  const signature = req.headers["x-hub-signature-256"] as string;
  if (!verifyWebhook(signature, req.body, WEBHOOK_SECRET)) {
    return res.status(401).send("Invalid signature");
  }

  // Handle event
  const event = req.headers["x-github-event"] as string;
  const payload = req.body;
  
  try {
    await handleEvent(event, payload);
    res.status(200).send("OK");
  } catch (error) {
    console.error("Error handling event:", error);
    res.status(500).send("Error");
  }
});

app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});

export default app;
```

### 2. Webhook Verification

**File**: `src/agent/webhook/verify.ts`

```typescript
import crypto from "crypto";

export function verifyWebhook(
  signature: string,
  payload: any,
  secret: string
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = Buffer.from(
    "sha256=" + hmac.update(JSON.stringify(payload)).digest("hex")
  );
  const expected = Buffer.from(signature);
  
  return crypto.timingSafeEqual(digest, expected);
}
```

### 3. Event Handler

**File**: `src/agent/webhook/handler.ts`

```typescript
import { IssueEvent, PullRequestEvent, IssueCommentEvent } from "@octokit/webhooks-types";
import { stage1Filter, stage2Filter } from "../filter";
import { invokeVibe } from "../vibe/invoke";

type GitHubEvent = IssueEvent | PullRequestEvent | IssueCommentEvent;

export async function handleEvent(event: string, payload: any) {
  console.log(`Received event: ${event}`);
  
  switch (event) {
    case "issues":
      if (payload.action === "opened") {
        await handleNewIssue(payload as IssueEvent);
      }
      break;
    case "issue_comment":
      if (payload.action === "created") {
        await handleNewComment(payload as IssueCommentEvent);
      }
      break;
    case "pull_request":
      if (payload.action === "opened" || payload.action === "synchronize") {
        await handleNewPR(payload as PullRequestEvent);
      }
      break;
    case "pull_request_review_comment":
      if (payload.action === "created") {
        await handlePRComment(payload);
      }
      break;
    default:
      console.log(`Ignoring event: ${event}`);
  }
}

async function handleNewIssue(event: IssueEvent) {
  if (!stage1Filter(event)) return;
  if (!stage2Filter(event)) return;
  
  await invokeVibe({
    type: "issue",
    action: "review",
    payload: event,
  });
}

async function handleNewComment(event: IssueCommentEvent) {
  if (!stage1Filter(event)) return;
  if (!stage2Filter(event)) return;
  
  await invokeVibe({
    type: "comment",
    action: "respond",
    payload: event,
  });
}

// Similar for PR events
```

### 4. Two-Stage Filtering

**File**: `src/agent/filter/stage1.ts`

```typescript
import { IssueEvent, IssueCommentEvent, PullRequestEvent } from "@octokit/webhooks-types";

type FilterableEvent = IssueEvent | IssueCommentEvent | PullRequestEvent;

export function stage1Filter(event: FilterableEvent): boolean {
  // Check if this is from the bot itself (avoid loops)
  const botUsername = "autovibe-rator[bot]";
  const sender = event.sender?.login;
  if (sender === botUsername) {
    console.log("Skipping: event from bot itself");
    return false;
  }

  // For issue comments, check if pinged
  if ("comment" in event && event.comment) {
    const body = event.comment.body;
    const pingPatterns = [
      `@autovibe-rator`,
      `@autovibe-rator[bot]`,
    ];
    
    const pinged = pingPatterns.some(pattern => body.includes(pattern));
    if (!pinged) {
      console.log("Skipping: no ping found in comment");
      return false;
    }
  }

  // For new issues, check labels or title
  if ("issue" in event) {
    const issue = event.issue;
    const hasLabel = issue.labels?.some(l => 
      l.name === "needs-review" || l.name === "autovibe-rator"
    );
    const hasTitlePing = issue.title?.includes("@autovibe-rator");
    const hasBodyPing = issue.body?.includes("@autovibe-rator");
    
    if (!hasLabel && !hasTitlePing && !hasBodyPing) {
      console.log("Skipping: no ping or label in issue");
      return false;
    }
  }

  return true;
}
```

**File**: `src/agent/filter/stage2.ts`

```typescript
import { IssueEvent, IssueCommentEvent, PullRequestEvent } from "@octokit/webhooks-types";

type FilterableEvent = IssueEvent | IssueCommentEvent | PullRequestEvent;

export function stage2Filter(event: FilterableEvent): boolean {
  const repo = event.repository?.full_name;
  
  // Whitelist of repositories to monitor
  const allowedRepos = [
    "FileJunkie/autovibe-rator",
    // Add more as needed
  ];
  
  if (!repo || !allowedRepos.includes(repo)) {
    console.log(`Skipping: repo ${repo} not in whitelist`);
    return false;
  }

  // Only allow certain event types
  const validEvents = ["issues", "issue_comment", "pull_request"];
  const eventType = event.action;
  
  if (!validEvents.includes(eventType)) {
    console.log(`Skipping: action ${eventType} not supported`);
    return false;
  }

  return true;
}
```

### 5. Vibe Invocation

**File**: `src/agent/vibe/invoke.ts`

```typescript
import { spawn } from "child_process";
import { readFileSync } from "fs";

export interface VibeContext {
  type: "issue" | "comment" | "pr";
  action: "review" | "respond";
  payload: any;
}

export async function invokeVibe(context: VibeContext): Promise<string> {
  // Build prompt based on context
  const prompt = buildPrompt(context);
  
  // Get Vibe command
  const vibeCmd = process.env.VIBE_CMD || "vibe";
  
  return new Promise((resolve, reject) => {
    const child = spawn(vibeCmd, [
      "--agent", "auto-approve",
      "--prompt", prompt,
    ], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    let errorOutput = "";
    
    child.stdout?.on("data", (data) => {
      output += data.toString();
    });
    
    child.stderr?.on("data", (data) => {
      errorOutput += data.toString();
    });
    
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Vibe exited with code ${code}: ${errorOutput}`));
      } else {
        resolve(output);
      }
    });
  });
}

function buildPrompt(context: VibeContext): string {
  const persona = readFileSync("src/agent/vibe/persona.md", "utf-8");
  
  let contextInfo = "";
  
  switch (context.type) {
    case "issue":
      const issue = context.payload.issue;
      contextInfo = `
You are reviewing a new GitHub issue:

**Repository**: ${context.payload.repository.full_name}
**Issue**: #${issue.number} - ${issue.title}
**Author**: ${issue.user.login}
**URL**: ${issue.html_url}
**Body**:
${issue.body}

Please provide a thorough code review response.
`;
      break;
    case "comment":
      const comment = context.payload.comment;
      contextInfo = `
You are responding to a GitHub comment:

**Repository**: ${context.payload.repository.full_name}
**Issue/PR**: #${comment.issue_url.split("/").pop()}
**Comment Author**: ${comment.user.login}
**Comment**:
${comment.body}

Please provide an appropriate response.
`;
      break;
    case "pr":
      const pr = context.payload.pull_request;
      contextInfo = `
You are reviewing a pull request:

**Repository**: ${context.payload.repository.full_name}
**PR**: #${pr.number} - ${pr.title}
**Author**: ${pr.user.login}
**URL**: ${pr.html_url}
**Changes**: ${pr.changed_files} files changed

Please review the changes and provide feedback.
`;
      break;
  }
  
  return `${persona}\n\n---\n\n${contextInfo}`;
}
```

**File**: `src/agent/vibe/persona.md`

```markdown
# Code Review Persona

You are an autonomous senior code reviewer named **autovibe-rator**. Your purpose is to provide thorough, constructive code reviews on GitHub repositories.

## Guidelines

1. **Be Thorough**: Review all aspects of the code - logic, security, performance, readability
2. **Be Constructive**: Always provide actionable feedback
3. **Be Respectful**: Remember there's a human on the other end
4. **Be Specific**: Reference exact lines, files, and code snippets
5. **Prioritize**: Focus on critical issues first, then suggestions

## Response Format

### For Issues:
- Acknowledge the issue
- Ask clarifying questions if needed
- Suggest solutions or alternatives

### For Pull Requests:
Use the format:
```
## Summary
[Brief overview of the PR]

## Strengths
- [What's good]
- [What's good]

## Concerns
- **[CRITICAL]** [Issue that must be fixed]
- **[SUGGESTION]** [Improvement idea]

## Nits
- [Minor style/readability improvements]
```

## Tools Available

You have access to GitHub tools via MCP:
- `github_get_issue` - Get issue details
- `github_get_pr` - Get PR details
- `github_create_comment` - Post a comment
- `github_create_review` - Create a PR review

Use these tools to gather more context when needed.
```

### 6. GitHub Response Handlers

**File**: `src/agent/github/post-comment.ts`

```typescript
import { Octokit } from "@octokit/rest";
import { getGitHubAuth } from "../../utils/github-auth";

export async function postComment(
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
) {
  const auth = await getGitHubAuth();
  const octokit = new Octokit({ auth });
  
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
  
  console.log(`Posted comment to ${owner}/${repo}#${issueNumber}`);
}
```

**File**: `src/agent/github/post-review.ts`

```typescript
import { Octokit } from "@octokit/rest";
import { getGitHubAuth } from "../../utils/github-auth";

type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

export async function postReview(
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
  event: ReviewEvent = "COMMENT"
) {
  const auth = await getGitHubAuth();
  const octokit = new Octokit({ auth });
  
  await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: prNumber,
    body,
    event,
  });
  
  console.log(`Posted review (${event}) to ${owner}/${repo}#${prNumber}`);
}
```

### 7. Main Entry Point

**File**: `src/agent/index.ts`

```typescript
import app from "./webhook/server";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`autovibe-rator agent listening on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
});
```

### 8. Package.json Scripts

```json
{
  "scripts": {
    "agent:dev": "ts-node src/agent/index.ts",
    "agent:build": "tsc -p tsconfig.agent.json",
    "agent:start": "node dist/agent/index.js"
  }
}
```

### 9. Environment Variables

Add to `.env`:
```bash
# Webhook
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here
PORT=3000

# Vibe
VIBE_CMD=vibe
```

## Testing Setup

### Local Testing with ngrok

1. Install ngrok: `npm install -g ngrok`
2. Start agent: `npm run agent:dev`
3. Start ngrok: `ngrok http 3000`
4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
5. Configure GitHub webhook with this URL + `/webhook`

### Test Scenarios

1. **Ping in issue**: Create issue with `@autovibe-rator please review`
2. **Ping in comment**: Comment on issue with `@autovibe-rator`
3. **Label trigger**: Add `needs-review` label to issue
4. **PR review**: Open PR, add `@autovibe-rator` in description

### Expected Behavior

- Stage 1 filter passes (ping or label detected)
- Stage 2 filter passes (repo in whitelist)
- Vibe is invoked with proper context
- Response is posted as bot comment + PR review (if applicable)

## Success Criteria

- [ ] Webhook server receives and verifies GitHub events
- [ ] Two-stage filtering works correctly
- [ ] Vibe is invoked with proper context
- [ ] Responses are posted back to GitHub
- [ ] Bot identity is correct
- [ ] Local testing with ngrok works

## Next Steps

After this plan is complete and tested, convert to GitHub issue #3 and delete this file.
