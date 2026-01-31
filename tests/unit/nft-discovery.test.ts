import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { discoverNFTs } from '../../src/nft-discovery.js';
import {
  createMockOwnedNft,
  createMockNftsResponse,
} from '../mocks/alchemy.js';

// Store the original env
const originalEnv = process.env.ALCHEMY_API_KEY;

// Mock the alchemy-sdk module
vi.mock('alchemy-sdk', () => {
  const mockGetNftsForOwner = vi.fn();

  return {
    Alchemy: vi.fn().mockImplementation(() => ({
      nft: {
        getNftsForOwner: mockGetNftsForOwner,
      },
    })),
    Network: {
      ETH_MAINNET: 'eth-mainnet',
    },
    // Export the mock so we can control it in tests
    __mockGetNftsForOwner: mockGetNftsForOwner,
  };
});

describe('nft-discovery', () => {
  let mockGetNftsForOwner: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset module cache to get fresh Alchemy client
    vi.resetModules();

    // Set API key for tests
    process.env.ALCHEMY_API_KEY = 'test-api-key';

    // Get the mock function
    const alchemySdk = await import('alchemy-sdk');
    mockGetNftsForOwner = (alchemySdk as unknown as { __mockGetNftsForOwner: ReturnType<typeof vi.fn> }).__mockGetNftsForOwner;
  });

  afterEach(() => {
    process.env.ALCHEMY_API_KEY = originalEnv;
  });

  describe('discoverNFTs', () => {
    it('should return empty array for wallet with no NFTs', async () => {
      mockGetNftsForOwner.mockResolvedValue(createMockNftsResponse([], undefined, 0));

      // Re-import to get fresh module with new mock
      const { discoverNFTs: discover } = await import('../../src/nft-discovery.js');
      const nfts = await discover('0x1234567890123456789012345678901234567890');

      expect(nfts).toEqual([]);
      expect(mockGetNftsForOwner).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890', {
        pageKey: undefined,
        pageSize: 100,
      });
    });

    it('should return discovered NFTs', async () => {
      const mockNfts = [
        createMockOwnedNft({ tokenId: '1', name: 'NFT #1' }),
        createMockOwnedNft({ tokenId: '2', name: 'NFT #2' }),
      ];
      mockGetNftsForOwner.mockResolvedValue(createMockNftsResponse(mockNfts, undefined, 2));

      const { discoverNFTs: discover } = await import('../../src/nft-discovery.js');
      const nfts = await discover('0x1234567890123456789012345678901234567890');

      expect(nfts).toHaveLength(2);
      expect(nfts[0].tokenId).toBe('1');
      expect(nfts[0].name).toBe('NFT #1');
      expect(nfts[1].tokenId).toBe('2');
    });

    it('should handle pagination correctly', async () => {
      const page1Nfts = [
        createMockOwnedNft({ tokenId: '1' }),
        createMockOwnedNft({ tokenId: '2' }),
      ];
      const page2Nfts = [
        createMockOwnedNft({ tokenId: '3' }),
      ];

      mockGetNftsForOwner
        .mockResolvedValueOnce(createMockNftsResponse(page1Nfts, 'page2', 3))
        .mockResolvedValueOnce(createMockNftsResponse(page2Nfts, undefined, 3));

      const { discoverNFTs: discover } = await import('../../src/nft-discovery.js');
      const nfts = await discover('0x1234567890123456789012345678901234567890');

      expect(nfts).toHaveLength(3);
      expect(mockGetNftsForOwner).toHaveBeenCalledTimes(2);
      expect(mockGetNftsForOwner).toHaveBeenLastCalledWith('0x1234567890123456789012345678901234567890', {
        pageKey: 'page2',
        pageSize: 100,
      });
    });

    it('should call progress callback with current count', async () => {
      const mockNfts = [
        createMockOwnedNft({ tokenId: '1' }),
        createMockOwnedNft({ tokenId: '2' }),
      ];
      mockGetNftsForOwner.mockResolvedValue(createMockNftsResponse(mockNfts, undefined, 2));

      const onProgress = vi.fn();
      const { discoverNFTs: discover } = await import('../../src/nft-discovery.js');
      await discover('0x1234567890123456789012345678901234567890', onProgress);

      expect(onProgress).toHaveBeenCalledWith(2, 2);
    });

    it('should call progress callback for each page', async () => {
      const page1Nfts = [createMockOwnedNft({ tokenId: '1' })];
      const page2Nfts = [createMockOwnedNft({ tokenId: '2' })];

      mockGetNftsForOwner
        .mockResolvedValueOnce(createMockNftsResponse(page1Nfts, 'page2', 2))
        .mockResolvedValueOnce(createMockNftsResponse(page2Nfts, undefined, 2));

      const onProgress = vi.fn();
      const { discoverNFTs: discover } = await import('../../src/nft-discovery.js');
      await discover('0x1234567890123456789012345678901234567890', onProgress);

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
      expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
    });

    it('should correctly transform NFT data', async () => {
      const mockNft = createMockOwnedNft({
        tokenId: '42',
        name: 'Test NFT',
        description: 'A test description',
        tokenUri: 'ipfs://QmTest',
        contract: {
          address: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
          name: 'Test Collection',
          tokenType: 'ERC721' as const,
          openSeaMetadata: {
            collectionName: 'Test Collection',
          },
        },
      });
      mockGetNftsForOwner.mockResolvedValue(createMockNftsResponse([mockNft], undefined, 1));

      const { discoverNFTs: discover } = await import('../../src/nft-discovery.js');
      const nfts = await discover('0x1234567890123456789012345678901234567890');

      expect(nfts[0].contractAddress).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
      expect(nfts[0].tokenId).toBe('42');
      expect(nfts[0].name).toBe('Test NFT');
      expect(nfts[0].description).toBe('A test description');
      expect(nfts[0].tokenUri).toBe('ipfs://QmTest');
      expect(nfts[0].contractName).toBe('Test Collection');
    });

    it('should handle NFT with cached metadata', async () => {
      const mockNft = createMockOwnedNft({
        tokenId: '1',
        raw: {
          tokenUri: 'ipfs://QmTest',
          metadata: {
            name: 'Cached Name',
            description: 'Cached Description',
            image: 'ipfs://QmImage',
            animation_url: 'ipfs://QmAnimation',
            external_url: 'https://example.com',
            attributes: [{ trait_type: 'Color', value: 'Blue' }],
          },
        },
      });
      mockGetNftsForOwner.mockResolvedValue(createMockNftsResponse([mockNft], undefined, 1));

      const { discoverNFTs: discover } = await import('../../src/nft-discovery.js');
      const nfts = await discover('0x1234567890123456789012345678901234567890');

      expect(nfts[0].cachedMetadata).toBeDefined();
      expect(nfts[0].cachedMetadata?.name).toBe('Cached Name');
      expect(nfts[0].cachedMetadata?.image).toBe('ipfs://QmImage');
      expect(nfts[0].cachedMetadata?.animation_url).toBe('ipfs://QmAnimation');
    });

    it('should extract cached image URL from various sources', async () => {
      const mockNft = createMockOwnedNft({
        tokenId: '1',
        image: {
          cachedUrl: 'https://cached.example.com/image.png',
          pngUrl: 'https://png.example.com/image.png',
          originalUrl: 'ipfs://QmOriginal',
        },
      });
      mockGetNftsForOwner.mockResolvedValue(createMockNftsResponse([mockNft], undefined, 1));

      const { discoverNFTs: discover } = await import('../../src/nft-discovery.js');
      const nfts = await discover('0x1234567890123456789012345678901234567890');

      expect(nfts[0].cachedImageUrl).toBe('https://cached.example.com/image.png');
    });
  });

  describe('error handling', () => {
    it('should throw error when ALCHEMY_API_KEY is not set', async () => {
      delete process.env.ALCHEMY_API_KEY;

      // Reset modules to clear cached client
      vi.resetModules();

      // Re-mock without API key
      vi.doMock('alchemy-sdk', () => ({
        Alchemy: vi.fn().mockImplementation(() => {
          throw new Error('ALCHEMY_API_KEY environment variable is required');
        }),
        Network: { ETH_MAINNET: 'eth-mainnet' },
      }));

      const { discoverNFTs: discover } = await import('../../src/nft-discovery.js');

      await expect(discover('0x1234567890123456789012345678901234567890')).rejects.toThrow(
        'ALCHEMY_API_KEY'
      );
    });
  });
});
