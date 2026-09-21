# Item 1: Continuous Integration

## Objective

Create GitHub Actions workflows that run automated checks on every pull request, ensuring code quality and catching issues before merge.

## Status: Done

## What's Implemented

### CI Workflow (`.github/workflows/ci.yml`)

Runs on every PR into `main`/`staging` and pushes to `main`. Uses path-gating via `dorny/paths-filter@v3` so irrelevant jobs are skipped (GitHub treats skipped as passing for required checks).

| Job | Trigger Condition | What It Runs |
|-----|-------------------|--------------|
| `app-frontend` | Changes in `src/`, `src-tauri/`, root config | `npm ci`, `npm test`, `npm run build` |
| `app-backend` | Changes in `src/`, `src-tauri/`, root config | Install Linux deps, `cargo test` |
| `website` | Changes in `website/` | `npm ci`, `npm run lint`, `npm run cf:build` |
| `blog` | Changes in `blog/` | `npm ci`, `npm run lint`, `npm run cf:typegen`, `tsc --noEmit`, `npm run cf:build` |

### Dependency Scanning (`.github/dependabot.yml`)

Weekly Dependabot checks for all package ecosystems:

| Ecosystem | Directory | Group Name |
|-----------|-----------|------------|
| npm | `/` | `npm-root` |
| npm | `/website` | `npm-website` |
| npm | `/blog` | `npm-blog` |
| cargo | `/src-tauri` | `cargo` |
| github-actions | `/` | `actions` |

### Secret Scanning (`.github/workflows/secret-scan.yml`)

Gitleaks scans:
- Every pull request
- Pushes to `main`
- Weekly schedule (Monday 02:17 UTC)

### Code Scanning (`.github/workflows/codeql.yml`)

CodeQL Advanced analyzes:
- `actions` (GitHub Actions workflows)
- `javascript-typescript` (blog, website, desktop frontend)
- `rust` (desktop backend)

Runs on PRs to `main`, pushes to `main`, and weekly (Friday 23:26 UTC).

## How It Works

1. A PR is opened targeting `main` or `staging`
2. The `changes` job detects which directories were modified
3. Only relevant jobs run (e.g., a `website/` change skips Rust tests)
4. Branch protection requires all jobs to pass (skipped = passing)
5. Dependabot opens PRs weekly for dependency updates
6. Gitleaks and CodeQL run independently for security scanning

## How to Verify

```bash
# Check CI status on a PR
gh pr checks <pr-number>

# Run the same checks locally
npm test                    # frontend tests
cd src-tauri && cargo test  # backend tests
npm run build               # frontend build
```

## Gaps / TODO

None. All planned CI coverage is in place.
