import type { DiscoveredNFT, NFTMetadata, NFTStorageReport, StorageAnalysis } from '../../src/types.js';

/**
 * Create a mock DiscoveredNFT with customizable properties
 */
export function createMockNFT(overrides: Partial<DiscoveredNFT> = {}): DiscoveredNFT {
  return {
    contractAddress: '0x1234567890123456789012345678901234567890',
    tokenId: '1',
    tokenUri: 'ipfs://QmTestMetadataCID12345678901234567890123',
    name: 'Test NFT',
    description: 'A test NFT for unit testing',
    contractName: 'Test Collection',
    cachedMetadata: undefined,
    cachedImageUrl: undefined,
    cachedAnimationUrl: undefined,
    ...overrides,
  };
}

/**
 * Create a mock NFT with IPFS storage (safe)
 */
export function createIpfsNFT(overrides: Partial<DiscoveredNFT> = {}): DiscoveredNFT {
  return createMockNFT({
    tokenUri: 'ipfs://QmTestMetadataCID12345678901234567890123',
    cachedMetadata: {
      name: 'IPFS NFT',
      description: 'Stored on IPFS',
      image: 'ipfs://QmTestImageCID1234567890123456789012345678',
    },
    ...overrides,
  });
}

/**
 * Create a mock NFT with centralized storage (at-risk)
 */
export function createCentralizedNFT(overrides: Partial<DiscoveredNFT> = {}): DiscoveredNFT {
  return createMockNFT({
    tokenUri: 'https://api.niftygateway.com/metadata/123',
    cachedMetadata: {
      name: 'Centralized NFT',
      description: 'Stored on centralized servers',
      image: 'https://cdn.niftygateway.com/images/nft.png',
    },
    cachedImageUrl: 'https://cdn.niftygateway.com/images/nft.png',
    ...overrides,
  });
}

/**
 * Create a mock NFT with mixed storage
 */
export function createMixedStorageNFT(overrides: Partial<DiscoveredNFT> = {}): DiscoveredNFT {
  return createMockNFT({
    tokenUri: 'ipfs://QmTestMetadataCID12345678901234567890123',
    cachedMetadata: {
      name: 'Mixed Storage NFT',
      description: 'Metadata on IPFS, image centralized',
      image: 'https://cdn.example.com/images/nft.png',
      animation_url: 'ipfs://QmTestAnimationCID123456789012345678901234',
    },
    ...overrides,
  });
}

/**
 * Create mock metadata
 */
export function createMockMetadata(overrides: Partial<NFTMetadata> = {}): NFTMetadata {
  return {
    name: 'Test NFT',
    description: 'A test NFT',
    image: 'ipfs://QmTestImageCID1234567890123456789012345678',
    animation_url: undefined,
    external_url: 'https://example.com/nft/1',
    attributes: [
      { trait_type: 'Color', value: 'Blue' },
      { trait_type: 'Size', value: 'Large' },
    ],
    ...overrides,
  };
}

/**
 * Create a mock storage analysis result
 */
export function createMockStorageAnalysis(overrides: Partial<StorageAnalysis> = {}): StorageAnalysis {
  return {
    type: 'ipfs',
    isAtRisk: false,
    originalUrl: 'ipfs://QmTestCID',
    ...overrides,
  };
}

/**
 * Create a mock NFT storage report
 */
export function createMockStorageReport(overrides: Partial<NFTStorageReport> = {}): NFTStorageReport {
  return {
    tokenUri: createMockStorageAnalysis(),
    image: createMockStorageAnalysis({ originalUrl: 'ipfs://QmImageCID' }),
    animation: undefined,
    isFullyDecentralized: true,
    atRiskUrls: [],
    ...overrides,
  };
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('waitFor timeout exceeded');
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/**
 * Create a delay promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
