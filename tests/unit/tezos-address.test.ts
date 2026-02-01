import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server.js';
import {
  isTezosAddress,
  isTezDomain,
  resolveTezDomain,
  resolveTezosAddress,
} from '../../src/tezos-address.js';

describe('tezos-address', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  describe('isTezosAddress', () => {
    it('should return true for valid tz1 addresses', () => {
      expect(isTezosAddress('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb')).toBe(true);
      expect(isTezosAddress('tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6')).toBe(true);
    });

    it('should return true for valid tz2 addresses', () => {
      expect(isTezosAddress('tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m')).toBe(true);
    });

    it('should return true for valid tz3 addresses', () => {
      expect(isTezosAddress('tz3WXYtyDUNL91qfiCJtVUX746QpNv5i5ve5')).toBe(true);
    });

    it('should return true for valid KT1 contract addresses', () => {
      expect(isTezosAddress('KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton')).toBe(true);
      expect(isTezosAddress('KT1GBZmSxmnKJXGMdMLbugPfLyUPmuLSMwKS')).toBe(true);
    });

    it('should return false for invalid addresses', () => {
      expect(isTezosAddress('tz4invalidprefix')).toBe(false);
      expect(isTezosAddress('KT2invalid')).toBe(false);
      expect(isTezosAddress('tz1short')).toBe(false);
      expect(isTezosAddress('tz1toolongggggggggggggggggggggggggggggggg')).toBe(false);
      expect(isTezosAddress('')).toBe(false);
    });

    it('should return false for Ethereum addresses', () => {
      expect(isTezosAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(false);
    });

    it('should return false for addresses with invalid characters', () => {
      // O, I, l, 0 are not valid in base58check
      expect(isTezosAddress('tz1VSUr8wwNhLAzempOch5d6hLRiTh8Cjcjb')).toBe(false); // O instead of valid char
      expect(isTezosAddress('tz1VSUr8wwNhLAzemp0ch5d6hLRiTh8Cjcjb')).toBe(false); // 0 instead of valid char
    });
  });

  describe('isTezDomain', () => {
    it('should return true for valid .tez domains', () => {
      expect(isTezDomain('alice.tez')).toBe(true);
      expect(isTezDomain('bob.tez')).toBe(true);
      expect(isTezDomain('my-wallet.tez')).toBe(true);
      expect(isTezDomain('subdomain.alice.tez')).toBe(true);
    });

    it('should return false for .eth domains', () => {
      expect(isTezDomain('vitalik.eth')).toBe(false);
    });

    it('should return false for regular domains', () => {
      expect(isTezDomain('example.com')).toBe(false);
      expect(isTezDomain('test.org')).toBe(false);
    });

    it('should return false for Tezos addresses', () => {
      expect(isTezDomain('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb')).toBe(false);
    });

    it('should return false for empty strings and invalid input', () => {
      expect(isTezDomain('')).toBe(false);
      expect(isTezDomain('.tez')).toBe(false);
      expect(isTezDomain('tez')).toBe(false);
    });
  });

  describe('resolveTezDomain', () => {
    it('should resolve a valid .tez domain to an address', async () => {
      server.use(
        http.get('https://api.tzkt.io/v1/domains', () => {
          return HttpResponse.json([{ address: 'tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb' }]);
        })
      );

      const address = await resolveTezDomain('alice.tez');
      expect(address).toBe('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb');
    });

    it('should handle uppercase domain names', async () => {
      server.use(
        http.get('https://api.tzkt.io/v1/domains', ({ request }) => {
          const url = new URL(request.url);
          const name = url.searchParams.get('name');
          // Verify lowercase normalization
          expect(name).toBe('alice');
          return HttpResponse.json([{ address: 'tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6' }]);
        })
      );

      const address = await resolveTezDomain('ALICE.tez');
      expect(address).toBe('tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6');
    });

    it('should throw error for non-existent domain', async () => {
      server.use(
        http.get('https://api.tzkt.io/v1/domains', () => {
          return HttpResponse.json([]);
        })
      );

      await expect(resolveTezDomain('nonexistent.tez')).rejects.toThrow(
        '.tez domain "nonexistent.tez" could not be resolved to an address'
      );
    });

    it('should throw error on API failure', async () => {
      server.use(
        http.get('https://api.tzkt.io/v1/domains', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      await expect(resolveTezDomain('alice.tez')).rejects.toThrow(
        'Failed to resolve .tez domain "alice.tez": HTTP 500'
      );
    });
  });

  describe('resolveTezosAddress', () => {
    it('should return address for valid Tezos addresses', async () => {
      const result = await resolveTezosAddress('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb');
      expect(result.address).toBe('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb');
      expect(result.warning).toBeUndefined();
    });

    it('should resolve .tez domains to addresses', async () => {
      server.use(
        http.get('https://api.tzkt.io/v1/domains', () => {
          return HttpResponse.json([{ address: 'tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb' }]);
        })
      );

      const result = await resolveTezosAddress('alice.tez');
      expect(result.address).toBe('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb');
    });

    it('should throw error for invalid input', async () => {
      await expect(resolveTezosAddress('invalid-input')).rejects.toThrow(
        'Invalid input: "invalid-input" is not a valid Tezos address or .tez domain'
      );
    });

    it('should throw error for Ethereum addresses', async () => {
      await expect(
        resolveTezosAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')
      ).rejects.toThrow('is not a valid Tezos address or .tez domain');
    });
  });
});
