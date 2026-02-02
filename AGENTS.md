# AGENTS.md - Guardrails for nft-rescue contributors

## Start-of-task checklist (mandatory)
1) Open `CLAUDE.md` before making any changes.
2) Run `git status` and confirm the working tree is clean or understood.
3) Create and switch to a feature branch (`feat/*`, `fix/*`, `chore/*`) before edits.
4) If you cannot run required commands (e.g., missing npm), call it out immediately and ask for guidance.

## Keep user-facing docs in sync
When you change supported chains, providers, or naming services, update all of:
- `src/chains.ts` (`SUPPORTED_CHAINS`)
- `README.md` (Features list, Supported Chains table, usage examples, prerequisites/API key notes)
- CLI help strings in `src/cli.ts` (wallet argument descriptions, chain option description)

## New chain/provider checklist
- Add the chain to `SUPPORTED_CHAINS` and wire the provider.
- Update README with the new chain and at least one `analyze` + `backup` example.
- Note naming-service support (`.eth`, `.tez`, etc.) and API key requirements.
- Run `nft-rescue --help` and confirm the help text matches current support.
- Update or add tests for name resolution and provider behavior if needed.
