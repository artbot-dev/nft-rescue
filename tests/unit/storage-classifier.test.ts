import { describe, it, expect } from 'vitest';
import {
  classifyUrl,
  analyzeNFTStorage,
  getStorageTypeName,
  getStorageStatus,
} from '../../src/storage-classifier.js';
import {
  createMockNFT,
  createMockMetadata,
  createMockStorageReport,
  createMockStorageAnalysis,
} from '../helpers/test-utils.js';

describe('storage-classifier', () => {
  describe('classifyUrl', () => {
    describe('IPFS URLs', () => {
      it('should classify ipfs:// protocol as IPFS', () => {
        const result = classifyUrl('ipfs://QmTestCID12345678901234567890123456789012');
        expect(result.type).toBe('ipfs');
        expect(result.isAtRisk).toBe(false);
      });

      it('should classify ipfs:// with bafy CID as IPFS', () => {
        const result = classifyUrl('ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi');
        expect(result.type).toBe('ipfs');
        expect(result.isAtRisk).toBe(false);
      });

      it('should classify /ipfs/ path as IPFS', () => {
        const result = classifyUrl('https://gateway.example.com/ipfs/QmTestCID1234567890123456789012345');
        expect(result.type).toBe('ipfs');
        expect(result.isAtRisk).toBe(false);
      });

      it('should classify known IPFS gateway hosts', () => {
        const gateways = [
          'https://ipfs.io/ipfs/QmTest',
          'https://cloudflare-ipfs.com/ipfs/QmTest',
          'https://gateway.pinata.cloud/ipfs/QmTest',
          'https://dweb.link/ipfs/QmTest',
        ];

        for (const url of gateways) {
          const result = classifyUrl(url);
          expect(result.type).toBe('ipfs');
          expect(result.isAtRisk).toBe(false);
        }
      });

      it('should classify raw Qm CID as IPFS', () => {
        // CIDv0 must be exactly 46 characters starting with Qm
        const result = classifyUrl('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG');
        expect(result.type).toBe('ipfs');
        expect(result.isAtRisk).toBe(false);
      });

      it('should classify raw bafy CID as IPFS', () => {
        const result = classifyUrl('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi');
        expect(result.type).toBe('ipfs');
        expect(result.isAtRisk).toBe(false);
      });
    });

    describe('Arweave URLs', () => {
      it('should classify ar:// protocol as Arweave', () => {
        const result = classifyUrl('ar://testTransactionId123');
        expect(result.type).toBe('arweave');
        expect(result.isAtRisk).toBe(false);
      });

      it('should classify arweave.net host as Arweave', () => {
        const result = classifyUrl('https://arweave.net/testTransactionId');
        expect(result.type).toBe('arweave');
        expect(result.isAtRisk).toBe(false);
      });

      it('should classify other Arweave gateways', () => {
        const gateways = [
          'https://arweave.dev/txId',
          'https://ar-io.net/txId',
          'https://g8way.io/txId',
        ];

        for (const url of gateways) {
          const result = classifyUrl(url);
          expect(result.type).toBe('arweave');
          expect(result.isAtRisk).toBe(false);
        }
      });
    });

    describe('Data URIs', () => {
      it('should classify data: URIs as data-uri', () => {
        const result = classifyUrl('data:image/png;base64,iVBORw0KGgo=');
        expect(result.type).toBe('data-uri');
        expect(result.isAtRisk).toBe(false);
      });

      it('should classify data: URIs with JSON', () => {
        const result = classifyUrl('data:application/json;base64,eyJuYW1lIjoidGVzdCJ9');
        expect(result.type).toBe('data-uri');
        expect(result.isAtRisk).toBe(false);
      });

      it('should handle data URIs with whitespace prefix', () => {
        const result = classifyUrl('  data:image/svg+xml,<svg></svg>');
        expect(result.type).toBe('data-uri');
        expect(result.isAtRisk).toBe(false);
      });
    });

    describe('Centralized URLs', () => {
      it('should classify HTTP URLs as centralized and at-risk', () => {
        const result = classifyUrl('https://example.com/nft/image.png');
        expect(result.type).toBe('centralized');
        expect(result.isAtRisk).toBe(true);
        expect(result.host).toBe('example.com');
      });

      it('should classify known at-risk hosts', () => {
        const atRiskUrls = [
          'https://api.niftygateway.com/metadata/123',
          'https://s3.amazonaws.com/nft-bucket/image.png',
          'https://lh3.googleusercontent.com/image123',
          'https://storage.googleapis.com/nft-images/1.png',
        ];

        for (const url of atRiskUrls) {
          const result = classifyUrl(url);
          expect(result.type).toBe('centralized');
          expect(result.isAtRisk).toBe(true);
        }
      });

      it('should classify OpenSea URLs as at-risk', () => {
        const result = classifyUrl('https://api.opensea.io/api/v1/asset/0x123/1');
        expect(result.type).toBe('centralized');
        expect(result.isAtRisk).toBe(true);
      });
    });

    describe('Edge cases', () => {
      it('should handle empty string', () => {
        const result = classifyUrl('');
        expect(result.type).toBe('centralized');
        expect(result.isAtRisk).toBe(true);
      });

      it('should handle null-like values', () => {
        const result = classifyUrl(null as unknown as string);
        expect(result.type).toBe('centralized');
        expect(result.isAtRisk).toBe(true);
      });

      it('should handle undefined', () => {
        const result = classifyUrl(undefined as unknown as string);
        expect(result.type).toBe('centralized');
        expect(result.isAtRisk).toBe(true);
      });

      it('should handle URLs with whitespace', () => {
        const result = classifyUrl('  https://example.com/nft.png  ');
        expect(result.type).toBe('centralized');
        expect(result.host).toBe('example.com');
      });

      it('should handle malformed URLs', () => {
        const result = classifyUrl('not-a-valid-url');
        expect(result.type).toBe('centralized');
        expect(result.isAtRisk).toBe(true);
      });

      it('should preserve original URL in result', () => {
        const url = 'ipfs://QmTestCID12345678901234567890123456789012';
        const result = classifyUrl(url);
        expect(result.originalUrl).toBe(url);
      });
    });
  });

  describe('analyzeNFTStorage', () => {
    it('should analyze fully decentralized NFT', () => {
      const nft = createMockNFT({
        tokenUri: 'ipfs://QmMetadata12345678901234567890123456789012',
      });
      const metadata = createMockMetadata({
        image: 'ipfs://QmImage12345678901234567890123456789012345',
        animation_url: 'ipfs://QmAnimation12345678901234567890123456789',
      });

      const report = analyzeNFTStorage(nft, metadata);

      expect(report.isFullyDecentralized).toBe(true);
      expect(report.atRiskUrls).toHaveLength(0);
      expect(report.tokenUri.type).toBe('ipfs');
      expect(report.image?.type).toBe('ipfs');
      expect(report.animation?.type).toBe('ipfs');
    });

    it('should analyze fully centralized NFT', () => {
      const nft = createMockNFT({
        tokenUri: 'https://api.niftygateway.com/metadata/1',
      });
      const metadata = createMockMetadata({
        image: 'https://cdn.niftygateway.com/image.png',
        animation_url: 'https://cdn.niftygateway.com/video.mp4',
      });

      const report = analyzeNFTStorage(nft, metadata);

      expect(report.isFullyDecentralized).toBe(false);
      expect(report.atRiskUrls.length).toBeGreaterThan(0);
      expect(report.tokenUri.isAtRisk).toBe(true);
      expect(report.image?.isAtRisk).toBe(true);
      expect(report.animation?.isAtRisk).toBe(true);
    });

    it('should analyze mixed storage NFT', () => {
      const nft = createMockNFT({
        tokenUri: 'ipfs://QmMetadata12345678901234567890123456789012',
      });
      const metadata = createMockMetadata({
        image: 'https://cdn.example.com/image.png',
        animation_url: 'ipfs://QmAnimation12345678901234567890123456789',
      });

      const report = analyzeNFTStorage(nft, metadata);

      expect(report.isFullyDecentralized).toBe(false);
      expect(report.atRiskUrls).toContain('https://cdn.example.com/image.png');
      expect(report.tokenUri.isAtRisk).toBe(false);
      expect(report.image?.isAtRisk).toBe(true);
      expect(report.animation?.isAtRisk).toBe(false);
    });

    it('should handle NFT without metadata', () => {
      const nft = createMockNFT({
        tokenUri: 'ipfs://QmTest12345678901234567890123456789012345',
      });

      const report = analyzeNFTStorage(nft, undefined);

      expect(report.tokenUri).toBeDefined();
      expect(report.image).toBeUndefined();
      expect(report.animation).toBeUndefined();
    });

    it('should handle NFT with no token URI', () => {
      const nft = createMockNFT({
        tokenUri: undefined,
      });
      const metadata = createMockMetadata();

      const report = analyzeNFTStorage(nft, metadata);

      expect(report.tokenUri.isAtRisk).toBe(true);
    });
  });

  describe('getStorageTypeName', () => {
    it('should return correct names for each type', () => {
      expect(getStorageTypeName('ipfs')).toBe('IPFS');
      expect(getStorageTypeName('arweave')).toBe('Arweave');
      expect(getStorageTypeName('data-uri')).toBe('Embedded (data URI)');
      expect(getStorageTypeName('centralized')).toBe('Centralized');
    });
  });

  describe('getStorageStatus', () => {
    it('should return decentralized for fully safe NFT', () => {
      const report = createMockStorageReport({
        isFullyDecentralized: true,
        tokenUri: createMockStorageAnalysis({ isAtRisk: false }),
        image: createMockStorageAnalysis({ isAtRisk: false }),
        animation: undefined,
        atRiskUrls: [],
      });

      expect(getStorageStatus(report)).toBe('decentralized');
    });

    it('should return at-risk for fully centralized NFT', () => {
      const report = createMockStorageReport({
        isFullyDecentralized: false,
        tokenUri: createMockStorageAnalysis({ type: 'centralized', isAtRisk: true }),
        image: createMockStorageAnalysis({ type: 'centralized', isAtRisk: true }),
        animation: undefined,
        atRiskUrls: ['https://example.com/1', 'https://example.com/2'],
      });

      expect(getStorageStatus(report)).toBe('at-risk');
    });

    it('should return mixed for partially safe NFT', () => {
      const report = createMockStorageReport({
        isFullyDecentralized: false,
        tokenUri: createMockStorageAnalysis({ type: 'ipfs', isAtRisk: false }),
        image: createMockStorageAnalysis({ type: 'centralized', isAtRisk: true }),
        animation: undefined,
        atRiskUrls: ['https://example.com/image.png'],
      });

      expect(getStorageStatus(report)).toBe('mixed');
    });

    it('should handle report with only tokenUri', () => {
      const report = createMockStorageReport({
        isFullyDecentralized: false,
        tokenUri: createMockStorageAnalysis({ type: 'centralized', isAtRisk: true }),
        image: undefined,
        animation: undefined,
        atRiskUrls: ['https://example.com/metadata'],
      });

      expect(getStorageStatus(report)).toBe('at-risk');
    });
  });
});
