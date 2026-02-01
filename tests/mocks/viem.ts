import { vi } from 'vitest';

// Mock ENS resolution responses
export const mockEnsResponses: Record<string, string | null> = {
  'vitalik.eth': '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  'artbot.eth': '0x1234567890123456789012345678901234567890',
  'test.eth': '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  'nonexistent.eth': null,
};

// Reverse lookup map
export const mockReverseEnsResponses: Record<string, string | null> = {
  '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045': 'vitalik.eth',
  '0x1234567890123456789012345678901234567890': 'artbot.eth',
  '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd': null, // No reverse record
};

// Create mock viem client
export function createMockViemClient() {
  return {
    getEnsAddress: vi.fn().mockImplementation(({ name }: { name: string }) => {
      const address = mockEnsResponses[name.toLowerCase()];
      return Promise.resolve(address);
    }),
    getEnsName: vi.fn().mockImplementation(({ address }: { address: string }) => {
      const name = mockReverseEnsResponses[address.toLowerCase()];
      return Promise.resolve(name);
    }),
  };
}

// Create mock that throws errors
export function createErrorMockViemClient(error: Error) {
  return {
    getEnsAddress: vi.fn().mockRejectedValue(error),
    getEnsName: vi.fn().mockRejectedValue(error),
  };
}
