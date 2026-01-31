import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Network } from 'alchemy-sdk';
import {
  createMockOwnedNft,
  createMockNftsResponse,
} from '../mocks/alchemy.js';

// Store the original env
const originalEnv = process.env.ALCHEMY_API_KEY;

// Mock the alchemy-sdk module
vi.mock('alchemy-sdk', () => {
  const mockGetNftsForOwner = vi.fn();
  const MockAlchemy = vi.fn().mockImplementation((config: { network: string }) => ({
    nft: {
      getNftsForOwner: mockGetNftsForOwner,
    },
    config,
  }));

  return {
    Alchemy: MockAlchemy,
    Network: {
      ETH_MAINNET: 'eth-mainnet',
      BASE_MAINNET: 'base-mainnet',
      ZORA_MAINNET: 'zora-mainnet',
      OPT_MAINNET: 'opt-mainnet',
      ARB_MAINNET: 'arb-mainnet',
      MATIC_MAINNET: 'matic-mainnet',
    },
    __mockGetNftsForOwner: mockGetNftsForOwner,
    __MockAlchemy: MockAlchemy,
  };
});

describe('nft-discovery multi-chain', () => {
  let mockGetNftsForOwner: ReturnType<typeof vi.fn>;
  let MockAlchemy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.ALCHEMY_API_KEY = 'test-api-key';

    const alchemySdk = await import('alchemy-sdk');
    mockGetNftsForOwner = (alchemySdk as unknown as { __mockGetNftsForOwner: ReturnType<typeof vi.fn> }).__mockGetNftsForOwner;
    MockAlchemy = (alchemySdk as unknown as { __MockAlchemy: ReturnType<typeof vi.fn> }).__MockAlchemy;
  });

  afterEach(() => {
    process.env.ALCHEMY_API_KEY = originalEnv;
  });

  describe('discoverNFTs with chain parameter', () => {
    it('should default to Ethereum mainnet when no chain specified', async () => {
      const mockNfts = [createMockOwnedNft({ tokenId: '1' })];
      mockGetNftsForOwner.mockResolvedValue(createMockNftsResponse(mockNfts, undefined, 1));

      const { discoverNFTs } = await import('../../src/nft-discovery.js');
      await discoverNFTs('0x1234567890123456789012345678901234567890');

      expect(MockAlchemy).toHaveBeenCalledWith(
        expect.objectContaining({
          network: 'eth-mainnet',
        })
      );
    });

    it('should use specified chain for Base', async () => {
      const mockNfts = [createMockOwnedNft({ tokenId: '1' })];
      mockGetNftsForOwner.mockResolvedValue(createMockNftsResponse(mockNfts, undefined, 1));

      const { discoverNFTs } = await import('../../src/nft-discovery.js');
      await discoverNFTs('0x1234567890123456789012345678901234567890', undefined, 'base');

      expect(MockAlchemy).toHaveBeenCalledWith(
        expect.objectContaining({
          network: 'base-mainnet',
        })
      );
    });

    it('should use specified chain for Zora', async () => {
      const mockNfts = [createMockOwnedNft({ tokenId: '1' })];
      mockGetNftsForOwner.mockResolvedValue(createMockNftsResponse(mockNfts, undefined, 1));

      const { discoverNFTs } = await import('../../src/nft-discovery.js');
      await discoverNFTs('0x1234567890123456789012345678901234567890', undefined, 'zora');

      expect(MockAlchemy).toHaveBeenCalledWith(
        expect.objectContaining({
          network: 'zora-mainnet',
        })
      );
    });

    it('should use specified chain for Optimism', async () => {
      const mockNfts = [createMockOwnedNft({ tokenId: '1' })];
      mockGetNftsForOwner.mockResolvedValue(createMockNftsResponse(mockNfts, undefined, 1));

      const { discoverNFTs } = await import('../../src/nft-discovery.js');
      await discoverNFTs('0x1234567890123456789012345678901234567890', undefined, 'optimism');

      expect(MockAlchemy).toHaveBeenCalledWith(
        expect.objectContaining({
          network: 'opt-mainnet',
        })
      );
    });

    it('should use specified chain for Arbitrum', async () => {
      const mockNfts = [createMockOwnedNft({ tokenId: '1' })];
      mockGetNftsForOwner.mockResolvedValue(createMockNftsResponse(mockNfts, undefined, 1));

      const { discoverNFTs } = await import('../../src/nft-discovery.js');
      await discoverNFTs('0x1234567890123456789012345678901234567890', undefined, 'arbitrum');

      expect(MockAlchemy).toHaveBeenCalledWith(
        expect.objectContaining({
          network: 'arb-mainnet',
        })
      );
    });

    it('should use specified chain for Polygon', async () => {
      const mockNfts = [createMockOwnedNft({ tokenId: '1' })];
      mockGetNftsForOwner.mockResolvedValue(createMockNftsResponse(mockNfts, undefined, 1));

      const { discoverNFTs } = await import('../../src/nft-discovery.js');
      await discoverNFTs('0x1234567890123456789012345678901234567890', undefined, 'polygon');

      expect(MockAlchemy).toHaveBeenCalledWith(
        expect.objectContaining({
          network: 'matic-mainnet',
        })
      );
    });

    it('should throw error for unsupported chain', async () => {
      const { discoverNFTs } = await import('../../src/nft-discovery.js');

      await expect(
        discoverNFTs('0x1234567890123456789012345678901234567890', undefined, 'unsupported')
      ).rejects.toThrow('Unsupported chain');
    });

    it('should include chainId and chainName in discovered NFTs', async () => {
      const mockNfts = [createMockOwnedNft({ tokenId: '1' })];
      mockGetNftsForOwner.mockResolvedValue(createMockNftsResponse(mockNfts, undefined, 1));

      const { discoverNFTs } = await import('../../src/nft-discovery.js');
      const nfts = await discoverNFTs('0x1234567890123456789012345678901234567890', undefined, 'base');

      expect(nfts[0].chainId).toBe(8453);
      expect(nfts[0].chainName).toBe('base');
    });

    it('should cache clients per chain', async () => {
      const mockNfts = [createMockOwnedNft({ tokenId: '1' })];
      mockGetNftsForOwner.mockResolvedValue(createMockNftsResponse(mockNfts, undefined, 1));

      const { discoverNFTs } = await import('../../src/nft-discovery.js');

      // Call twice for same chain
      await discoverNFTs('0x1234567890123456789012345678901234567890', undefined, 'base');
      await discoverNFTs('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', undefined, 'base');

      // Should only create one client for base
      const baseCalls = MockAlchemy.mock.calls.filter(
        (call: unknown[]) => (call[0] as { network: string }).network === 'base-mainnet'
      );
      expect(baseCalls.length).toBe(1);
    });

    it('should create separate clients for different chains', async () => {
      const mockNfts = [createMockOwnedNft({ tokenId: '1' })];
      mockGetNftsForOwner.mockResolvedValue(createMockNftsResponse(mockNfts, undefined, 1));

      const { discoverNFTs } = await import('../../src/nft-discovery.js');

      await discoverNFTs('0x1234567890123456789012345678901234567890', undefined, 'base');
      await discoverNFTs('0x1234567890123456789012345678901234567890', undefined, 'zora');

      expect(MockAlchemy).toHaveBeenCalledTimes(2);
    });
  });
});
