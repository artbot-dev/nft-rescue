import { createPublicClient, http, isAddress } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';

// Create a public client for ENS resolution
const client = createPublicClient({
  chain: mainnet,
  transport: http(),
});

/**
 * Check if the input looks like an ENS name
 */
export function isEnsName(input: string): boolean {
  return input.endsWith('.eth') && !isAddress(input);
}

/**
 * Resolve an ENS name or validate an Ethereum address
 * @param input ENS name (e.g., "artbot.eth") or Ethereum address
 * @returns Resolved Ethereum address
 */
export async function resolveAddress(input: string): Promise<string> {
  // If it's already a valid address, return it normalized
  if (isAddress(input)) {
    return input.toLowerCase();
  }

  // Check if it looks like an ENS name
  if (!isEnsName(input)) {
    throw new Error(
      `Invalid input: "${input}" is not a valid Ethereum address or ENS name`
    );
  }

  // Resolve ENS name
  try {
    const normalizedName = normalize(input);
    const address = await client.getEnsAddress({
      name: normalizedName,
    });

    if (!address) {
      throw new Error(`ENS name "${input}" could not be resolved to an address`);
    }

    return address.toLowerCase();
  } catch (error) {
    if (error instanceof Error && error.message.includes('could not be resolved')) {
      throw error;
    }
    throw new Error(`Failed to resolve ENS name "${input}": ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Reverse resolve an address to ENS name (if available)
 */
export async function reverseResolve(address: string): Promise<string | null> {
  try {
    const name = await client.getEnsName({
      address: address as `0x${string}`,
    });
    return name;
  } catch {
    return null;
  }
}
