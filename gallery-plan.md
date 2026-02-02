# Gallery Plan (Draft)

## Goal
Minimal, offline-friendly gallery that runs from the backup root and allows filtering by chain and metadata traits.

## Constraints
- Static files only (open the backup folder directly).
- Prefer local media when present; optional remote fallback.

## Data Source Options
### A) Manifest-only gallery
- Read one or more manifests, normalize paths, and load `metadata.json` per entry.
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
- `metadataPath`
- `media`: `{ imagePath?, animationPath?, imageUrl?, animationUrl? }`
- `traits`: normalized array of `{ trait_type, value, display_type? }`
- `storageStatus` (if available)

### 2) Path normalization
- Manifest paths may include the backup root prefix.
- Normalize to paths relative to the backup root.

### 3) Media resolution order
1. Local `image.*` / `animation.*` in the NFT folder.
2. Manifest `imageFile` / `animationFile` if present.
3. Metadata `image` / `animation_url` / `content.uri` as optional remote fallback.

### 4) Trait normalization
- Accept `attributes`, `traits`, or `properties`.
- Normalize to `{ trait_type, value, display_type? }`.

### 5) Filtering
- Chain, collection/contract, trait type/value, storage status.

## Implementation Steps (Draft)
1. Decide data source (manifest-only vs index-builder).
2. Implement loader and normalization.
3. Build UI:
   - `index.html`: filter panel + grid.
   - `app.js`: load, normalize, render, filter.
   - `styles.css`: minimal, responsive.
4. Offline behavior:
   - Prefer local assets.
   - Explicit toggle for remote fallback if allowed.

## Open Questions
- Should gallery read multiple manifests automatically (for multi-chain)?
- Is `gallery-index.json` acceptable as a build step?
- Remote fallback allowed or strictly local?
