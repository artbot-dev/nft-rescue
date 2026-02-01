import { vi } from 'vitest';
import type { OwnedNft } from 'alchemy-sdk';

// Factory function to create mock NFT data
export function createMockOwnedNft(overrides: Partial<OwnedNft> = {}): OwnedNft {
  return {
    contract: {
      address: '0x1234567890123456789012345678901234567890',
      name: 'Test Collection',
      symbol: 'TEST',
      tokenType: 'ERC721' as const,
      openSeaMetadata: {
        collectionName: 'Test Collection',
      },
      ...overrides.contract,
    },
    tokenId: '1',
    tokenType: 'ERC721' as const,
    name: 'Test NFT #1',
    description: 'A test NFT',
    tokenUri: 'ipfs://QmTestMetadataCID12345678901234567890123',
    image: {
      cachedUrl: 'https://nft-cdn.alchemy.com/eth-mainnet/cached/image.png',
      pngUrl: 'https://nft-cdn.alchemy.com/eth-mainnet/png/image.png',
      originalUrl: 'ipfs://QmTestImageCID1234567890123456789012345678',
    },
    raw: {
      tokenUri: 'ipfs://QmTestMetadataCID12345678901234567890123',
      metadata: {
        name: 'Test NFT #1',
        description: 'A test NFT',
        image: 'ipfs://QmTestImageCID1234567890123456789012345678',
        animation_url: undefined,
        external_url: 'https://example.com/nft/1',
        attributes: [
          { trait_type: 'Color', value: 'Blue' },
        ],
      },
    },
    collection: undefined,
    mint: undefined,
    owners: undefined,
    timeLastUpdated: new Date().toISOString(),
    balance: '1',
    acquiredAt: undefined,
    ...overrides,
  } as OwnedNft;
}

// Create mock response for getNftsForOwner
export function createMockNftsResponse(
  nfts: OwnedNft[],
  pageKey?: string,
  totalCount?: number
) {
  return {
    ownedNfts: nfts,
    pageKey,
    totalCount: totalCount ?? nfts.length,
    validAt: { blockNumber: 12345678, blockHash: '0xabc', blockTimestamp: Date.now() },
  };
}

// Create mock Alchemy client
export function createMockAlchemyClient() {
  const mockNfts = [
    createMockOwnedNft({ tokenId: '1', name: 'Test NFT #1' }),
    createMockOwnedNft({
      tokenId: '2',
      name: 'Test NFT #2',
      tokenUri: 'https://api.niftygateway.com/metadata/2',
      contract: {
        address: '0x0987654321098765432109876543210987654321',
        name: 'Another Collection',
        tokenType: 'ERC721' as const,
      },
    }),
  ];

  return {
    nft: {
      getNftsForOwner: vi.fn().mockResolvedValue(createMockNftsResponse(mockNfts, undefined, 2)),
    },
  };
}

// Mock for empty wallet
export function createEmptyWalletMock() {
  return {
    nft: {
      getNftsForOwner: vi.fn().mockResolvedValue(createMockNftsResponse([], undefined, 0)),
    },
  };
}

// Mock for paginated response
export function createPaginatedMock() {
  const page1Nfts = [
    createMockOwnedNft({ tokenId: '1' }),
    createMockOwnedNft({ tokenId: '2' }),
  ];
  const page2Nfts = [
    createMockOwnedNft({ tokenId: '3' }),
  ];

  let callCount = 0;

  return {
    nft: {
      getNftsForOwner: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createMockNftsResponse(page1Nfts, 'page2', 3));
        }
        return Promise.resolve(createMockNftsResponse(page2Nfts, undefined, 3));
      }),
    },
  };
}
