# Plan: Publishing Workflow (gh-pages as Debian Repo)

**Mode**: PLAN - Do not implement. Convert to GitHub issue first.

**Priority**: Medium (Phase 4)
**Status**: Not Started
**Depends on**: debian-package.md

---

**AGENT INSTRUCTION**: You are in PLAN mode. Read this file, ask clarifying questions if needed, but do NOT start implementation. When user says "implement" or "start", convert this to a GitHub issue and delete this file.

## Objective

Set up a publishing workflow that:
1. Builds the `.deb` package on every release
2. Publishes it to `gh-pages` branch
3. Configures `gh-pages` as a Debian APT repository
4. Allows users to install via `apt`

## Background

From planning session: ".deb file will be published straight in the repo as gh-pages, so gh-pages work as a debian repo"

This means:
- `gh-pages` branch serves as the APT repository
- Users can add this repo to their sources and install via `apt install autovibe-rator`
- We need to generate the APT repository metadata (Packages, Packages.gz, Release, etc.)

## Architecture

```
GitHub Repository
├── main branch     # Source code, development
├── gh-pages branch # APT repository
│   └── dists/
│       └── stable/
│           ├── main/
│           │   ├── binary-amd64/
│           │   │   └── autovibe-rator_0.1.0_amd64.deb
│           │   ├── Packages
│           │   ├── Packages.gz
│           │   ├── Release
│           │   └── InRelease
│           └── ...
└── .github/
    └── workflows/
        └── publish.yml
```

## Implementation Steps

### 1. GitHub Actions Workflow

Create `.github/workflows/publish.yml`:

```yaml
name: Publish Debian Package

on:
  push:
    tags:
      - "v*"  # Trigger on version tags like v0.1.0, v1.0.0

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build project
        run: npm run build
      
      - name: Build binary with pkg
        run: npm run pkg
      
      - name: Build .deb package
        run: |
          npm run deb
          mkdir -p release
          cp autovibe-rator.deb release/
      
      - name: Prepare APT repository
        run: |
          # Install dpkg tools
          sudo apt-get update
          sudo apt-get install -y dpkg-dev
          
          # Create repository structure
          mkdir -p gh-pages/dists/stable/main/binary-amd64
          
          # Copy the .deb package with proper naming
          VERSION=${{ github.ref_name }}
          VERSION=${VERSION#v}  # Remove leading 'v'
          cp release/autovibe-rator.deb \
             gh-pages/dists/stable/main/binary-amd64/autovibe-rator_${VERSION}_amd64.deb
          
          # Generate Packages file
          cd gh-pages/dists/stable/main/binary-amd64
          dpkg-scanpackages . / > Packages
          gzip -k Packages
          cd ../../..
          
          # Create Release file (simplified, without signing)
          cat > dists/stable/Release << 'EOF'
Origin: autovibe-rator
Label: autovibe-rator
Suite: stable
Codename: stable
Architectures: amd64
Components: main
Description: Autonomous GitHub agent for Mistral Vibe
EOF
          
          # Create InRelease (empty for now, will be signed later)
          touch dists/stable/InRelease
          
          # Create Release.gpg and InRelease (signed versions)
          # For now, skip signing - users will need to add with [trusted=yes]
          # In production, you'd sign these with your GPG key
          
          cd ../../..
      
      - name: Update Release file with hashes
        run: |
          cd gh-pages/dists/stable
          
          # Calculate hashes
          SHA256=$(sha256sum main/binary-amd64/autovibe-rator_*_amd64.deb | awk '{print $1}')
          SHA1=$(sha1sum main/binary-amd64/autovibe-rator_*_amd64.deb | awk '{print $1}')
          MD5=$(md5sum main/binary-amd64/autovibe-rator_*_amd64.deb | awk '{print $1}')
          SIZE=$(stat -c%s main/binary-amd64/autovibe-rator_*_amd64.deb)
          FILENAME=$(basename main/binary-amd64/autovibe-rator_*_amd64.deb)
          
          cat > Release << EOF
Origin: autovibe-rator
Label: autovibe-rator
Suite: stable
Codename: stable
Architectures: amd64
Components: main
Description: Autonomous GitHub agent for Mistral Vibe
Date: $(date -u +"%a, %d %b %Y %H:%M:%S GMT")
Valid-Until: $(date -u -d "+365 days" +"%a, %d %b %Y %H:%M:%S GMT")

Files:
 $(echo " $SHA256 $SIZE $FILENAME")
 $(echo " $SHA1 $SIZE $FILENAME")
 $(echo " $MD5 $SIZE $FILENAME")
EOF
          
          cd ../../..
      
      - name: Commit and push to gh-pages
        run: |
          git config --global user.name "GitHub Actions"
          git config --global user.email "actions@github.com"
          
          cd gh-pages
          git init
          git add .
          git commit -m "Publish ${{ github.ref_name }} [skip ci]"
          
          # Push to gh-pages branch
          git remote add origin https://x-access-token:${{ secrets.GITHUB_TOKEN }}@github.com/${{ github.repository }}
          git push -u origin gh-pages --force
      
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: release/autovibe-rator.deb
          tag_name: ${{ github.ref_name }}
          name: autovibe-rator ${{ github.ref_name }}
          body: |
            ### Debian Package
            
            Install from our APT repository:
            
            ```bash
            echo "deb [trusted=yes] https://${{ github.repository_owner }}.github.io/${{ github.repository }}/ ./" | sudo tee /etc/apt/sources.list.d/autovibe-rator.list
            sudo apt update
            sudo apt install autovibe-rator
            ```
            
            Or download directly:
            - [autovibe-rator.deb](https://github.com/${{ github.repository }}/releases/download/${{ github.ref_name }}/autovibe-rator.deb)
        if: startsWith(github.ref, 'refs/tags/')
```

### 2. GitHub Pages Configuration

Create `.github/pages.yml` or configure in repo settings:
- **Source**: `gh-pages` branch
- **Folder**: `/ (root)`
- **Theme**: None needed (serving raw files)

### 3. User Installation Instructions

Create `INSTALL.md` in root:

```markdown
# Installation

## Quick Install (Recommended)

Add our APT repository and install:

```bash
# Add repository
echo "deb [trusted=yes] https://FileJunkie.github.io/autovibe-rator ./" | \
  sudo tee /etc/apt/sources.list.d/autovibe-rator.list

# Update package lists
sudo apt update

# Install
sudo apt install autovibe-rator
```

## Manual Install

Download the latest .deb from [Releases](https://github.com/FileJunkie/autovibe-rator/releases):

```bash
wget https://github.com/FileJunkie/autovibe-rator/releases/latest/download/autovibe-rator.deb
sudo dpkg -i autovibe-rator.deb
```

## Configuration

After installation:

1. Edit `/etc/autovibe-rator/config.json` with your GitHub App credentials
2. Start the service: `sudo systemctl start autovibe-rator`
3. Enable on boot: `sudo systemctl enable autovibe-rator`
4. Check status: `sudo systemctl status autovibe-rator`

## Uninstall

```bash
sudo apt remove autovibe-rator
# Or
sudo dpkg -r autovibe-rator
```

## Updating

```bash
sudo apt update
sudo apt upgrade autovibe-rator
```
```

### 4. GitHub Pages Index (Optional)

Create `index.html` in `gh-pages` branch for a simple landing page:

```html
<!DOCTYPE html>
<html>
<head>
    <title>autovibe-rator - APT Repository</title>
</head>
<body>
    <h1>autovibe-rator APT Repository</h1>
    <p>This is the APT repository for autovibe-rator Debian packages.</p>
    
    <h2>Installation</h2>
    <pre>echo "deb [trusted=yes] https://FileJunkie.github.io/autovibe-rator ./" | sudo tee /etc/apt/sources.list.d/autovibe-rator.list
sudo apt update
sudo apt install autovibe-rator</pre>
    
    <h2>Releases</h2>
    <p>See <a href="https://github.com/FileJunkie/autovibe-rator/releases">GitHub Releases</a> for .deb files.</p>
</body>
</html>
```

### 5. Repository Signing (Optional, Recommended for Production)

For production use, you should sign your repository with GPG:

1. Create a GPG key:
   ```bash
   gpg --full-generate-key
   ```

2. Export public key:
   ```bash
   gpg --export --armor YOUR_KEY_ID > public.key
   ```

3. Store private key as a GitHub Actions secret: `GPG_PRIVATE_KEY`

4. Update workflow to sign Release and InRelease files:
   ```yaml
   - name: Sign repository
     run: |
       echo "${{ secrets.GPG_PRIVATE_KEY }}" | gpg --import
       gpg --default-key YOUR_KEY_ID --armor --detach-sign --output Release.gpg Release
       gpg --default-key YOUR_KEY_ID --clearsign --output InRelease Release
   ```

5. Users can then install with:
   ```bash
   echo "deb https://FileJunkie.github.io/autovibe-rator ./" | sudo tee /etc/apt/sources.list.d/autovibe-rator.list
   wget -qO - https://FileJunkie.github.io/autovibe-rator/public.key | sudo apt-key add -
   sudo apt update
   ```

### 6. Version Management

Update `package.json` to use proper semantic versioning:

```json
{
  "version": "0.1.0"
}
```

Tag releases with `v` prefix:
```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow will:
1. Build the package with the version from the tag
2. Create the .deb with that version
3. Publish to gh-pages

### 7. Testing the Publishing Flow

1. Create a test tag:
   ```bash
   git tag v0.1.0-test
   git push origin v0.1.0-test
   ```

2. Wait for GitHub Actions to complete

3. Check gh-pages branch:
   ```bash
   git fetch origin gh-pages:gh-pages
   git checkout gh-pages
   ls -la dists/stable/main/binary-amd64/
   ```

4. Test APT repository locally:
   ```bash
   # Add to sources
   echo "deb [trusted=yes] file:/path/to/gh-pages ./" | sudo tee /etc/apt/sources.list.d/test.list
   
   # Update and test
   sudo apt update
   apt-cache show autovibe-rator
   ```

### 8. Cleanup Workflow

Add a workflow to clean up old packages from gh-pages:

`.github/workflows/cleanup.yml`:

```yaml
name: Cleanup Old Packages

on:
  schedule:
    - cron: "0 0 * * 0"  # Every Sunday at midnight

jobs:
  cleanup:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout gh-pages
        uses: actions/checkout@v4
        with:
          ref: gh-pages
          fetch-depth: 0
      
      - name: Remove old packages
        run: |
          git config --global user.name "GitHub Actions"
          git config --global user.email "actions@github.com"
          
          cd dists/stable/main/binary-amd64
          
          # Keep only last 10 versions
          ls -t *.deb | tail -n +11 | xargs rm -f
          
          # Rebuild Packages file
          cd ..
          dpkg-scanpackages binary-amd64 / > Packages
          gzip -k Packages
          
          # Update Release with new hashes
          # ... similar logic as publish workflow
          
          cd ../../..
          git add .
          git commit -m "Cleanup old packages [skip ci]" || echo "No changes"
          git push
```

## Success Criteria

- [ ] GitHub Actions workflow triggers on tag push
- [ ] Workflow builds .deb and generates APT repo metadata
- [ ] gh-pages branch contains proper APT repository structure
- [ ] Users can install via `apt` (with `[trusted=yes]` or signed)
- [ ] GitHub Release is created with .deb file
- [ ] Installation instructions work end-to-end

## Next Steps

After this plan is complete and tested, convert to a GitHub issue and delete this file.

## Final Notes

Once all plans are implemented and deleted:
1. The `.vibe/plans/` directory will be empty
2. All work will be tracked via GitHub issues
3. `AGENTS.md` and `CLAUDE.md` remain in root for agent instructions
4. The project will be fully operational as an autonomous GitHub reviewer
