import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server.js';
import { getExtensionFromUrl, downloadAsset, formatBytes } from '../../src/downloader.js';
import { mkdir, rm, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('downloader', () => {
  describe('getExtensionFromUrl', () => {
    describe('from content-type header', () => {
      it('should return .png for image/png', () => {
        expect(getExtensionFromUrl('https://example.com/image', 'image/png')).toBe('.png');
      });

      it('should return .jpg for image/jpeg', () => {
        expect(getExtensionFromUrl('https://example.com/image', 'image/jpeg')).toBe('.jpg');
      });

      it('should return .jpg for image/jpg', () => {
        expect(getExtensionFromUrl('https://example.com/image', 'image/jpg')).toBe('.jpg');
      });

      it('should return .gif for image/gif', () => {
        expect(getExtensionFromUrl('https://example.com/image', 'image/gif')).toBe('.gif');
      });

      it('should return .webp for image/webp', () => {
        expect(getExtensionFromUrl('https://example.com/image', 'image/webp')).toBe('.webp');
      });

      it('should return .svg for image/svg+xml', () => {
        expect(getExtensionFromUrl('https://example.com/image', 'image/svg+xml')).toBe('.svg');
      });

      it('should return .mp4 for video/mp4', () => {
        expect(getExtensionFromUrl('https://example.com/video', 'video/mp4')).toBe('.mp4');
      });

      it('should return .webm for video/webm', () => {
        expect(getExtensionFromUrl('https://example.com/video', 'video/webm')).toBe('.webm');
      });

      it('should return .mov for video/quicktime', () => {
        expect(getExtensionFromUrl('https://example.com/video', 'video/quicktime')).toBe('.mov');
      });

      it('should return .mp3 for audio/mpeg', () => {
        expect(getExtensionFromUrl('https://example.com/audio', 'audio/mpeg')).toBe('.mp3');
      });

      it('should return .html for text/html', () => {
        expect(getExtensionFromUrl('https://example.com/page', 'text/html')).toBe('.html');
      });

      it('should return .pdf for application/pdf', () => {
        expect(getExtensionFromUrl('https://example.com/doc', 'application/pdf')).toBe('.pdf');
      });

      it('should handle content-type with charset', () => {
        expect(getExtensionFromUrl('https://example.com/page', 'text/html; charset=utf-8')).toBe('.html');
      });
    });

    describe('from URL path', () => {
      it('should extract extension from URL path', () => {
        expect(getExtensionFromUrl('https://example.com/image.png')).toBe('.png');
        expect(getExtensionFromUrl('https://example.com/video.mp4')).toBe('.mp4');
        expect(getExtensionFromUrl('https://example.com/audio.mp3')).toBe('.mp3');
      });

      it('should handle URLs with query strings', () => {
        expect(getExtensionFromUrl('https://example.com/image.jpg?size=large')).toBe('.jpg');
      });

      it('should handle URLs with fragments', () => {
        expect(getExtensionFromUrl('https://example.com/image.gif#section')).toBe('.gif');
      });

      it('should convert extension to lowercase', () => {
        expect(getExtensionFromUrl('https://example.com/image.PNG')).toBe('.png');
        expect(getExtensionFromUrl('https://example.com/video.MP4')).toBe('.mp4');
      });

      it('should handle deep paths', () => {
        expect(getExtensionFromUrl('https://example.com/path/to/image.webp')).toBe('.webp');
      });
    });

    describe('fallback behavior', () => {
      it('should return .bin for unknown content-type', () => {
        expect(getExtensionFromUrl('https://example.com/file', 'application/octet-stream')).toBe('.bin');
      });

      it('should return .bin when no extension in URL and no content-type', () => {
        expect(getExtensionFromUrl('https://example.com/file')).toBe('.bin');
      });

      it('should prefer content-type over URL extension', () => {
        expect(getExtensionFromUrl('https://example.com/image.jpg', 'image/png')).toBe('.png');
      });

      it('should fall back to URL when content-type is unknown', () => {
        expect(getExtensionFromUrl('https://example.com/image.jpg', 'application/unknown')).toBe('.jpg');
      });
    });
  });

  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatBytes(500)).toBe('500.0 B');
      expect(formatBytes(1023)).toBe('1023.0 B');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(10240)).toBe('10.0 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1048576)).toBe('1.0 MB');
      expect(formatBytes(5242880)).toBe('5.0 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1073741824)).toBe('1.0 GB');
      expect(formatBytes(2147483648)).toBe('2.0 GB');
    });

    it('should handle decimal precision', () => {
      expect(formatBytes(1500)).toBe('1.5 KB');
      expect(formatBytes(1234567)).toBe('1.2 MB');
    });
  });

  describe('downloadAsset', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(tmpdir(), `nft-rescue-test-${Date.now()}`);
      await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should download file and save with correct extension', async () => {
      server.use(
        http.get('https://cdn.example.com/nft/image.png', () => {
          return new HttpResponse(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
            headers: {
              'Content-Type': 'image/png',
              'Content-Length': '4',
            },
          });
        })
      );

      const destPath = join(testDir, 'image.tmp');
      const result = await downloadAsset('https://cdn.example.com/nft/image.png', destPath);

      expect(result.path).toMatch(/\.png$/);
      expect(result.size).toBe(4);

      const files = await readdir(testDir);
      expect(files).toContain('image.png');
    });

    it('should create destination directory if it does not exist', async () => {
      server.use(
        http.get('https://cdn.example.com/nft/image.jpg', () => {
          return new HttpResponse(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), {
            headers: {
              'Content-Type': 'image/jpeg',
              'Content-Length': '4',
            },
          });
        })
      );

      const nestedDir = join(testDir, 'nested', 'deep', 'path');
      const destPath = join(nestedDir, 'image.tmp');
      const result = await downloadAsset('https://cdn.example.com/nft/image.jpg', destPath);

      expect(result.path).toMatch(/\.jpg$/);

      const files = await readdir(nestedDir);
      expect(files).toContain('image.jpg');
    });

    it('should throw error for 404 response', async () => {
      server.use(
        http.get('https://cdn.example.com/missing.png', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const destPath = join(testDir, 'missing.tmp');
      await expect(downloadAsset('https://cdn.example.com/missing.png', destPath)).rejects.toThrow();
    });

    it('should try multiple IPFS gateways when one fails', async () => {
      let callCount = 0;
      server.use(
        http.get('https://ipfs.io/ipfs/:cid', () => {
          callCount++;
          return new HttpResponse(null, { status: 500 });
        }),
        http.get('https://cloudflare-ipfs.com/ipfs/:cid', () => {
          callCount++;
          return new HttpResponse(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
            headers: {
              'Content-Type': 'image/png',
              'Content-Length': '4',
            },
          });
        })
      );

      const destPath = join(testDir, 'ipfs-image.tmp');
      const result = await downloadAsset(
        'https://ipfs.io/ipfs/QmTestCID1234567890123456789012345678901234',
        destPath
      );

      expect(result.path).toMatch(/\.png$/);
      // Should have tried at least 2 gateways (with retries)
      expect(callCount).toBeGreaterThanOrEqual(2);
    });

    it('should handle response without content-length', async () => {
      server.use(
        http.get('https://cdn.example.com/no-length.gif', () => {
          return new HttpResponse(new Uint8Array([0x47, 0x49, 0x46, 0x38]), {
            headers: {
              'Content-Type': 'image/gif',
            },
          });
        })
      );

      const destPath = join(testDir, 'no-length.tmp');
      const result = await downloadAsset('https://cdn.example.com/no-length.gif', destPath);

      expect(result.path).toMatch(/\.gif$/);
      expect(result.size).toBe(0); // Size is 0 when content-length is not provided
    });

    it('should write correct content to file', async () => {
      const testContent = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      server.use(
        http.get('https://cdn.example.com/content-test.png', () => {
          return new HttpResponse(testContent, {
            headers: {
              'Content-Type': 'image/png',
              'Content-Length': String(testContent.length),
            },
          });
        })
      );

      const destPath = join(testDir, 'content-test.tmp');
      const result = await downloadAsset('https://cdn.example.com/content-test.png', destPath);

      const fileContent = await readFile(result.path);
      expect(Buffer.from(testContent).equals(fileContent)).toBe(true);
    });
  });
});
