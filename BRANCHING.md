# Git Branching Strategy

This project follows **Git Flow** for organized development and releases.

## Branch Types

### Main Branches

#### `main` - Production Ready
- **Purpose**: Production-ready code only
- **Protection**: Requires PR review and all CI checks passing
- **Deployment**: Auto-deploys to production
- **Creation**: Never created directly; created from release branches

#### `develop` - Integration Branch
- **Purpose**: Development and testing branch
- **Protection**: Requires PR review and CI checks
- **Deployment**: Auto-deploys to staging
- **Source**: Starting point for feature branches

### Supporting Branches

#### `feature/*` - Feature Development
- **Pattern**: `feature/short-description` or `feature/issue-number-description`
- **Examples**:
  - `feature/seller-menu-crud`
  - `feature/123-otp-authentication`
  - `feature/buyer-order-placement`
  - `feature/rating-system`
- **Source**: Branch from `develop`
- **Target PR**: Pull request to `develop`
- **Delete after merge**: Yes

#### `bugfix/*` - Bug Fixes
- **Pattern**: `bugfix/short-description` or `bugfix/issue-number-description`
- **Examples**:
  - `bugfix/456-order-status-bug`
  - `bugfix/menu-price-validation`
- **Source**: Branch from `develop`
- **Target PR**: Pull request to `develop`

#### `hotfix/*` - Production Patches
- **Pattern**: `hotfix/critical-fix-description`
- **Examples**:
  - `hotfix/security-vulnerability`
  - `hotfix/database-crash`
- **Source**: Branch from `main`
- **Target PR**: Pull request to `main`, then merge back to `develop`

#### `release/*` - Release Preparation
- **Pattern**: `release/v1.0.0` or `release/1.0.0-rc.1`
- **Examples**:
  - `release/v1.0.0`
  - `release/v1.1.0-beta.1`
- **Source**: Branch from `develop` when ready for release
- **Target PR**: Pull request to `main`
- **Tasks**:
  - Version number updates
  - CHANGELOG updates
  - Final bug fixes only
- **After merge**: Tag on `main` (e.g., `git tag -a v1.0.0`)

## Workflow Diagram

```
main (production) ──────────────────────────────
  ↑                                              │
  │                                              │
  └─── release/v1.0.0 ───── tag: v1.0.0         │
  │       │ Update version                       │
  │       │ Update CHANGELOG                     │
  │       └─ PR to main ─────────────────────────
  │
develop (staging) ──────────────────────────────
  ↑
  ├─── feature/seller-menu ──────────┐
  │     └─ PR to develop ────────────┘
  │
  ├─── feature/buyer-orders ─────────┐
  │     └─ PR to develop ────────────┘
  │
  ├─── bugfix/issue-fix ─────────────┐
  │     └─ PR to develop ────────────┘
  │
  └─── hotfix/security (from main) ──┐
        └─ PR to main + merge to develop
```

## Pull Request Process

### Before Creating a PR

1. **Keep your branch updated:**
   ```bash
   git fetch origin
   git rebase origin/develop
   ```

2. **Run tests locally:**
   ```bash
   # Backend
   cd backend && pytest

   # Frontend
   cd frontend && npm test
   ```

3. **Run linting:**
   ```bash
   # Backend
   cd backend && black . && flake8 .

   # Frontend
   cd frontend && npm run lint -- --fix
   ```

### Creating a PR

1. **Push your branch:**
   ```bash
   git push origin feature/your-feature
   ```

2. **Create PR on GitHub:**
   - **Target**: `develop` (or `main` for hotfix)
   - **Title**: Follow conventional commit format
   - **Description**: Include:
     - What changed and why
     - Related issue: `Closes #123`
     - Testing done
     - Screenshots (if applicable)

### PR Checklist

Reviewers verify:
- [ ] Code follows project standards
- [ ] Tests included and passing
- [ ] Documentation updated
- [ ] No breaking changes
- [ ] Commit messages follow conventions
- [ ] No secrets exposed

### Merging

- **Feature/Bugfix**: Squash and merge (keep history clean)
- **Release**: Create merge commit (preserve structure)
- **Hotfix**: Rebase and merge

## Naming Conventions

| Type | Pattern | Example | Source → Target |
|------|---------|---------|-----------------|
| Feature | `feature/*` | `feature/menu-api` | develop → develop |
| Bugfix | `bugfix/*` | `bugfix/123-order-bug` | develop → develop |
| Hotfix | `hotfix/*` | `hotfix/security-fix` | main → main |
| Release | `release/*` | `release/v1.0.0` | develop → main |

## Key Commands

```bash
# Create and switch to feature branch
git checkout -b feature/your-feature develop

# Push branch
git push origin feature/your-feature

# Keep branch updated with develop
git fetch origin && git rebase origin/develop

# Merge with squash (recommended for features)
git checkout develop
git merge --squash feature/your-feature
git commit -m "feat: add new feature"
```

## Release Process

```bash
# 1. Create release branch
git checkout -b release/v1.0.0 develop

# 2. Update version numbers and CHANGELOG

# 3. Commit changes
git commit -m "chore: bump version to 1.0.0"

# 4. Push and create PR
git push origin release/v1.0.0
# Create PR to main

# 5. After merge, tag the release
git checkout main && git pull
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# 6. Merge back to develop
git checkout develop && git pull
git merge main
git push origin develop
```

## Local Setup

```bash
# Clone and set up
git clone https://github.com/yourusername/society-food-platform.git
cd society-food-platform

# Install pre-commit hooks
pip install pre-commit
pre-commit install

# Create feature branch
git checkout -b feature/your-feature develop
```

## FAQ

**Q: Can I merge directly to main?**
A: No. All changes go through develop first, then to main via release/hotfix branches.

**Q: What if my feature branch gets stale?**
A: Rebase regularly: `git fetch origin && git rebase origin/develop`

**Q: How do I sync my local develop?**
A: `git checkout develop && git pull origin develop`

**Q: When to use hotfix vs bugfix?**
A: Use `hotfix` for critical production bugs. Use `bugfix` for non-urgent issues.

## References

- [Git Flow Cheatsheet](https://danielkummer.github.io/git-flow-cheatsheet/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Commit Conventions](./COMMIT_CONVENTIONS.md)
