import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server.js';
import { ipfsToHttp, fetchMetadata, extractMediaUrls } from '../../src/metadata.js';
import { createMockMetadata } from '../helpers/test-utils.js';

describe('metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ipfsToHttp', () => {
    it('should convert ipfs:// protocol to HTTP gateway URL', () => {
      const result = ipfsToHttp('ipfs://QmTestCID12345678901234567890123456789012');
      expect(result).toBe('https://ipfs.io/ipfs/QmTestCID12345678901234567890123456789012');
    });

    it('should convert ipfs/ prefix to HTTP gateway URL', () => {
      const result = ipfsToHttp('ipfs/QmTestCID12345678901234567890123456789012');
      expect(result).toBe('https://ipfs.io/ipfs/QmTestCID12345678901234567890123456789012');
    });

    it('should convert raw Qm CID to HTTP gateway URL', () => {
      // CIDv0 must be exactly 46 characters starting with Qm
      const cid = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
      const result = ipfsToHttp(cid);
      expect(result).toBe(`https://ipfs.io/ipfs/${cid}`);
    });

    it('should convert raw bafy CID to HTTP gateway URL', () => {
      const result = ipfsToHttp('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi');
      expect(result).toBe('https://ipfs.io/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi');
    });

    it('should preserve HTTP URLs as-is', () => {
      const url = 'https://example.com/image.png';
      expect(ipfsToHttp(url)).toBe(url);
    });

    it('should preserve HTTPS URLs as-is', () => {
      const url = 'https://cdn.example.com/nft/123.png';
      expect(ipfsToHttp(url)).toBe(url);
    });

    it('should handle empty string', () => {
      expect(ipfsToHttp('')).toBe('');
    });

    it('should handle IPFS CID with path', () => {
      const result = ipfsToHttp('ipfs://QmTestCID12345678901234567890123456789012/image.png');
      expect(result).toBe('https://ipfs.io/ipfs/QmTestCID12345678901234567890123456789012/image.png');
    });
  });

  describe('fetchMetadata', () => {
    it('should fetch metadata from HTTP URL', async () => {
      server.use(
        http.get('https://api.example.com/metadata/1', () => {
          return HttpResponse.json({
            name: 'Test NFT',
            description: 'A test NFT',
            image: 'https://cdn.example.com/1.png',
          });
        })
      );

      const metadata = await fetchMetadata('https://api.example.com/metadata/1');

      expect(metadata.name).toBe('Test NFT');
      expect(metadata.description).toBe('A test NFT');
      expect(metadata.image).toBe('https://cdn.example.com/1.png');
    });

    it('should fetch metadata from IPFS URI', async () => {
      server.use(
        http.get('https://ipfs.io/ipfs/QmTestMetadataCID12345678901234567890123', () => {
          return HttpResponse.json({
            name: 'IPFS NFT',
            description: 'Stored on IPFS',
            image: 'ipfs://QmImageCID',
          });
        })
      );

      const metadata = await fetchMetadata('ipfs://QmTestMetadataCID12345678901234567890123');

      expect(metadata.name).toBe('IPFS NFT');
      expect(metadata.description).toBe('Stored on IPFS');
    });

    it('should throw error for empty token URI', async () => {
      await expect(fetchMetadata('')).rejects.toThrow('Token URI is empty');
    });

    it('should throw error for invalid JSON', async () => {
      server.use(
        http.get('https://api.example.com/metadata/bad', () => {
          return new HttpResponse('not json', {
            headers: { 'Content-Type': 'text/plain' },
          });
        })
      );

      await expect(fetchMetadata('https://api.example.com/metadata/bad')).rejects.toThrow(
        'Invalid JSON in metadata'
      );
    });

    it('should throw error on 404', async () => {
      server.use(
        http.get('https://api.example.com/metadata/404', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      await expect(fetchMetadata('https://api.example.com/metadata/404')).rejects.toThrow();
    });

    it('should fallback to other IPFS gateways when first fails', async () => {
      let callCount = 0;
      server.use(
        http.get('https://ipfs.io/ipfs/:cid', () => {
          callCount++;
          return new HttpResponse(null, { status: 500 });
        }),
        http.get('https://cloudflare-ipfs.com/ipfs/:cid', () => {
          callCount++;
          return HttpResponse.json({
            name: 'Fallback NFT',
            description: 'From second gateway',
          });
        })
      );

      const metadata = await fetchMetadata('ipfs://QmTestFallbackCID12345678901234567890123');

      expect(metadata.name).toBe('Fallback NFT');
      expect(callCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('extractMediaUrls', () => {
    it('should extract image URL and convert IPFS to HTTP', () => {
      const metadata = createMockMetadata({
        image: 'ipfs://QmImageCID12345678901234567890123456789012',
      });

      const result = extractMediaUrls(metadata);

      expect(result.image).toBe('https://ipfs.io/ipfs/QmImageCID12345678901234567890123456789012');
    });

    it('should extract animation URL and convert IPFS to HTTP', () => {
      const metadata = createMockMetadata({
        animation_url: 'ipfs://QmAnimationCID123456789012345678901234567',
      });

      const result = extractMediaUrls(metadata);

      expect(result.animation).toBe('https://ipfs.io/ipfs/QmAnimationCID123456789012345678901234567');
    });

    it('should handle HTTP URLs without conversion', () => {
      const metadata = createMockMetadata({
        image: 'https://cdn.example.com/image.png',
        animation_url: 'https://cdn.example.com/video.mp4',
      });

      const result = extractMediaUrls(metadata);

      expect(result.image).toBe('https://cdn.example.com/image.png');
      expect(result.animation).toBe('https://cdn.example.com/video.mp4');
    });

    it('should return undefined for missing image', () => {
      const metadata = createMockMetadata({
        image: undefined,
      });

      const result = extractMediaUrls(metadata);

      expect(result.image).toBeUndefined();
    });

    it('should return undefined for missing animation', () => {
      const metadata = createMockMetadata({
        animation_url: undefined,
      });

      const result = extractMediaUrls(metadata);

      expect(result.animation).toBeUndefined();
    });

    it('should handle both URLs being present', () => {
      const metadata = createMockMetadata({
        image: 'ipfs://QmImage1234567890123456789012345678901234',
        animation_url: 'https://example.com/video.mp4',
      });

      const result = extractMediaUrls(metadata);

      expect(result.image).toBe('https://ipfs.io/ipfs/QmImage1234567890123456789012345678901234');
      expect(result.animation).toBe('https://example.com/video.mp4');
    });
  });
});
