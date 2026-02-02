export interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  animation_url?: string;
  external_url?: string;
  attributes?: Array<{
    trait_type?: string;
    value?: string | number;
    display_type?: string;
  }>;
  [key: string]: unknown;
}

export interface NormalizedTrait {
  trait_type: string;
  value: string;
  display_type?: string;
}

export interface DiscoveredNFT {
  contractAddress: string;
  tokenId: string;
  tokenUri?: string;
  name?: string;
  description?: string;
  contractName?: string;
  // Cached data from Alchemy (fallback when original URI is dead)
  cachedMetadata?: NFTMetadata;
  cachedImageUrl?: string;
  cachedAnimationUrl?: string;
  // Chain information
  chainId?: number;
  chainName?: string;
}

// Storage classification types
export type StorageType = 'ipfs' | 'arweave' | 'data-uri' | 'centralized';

export interface StorageAnalysis {
  type: StorageType;
  isAtRisk: boolean;
  originalUrl: string;
  host?: string; // For centralized URLs, shows the domain
}

export interface NFTStorageReport {
  tokenUri: StorageAnalysis;
  image?: StorageAnalysis;
  animation?: StorageAnalysis;
  isFullyDecentralized: boolean; // All URLs are safe
  atRiskUrls: string[]; // List of URLs needing backup
}

export interface BackupResult {
  nft: DiscoveredNFT;
  metadataPath?: string;
  imagePath?: string;
  animationPath?: string;
  storageReport?: NFTStorageReport;
  error?: string;
}

export interface BackupSummary {
  totalNFTs: number;
  fullyDecentralized: number;
  atRisk: number;
  backedUp: number;
  failed: number;
}

export interface BackupManifest {
  walletAddress: string;
  ensName?: string;
  chainName: string;
  chainId: number;
  backupDate: string;
  summary: BackupSummary;
  nfts: Array<{
    contractAddress: string;
    tokenId: string;
    name?: string;
    collectionName?: string;
    traits?: NormalizedTrait[];
    metadataFile?: string;
    imageFile?: string;
    animationFile?: string;
    imageUrl?: string;
    animationUrl?: string;
    storageReportFile?: string;
    storageStatus: 'decentralized' | 'at-risk' | 'mixed';
    error?: string;
  }>;
}

export interface BackupOptions {
  outputDir: string;
  dryRun: boolean;
  verbose: boolean;
  all: boolean; // Backup all NFTs, not just at-risk
  chain: string; // Chain to query (e.g., 'ethereum', 'base', 'zora')
}

export interface AnalyzeOptions {
  verbose: boolean;
  chain: string; // Chain to query (e.g., 'ethereum', 'base', 'zora')
}
