import { createPublicClient, http, isAddress } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';
import { getChainConfig, getDefaultChain, isTezosChain } from './chains.js';
import {
  isTezosAddress,
  isTezDomain,
  resolveTezosAddress,
} from './tezos-address.js';

// Create a public client for ENS resolution (Ethereum only)
const client = createPublicClient({
  chain: mainnet,
  transport: http(),
});

/**
 * Check if ENS is supported on the given chain
 * @param chainName Optional chain name, defaults to 'ethereum'
 */
export function supportsEns(chainName?: string): boolean {
  const chain = chainName ? getChainConfig(chainName) : getDefaultChain();
  return chain.supportsEns;
}

/**
 * Check if .tez domains are supported on the given chain
 * @param chainName Optional chain name, defaults to 'ethereum'
 */
export function supportsTezDomains(chainName?: string): boolean {
  const chain = chainName ? getChainConfig(chainName) : getDefaultChain();
  return chain.supportsTezDomains ?? false;
}

/**
 * Check if the input looks like an ENS name
 */
export function isEnsName(input: string): boolean {
  return input.endsWith('.eth') && !isAddress(input);
}

/**
 * Check if the input is a valid address for the given chain
 * @param input Address to validate
 * @param chainName Optional chain name, defaults to 'ethereum'
 */
export function isValidAddress(input: string, chainName?: string): boolean {
  const chain = chainName ? getChainConfig(chainName) : getDefaultChain();

  if (isTezosChain(chain)) {
    return isTezosAddress(input);
  }

  // EVM chains use Ethereum-style addresses
  return isAddress(input);
}

/**
 * Result of resolving an address, includes warning if ENS was resolved cross-chain
 */
export interface ResolveResult {
  address: string;
  warning?: string;
}

/**
 * Resolve an ENS name, .tez domain, or validate an address
 * @param input ENS name, .tez domain, or blockchain address
 * @param chainName Optional chain name, defaults to 'ethereum'
 * @returns Resolved address and optional warning
 */
export async function resolveAddress(
  input: string,
  chainName?: string
): Promise<ResolveResult> {
  const chain = chainName ? getChainConfig(chainName) : getDefaultChain();

  // Handle Tezos chain
  if (isTezosChain(chain)) {
    // Check if it's a valid Tezos address
    if (isTezosAddress(input)) {
      return { address: input };
    }

    // Check if it's a .tez domain
    if (isTezDomain(input)) {
      const result = await resolveTezosAddress(input);
      return { address: result.address };
    }

    // Not valid for Tezos
    throw new Error(
      `Invalid input: "${input}" is not a valid Tezos address or .tez domain`
    );
  }

  // EVM chain handling below

  // If it's already a valid EVM address, return it normalized
  if (isAddress(input)) {
    return { address: input.toLowerCase() };
  }

  // Check if it looks like an ENS name
  if (!isEnsName(input)) {
    throw new Error(
      `Invalid input: "${input}" is not a valid Ethereum address or ENS name`
    );
  }

  // Resolve ENS name (always on Ethereum)
  try {
    const normalizedName = normalize(input);
    const address = await client.getEnsAddress({
      name: normalizedName,
    });

    if (!address) {
      throw new Error(`ENS name "${input}" could not be resolved to an address`);
    }

    const result: ResolveResult = { address: address.toLowerCase() };

    // Add warning if resolving for a non-Ethereum chain
    if (chainName && !supportsEns(chainName)) {
      result.warning = `ENS name "${input}" resolved on Ethereum. Using the same address on ${chainName}.`;
    }

    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes('could not be resolved')) {
      throw error;
    }
    throw new Error(`Failed to resolve ENS name "${input}": ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Reverse resolve an address to ENS name (if available)
 * @param address Ethereum address
 * @param chainName Optional chain name, defaults to 'ethereum'
 */
export async function reverseResolve(
  address: string,
  chainName?: string
): Promise<string | null> {
  const chain = chainName ? getChainConfig(chainName) : getDefaultChain();

  // Reverse resolution is not supported on Tezos (yet)
  if (isTezosChain(chain)) {
    return null;
  }

  // ENS is only supported on Ethereum
  if (!supportsEns(chainName)) {
    return null;
  }

  try {
    const name = await client.getEnsName({
      address: address as `0x${string}`,
    });
    return name;
  } catch {
    return null;
  }
}

// Re-export Tezos-specific functions for convenience
export { isTezosAddress, isTezDomain } from './tezos-address.js';
