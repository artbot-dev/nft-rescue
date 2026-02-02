# AGENTS.md - Guardrails for nft-rescue contributors

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
