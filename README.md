# NFT Rescue

A CLI tool to backup NFT assets stored on centralized/at-risk infrastructure. The tool analyzes all NFTs in a wallet, classifies their storage as "safe" (IPFS/Arweave) or "at-risk" (centralized CDNs, APIs), and downloads at-risk assets locally.

## Features

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

## Setup

1. Clone and install dependencies:

```bash
cd nft-rescue
npm install
npm run build
```

2. Get an Alchemy API key:
   - Go to https://dashboard.alchemy.com/signup
   - Create a free account
   - Create a new app (select "Ethereum" and "Mainnet")
   - Copy your API key

3. Set the environment variable:

```bash
export ALCHEMY_API_KEY=your-api-key-here
```

## Usage

### Analyze Storage

Analyze a wallet to see the storage breakdown of all NFTs:

```bash
# Basic analysis
nft-rescue analyze artbot.eth

# Verbose output (shows details of at-risk NFTs)
nft-rescue analyze artbot.eth --verbose
```

### Backup At-Risk NFTs

Backup NFTs stored on centralized infrastructure:

```bash
# Backup at-risk NFTs (default behavior)
nft-rescue backup artbot.eth

# Specify output directory
nft-rescue backup artbot.eth --output ./my-backup

# Dry run (show what would be backed up)
nft-rescue backup artbot.eth --dry-run

# Backup ALL NFTs, not just at-risk
nft-rescue backup artbot.eth --all
```

### Shorthand

You can also run backup directly without the `backup` subcommand:

```bash
nft-rescue artbot.eth
nft-rescue 0x1234...abcd --output ./backup
```

## CLI Options

### `nft-rescue analyze <wallet>`

| Option | Description |
|--------|-------------|
| `-v, --verbose` | Show detailed output including at-risk NFT details |

### `nft-rescue backup <wallet>`

| Option | Description | Default |
|--------|-------------|---------|
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
├── manifest.json                    # Summary with storage analysis
└── nfts/
    └── <contract-address>/
        └── <token-id>/
            ├── metadata.json        # Original metadata
            ├── image.<ext>          # Primary image
            ├── animation.<ext>      # Animation if present
            └── storage-report.json  # Classification details
```

## Manifest Format

```json
{
  "walletAddress": "0x...",
  "ensName": "artbot.eth",
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
- The tool includes rate limiting to avoid API throttling
- IPFS content is accessed through multiple gateways with fallback
- When original metadata servers are offline, the tool falls back to Alchemy's cached data

## License

MIT
