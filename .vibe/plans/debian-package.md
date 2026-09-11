# Plan: Debian Package Creation

**Mode**: PLAN - Do not implement. Convert to GitHub issue first.

**Priority**: Medium (Phase 3)
**Status**: Not Started
**Depends on**: mcp-setup.md, github-bot.md, local-agent.md
**Becomes Issue**: #4

---

**AGENT INSTRUCTION**: You are in PLAN mode. Read this file, ask clarifying questions if needed, but do NOT start implementation. When user says "implement" or "start", convert this to a GitHub issue and delete this file.

## Objective

Create a `.deb` package for the autovibe-rator agent that can be installed on Debian/Ubuntu systems. The package will:
- Install the binary to `/usr/bin/autovibe-rator`
- Install configuration to `/etc/autovibe-rator/`
- Set up a systemd service for automatic startup
- Include man pages for documentation

## Background

From planning session: The final deliverable should be a .deb file that can be installed in a Debian repository. This allows users to easily install and manage the autovibe-rator service.

## Directory Structure

```
autovibe-rator/
├── debian/                  # Debian packaging files
│   ├── DEBIAN/
│   │   ├── control         # Package metadata
│   │   ├── postinst        # Post-installation script
│   │   ├── postrm          # Post-removal script
│   │   └── prerm           # Pre-removal script
│   ├── usr/
│   │   ├── bin/
│   │   │   └── autovibe-rator  # Symlink to actual binary
│   │   └── lib/
│   │       └── autovibe-rator/  # Actual files
│   │           ├── bin/
│   │           │   └── autovibe-rator  # Compiled binary
│   │           └── etc/
│   │               └── config.json.example
│   └── lib/
│       └── systemd/
│           └── system/
│               └── autovibe-rator.service
└── ...
```

## Implementation Steps

### 1. Install Build Dependencies

```bash
# On Debian/Ubuntu
sudo apt-get update
sudo apt-get install -y dpkg-dev dpkg-deb build-essential pkg-config
```

### 2. Package Structure

**debian/DEBIAN/control**:
```
Package: autovibe-rator
Version: 0.1.0
Section: utils
Priority: optional
Architecture: amd64
Maintainer: FileJunkie <filejunkie@example.com>
Description: Autonomous GitHub agent for Mistral Vibe
 This package provides a local MCP server and webhook harness that enables
 Mistral Vibe to act as an autonomous code reviewer on GitHub repositories.
 .
 Features:
  - MCP server with GitHub tools
  - Webhook receiver for GitHub events
  - Two-stage filtering to minimize token usage
  - Automatic posting of reviews and comments

Depends: nodejs (>= 20.0.0), npm
Homepage: https://github.com/FileJunkie/autovibe-rator
```

### 3. Build the Binary

We have two options for the binary:

**Option A: Bundled Node.js + Source (Recommended)**
- Package includes Node.js runtime (for consistent environment)
- Or rely on system Node.js (smaller package, but version dependent)

**Option B: Compiled Binary with pkg**
- Use `pkg` to create a standalone binary
- No Node.js dependency
- Larger package size

We'll use **Option B** (pkg) for simplicity and reliability.

**package.json updates**:
```json
{
  "scripts": {
    "build": "tsc",
    "pkg": "pkg dist/agent/index.js --output dist/autovibe-rator --targets node20-linux-x64",
    "deb": "npm run build && npm run pkg && dpkg-deb --build debian"
  },
  "pkg": {
    "assets": [
      "node_modules/**/*",
      "dist/agent/**/*"
    ]
  }
}
```

### 4. Debian File Structure

```bash
# Create debian directory structure
mkdir -p debian/DEBIAN
mkdir -p debian/usr/bin
mkdir -p debian/usr/lib/autovibe-rator/bin
mkdir -p debian/usr/lib/autovibe-rator/etc
mkdir -p debian/lib/systemd/system
```

**debian/DEBIAN/postinst** (make executable):
```bash
#!/bin/sh

set -e

# Create config directory
mkdir -p /etc/autovibe-rator

# Copy example config if it doesn't exist
if [ ! -f /etc/autovibe-rator/config.json ]; then
    cp /usr/lib/autovibe-rator/etc/config.json.example /etc/autovibe-rator/config.json
    chmod 600 /etc/autovibe-rator/config.json
fi

# Create symlink for binary
ln -sf /usr/lib/autovibe-rator/bin/autovibe-rator /usr/bin/autovibe-rator

# Enable and start systemd service
if command -v systemctl >/dev/null 2>&1; then
    systemctl daemon-reload
    systemctl enable autovibe-rator
    # Don't start automatically - user should configure first
    # systemctl start autovibe-rator
fi

# Update ldconfig if needed
ldconfig

exit 0
```

**debian/DEBIAN/postrm** (make executable):
```bash
#!/bin/sh

set -e

# Disable and stop service
if command -v systemctl >/dev/null 2>&1; then
    systemctl stop autovibe-rator || true
    systemctl disable autovibe-rator || true
    systemctl daemon-reload
fi

# Remove symlink
rm -f /usr/bin/autovibe-rator

# Backup config but don't delete (user might want to keep it)
if [ -f /etc/autovibe-rator/config.json ]; then
    cp /etc/autovibe-rator/config.json /etc/autovibe-rator/config.json.bak
fi

exit 0
```

**debian/DEBIAN/prerm** (make executable):
```bash
#!/bin/sh

set -e

# Stop service before removal
if command -v systemctl >/dev/null 2>&1; then
    systemctl stop autovibe-rator || true
fi

exit 0
```

### 5. Systemd Service File

**debian/lib/systemd/system/autovibe-rator.service**:
```ini
[Unit]
Description=autovibe-rator - Autonomous GitHub agent for Mistral Vibe
After=network.target

[Service]
Type=simple
User=autovibe-rator
Group=autovibe-rator
WorkingDirectory=/etc/autovibe-rator
Environment=CONFIG_PATH=/etc/autovibe-rator/config.json
Environment=NODE_ENV=production
ExecStart=/usr/bin/autovibe-rator
Restart=always
RestartSec=5

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/etc/autovibe-rator

[Install]
WantedBy=multi-user.target
```

### 6. Build Script

Create `scripts/build-deb.sh`:
```bash
#!/bin/bash

set -e

echo "Building autovibe-rator..."

# Clean previous builds
rm -rf dist debian/DEBIAN/{postinst,postrm,prerm} debian/usr debian/lib

# Build TypeScript
npm run build

# Build binary with pkg
npm run pkg

# Prepare debian structure
echo "Preparing debian package structure..."

# Create directories
mkdir -p debian/DEBIAN
mkdir -p debian/usr/bin
mkdir -p debian/usr/lib/autovibe-rator/bin
mkdir -p debian/usr/lib/autovibe-rator/etc
mkdir -p debian/lib/systemd/system

# Copy binary
cp dist/autovibe-rator debian/usr/lib/autovibe-rator/bin/autovibe-rator
chmod +x debian/usr/lib/autovibe-rator/bin/autovibe-rator

# Copy config example
cp config.template.json debian/usr/lib/autovibe-rator/etc/config.json.example

# Copy control file
cp debian/DEBIAN/control debian/DEBIAN/control
chmod 644 debian/DEBIAN/control

# Copy scripts (make executable)
cp debian/DEBIAN/postinst debian/DEBIAN/postinst
cp debian/DEBIAN/postrm debian/DEBIAN/postrm
cp debian/DEBIAN/prerm debian/DEBIAN/prerm
chmod +x debian/DEBIAN/postinst debian/DEBIAN/postrm debian/DEBIAN/prerm

# Copy systemd service
cp debian/lib/systemd/system/autovibe-rator.service debian/lib/systemd/system/autovibe-rator.service

# Build the package
echo "Building .deb package..."
dpkg-deb --build debian

# Move to output
echo "Package built: autovibe-rator.deb"

# Clean up
rm -rf debian

echo "Done!"
```

### 7. Configuration Template

**config.template.json** (in root, commit to git):
```json
{
  "github": {
    "appId": "YOUR_GITHUB_APP_ID",
    "installationId": "YOUR_INSTALLATION_ID",
    "privateKeyPath": "/etc/autovibe-rator/github-app-private-key.pem",
    "webhookSecret": "YOUR_WEBHOOK_SECRET"
  },
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "filter": {
    "allowedRepos": [
      "FileJunkie/autovibe-rator"
    ],
    "pingPatterns": [
      "@autovibe-rator",
      "@autovibe-rator[bot]"
    ]
  }
}
```

### 8. Makefile (Optional)

```makefile
.PHONY: all build clean deb

all: build deb

build:
	npm run build
	npm run pkg

clean:
	rm -rf dist debian *.deb

deb: build
	rm -rf debian
	mkdir -p debian/DEBIAN debian/usr/bin debian/usr/lib/autovibe-rator/bin debian/usr/lib/autovibe-rator/etc debian/lib/systemd/system
	cp dist/autovibe-rator debian/usr/lib/autovibe-rator/bin/
	cp config.template.json debian/usr/lib/autovibe-rator/etc/config.json.example
	cp debian/DEBIAN/control debian/DEBIAN/
	cp debian/DEBIAN/postinst debian/DEBIAN/
	cp debian/DEBIAN/postrm debian/DEBIAN/
	cp debian/DEBIAN/prerm debian/DEBIAN/
	cp debian/lib/systemd/system/autovibe-rator.service debian/lib/systemd/system/
	chmod +x debian/DEBIAN/postinst debian/DEBIAN/postrm debian/DEBIAN/prerm
	chmod +x debian/usr/lib/autovibe-rator/bin/autovibe-rator
	dpkg-deb --build debian

.PHONY: test
install: deb
	sudo dpkg -i autovibe-rator.deb
```

## Testing the Package

### Build and Install Locally

```bash
# Build the package
make deb

# Install it
sudo dpkg -i autovibe-rator.deb

# Configure
sudo cp /usr/lib/autovibe-rator/etc/config.json.example /etc/autovibe-rator/config.json
sudo nano /etc/autovibe-rator/config.json  # Add your values

# Start the service
sudo systemctl start autovibe-rator
sudo systemctl status autovibe-rator

# Check logs
journalctl -u autovibe-rator -f
```

### Verify Installation

```bash
# Check binary
which autovibe-rator
autovibe-rator --version

# Check config
ls -la /etc/autovibe-rator/

# Check service
systemctl is-enabled autovibe-rator
systemctl is-active autovibe-rator
```

## Package Contents Check

After building, verify the .deb contains everything:

```bash
# List contents
dpkg-deb --contents autovibe-rator.deb

# Extract and inspect
dpkg-deb --extract autovibe-rator.deb /tmp/deb-test
find /tmp/deb-test -type f
```

## Success Criteria

- [ ] `.deb` package builds without errors
- [ ] Package installs cleanly on Debian/Ubuntu
- [ ] Service starts and runs correctly
- [ ] Configuration directory and example created
- [ ] Binary is accessible at `/usr/bin/autovibe-rator`
- [ ] Systemd service is configured and can be managed

## Next Steps

After this plan is complete and tested, convert to GitHub issue #4 and delete this file.
