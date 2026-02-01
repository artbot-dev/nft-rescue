import type { DiscoveredNFT } from '../types.js';
import type { ChainConfig } from '../chains.js';

/**
 * Progress callback for NFT discovery
 * @param current Number of NFTs discovered so far
 * @param total Total number of NFTs (if known)
 */
export type ProgressCallback = (current: number, total?: number) => void;

/**
 * Abstract interface for NFT discovery providers
 * Implementations include AlchemyProvider (EVM chains) and TzKTProvider (Tezos)
 */
export interface NFTDiscoveryProvider {
  /**
   * The chain configuration this provider operates on
   */
  readonly chainConfig: ChainConfig;

  /**
   * Discover all NFTs owned by a wallet address
   * @param walletAddress The wallet address to query
   * @param onProgress Optional callback for progress updates
   * @returns Array of discovered NFTs
   */
  discoverNFTs(
    walletAddress: string,
    onProgress?: ProgressCallback
  ): Promise<DiscoveredNFT[]>;
}
