import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isEnsName, resolveAddress, reverseResolve } from '../../src/ens.js';

// Mock viem module
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getEnsAddress: vi.fn().mockImplementation(({ name }: { name: string }) => {
        const responses: Record<string, string | null> = {
          'vitalik.eth': '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
          'artbot.eth': '0x1234567890123456789012345678901234567890',
          'test.eth': '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        };
        return Promise.resolve(responses[name.toLowerCase()] ?? null);
      }),
      getEnsName: vi.fn().mockImplementation(({ address }: { address: string }) => {
        const responses: Record<string, string | null> = {
          '0xd8da6bf26964af9d7eed9e03e53415d37aa96045': 'vitalik.eth',
          '0x1234567890123456789012345678901234567890': 'artbot.eth',
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

describe('ens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isEnsName', () => {
    it('should return true for valid ENS names', () => {
      expect(isEnsName('vitalik.eth')).toBe(true);
      expect(isEnsName('artbot.eth')).toBe(true);
      expect(isEnsName('test.eth')).toBe(true);
    });

    it('should return true for ENS names with subdomains', () => {
      expect(isEnsName('subdomain.vitalik.eth')).toBe(true);
      expect(isEnsName('deep.subdomain.test.eth')).toBe(true);
    });

    it('should return false for Ethereum addresses', () => {
      expect(isEnsName('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(false);
      expect(isEnsName('0x1234567890123456789012345678901234567890')).toBe(false);
    });

    it('should return false for non-.eth domains', () => {
      expect(isEnsName('example.com')).toBe(false);
      expect(isEnsName('test.org')).toBe(false);
      expect(isEnsName('name.xyz')).toBe(false);
    });

    it('should return false for empty strings', () => {
      expect(isEnsName('')).toBe(false);
    });

    it('should return false for strings without .eth suffix', () => {
      expect(isEnsName('vitalik')).toBe(false);
      expect(isEnsName('eth')).toBe(false);
    });
  });

  describe('resolveAddress', () => {
    it('should return normalized address for valid Ethereum addresses', async () => {
      const result = await resolveAddress('0xD8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
      expect(result.address).toBe('0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
      expect(result.warning).toBeUndefined();
    });

    it('should resolve ENS names to addresses', async () => {
      const result = await resolveAddress('vitalik.eth');
      expect(result.address).toBe('0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
      expect(result.warning).toBeUndefined();
    });

    it('should resolve multiple ENS names correctly', async () => {
      const vitalik = await resolveAddress('vitalik.eth');
      const artbot = await resolveAddress('artbot.eth');

      expect(vitalik.address).toBe('0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
      expect(artbot.address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should throw error for invalid input', async () => {
      await expect(resolveAddress('invalid-input')).rejects.toThrow(
        'Invalid input: "invalid-input" is not a valid Ethereum address or ENS name'
      );
    });

    it('should throw error for unresolvable ENS name', async () => {
      await expect(resolveAddress('nonexistent.eth')).rejects.toThrow(
        'could not be resolved'
      );
    });
  });

  describe('reverseResolve', () => {
    it('should resolve address to ENS name when available', async () => {
      const name = await reverseResolve('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
      expect(name).toBe('vitalik.eth');
    });

    it('should return null when no reverse record exists', async () => {
      const name = await reverseResolve('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
      expect(name).toBeNull();
    });

    it('should handle lowercase addresses', async () => {
      const name = await reverseResolve('0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
      expect(name).toBe('vitalik.eth');
    });
  });
});
