# CLAUDE.md - Development Guide for nft-rescue

## Development Practices

### Test-Driven Development (TDD)
- Write tests first, then implement features
- Run tests continuously during development: `npm test`
- Watch mode for active development: `npm run test:watch`

### Branch Naming
- `feat/*` - New features
- `fix/*` - Bug fixes
- `chore/*` - Maintenance tasks

### Commit Convention
Use conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `chore:` - Maintenance
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Test additions/changes

### Pre-commit Checks
Always run before committing:
```bash
npm test && npm run build
```

## Code Quality

### TypeScript
- Strict mode enabled
- No `any` types - use proper typing

### Testing
- Maintain 80%+ code coverage
- Mock external APIs (Alchemy, IPFS gateways)
- Coverage report: `npm run test:coverage`

## Security

- Never commit secrets - use `.env` files (already in `.gitignore`)
- Validate all user input (contract addresses, token IDs)
- Review dependencies for vulnerabilities

## Dependencies

```bash
# Check for outdated packages
npm outdated

# Audit for vulnerabilities
npm audit
```

## npm Publishing

The `prepublishOnly` script automatically runs tests before publish.

```bash
# Verify package contents before publishing
npm pack --dry-run

# Publish to npm
npm publish
```

## Documentation

- Update README.md when adding new features
- Document CLI options and API changes

## CI/CD

GitHub Actions runs automatically:
- **CI** (`ci.yml`): Tests on Node 18/20/22 on push to main and PRs
- **Publish** (`publish.yml`): Publishes to npm on version tags

## Release Workflow

1. **Squash merge** feature branch to main (CI runs automatically)

2. **Create and push git tag**
   ```bash
   git tag v1.0.0
   git push origin main --tags
   ```
   This triggers automatic npm publish.

3. **Create GitHub release** from the tag

4. **Cleanup** - delete merged feature branch
