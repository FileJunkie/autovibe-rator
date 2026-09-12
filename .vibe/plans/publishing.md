# Plan: Publishing Workflow (gh-pages as Debian Repo)

**Mode**: PLAN - Do not implement. Convert to GitHub issue first.

**Priority**: Medium (Phase 4)
**Status**: Not Started
**Depends on**: debian-package.md

---

**AGENT INSTRUCTION**: You are in PLAN mode. Read this file, ask clarifying questions if needed, but do NOT start implementation. When user says "implement" or "start", convert this to a GitHub issue and delete this file.

## Objective

Set up a publishing workflow that:
1. Builds the .deb package on every release
2. Publishes it to gh-pages branch
3. Configures gh-pages as a Debian APT repository
4. Allows users to install via apt

## Background

From planning session: ".deb file will be published straight in the repo as gh-pages, so gh-pages work as a debian repo"

This means:
- gh-pages branch serves as the APT repository
- Users can add this repo to their sources and install via apt install autovibe-rator
- Need to generate APT repository metadata (Packages, Packages.gz, Release, InRelease)

## Architecture

GitHub Repository structure:
- main branch: Source code, development
- gh-pages branch: APT repository with dists/stable/main/binary-amd64/ structure

APT repository structure on gh-pages:
- dists/stable/main/binary-amd64/ - contains .deb files
- dists/stable/main/binary-amd64/Packages - package metadata
- dists/stable/main/binary-amd64/Packages.gz - compressed metadata
- dists/stable/Release - repository release info
- dists/stable/InRelease - signed release info (optional)

## Implementation Steps

### 1. GitHub Actions Workflow

Create .github/workflows/publish.yml that:
- Triggers on push to version tags (v*)
- Runs on ubuntu-latest
- Checks out code with full history
- Sets up Node.js 20
- Installs dependencies with npm ci
- Builds the project
- Builds the binary with pkg
- Builds the .deb package
- Prepares the APT repository structure
- Generates Packages and Packages.gz files using dpkg-scanpackages
- Creates Release file with hashes (SHA256, SHA1, MD5) and metadata
- Commits the repository to gh-pages branch
- Pushes to gh-pages
- Creates a GitHub Release with the .deb file attached

### 2. GitHub Pages Configuration

Configure in repository settings:
- Source: gh-pages branch
- Folder: / (root)
- Theme: None (serving raw files)

### 3. User Installation Instructions

Create INSTALL.md in project root with:

Quick Install section:
- Command to add the APT repository with deb [trusted=yes]
- apt update command
- apt install autovibe-rator command

Manual Install section:
- wget command to download latest .deb from releases
- dpkg -i command to install

Configuration section:
- Edit /etc/autovibe-rator/config.json
- Start the service with systemctl
- Enable on boot with systemctl enable
- Check status with systemctl status

Uninstall section:
- apt remove autovibe-rator or dpkg -r autovibe-rator

Updating section:
- apt update and apt upgrade autovibe-rator

### 4. GitHub Pages Index (Optional)

Create index.html in gh-pages branch for a simple landing page with:
- Project title and description
- Installation instructions
- Link to GitHub Releases page

### 5. Repository Signing (Optional, Recommended for Production)

For production use, sign the repository with GPG:
1. Create a GPG key
2. Export public key to the gh-pages branch
3. Store private key as GitHub Actions secret
4. Update workflow to sign Release and InRelease files
5. Update installation instructions to use signed repo (without trusted=yes)

### 6. Version Management

- Use semantic versioning in package.json
- Tag releases with v prefix (v0.1.0, v1.0.0, etc.)
- The workflow extracts version from tag name

### 7. Testing the Publishing Flow

1. Create a test tag: git tag v0.1.0-test && git push origin v0.1.0-test
2. Wait for GitHub Actions to complete
3. Check gh-pages branch for proper structure
4. Test APT repository locally by adding it as a file:// source

### 8. Cleanup Workflow

Create .github/workflows/cleanup.yml that:
- Runs on a schedule (e.g., every Sunday at midnight)
- Checks out gh-pages branch
- Removes old .deb packages (keep last 10 versions)
- Rebuilds Packages and Packages.gz
- Updates Release file with new hashes
- Commits and pushes changes

## APT Repository Structure Details

The gh-pages branch should have:
- dists/stable/main/binary-amd64/ - directory for amd64 .deb files
- dists/stable/main/binary-amd64/Packages - lists all packages with metadata
- dists/stable/main/binary-amd64/Packages.gz - gzipped version of Packages
- dists/stable/Release - contains repository metadata and file hashes
- dists/stable/InRelease - optional signed version of Release

## Success Criteria

- [ ] GitHub Actions workflow triggers on tag push
- [ ] Workflow builds .deb and generates APT repo metadata
- [ ] gh-pages branch contains proper APT repository structure
- [ ] Users can install via apt (with trusted=yes or signed)
- [ ] GitHub Release is created with .deb file
- [ ] Installation instructions work end-to-end

## Next Steps

After this plan is complete and tested, convert to a GitHub issue and delete this file.

## Final Notes

Once all plans are implemented and deleted:
1. The .vibe/plans/ directory will be empty
2. All work will be tracked via GitHub issues
3. AGENTS.md and CLAUDE.md remain in root for agent instructions
4. The project will be fully operational as an autonomous GitHub reviewer
