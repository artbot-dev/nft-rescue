# Gallery Plan (Draft)

## Goal
Minimal, offline-friendly gallery that runs from the backup root and allows filtering by chain and metadata traits.

## Constraints
- Static files only (open the backup folder directly).
- Prefer local media when present; optional remote fallback.

## Data Source Options
### A) Manifest-only gallery
- Read canonical manifests only: `manifests/manifest.<chain>.<wallet>.json`.
- Ignore `manifests/history/` and `manifests/runs/` by default.
- Use `manifests/index.json` for manifest discovery in static mode.
- Generate `gallery-data.js` for file:// loading (no fetch).
- Normalize paths, and load `metadata.json` per entry.
- Only shows NFTs listed in manifests.
- Simple and fast, but can miss items if manifests are partial.

### B) Index-builder + gallery
- Add a script to scan `nfts/` and build `gallery-index.json`.
- Optionally merge manifest info (chain, wallet, storageStatus).
- Full coverage; requires a build step.

## Draft Architecture
### 1) Data model (per NFT)
- `id`: `${chainId}:${contractAddress}:${tokenId}`
- `contractAddress`, `tokenId`, `name`
- `chainName`, `chainId`
- `walletAddress`, `walletName?` (ENS/Tez when present)
- `metadataPath`
- `media`: `{ imagePath?, animationPath?, imageUrl?, animationUrl? }`
- `traits`: normalized array of `{ trait_type, value, display_type? }`
- `storageStatus` (if available)

### 2) Path normalization
- Manifest file paths are absolute (from backup run).
- Normalize to paths relative to the backup root (path-relative + separator normalization).

### 3) Media resolution order
1. Manifest `imageFile` / `animationFile` if present.
2. Local `image.*` / `animation.*` in the NFT folder (fallback scan).
3. Metadata `image` / `animation_url` / `content.uri` as optional remote fallback.

### 4) Trait normalization
- Accept `attributes`, `traits`, or `properties`.
- Normalize to `{ trait_type, value, display_type? }`.

### 5) Filtering
- Wallet/ENS/Tez, chain, collection/contract, trait type/value, storage status.

## Implementation Steps (Draft)
1. Decide data source (manifest-only vs index-builder).
   - Default selection: chain = `ethereum`, wallet = first manifest found for that chain.
     - Preferred order: entries with ENS/Tez name first; then lexicographic by name/address.
   - Load only canonical manifests; ignore `history/` and `runs/` unless explicitly requested.
2. Implement loader and normalization.
3. Build UI (three views):
   - Gallery view: global filters + grid.
   - Collection view: gallery view with collection filter applied.
   - Artwork view: single NFT detail (media, traits, storage status, metadata links).
   - `index.html`: filter panel + grid + detail region (view routing/state).
   - `app.js`: load, normalize, render, filter, route views.
   - `styles.css`: minimal, responsive.
4. Offline behavior:
   - Prefer local assets.
   - Explicit toggle for remote fallback if allowed.

## Open Questions
- Should gallery read multiple manifests automatically (for multi-chain)?
- Is `gallery-index.json` acceptable as a build step?
- Remote fallback allowed or strictly local?
