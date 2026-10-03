# Item 9: Desktop Release Operations

## Objective

Improve Tauri releases with automated multi-platform builds, portable archives, and draft GitHub Releases.

## Status: Done

## What's Implemented

### Release Workflow (`.github/workflows/release.yml`)

Triggered by:
- Pushing a `v*` tag (e.g., `v0.1.0`)
- Manual dispatch from the Actions tab

### Build Matrix

| Platform | Runner | Target | Output |
|----------|--------|--------|--------|
| macOS ARM | `macos-latest` | `aarch64-apple-darwin` | `.app` bundle |
| macOS Intel | `macos-latest` | `x86_64-apple-darwin` | `.app` bundle |
| Linux | `ubuntu-22.04` | default | `.AppImage`, `.deb` |
| Windows | `windows-latest` | default | `.msi`, `.exe` |

### Windows Portable Build

In addition to installers, the workflow creates `ScarySpiderSEO-portable-windows-x64.zip` — a zero-install portable archive that can be unzipped and run directly.

### Release Process

1. `tauri-apps/tauri-action@v0` builds all platforms
2. Creates a draft GitHub Release named "Scary Spider SEO v*"
3. Attaches platform-specific installers
4. Windows job additionally packages and attaches the portable zip
5. Release body includes install instructions and unsigned-build warnings

### Release Notes

Auto-generated release body includes:
- Download instructions for each platform
- Note that builds are unsigned (Windows SmartScreen / macOS Gatekeeper warnings)
- Link to README for how to proceed past warnings

## How It Works

```
git tag v0.1.0
git push origin v0.1.0
  -> release.yml triggers
  -> Matrix builds on 4 runners in parallel
  -> Each builds Tauri app for its platform
  -> tauri-action creates draft release
  -> Windows job adds portable zip
  -> Draft release available for review
  -> Maintainer publishes when ready
```

## How to Verify

```bash
# Create a release
git tag v0.1.0
git push origin v0.1.0

# Check build status
gh run list --workflow=release.yml

# Download a specific release artifact
gh release download v0.1.0
```

## Gaps / TODO

- Builds are unsigned (expected for open-source without code-signing certificates)
- No checksum generation (SHA-256 for each artifact)
- No update manifest for Tauri auto-updates
- No release provenance attestation (SLSA)
- No automated changelog generation
