# Manifest Plan (Draft)

## Goal
Keep a complete, diff-friendly record of backups across multiple runs, wallets, and chains.

## Recommended Strategy
Canonical manifest per wallet+chain, plus snapshots and optional delta files.

Why:
- Deterministic scope per file
- Safer updates (only overwrite the affected manifest)
- Easy diffs for incremental runs

## File Layout (Backup Root)
```
backup-root/
  manifests/
    manifest.<chain>.<wallet>.json
    history/
      manifest.<chain>.<wallet>.<timestamp>.json
    runs/
      run.<timestamp>.<chain>.<wallet>.json
  nfts/
    <contract>/<token>/
      metadata.json
      storage-report.json
      image.* | animation.*
```

## Canonical Manifest Schema (Sketch)
```
{
  "walletAddress": "0x...",
  "chainName": "zora",
  "chainId": 7777777,
  "backupDate": "2026-02-02T12:00:00Z",
  "summary": { ... },
  "nfts": [
    {
      "id": "7777777:0xabc...:123",
      "contractAddress": "0xabc...",
      "tokenId": "123",
      "name": "Example",
      "metadataFile": "nfts/0xabc.../123/metadata.json",
      "imageFile": "nfts/0xabc.../123/image.png",
      "animationFile": "nfts/0xabc.../123/animation.mp4",
      "storageReportFile": "nfts/0xabc.../123/storage-report.json",
      "storageStatus": "mixed",
      "error": null,
      "updatedAt": "2026-02-02T12:00:00Z",
      "metadataHash": "sha256:...",
      "imageHash": "sha256:...",
      "animationHash": "sha256:..."
    }
  ]
}
```

## Delta File (Optional, per run)
```
{
  "runId": "2026-02-02T12:00:00Z",
  "walletAddress": "0x...",
  "chainName": "zora",
  "chainId": 7777777,
  "added": ["7777777:0xabc...:123"],
  "updated": ["7777777:0xdef...:456"],
  "removed": ["7777777:0x987...:654"],
  "summary": { "added": 1, "updated": 1, "removed": 1 }
}
```

## Merge Rules (Draft)
- Stable ID: `${chainId}:${contractAddress}:${tokenId}`.
- Upsert by ID; keep existing fields if new run has no data.
- Update `updatedAt` when any file path or hash changes.
- Recompute summary on every write.
- Write snapshot to `manifests/history/` before overwriting the canonical manifest.

## Implementation Steps (Draft)
1. Decide canonical file naming (`manifest.<chain>.<wallet>.json`).
2. Update backup flow:
   - Load existing manifest if present.
   - Merge new results, recompute summary.
   - Write snapshot, then overwrite canonical.
   - Optionally write delta in `manifests/runs/`.
3. Ensure backward compatibility:
   - If old `manifest.json` exists, migrate or merge once.

## Open Questions
- Should delta files be written on every run or only when changes occur?
- How many snapshots to retain (cap, or unlimited)?
