import { describe, it, expect, vi, beforeEach } from 'vitest';

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
});
