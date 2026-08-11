# Contributing to Society Food Platform

Thank you for your interest in contributing! 

## Code of Conduct

Be respectful, provide constructive feedback, and be inclusive.

## Reporting Issues

### Bug Report
1. Check [existing issues](https://github.com/yourusername/society-food-platform/issues)
2. Use [bug_report.md](.github/ISSUE_TEMPLATE/bug_report.md) template
3. Include:
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if possible
   - Your role (buyer/seller/admin)

### Feature Request
1. Check [existing requests](https://github.com/yourusername/society-food-platform/issues?q=label%3Aenhancement)
2. Use [feature_request.md](.github/ISSUE_TEMPLATE/feature_request.md) template
3. Include:
   - User story
   - Problem statement
   - Proposed solution
   - Target role(s)

## Development Setup

### Prerequisites
- Python 3.10+
- Node.js 16+
- PostgreSQL 14+
- Docker (optional)

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
npm start
```

## Git Workflow

### Creating a Feature
```bash
# 1. Create branch from develop
git checkout -b feature/your-feature develop

# 2. Make changes, commit with conventional commits
git commit -m "feat(scope): description"

# 3. Push and create PR
git push origin feature/your-feature
```

### Commit Messages
Follow [COMMIT_CONVENTIONS.md](../COMMIT_CONVENTIONS.md):
```
feat(seller): add menu item limit
fix(order): resolve status display
docs: update API documentation
```

### PR Checklist
- [ ] Tests added/updated
- [ ] Linting passes
- [ ] Documentation updated
- [ ] No breaking changes
- [ ] Related issue linked

## Code Standards

### Python Backend
```bash
# Format
black backend/

# Lint
flake8 backend/

# Type check
mypy backend/

# Security scan
bandit -r backend/app
```

### React Frontend
```bash
# Format
npm run format

# Lint
npm run lint

# Test
npm test
```

### Pre-commit Hooks
```bash
pip install pre-commit
pre-commit install
```

## Testing

### Backend
```bash
cd backend
pytest tests/ -v --cov=app
```

### Frontend
```bash
cd frontend
npm test -- --coverage
```

## Documentation

- Update relevant docs in `/docs`
- Add examples in docstrings (Python) or JSDoc (React)
- Update README.md if behavior changes

## Pull Request Process

1. **Before creating PR:**
   ```bash
   git rebase origin/develop
   pytest  # Backend
   npm test  # Frontend
   ```

2. **Create PR on GitHub:**
   - Title: Follow conventional commit format
   - Description: Link issue, describe changes
   - Target: `develop` branch

3. **Address Review Feedback**
   - Push updates to same branch
   - Don't force-push during review

4. **After Approval**
   - Use "Squash and merge" button
   - Ensure commit message follows conventions

## Branching Strategy

See [BRANCHING.md](../BRANCHING.md) for detailed workflow.

- `main`: Production code (protected)
- `develop`: Integration branch (protected)
- `feature/*`: Feature development
- `bugfix/*`: Bug fixes
- `hotfix/*`: Production patches

## Release Process

1. Create `release/vX.Y.Z` from `develop`
2. Update version and CHANGELOG
3. Create PR to `main`
4. After merge, tag release: `git tag -a vX.Y.Z`
5. Merge back to `develop`

## Getting Help

- 📖 [Architecture Guide](../docs/architecture.md)
- 📚 [Developer Guide](../docs/developer-guide.md)
- 💬 [GitHub Discussions](https://github.com/yourusername/society-food-platform/discussions)
- 📧 support@societyfood.local

## Additional Notes

### Technology Choices
- **Python + FastAPI**: Lightweight, async-first framework
- **React**: UI library with PWA support
- **PostgreSQL**: Reliable relational database

### Quality Standards
- Maintain >80% test coverage
- Follow PEP8 (Python) and Airbnb style (React)
- All PRs require CI green lights
- All PRs require 2+ approvals before merge

---

Thank you for contributing! 🙏
