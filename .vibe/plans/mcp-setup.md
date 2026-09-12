# Plan: Set Up Local MCP Server

**Mode**: PLAN - Do not implement. Convert to GitHub issue first.

**Priority**: High (Phase 1)
**Status**: Not Started
**Depends on**: Nothing

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

Directory structure:
- src/mcp-server/index.ts - Server entry point
- src/mcp-server/github/index.ts - GitHub tools registrar
- src/mcp-server/github/get-issue.ts - Get issue details
- src/mcp-server/github/get-pr.ts - Get pull request details
- src/mcp-server/github/search-issues.ts - Search issues
- src/mcp-server/github/create-comment.ts - Create comments
- src/mcp-server/github/create-review.ts - Create reviews

## Tools to Implement

### Required Tools (Minimum Viable)

- `github_get_issue` - Get details of a GitHub issue. Inputs: owner, repo, issue_number
- `github_get_pr` - Get details of a pull request. Inputs: owner, repo, pr_number
- `github_search_issues` - Search issues in a repo. Inputs: owner, repo, query, state, per_page
- `github_create_comment` - Create issue/PR comment. Inputs: owner, repo, issue_number/pr_number, body
- `github_create_review` - Create PR review. Inputs: owner, repo, pr_number, body, event (APPROVE/REQUEST_CHANGES/COMMENT)

### Nice-to-Have (Future)

- `github_list_pr_files` - List files changed in a PR
- `github_get_file_contents` - Get file contents from repo
- `github_create_issue` - Create new issues
- `github_update_issue` - Update issue labels/assignees

## Implementation Steps

### 1. Project Structure

Create directory: src/mcp-server/github

### 2. Dependencies

Add to package.json:
- @modelcontextprotocol/sdk (version 0.4.0 or later)
- @octokit/rest (version 20.0.0 or later)
- zod (version 3.22.0 or later)

### 3. MCP Server Entry Point

Create src/mcp-server/index.ts that:
- Imports and initializes McpServer from the MCP SDK
- Loads configuration from config.json (containing github token)
- Registers all GitHub tools
- Connects via StdioServerTransport
- Handles config errors gracefully with clear error messages

### 4. Configuration

- Create config.schema.json for JSON Schema validation of the config file
- Config file: config.json (add to .gitignore since it contains secrets)
- Create config.template.json with placeholder values (this can be committed to git)

Example config fields needed: github.token

### 5. GitHub Tools Implementation

Each tool file should:
- Use @octokit/rest for all GitHub API calls
- Validate input with zod schemas
- Return structured content with proper text formatting
- Handle Octokit errors and return user-friendly messages
- Use X-GitHub-Api-Version: 2022-11-28 header for all requests

### 6. TypeScript Configuration

Create tsconfig.json with:
- Target: ES2020
- Module: ESM
- Root dir: src
- Out dir: dist

### 7. Build Scripts

Add to package.json scripts section:
- build: runs TypeScript compiler
- dev: runs server with ts-node for development
- start: runs compiled server with node

## Vibe Configuration

Create or update .vibe/config.toml to include:
- An mcp_servers entry named autovibe-rator
- transport set to stdio
- command set to node
- args pointing to the compiled server entry point
- env setting CONFIG_PATH to ./config.json

## Testing

1. Run build script
2. Create config.json with a valid GitHub token
3. Start the server
4. In another terminal, run Vibe with auto-approve agent
5. Use /mcp list to verify autovibe-rator tools appear
6. Test by invoking a tool to create a GitHub issue

## Success Criteria

- [ ] MCP server starts without errors
- [ ] All 5 required tools are registered and callable
- [ ] Vibe can successfully invoke tools and receive responses
- [ ] Configuration is validated on startup
- [ ] Secrets are properly excluded from git

## Next Steps

After this plan is complete and tested, convert to a GitHub issue and delete this file.
