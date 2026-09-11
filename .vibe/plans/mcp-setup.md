# Plan: Set Up Local MCP Server

**Mode**: PLAN - Do not implement. Convert to GitHub issue first.

**Priority**: High (Phase 1)
**Status**: Not Started
**Depends on**: Nothing
**Becomes Issue**: #1

---

**AGENT INSTRUCTION**: You are in PLAN mode. Read this file, ask clarifying questions if needed, but do NOT start implementation. When user says "implement" or "start", convert this to a GitHub issue and delete this file.

## Objective

Create a local MCP (Model Context Protocol) server that provides GitHub-specific tools for Mistral Vibe to use. This server will be part of the project and its configuration (excluding secrets) will be committed to git.

## Background

From planning session: We need Vibe to have access to GitHub operations through MCP. The MCP server will:
- Run locally alongside the project
- Provide tools that Vibe can call without direct API access
- Keep configuration in git (secrets in .env/.gitignore)

## Architecture

```
src/
└── mcp-server/
    ├── index.ts          # Server entry point
    └── github/
        ├── index.ts      # GitHub tools registrar
        ├── get-issue.ts  # Get issue details
        ├── get-pr.ts     # Get pull request details
        ├── search-issues.ts
        ├── create-comment.ts
        └── create-review.ts
```

## Tools to Implement

### Required Tools (Minimum Viable)

| Tool Name | Description | Input Schema |
|-----------|-------------|--------------|
| `github_get_issue` | Get details of a GitHub issue | `owner`, `repo`, `issue_number` |
| `github_get_pr` | Get details of a pull request | `owner`, `repo`, `pr_number` |
| `github_search_issues` | Search issues in a repo | `owner`, `repo`, `query`, `state`, `per_page` |
| `github_create_comment` | Create issue/PR comment | `owner`, `repo`, `issue_number`/`pr_number`, `body` |
| `github_create_review` | Create PR review | `owner`, `repo`, `pr_number`, `body`, `event` (APPROVE/REQUEST_CHANGES/COMMENT) |

### Nice-to-Have (Future)
- `github_list_pr_files` - List files changed in a PR
- `github_get_file_contents` - Get file contents from repo
- `github_create_issue` - Create new issues
- `github_update_issue` - Update issue labels/assignees

## Implementation Steps

### 1. Project Structure
```bash
mkdir -p src/mcp-server/github
```

### 2. Dependencies (package.json)
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.4.0",
    "@octokit/rest": "^20.0.0",
    "zod": "^3.22.0"
  }
}
```

### 3. MCP Server Entry Point (src/mcp-server/index.ts)
- Import and initialize McpServer from SDK
- Load configuration from `config.json` (github token)
- Register all GitHub tools
- Connect via StdioServerTransport
- Must handle config errors gracefully

### 4. Configuration
- Create `config.schema.json` - JSON Schema for config validation
- Config file: `config.json` (in .gitignore for secrets, but we'll have a template)
- Template in repo: `config.template.json` with placeholder values

Example config:
```json
{
  "github": {
    "token": "ghp_..."
  }
}
```

### 5. GitHub Tools Implementation
- Use `@octokit/rest` for all GitHub API calls
- Each tool validates input with zod
- Each tool returns structured content (text with formatting)
- Error handling: catch Octokit errors, return user-friendly messages
- Use `X-GitHub-Api-Version: 2022-11-28` header

### 6. TypeScript Configuration
- `tsconfig.json` with ESM modules
- Target: ES2020
- Out dir: `dist`

### 7. Build Script
```json
{
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/mcp-server/index.ts",
    "start": "node dist/mcp-server/index.js"
  }
}
```

## Vibe Configuration

Create/update `.vibe/config.toml`:
```toml
[[mcp_servers]]
name = "autovibe-rator"
transport = "stdio"
command = "node"
args = ["dist/mcp-server/index.js"]

[mcp_servers.env]
CONFIG_PATH = "./config.json"
```

## Testing

1. Build: `npm run build`
2. Create `config.json` with valid GitHub token
3. Start server: `npm start`
4. In another terminal, run Vibe: `vibe --agent auto-approve`
5. Test tool: `/mcp list` should show autovibe-rator tools
6. Test a call: Try creating a GitHub issue via Vibe

## Success Criteria

- [ ] MCP server starts without errors
- [ ] All 5 required tools are registered and callable
- [ ] Vibe can invoke tools and get responses
- [ ] Configuration is validated on startup
- [ ] Secrets are not in git

## Next Steps

After this plan is complete and tested, convert to GitHub issue #1 and delete this file.
