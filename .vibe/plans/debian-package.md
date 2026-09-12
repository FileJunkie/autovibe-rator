# Plan: Debian Package Creation

**Mode**: PLAN - Do not implement. Convert to GitHub issue first.

**Priority**: Medium (Phase 3)
**Status**: Not Started
**Depends on**: mcp-setup.md, github-bot.md, local-agent.md

---

**PROCESS NOTE**: This plan will be converted to a GitHub issue. After all issues are created, you will tell me which one to implement. I will work in IMPLEMENT mode on that specific issue only.

**AGENT INSTRUCTION**: You are in PLAN mode. Read this file, ask clarifying questions if needed, but do NOT start implementation. When user says "implement" or "start", convert this to a GitHub issue and delete this file.

## Objective

Create a .deb package for the autovibe-rator agent that can be installed on Debian/Ubuntu systems. The package will:
- Install the Docker image and helper scripts to /usr/bin/autovibe-rator
- Install configuration to /etc/autovibe-rator/
- Set up a systemd service for automatic startup
- Include example configuration
- Ensure Docker is installed as a dependency

## Background

From planning session: The final deliverable should be a .deb file that can be installed in a Debian repository. The agent uses Docker for sandboxing each invocation, so the package must ensure Docker is available.

## Directory Structure

Debian package structure:
- debian/DEBIAN/control - Package metadata
- debian/DEBIAN/postinst - Post-installation script
- debian/DEBIAN/postrm - Post-removal script
- debian/DEBIAN/prerm - Pre-removal script
- debian/usr/bin/autovibe-rator - Harness script (not the container itself)
- debian/usr/lib/autovibe-rator/ - Supporting files
- debian/usr/lib/autovibe-rator/Dockerfile - Container image definition
- debian/usr/lib/autovibe-rator/bin/ - Compiled harness binary
- debian/usr/lib/autovibe-rator/etc/config.json.example - Example config
- debian/usr/lib/autovibe-rator/scripts/build-image.sh - Docker image build script
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
- Description: Autonomous GitHub agent for Mistral Vibe using Docker sandboxing
- Dependencies: docker.io (or docker-ce), nodejs (>= 20.0.0), npm
- Homepage: https://github.com/FileJunkie/autovibe-rator

### 3. Docker Image

The .deb package should include or reference a Docker image. Options:
- Include Dockerfile in package, build on install (postinst script)
- Pre-build image and push to registry, package just ensures Docker is installed

For this plan, we will include the Dockerfile and build it during package installation.

### 4. Build the Harness Binary

Use pkg to create a standalone binary for the harness (the Node.js code that manages Docker containers). This binary:
- Manages Docker container lifecycle
- Handles webhook events
- Launches containers per invocation
- Does NOT include Vibe itself (Vibe runs inside containers)

### 5. Debian File Structure Setup

Create the debian directory structure:
- debian/DEBIAN/ - control, postinst, postrm, prerm
- debian/usr/bin/ - harness script
- debian/usr/lib/autovibe-rator/bin/ - harness binary
- debian/usr/lib/autovibe-rator/etc/ - config example
- debian/usr/lib/autovibe-rator/Dockerfile - container definition
- debian/usr/lib/autovibe-rator/scripts/ - helper scripts
- debian/lib/systemd/system/ - systemd service

### 6. Post-Installation Script (debian/DEBIAN/postinst)

Script that runs after package installation:
- Check if Docker is installed, error if not (or install it automatically)
- Build the Docker image from the included Dockerfile
- Create /etc/autovibe-rator directory
- Copy config.json.example to config.json if it doesn't exist
- Set permissions on config.json to 600
- Create symlink from /usr/bin/autovibe-rator to the harness binary
- Reload systemd and enable the service (don't start automatically to allow config)
- Run ldconfig

Make it executable.

### 7. Pre-Removal Script (debian/DEBIAN/prerm)

Script that runs before package removal:
- Stop the autovibe-rator service if running

Make it executable.

### 8. Post-Removal Script (debian/DEBIAN/postrm)

Script that runs after package removal:
- Disable and stop the service
- Remove the symlink from /usr/bin/autovibe-rator
- Remove the Docker image built during installation
- Backup existing config.json to config.json.bak

Make it executable.

### 9. Systemd Service File

Create debian/lib/systemd/system/autovibe-rator.service with:

Unit section:
- Description: autovibe-rator - Autonomous GitHub agent for Mistral Vibe
- After: network.target, docker.service
- Requires: docker.service

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
- ReadWritePaths: /etc/autovibe-rator /var/lib/docker

Install section:
- WantedBy: multi-user.target

### 10. Dockerfile

Create a Dockerfile that will be included in the package:
- Uses a Node.js base image (version 20 or later)
- Installs git for repository cloning
- Copies the necessary files for Vibe invocation inside containers
- Installs dependencies with npm ci
- Sets up the entry point to receive context and run Vibe
- Runs as non-root user for security
- Uses minimal base image for smaller size

This Dockerfile is used to build the image that will be used for each sandboxed invocation.

### 11. Build Script

Create scripts/build-deb.sh that:
- Cleans previous builds
- Runs TypeScript build
- Builds harness binary with pkg
- Builds Docker image from Dockerfile
- Prepares debian directory structure
- Copies harness binary, Dockerfile, config example, control file, scripts, service file
- Sets executable permissions
- Runs dpkg-deb --build debian
- Cleans up temporary files

## Testing the Package

### Build and Install Locally

1. Run: make deb or npm run deb
2. Install: sudo dpkg -i autovibe-rator.deb
3. If Docker is not installed, install it first: sudo apt install docker.io
4. Build the Docker image: sudo /usr/lib/autovibe-rator/scripts/build-image.sh
5. Copy example config: sudo cp /usr/lib/autovibe-rator/etc/config.json.example /etc/autovibe-rator/config.json
6. Edit config with your values
7. Start service: sudo systemctl start autovibe-rator
8. Check status: sudo systemctl status autovibe-rator
9. Check logs: journalctl -u autovibe-rator -f

### Verify Installation

- which autovibe-rator returns /usr/bin/autovibe-rator
- docker images shows the autovibe-rator image
- /etc/autovibe-rator/ directory exists
- systemctl is-enabled autovibe-rator shows enabled
- systemctl is-active autovibe-rator shows active (after starting)

### Check Package Contents

- dpkg-deb --contents autovibe-rator.deb lists all files
- dpkg-deb --extract autovibe-rator.deb /tmp/deb-test for inspection

## Success Criteria

- [ ] .deb package builds without errors
- [ ] Package installs cleanly on Debian/Ubuntu
- [ ] Docker dependency is properly handled (installed or error message)
- [ ] Docker image builds successfully during installation
- [ ] Service starts and runs correctly
- [ ] Configuration directory and example created
- [ ] Harness binary is accessible at /usr/bin/autovibe-rator
- [ ] Systemd service is configured and can be managed

## Next Steps

After this plan is complete and tested, convert to a GitHub issue and delete this file.
