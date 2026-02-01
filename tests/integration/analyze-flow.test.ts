import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockOwnedNft, createMockNftsResponse } from '../mocks/alchemy.js';

// Mock chalk to disable colors in tests
vi.mock('chalk', () => ({
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    cyan: (s: string) => s,
    dim: (s: string) => s,
    bold: (s: string) => s,
  },
}));

// Mock ora spinner
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    text: '',
  }),
}));

// Mock cli-progress
vi.mock('cli-progress', () => ({
  default: {
    SingleBar: vi.fn().mockImplementation(() => ({
      start: vi.fn(),
      update: vi.fn(),
      stop: vi.fn(),
    })),
    Presets: {
      shades_classic: {},
    },
  },
}));

// Store original env
const originalEnv = { ...process.env };

describe('analyze flow integration', () => {
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;
  let mockProcessExit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALCHEMY_API_KEY = 'test-api-key';
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
  });

  describe('storage classification integration', () => {
    it('should classify IPFS NFTs as safe', async () => {
      const { analyzeNFTStorage, getStorageStatus } = await import('../../src/storage-classifier.js');

      const nft = {
        contractAddress: '0x1234567890123456789012345678901234567890',
        tokenId: '1',
        tokenUri: 'ipfs://QmTestMetadata12345678901234567890123456789',
      };

      const metadata = {
        name: 'IPFS NFT',
        image: 'ipfs://QmTestImage12345678901234567890123456789012',
      };

      const report = analyzeNFTStorage(nft, metadata);
      const status = getStorageStatus(report);

      expect(status).toBe('decentralized');
      expect(report.isFullyDecentralized).toBe(true);
      expect(report.atRiskUrls).toHaveLength(0);
    });

    it('should classify centralized NFTs as at-risk', async () => {
      const { analyzeNFTStorage, getStorageStatus } = await import('../../src/storage-classifier.js');

      const nft = {
        contractAddress: '0x1234567890123456789012345678901234567890',
        tokenId: '1',
        tokenUri: 'https://api.niftygateway.com/metadata/1',
      };

      const metadata = {
        name: 'Centralized NFT',
        image: 'https://cdn.niftygateway.com/image.png',
      };

      const report = analyzeNFTStorage(nft, metadata);
      const status = getStorageStatus(report);

      expect(status).toBe('at-risk');
      expect(report.isFullyDecentralized).toBe(false);
      expect(report.atRiskUrls.length).toBeGreaterThan(0);
    });

    it('should classify mixed storage NFTs correctly', async () => {
      const { analyzeNFTStorage, getStorageStatus } = await import('../../src/storage-classifier.js');

      const nft = {
        contractAddress: '0x1234567890123456789012345678901234567890',
        tokenId: '1',
        tokenUri: 'ipfs://QmTestMetadata12345678901234567890123456789',
      };

      const metadata = {
        name: 'Mixed NFT',
        image: 'https://cdn.example.com/image.png',
        animation_url: 'ipfs://QmTestAnimation123456789012345678901234567',
      };

      const report = analyzeNFTStorage(nft, metadata);
      const status = getStorageStatus(report);

      expect(status).toBe('mixed');
      expect(report.isFullyDecentralized).toBe(false);
      expect(report.tokenUri.isAtRisk).toBe(false);
      expect(report.image?.isAtRisk).toBe(true);
      expect(report.animation?.isAtRisk).toBe(false);
    });
  });

  describe('ENS resolution integration', () => {
    it('should resolve valid addresses', async () => {
      vi.doMock('viem', async () => {
        const actual = await vi.importActual('viem');
        return {
          ...actual,
          createPublicClient: vi.fn(() => ({
            getEnsAddress: vi.fn().mockResolvedValue('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'),
            getEnsName: vi.fn().mockResolvedValue('vitalik.eth'),
          })),
          isAddress: (input: string) => /^0x[a-fA-F0-9]{40}$/.test(input),
        };
      });

      vi.doMock('viem/ens', () => ({
        normalize: (name: string) => name.toLowerCase(),
      }));

      const { isEnsName, resolveAddress } = await import('../../src/ens.js');

      // Test address detection
      expect(isEnsName('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(false);
      expect(isEnsName('vitalik.eth')).toBe(true);

      // Test address resolution
      const resolved = await resolveAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
      expect(resolved).toBe('0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
    });
  });

  describe('metadata extraction integration', () => {
    it('should extract and convert IPFS URLs to HTTP', async () => {
      const { extractMediaUrls } = await import('../../src/metadata.js');

      const metadata = {
        name: 'Test NFT',
        image: 'ipfs://QmImage12345678901234567890123456789012345',
        animation_url: 'ipfs://QmAnimation12345678901234567890123456789',
      };

      const urls = extractMediaUrls(metadata);

      expect(urls.image).toContain('https://ipfs.io/ipfs/');
      expect(urls.animation).toContain('https://ipfs.io/ipfs/');
    });

    it('should preserve HTTP URLs', async () => {
      const { extractMediaUrls } = await import('../../src/metadata.js');

      const metadata = {
        name: 'Test NFT',
        image: 'https://example.com/image.png',
        animation_url: 'https://example.com/video.mp4',
      };

      const urls = extractMediaUrls(metadata);

      expect(urls.image).toBe('https://example.com/image.png');
      expect(urls.animation).toBe('https://example.com/video.mp4');
    });
  });

  describe('full analysis pipeline', () => {
    it('should process multiple NFTs with different storage types', async () => {
      const { analyzeNFTStorage, getStorageStatus } = await import('../../src/storage-classifier.js');

      const nfts = [
        {
          contractAddress: '0x1111111111111111111111111111111111111111',
          tokenId: '1',
          tokenUri: 'ipfs://QmSafe111111111111111111111111111111111111',
        },
        {
          contractAddress: '0x2222222222222222222222222222222222222222',
          tokenId: '2',
          tokenUri: 'https://api.niftygateway.com/metadata/2',
        },
        {
          contractAddress: '0x3333333333333333333333333333333333333333',
          tokenId: '3',
          tokenUri: 'ar://arweaveTxId123456789',
        },
      ];

      const metadatas = [
        { name: 'IPFS NFT', image: 'ipfs://QmImage1' },
        { name: 'Centralized NFT', image: 'https://cdn.example.com/2.png' },
        { name: 'Arweave NFT', image: 'ar://arweaveImageTxId' },
      ];

      const results = nfts.map((nft, i) => {
        const report = analyzeNFTStorage(nft, metadatas[i]);
        return {
          tokenId: nft.tokenId,
          status: getStorageStatus(report),
          isDecentralized: report.isFullyDecentralized,
        };
      });

      expect(results[0].status).toBe('decentralized');
      expect(results[1].status).toBe('at-risk');
      expect(results[2].status).toBe('decentralized');
    });
  });
});
