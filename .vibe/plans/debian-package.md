# Plan: Debian Package Creation

**Mode**: PLAN - Do not implement. Convert to GitHub issue first.

**Priority**: Medium (Phase 3)
**Status**: Not Started
**Depends on**: mcp-setup.md, github-bot.md, local-agent.md

---

**AGENT INSTRUCTION**: You are in PLAN mode. Read this file, ask clarifying questions if needed, but do NOT start implementation. When user says "implement" or "start", convert this to a GitHub issue and delete this file.

## Objective

Create a .deb package for the autovibe-rator agent that can be installed on Debian/Ubuntu systems. The package will:
- Install the binary to /usr/bin/autovibe-rator
- Install configuration to /etc/autovibe-rator/
- Set up a systemd service for automatic startup
- Include example configuration

## Background

From planning session: The final deliverable should be a .deb file that can be installed in a Debian repository. This allows users to easily install and manage the autovibe-rator service.

## Directory Structure

Debian package structure:
- debian/DEBIAN/control - Package metadata
- debian/DEBIAN/postinst - Post-installation script
- debian/DEBIAN/postrm - Post-removal script
- debian/DEBIAN/prerm - Pre-removal script
- debian/usr/bin/autovibe-rator - Symlink to actual binary
- debian/usr/lib/autovibe-rator/bin/autovibe-rator - Actual compiled binary
- debian/usr/lib/autovibe-rator/etc/config.json.example - Example config
- debian/lib/systemd/system/autovibe-rator.service - Systemd service file

## Implementation Steps

### 1. Install Build Dependencies

On Debian/Ubuntu:
- dpkg-dev
- dpkg-deb
- build-essential
- pkg-config

### 2. Package Metadata

Create debian/DEBIAN/control with:
- Package: autovibe-rator
- Version: from package.json
- Section: utils
- Priority: optional
- Architecture: amd64
- Maintainer: FileJunkie
- Description: Autonomous GitHub agent for Mistral Vibe
- Dependencies: nodejs (>= 20.0.0), npm
- Homepage: https://github.com/FileJunkie/autovibe-rator

### 3. Build the Binary

Use pkg to create a standalone binary:
- Input: compiled TypeScript from dist/agent/index.js
- Output: dist/autovibe-rator binary
- Target: node20-linux-x64

Update package.json scripts:
- pkg: runs pkg to build the binary
- deb: builds TypeScript, builds binary, builds .deb package

### 4. Debian File Structure Setup

Create the debian directory structure:
- debian/DEBIAN/ - control, postinst, postrm, prerm
- debian/usr/bin/ - symlink target
- debian/usr/lib/autovibe-rator/bin/ - binary location
- debian/usr/lib/autovibe-rator/etc/ - config example
- debian/lib/systemd/system/ - systemd service

### 5. Post-Installation Script (debian/DEBIAN/postinst)

Script that runs after package installation:
- Create /etc/autovibe-rator directory
- Copy config.json.example to config.json if it doesn't exist
- Set permissions on config.json to 600
- Create symlink from /usr/bin/autovibe-rator to the actual binary
- Reload systemd and enable the service (don't start automatically)
- Run ldconfig

Make it executable.

### 6. Pre-Removal Script (debian/DEBIAN/prerm)

Script that runs before package removal:
- Stop the autovibe-rator service if running

Make it executable.

### 7. Post-Removal Script (debian/DEBIAN/postrm)

Script that runs after package removal:
- Disable and stop the service
- Remove the symlink from /usr/bin/autovibe-rator
- Backup existing config.json to config.json.bak

Make it executable.

### 8. Systemd Service File

Create debian/lib/systemd/system/autovibe-rator.service with:

Unit section:
- Description: autovibe-rator - Autonomous GitHub agent for Mistral Vibe
- After: network.target

Service section:
- Type: simple
- User: autovibe-rator
- Group: autovibe-rator
- WorkingDirectory: /etc/autovibe-rator
- Environment: CONFIG_PATH=/etc/autovibe-rator/config.json
- Environment: NODE_ENV=production
- ExecStart: /usr/bin/autovibe-rator
- Restart: always
- RestartSec: 5
- NoNewPrivileges: true
- PrivateTmp: true
- ProtectSystem: strict
- ProtectHome: true
- ReadWritePaths: /etc/autovibe-rator

Install section:
- WantedBy: multi-user.target

### 9. Build Script

Create scripts/build-deb.sh that:
- Cleans previous builds
- Runs TypeScript build
- Builds binary with pkg
- Prepares debian directory structure
- Copies binary, config example, control file, scripts, service file
- Sets executable permissions
- Runs dpkg-deb --build debian
- Cleans up temporary files

### 10. Configuration Template

Create config.template.json in project root (commit to git) with:
- github.appId
- github.installationId
- github.privateKeyPath
- github.webhookSecret
- server.port
- server.host
- filter.allowedRepos
- filter.pingPatterns

## Testing the Package

### Build and Install Locally

1. Run: make deb or npm run deb
2. Install: sudo dpkg -i autovibe-rator.deb
3. Copy example config: sudo cp /usr/lib/autovibe-rator/etc/config.json.example /etc/autovibe-rator/config.json
4. Edit config with your values
5. Start service: sudo systemctl start autovibe-rator
6. Check status: sudo systemctl status autovibe-rator
7. Check logs: journalctl -u autovibe-rator -f

### Verify Installation

- which autovibe-rator returns /usr/bin/autovibe-rator
- autovibe-rator --version works
- /etc/autovibe-rator/ directory exists
- systemctl is-enabled autovibe-rator shows enabled
- systemctl is-active autovibe-rator shows active (after starting)

### Check Package Contents

- dpkg-deb --contents autovibe-rator.deb lists all files
- dpkg-deb --extract autovibe-rator.deb /tmp/deb-test for inspection

## Success Criteria

- [ ] .deb package builds without errors
- [ ] Package installs cleanly on Debian/Ubuntu
- [ ] Service starts and runs correctly
- [ ] Configuration directory and example created
- [ ] Binary is accessible at /usr/bin/autovibe-rator
- [ ] Systemd service is configured and can be managed

## Next Steps

After this plan is complete and tested, convert to a GitHub issue and delete this file.
