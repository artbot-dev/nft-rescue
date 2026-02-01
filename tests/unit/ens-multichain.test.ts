import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server.js';

// Mock viem module
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getEnsAddress: vi.fn().mockImplementation(({ name }: { name: string }) => {
        const responses: Record<string, string | null> = {
          'vitalik.eth': '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
          'test.eth': '0x1234567890123456789012345678901234567890',
        };
        return Promise.resolve(responses[name.toLowerCase()] ?? null);
      }),
      getEnsName: vi.fn().mockImplementation(({ address }: { address: string }) => {
        const responses: Record<string, string | null> = {
          '0xd8da6bf26964af9d7eed9e03e53415d37aa96045': 'vitalik.eth',
        };
        return Promise.resolve(responses[address.toLowerCase()] ?? null);
      }),
    })),
    isAddress: (input: string) => /^0x[a-fA-F0-9]{40}$/.test(input),
  };
});

vi.mock('viem/ens', () => ({
  normalize: (name: string) => name.toLowerCase(),
}));

describe('ens multi-chain support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveAddress with chain parameter', () => {
    it('should resolve ENS names on Ethereum without warning', async () => {
      const { resolveAddress } = await import('../../src/ens.js');

      const result = await resolveAddress('vitalik.eth', 'ethereum');
      expect(result.address).toBe('0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
      expect(result.warning).toBeUndefined();
    });

    it('should resolve ENS names when no chain specified (defaults to Ethereum)', async () => {
      const { resolveAddress } = await import('../../src/ens.js');

      const result = await resolveAddress('vitalik.eth');
      expect(result.address).toBe('0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
      expect(result.warning).toBeUndefined();
    });

    it('should resolve ENS names on non-Ethereum chains with warning', async () => {
      const { resolveAddress } = await import('../../src/ens.js');

      const result = await resolveAddress('vitalik.eth', 'base');
      expect(result.address).toBe('0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
      expect(result.warning).toContain('resolved on Ethereum');
      expect(result.warning).toContain('base');
    });

    it('should resolve ENS names on Zora with warning', async () => {
      const { resolveAddress } = await import('../../src/ens.js');

      const result = await resolveAddress('vitalik.eth', 'zora');
      expect(result.address).toBe('0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
      expect(result.warning).toContain('resolved on Ethereum');
      expect(result.warning).toContain('zora');
    });

    it('should resolve ENS names on Optimism with warning', async () => {
      const { resolveAddress } = await import('../../src/ens.js');

      const result = await resolveAddress('vitalik.eth', 'optimism');
      expect(result.address).toBe('0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
      expect(result.warning).toContain('resolved on Ethereum');
    });

    it('should accept valid addresses on any chain without warning', async () => {
      const { resolveAddress } = await import('../../src/ens.js');
      const testAddress = '0x1234567890123456789012345678901234567890';

      // Should work on all chains without warning
      const ethResult = await resolveAddress(testAddress, 'ethereum');
      expect(ethResult.address).toBe(testAddress.toLowerCase());
      expect(ethResult.warning).toBeUndefined();

      const baseResult = await resolveAddress(testAddress, 'base');
      expect(baseResult.address).toBe(testAddress.toLowerCase());
      expect(baseResult.warning).toBeUndefined();

      const zoraResult = await resolveAddress(testAddress, 'zora');
      expect(zoraResult.address).toBe(testAddress.toLowerCase());
      expect(zoraResult.warning).toBeUndefined();
    });

    it('should throw error for invalid addresses on any chain', async () => {
      const { resolveAddress } = await import('../../src/ens.js');

      await expect(resolveAddress('invalid', 'base')).rejects.toThrow(
        'Invalid input'
      );
    });
  });

  describe('reverseResolve with chain parameter', () => {
    it('should reverse resolve on Ethereum', async () => {
      const { reverseResolve } = await import('../../src/ens.js');

      const name = await reverseResolve(
        '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        'ethereum'
      );
      expect(name).toBe('vitalik.eth');
    });

    it('should return null for reverse resolve on non-Ethereum chains', async () => {
      const { reverseResolve } = await import('../../src/ens.js');

      const name = await reverseResolve(
        '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        'base'
      );
      expect(name).toBeNull();
    });

    it('should return null for reverse resolve on Zora', async () => {
      const { reverseResolve } = await import('../../src/ens.js');

      const name = await reverseResolve(
        '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        'zora'
      );
      expect(name).toBeNull();
    });
  });

  describe('supportsEns helper', () => {
    it('should return true for Ethereum', async () => {
      const { supportsEns } = await import('../../src/ens.js');

      expect(supportsEns('ethereum')).toBe(true);
    });

    it('should return false for non-Ethereum chains', async () => {
      const { supportsEns } = await import('../../src/ens.js');

      expect(supportsEns('base')).toBe(false);
      expect(supportsEns('zora')).toBe(false);
      expect(supportsEns('optimism')).toBe(false);
      expect(supportsEns('arbitrum')).toBe(false);
      expect(supportsEns('polygon')).toBe(false);
    });

    it('should default to ethereum when no chain specified', async () => {
      const { supportsEns } = await import('../../src/ens.js');

      expect(supportsEns()).toBe(true);
    });
  });

  describe('Tezos support', () => {
    beforeEach(() => {
      server.resetHandlers();
    });

    it('should accept valid Tezos addresses on tezos chain', async () => {
      const { resolveAddress } = await import('../../src/ens.js');

      const result = await resolveAddress('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb', 'tezos');
      expect(result.address).toBe('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb');
      expect(result.warning).toBeUndefined();
    });

    it('should resolve .tez domains on tezos chain', async () => {
      server.use(
        http.get('https://api.tzkt.io/v1/domains', () => {
          return HttpResponse.json([{ address: 'tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb' }]);
        })
      );

      const { resolveAddress } = await import('../../src/ens.js');

      const result = await resolveAddress('alice.tez', 'tezos');
      expect(result.address).toBe('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb');
    });

    it('should throw error for EVM addresses on Tezos chain', async () => {
      const { resolveAddress } = await import('../../src/ens.js');

      await expect(
        resolveAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', 'tezos')
      ).rejects.toThrow('is not a valid Tezos address or .tez domain');
    });

    it('should throw error for ENS names on Tezos chain', async () => {
      const { resolveAddress } = await import('../../src/ens.js');

      await expect(resolveAddress('vitalik.eth', 'tezos')).rejects.toThrow(
        'is not a valid Tezos address or .tez domain'
      );
    });

    it('should return null for reverse resolve on Tezos', async () => {
      const { reverseResolve } = await import('../../src/ens.js');

      const name = await reverseResolve('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb', 'tezos');
      expect(name).toBeNull();
    });

    it('should identify .tez domains with isTezDomain', async () => {
      const { isTezDomain } = await import('../../src/ens.js');

      expect(isTezDomain('alice.tez')).toBe(true);
      expect(isTezDomain('bob.tez')).toBe(true);
      expect(isTezDomain('vitalik.eth')).toBe(false);
      expect(isTezDomain('example.com')).toBe(false);
    });

    it('should validate Tezos addresses with isTezosAddress', async () => {
      const { isTezosAddress } = await import('../../src/ens.js');

      expect(isTezosAddress('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb')).toBe(true);
      expect(isTezosAddress('KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton')).toBe(true);
      expect(isTezosAddress('0x1234567890123456789012345678901234567890')).toBe(false);
    });

    it('should check valid address for chain with isValidAddress', async () => {
      const { isValidAddress } = await import('../../src/ens.js');

      // EVM address is valid on Ethereum, not on Tezos
      expect(isValidAddress('0x1234567890123456789012345678901234567890', 'ethereum')).toBe(true);
      expect(isValidAddress('0x1234567890123456789012345678901234567890', 'tezos')).toBe(false);

      // Tezos address is valid on Tezos, not on Ethereum
      expect(isValidAddress('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb', 'tezos')).toBe(true);
      expect(isValidAddress('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb', 'ethereum')).toBe(false);
    });

    it('supportsTezDomains should return true for Tezos', async () => {
      const { supportsTezDomains } = await import('../../src/ens.js');

      expect(supportsTezDomains('tezos')).toBe(true);
      expect(supportsTezDomains('ethereum')).toBe(false);
      expect(supportsTezDomains('base')).toBe(false);
    });
  });
});
