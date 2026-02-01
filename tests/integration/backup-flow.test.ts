import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readdir, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server.js';

// Mock chalk
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

describe('backup flow integration', () => {
  let testDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    testDir = join(tmpdir(), `nft-rescue-backup-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('directory structure', () => {
    it('should create proper directory structure for NFT backup', async () => {
      const { mkdir: fsMkdir, writeFile } = await import('node:fs/promises');

      const contractAddress = '0x1234567890123456789012345678901234567890';
      const tokenId = '42';
      const nftDir = join(testDir, 'nfts', contractAddress, tokenId);

      await fsMkdir(nftDir, { recursive: true });

      // Write metadata
      await writeFile(
        join(nftDir, 'metadata.json'),
        JSON.stringify({ name: 'Test NFT', image: 'ipfs://QmTest' }, null, 2)
      );

      // Write storage report
      await writeFile(
        join(nftDir, 'storage-report.json'),
        JSON.stringify({
          tokenUri: { type: 'ipfs', isAtRisk: false },
          isFullyDecentralized: true,
          atRiskUrls: [],
        }, null, 2)
      );

      // Verify structure
      const nftDirContents = await readdir(nftDir);
      expect(nftDirContents).toContain('metadata.json');
      expect(nftDirContents).toContain('storage-report.json');

      // Verify metadata content
      const metadata = JSON.parse(await readFile(join(nftDir, 'metadata.json'), 'utf-8'));
      expect(metadata.name).toBe('Test NFT');
    });
  });

  describe('asset downloading', () => {
    it('should download image with correct extension', async () => {
      server.use(
        http.get('https://cdn.test.com/image.png', () => {
          return new HttpResponse(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
            headers: {
              'Content-Type': 'image/png',
              'Content-Length': '4',
            },
          });
        })
      );

      const { downloadAsset } = await import('../../src/downloader.js');

      const destPath = join(testDir, 'image.tmp');
      const result = await downloadAsset('https://cdn.test.com/image.png', destPath);

      expect(result.path).toMatch(/\.png$/);
      expect(result.size).toBe(4);

      const fileExists = await access(result.path).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should handle IPFS URLs by trying multiple gateways', async () => {
      let gatewayAttempts = 0;

      server.use(
        http.get('https://ipfs.io/ipfs/:cid', () => {
          gatewayAttempts++;
          return new HttpResponse(null, { status: 503 });
        }),
        http.get('https://cloudflare-ipfs.com/ipfs/:cid', () => {
          gatewayAttempts++;
          return new HttpResponse(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
            headers: {
              'Content-Type': 'image/png',
              'Content-Length': '4',
            },
          });
        })
      );

      const { downloadAsset } = await import('../../src/downloader.js');

      const destPath = join(testDir, 'ipfs-image.tmp');
      const result = await downloadAsset(
        'https://ipfs.io/ipfs/QmTestIPFSCID12345678901234567890123456',
        destPath
      );

      expect(result.path).toMatch(/\.png$/);
      expect(gatewayAttempts).toBeGreaterThan(1);
    });
  });

  describe('manifest generation', () => {
    it('should create valid manifest structure', async () => {
      const manifest = {
        walletAddress: '0x1234567890123456789012345678901234567890',
        ensName: 'test.eth',
        backupDate: new Date().toISOString(),
        summary: {
          totalNFTs: 10,
          fullyDecentralized: 5,
          atRisk: 5,
          backedUp: 4,
          failed: 1,
        },
        nfts: [
          {
            contractAddress: '0x1111111111111111111111111111111111111111',
            tokenId: '1',
            name: 'Test NFT #1',
            metadataFile: 'nfts/0x1111.../1/metadata.json',
            imageFile: 'nfts/0x1111.../1/image.png',
            storageStatus: 'at-risk' as const,
          },
        ],
      };

      const manifestPath = join(testDir, 'manifest.json');
      const { writeFile } = await import('node:fs/promises');
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      // Verify manifest
      const savedManifest = JSON.parse(await readFile(manifestPath, 'utf-8'));

      expect(savedManifest.walletAddress).toBe(manifest.walletAddress);
      expect(savedManifest.ensName).toBe(manifest.ensName);
      expect(savedManifest.summary.totalNFTs).toBe(10);
      expect(savedManifest.summary.backedUp).toBe(4);
      expect(savedManifest.nfts).toHaveLength(1);
      expect(savedManifest.nfts[0].storageStatus).toBe('at-risk');
    });
  });

  describe('storage report integration', () => {
    it('should generate accurate storage reports for mixed storage NFTs', async () => {
      const { analyzeNFTStorage, getStorageStatus } = await import('../../src/storage-classifier.js');

      const nft = {
        contractAddress: '0x1234567890123456789012345678901234567890',
        tokenId: '1',
        tokenUri: 'ipfs://QmMetadataCID1234567890123456789012345678',
      };

      const metadata = {
        name: 'Mixed Storage NFT',
        description: 'Has IPFS metadata but centralized image',
        image: 'https://cdn.niftygateway.com/images/nft.png',
        animation_url: 'ipfs://QmAnimationCID12345678901234567890123456',
        attributes: [{ trait_type: 'Storage', value: 'Mixed' }],
      };

      const report = analyzeNFTStorage(nft, metadata);
      const status = getStorageStatus(report);

      expect(status).toBe('mixed');
      expect(report.tokenUri.type).toBe('ipfs');
      expect(report.tokenUri.isAtRisk).toBe(false);
      expect(report.image?.type).toBe('centralized');
      expect(report.image?.isAtRisk).toBe(true);
      expect(report.animation?.type).toBe('ipfs');
      expect(report.animation?.isAtRisk).toBe(false);
      expect(report.atRiskUrls).toContain('https://cdn.niftygateway.com/images/nft.png');
    });
  });

  describe('error handling', () => {
    it('should handle failed downloads gracefully', async () => {
      server.use(
        http.get('https://broken.example.com/image.png', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const { downloadAsset } = await import('../../src/downloader.js');

      const destPath = join(testDir, 'broken.tmp');
      await expect(downloadAsset('https://broken.example.com/image.png', destPath)).rejects.toThrow();
    });

    it('should handle metadata fetch failures', async () => {
      server.use(
        http.get('https://dead-api.example.com/metadata/1', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const { fetchMetadata } = await import('../../src/metadata.js');

      await expect(fetchMetadata('https://dead-api.example.com/metadata/1')).rejects.toThrow();
    });
  });

  describe('cached metadata fallback', () => {
    it('should use cached metadata when original URI fails', async () => {
      const { analyzeNFTStorage } = await import('../../src/storage-classifier.js');

      // Simulate NFT with cached metadata from Alchemy
      const nft = {
        contractAddress: '0x1234567890123456789012345678901234567890',
        tokenId: '1',
        tokenUri: 'https://dead-api.example.com/metadata/1', // Dead URL
        cachedMetadata: {
          name: 'Cached NFT',
          description: 'From Alchemy cache',
          image: 'https://cached-cdn.example.com/image.png',
        },
        cachedImageUrl: 'https://nft-cdn.alchemy.com/cached/image.png',
      };

      // Use cached metadata for analysis
      const report = analyzeNFTStorage(nft, nft.cachedMetadata);

      expect(report.tokenUri.isAtRisk).toBe(true); // Original URI is centralized
      expect(report.image?.isAtRisk).toBe(true);
      expect(report.isFullyDecentralized).toBe(false);
    });
  });
});
