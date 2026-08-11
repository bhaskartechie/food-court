# Commit Conventions

This project follows **Conventional Commits** specification for clear, automated changelog generation and versioning.

## Format

```
<type>(<scope>): <description>

<body>

<footer>
```

## Type

Must be one of:
- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, semicolons, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Build/tool/CI configuration changes

## Scope (Recommended)

Indicates what part of the system is affected:
- **auth**: Authentication/OTP login
- **seller**: Seller-related features
- **menu**: Menu management
- **order**: Order placement/management
- **rating**: Rating and reviews
- **admin**: Admin features
- **api**: API endpoints
- **db**: Database changes
- **frontend**: React UI
- **docker**: Docker configuration
- **ci**: CI/CD pipeline
- **docs**: Documentation

## Description

- Use imperative mood: "add feature" not "added feature"
- Lowercase, no period at end
- Max 50 characters
- Specific and concise

## Examples

### Features

```
feat(auth): implement OTP login via email

Implement OTP generation and validation for resident login.
Supports both email and WhatsApp delivery (optional).
```

```
feat(seller): create menu management API

- Add menu item CRUD operations
- Set daily availability
- Update prices in real-time
```

### Bug Fixes

```
fix(order): correct order status display in buyer dashboard

Order status wasn't updating after seller marked as ready.
Implemented WebSocket subscription for real-time updates.

Closes #45
```

### Improvements

```
perf(api): optimize seller menu query with database indexing

Added composite index on (seller_id, date) to reduce query time
from 500ms to 50ms for average case.
```

### Documentation

```
docs: add API endpoint examples for menu management

Include sample requests and responses for all menu endpoints.
```

### Chores

```
chore(ci): upgrade Python to 3.11 in GitHub Actions
```

### Multiple Related Changes

```
feat(order): implement order status and real-time updates

- Add order status enum (pending, accepted, ready, completed)
- Implement WebSocket for real-time status updates
- Add order history tracking
- Test cases for all status transitions

Closes #78
```

## Rules

✅ DO:
- Start with type(scope)
- Use imperative mood
- Reference issues: `Closes #123`
- Keep subject under 50 chars
- Capitalize scope: `auth`, `seller`, `menu`
- Use lowercase for type
- Add body for complex changes

❌ DON'T:
- Don't capitalize subject
- Don't add period to subject
- Don't use vague messages
- Don't mix unrelated changes

## Breaking Changes

For breaking changes, add `!` before colon:

```
feat(api)!: change menu API response format

BREAKING CHANGE: Menu items now return as array instead of object.
Old: { menu: [...] }
New: [{ id: 1, name: "..." }]

Migration: Update client code to access array directly.
```

## Pre-commit Validation

This project uses pre-commit hooks to validate commit messages:

```bash
pip install pre-commit
pre-commit install --hook-type commit-msg
```

If message doesn't follow conventions:
```
✗ Commit message does not follow Conventional Commits

Examples:
  feat(scope): add new feature
  fix(scope): resolve bug
  docs: update documentation
```

## Automated Changelog

Commits are grouped automatically into changelog:
- **Features**: All `feat:` commits
- **Bug Fixes**: All `fix:` commits
- **Performance**: All `perf:` commits
- **Breaking Changes**: All commits with `BREAKING CHANGE:`

## Interactive Rebase for Cleanup

Clean up commits before merge:

```bash
# Rebase last 5 commits
git rebase -i HEAD~5

# Change to:
# pick abc1234 feat(auth): add OTP login
# fixup def5678 fix: update OTP validation
# fixup ghi9012 docs: update auth docs

# Result: single commit "feat(auth): add OTP login"
```

## Tools

- **[Commitizen](http://commitizen.github.io/)**: CLI for writing commits
- **[Husky](https://typicode.github.io/husky/)**: Git hooks

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Angular Commit Guidelines](https://github.com/angular/angular/blob/master/CONTRIBUTING.md#commit)
