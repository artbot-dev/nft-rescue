import type { DiscoveredNFT } from './types.js';
import {
  getChainConfig,
  getDefaultChain,
  isEvmChain,
  isTezosChain,
  type ChainConfig,
} from './chains.js';
import {
  AlchemyProvider,
  TzKTProvider,
  clearAlchemyClients as clearAlchemyClientsInternal,
  type NFTDiscoveryProvider,
  type ProgressCallback,
} from './providers/index.js';

/**
 * Get the appropriate NFT discovery provider for a chain
 * @param chainConfig Chain configuration
 * @returns Provider instance for the chain
 */
export function getDiscoveryProvider(chainConfig: ChainConfig): NFTDiscoveryProvider {
  if (isEvmChain(chainConfig)) {
    return new AlchemyProvider(chainConfig);
  }

  if (isTezosChain(chainConfig)) {
    return new TzKTProvider(chainConfig);
  }

  throw new Error(`No NFT discovery provider available for chain: ${chainConfig.name}`);
}

/**
 * Discover all NFTs owned by a wallet address on a specific chain
 * @param walletAddress Wallet address to check
 * @param onProgress Optional callback for progress updates (current count, total if known)
 * @param chainName Optional chain name (defaults to 'ethereum')
 */
export async function discoverNFTs(
  walletAddress: string,
  onProgress?: ProgressCallback,
  chainName?: string
): Promise<DiscoveredNFT[]> {
  const chainConfig = chainName ? getChainConfig(chainName) : getDefaultChain();
  const provider = getDiscoveryProvider(chainConfig);
  return provider.discoverNFTs(walletAddress, onProgress);
}

/**
 * Clear cached Alchemy clients (useful for testing)
 */
export function clearAlchemyClients(): void {
  clearAlchemyClientsInternal();
}
