# CLAUDE.md - Development Guide for nft-rescue

## Project Overview

nft-rescue is a CLI tool that backs up NFT assets stored on centralized/at-risk infrastructure. It:
- Discovers NFTs owned by a wallet address
- Analyzes storage (IPFS/Arweave = safe, HTTP URLs = at-risk)
- Downloads at-risk metadata and media to local storage

**Commands:**
- `nft-rescue analyze <wallet>` - Show storage breakdown
- `nft-rescue backup <wallet>` - Download at-risk assets

## Architecture

```
src/
├── index.ts           # CLI entry point (commander.js)
├── chains.ts          # Chain configs (EVM + Tezos)
├── ens.ts             # Address resolution (ENS, .tez domains)
├── nft-discovery.ts   # NFT discovery facade
├── providers/         # NFT discovery implementations
│   ├── alchemy-provider.ts  # EVM chains via Alchemy API
│   └── tzkt-provider.ts     # Tezos via TzKT API
├── metadata.ts        # Fetch and parse NFT metadata
├── storage-classifier.ts  # Classify URLs as safe/at-risk
├── downloader.ts      # Download assets with retry logic
└── types.ts           # Shared TypeScript interfaces
```

### Adding a New Blockchain

**For EVM chains (Alchemy-supported):**
1. Add config to `SUPPORTED_CHAINS` in `chains.ts` with `chainType: 'evm'`
2. Include the `alchemyNetwork` from alchemy-sdk

**For non-EVM chains:**
1. Create new provider in `src/providers/` implementing `NFTDiscoveryProvider`
2. Add chain config to `chains.ts` with appropriate `chainType`
3. Update `getDiscoveryProvider()` in `nft-discovery.ts`
4. Update `ens.ts` if the chain has its own naming service
5. Update user-facing docs and help:
   - README: Features list, Supported Chains table, usage examples, prerequisites/API key notes
   - CLI help text in `src/cli.ts` (wallet argument description, chain option description)
   - Verify `nft-rescue --help` reflects the new chain/naming service

## Key Dependencies

- **alchemy-sdk** - NFT discovery for EVM chains
- **viem** - ENS resolution, Ethereum address validation
- **commander** - CLI framework
- **msw** - HTTP mocking in tests (Mock Service Worker)

## Development Practices

### Test-Driven Development (TDD)
- Write tests first, then implement features
- Run tests continuously during development: `npm test`
- Watch mode for active development: `npm run test:watch`

### Branching Workflow
**IMPORTANT: Always create a feature branch BEFORE making any changes.**

```bash
# Create and switch to feature branch FIRST
git checkout -b feat/my-feature

# ... make changes, commit ...

# Push and create PR
git push -u origin feat/my-feature
```

Never commit directly to `main`. All changes must go through feature branches and PRs.

### Mandatory Start-of-Task Checklist
Before editing any file:
1) Open `CLAUDE.md` and `AGENTS.md` to confirm required workflow.
2) Run `git status` to ensure the working tree is clean or the state is understood.
3) Create and switch to a feature branch (`feat/*`, `fix/*`, `chore/*`).
4) If any required tooling (npm, git, etc.) is unavailable, stop and ask for guidance.

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
- Coverage report: `npm run test:coverage`

**HTTP Mocking with MSW:**
- Use MSW (Mock Service Worker), NOT `global.fetch` mocking
- Default handlers in `tests/mocks/handlers.ts`
- Override per-test with `server.use()`:
```typescript
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server.js';

it('should handle API response', async () => {
  server.use(
    http.get('https://api.example.com/data', () => {
      return HttpResponse.json({ key: 'value' });
    })
  );
  // ... test code
});
```

**Test structure:**
- `tests/unit/` - Unit tests for individual modules
- `tests/integration/` - Multi-module flows
- `tests/e2e/` - CLI end-to-end tests
- `tests/mocks/` - MSW handlers and mock data factories

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
- When adding or changing supported chains, keep README and CLI help in sync with `SUPPORTED_CHAINS`

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
