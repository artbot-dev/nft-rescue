# NFT Rescue

[![npm version](https://img.shields.io/npm/v/nft-rescue.svg)](https://www.npmjs.com/package/nft-rescue)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/nft-rescue.svg)](https://nodejs.org)

A CLI tool to backup NFT assets stored on centralized/at-risk infrastructure. The tool analyzes all NFTs in a wallet, classifies their storage as "safe" (IPFS/Arweave) or "at-risk" (centralized CDNs, APIs), and downloads at-risk assets locally.

## Features

- **Multi-chain support**: Ethereum, Base, Zora, Optimism, Arbitrum, Polygon
- Accepts ENS names (e.g., `artbot.eth`) or wallet addresses
- Discovers all NFTs owned by the wallet
- Classifies storage as safe (IPFS, Arweave, data URIs) or at-risk (centralized)
- Downloads at-risk assets locally
- Falls back to Alchemy's cached data when original servers are offline
- Progress bars and detailed reporting
- Supports IPFS and HTTP URLs with retry logic

## Prerequisites

- Node.js 18+
- Alchemy API key (free tier works fine)

## Installation

### From npm (recommended)

```bash
npm install -g nft-rescue
```

### From source

```bash
git clone https://github.com/artbot-dev/nft-rescue.git
cd nft-rescue
npm install
npm run build
npm link  # Makes 'nft-rescue' available globally
```

## Setup

1. Get an Alchemy API key:
   - Go to https://dashboard.alchemy.com/signup
   - Create a free account
   - Create a new app (select "Ethereum" and "Mainnet")
   - Copy your API key

2. Set the environment variable:

```bash
export ALCHEMY_API_KEY=your-api-key-here
```

## Usage

### Analyze Storage

Analyze a wallet to see the storage breakdown of all NFTs:

```bash
# Basic analysis (Ethereum by default)
nft-rescue analyze artbot.eth

# Analyze on a specific chain
nft-rescue analyze 0x1234...abcd --chain base
nft-rescue analyze 0x1234...abcd --chain zora

# Verbose output (shows details of at-risk NFTs)
nft-rescue analyze artbot.eth --verbose
```

### Backup At-Risk NFTs

Backup NFTs stored on centralized infrastructure:

```bash
# Backup at-risk NFTs (default behavior)
nft-rescue backup artbot.eth

# Backup from a specific chain
nft-rescue backup 0x1234...abcd --chain base

# Specify output directory
nft-rescue backup artbot.eth --output ./my-backup

# Dry run (show what would be backed up)
nft-rescue backup artbot.eth --dry-run

# Backup ALL NFTs, not just at-risk
nft-rescue backup artbot.eth --all
```

## Supported Chains

| Chain | Flag | Chain ID |
|-------|------|----------|
| Ethereum | `--chain ethereum` (default) | 1 |
| Base | `--chain base` | 8453 |
| Zora | `--chain zora` | 7777777 |
| Optimism | `--chain optimism` | 10 |
| Arbitrum | `--chain arbitrum` | 42161 |
| Polygon | `--chain polygon` | 137 |

**Note:** ENS names (e.g., `artbot.eth`) are only supported on Ethereum. Use wallet addresses for other chains.

## CLI Options

### `nft-rescue analyze <wallet>`

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --chain <chain>` | Blockchain to query | `ethereum` |
| `-v, --verbose` | Show detailed output including at-risk NFT details | `false` |

### `nft-rescue backup <wallet>`

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --chain <chain>` | Blockchain to query | `ethereum` |
| `-o, --output <dir>` | Output directory | `./nft-rescue-backup` |
| `-a, --all` | Backup all NFTs, not just at-risk | `false` |
| `-d, --dry-run` | Show what would be backed up | `false` |
| `-v, --verbose` | Detailed output | `false` |

## Storage Classification

### Safe (Decentralized) Storage

The following are considered safe and won't be backed up by default:

- **IPFS**: `ipfs://...`, `/ipfs/Qm...`, raw CIDs
- **IPFS Gateways**: ipfs.io, cloudflare-ipfs.com, gateway.pinata.cloud, dweb.link, w3s.link, nftstorage.link
- **Arweave**: `ar://...`, arweave.net, arweave.dev
- **Data URIs**: `data:...` (content embedded directly)

### At-Risk (Centralized) Storage

Everything else is considered at-risk, including:

- `api.niftygateway.com`
- `*.cloudinary.com`
- `*.amazonaws.com` / S3
- Custom domains (artist websites, etc.)
- `opensea.io` metadata API

## Output Structure

```
nft-rescue-backup/
├── manifests/
│   ├── manifest.<chain>.<wallet>.json          # Summary with storage analysis
│   ├── history/
│   │   └── manifest.<chain>.<wallet>.<ts>.json # Snapshots before overwrite
│   └── runs/
│       └── run.<ts>.<chain>.<wallet>.json      # Per-run delta summary
└── nfts/
    └── <contract-address>/
        └── <token-id>/
            ├── metadata.json        # Original metadata
            ├── image.<ext>          # Primary image
            ├── animation.<ext>      # Animation if present
            └── storage-report.json  # Classification details
```

## Manifest Format

Manifests are stored per wallet+chain at `manifests/manifest.<chain>.<wallet>.json`.
Per-run delta files are stored at `manifests/runs/run.<ts>.<chain>.<wallet>.json`.

```json
{
  "walletAddress": "0x...",
  "ensName": "artbot.eth",
  "chainName": "ethereum",
  "chainId": 1,
  "backupDate": "2025-01-27T...",
  "summary": {
    "totalNFTs": 50,
    "fullyDecentralized": 30,
    "atRisk": 20,
    "backedUp": 18,
    "failed": 2
  },
  "nfts": [...]
}
```

## Notes

- Only at-risk assets are backed up by default; use `--all` to backup everything
- The tool includes rate limiting to avoid API throttling (100ms between requests)
- IPFS content is accessed through multiple gateways with fallback
- When original metadata servers are offline, the tool falls back to Alchemy's cached data
- ENS resolution only works on Ethereum; use wallet addresses for other chains

## API Rate Limits

The free Alchemy tier has generous rate limits for most use cases. If you're backing up a wallet with thousands of NFTs, consider:
- Using `--dry-run` first to see the scope
- Running during off-peak hours
- Upgrading to a paid Alchemy plan for higher limits

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT - see [LICENSE](LICENSE) file for details.
