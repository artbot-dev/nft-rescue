import { Alchemy, OwnedNft } from 'alchemy-sdk';
import type { DiscoveredNFT } from '../types.js';
import type { ChainConfig } from '../chains.js';
import type { NFTDiscoveryProvider, ProgressCallback } from './types.js';

// Cache Alchemy clients per chain
const alchemyClients: Map<string, Alchemy> = new Map();

/**
 * Get or create an Alchemy client for the specified chain
 */
function getAlchemyClient(chainConfig: ChainConfig): Alchemy {
  const cacheKey = chainConfig.name;

  if (!alchemyClients.has(cacheKey)) {
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      throw new Error(
        'ALCHEMY_API_KEY environment variable is required.\n' +
        'Get a free API key at: https://dashboard.alchemy.com/signup'
      );
    }

    if (!chainConfig.alchemyNetwork) {
      throw new Error(
        `Chain ${chainConfig.name} does not have an Alchemy network configured`
      );
    }

    alchemyClients.set(
      cacheKey,
      new Alchemy({
        apiKey,
        network: chainConfig.alchemyNetwork,
      })
    );
  }

  return alchemyClients.get(cacheKey)!;
}

/**
 * Convert Alchemy NFT to our DiscoveredNFT format
 */
function toDiscoveredNFT(nft: OwnedNft, chainConfig: ChainConfig): DiscoveredNFT {
  // Extract cached image URL - try multiple sources
  const cachedImageUrl =
    nft.image?.cachedUrl ||
    nft.image?.pngUrl ||
    nft.image?.originalUrl ||
    nft.raw?.metadata?.image;

  // Extract cached animation URL
  const cachedAnimationUrl = nft.raw?.metadata?.animation_url;

  // Build cached metadata from Alchemy's data
  const cachedMetadata = nft.raw?.metadata ? {
    name: nft.raw.metadata.name,
    description: nft.raw.metadata.description,
    image: nft.raw.metadata.image,
    animation_url: nft.raw.metadata.animation_url,
    external_url: nft.raw.metadata.external_url,
    attributes: nft.raw.metadata.attributes,
  } : undefined;

  return {
    contractAddress: nft.contract.address.toLowerCase(),
    tokenId: nft.tokenId,
    tokenUri: nft.tokenUri,
    name: nft.name || nft.raw?.metadata?.name,
    description: nft.description || nft.raw?.metadata?.description,
    contractName: nft.contract.name || nft.contract.openSeaMetadata?.collectionName,
    cachedMetadata,
    cachedImageUrl,
    cachedAnimationUrl,
    chainId: chainConfig.chainId,
    chainName: chainConfig.name,
  };
}

/**
 * NFT discovery provider using Alchemy API for EVM chains
 */
export class AlchemyProvider implements NFTDiscoveryProvider {
  readonly chainConfig: ChainConfig;

  constructor(chainConfig: ChainConfig) {
    if (!chainConfig.alchemyNetwork) {
      throw new Error(
        `AlchemyProvider requires a chain with alchemyNetwork configured. ` +
        `${chainConfig.name} does not have one.`
      );
    }
    this.chainConfig = chainConfig;
  }

  async discoverNFTs(
    walletAddress: string,
    onProgress?: ProgressCallback
  ): Promise<DiscoveredNFT[]> {
    const alchemy = getAlchemyClient(this.chainConfig);
    const allNFTs: DiscoveredNFT[] = [];
    let pageKey: string | undefined;

    do {
      const response = await alchemy.nft.getNftsForOwner(walletAddress, {
        pageKey,
        pageSize: 100,
      });

      for (const nft of response.ownedNfts) {
        allNFTs.push(toDiscoveredNFT(nft, this.chainConfig));
      }

      pageKey = response.pageKey;
      onProgress?.(allNFTs.length, response.totalCount);
    } while (pageKey);

    return allNFTs;
  }
}

/**
 * Clear cached Alchemy clients (useful for testing)
 */
export function clearAlchemyClients(): void {
  alchemyClients.clear();
}
