import { Alchemy, OwnedNft } from 'alchemy-sdk';
import type { DiscoveredNFT } from './types.js';
import { getChainConfig, getDefaultChain, type ChainConfig } from './chains.js';

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
 * Discover all NFTs owned by a wallet address on a specific chain
 * @param walletAddress Wallet address to check
 * @param onProgress Optional callback for progress updates (current count, total if known)
 * @param chainName Optional chain name (defaults to 'ethereum')
 */
export async function discoverNFTs(
  walletAddress: string,
  onProgress?: (current: number, total?: number) => void,
  chainName?: string
): Promise<DiscoveredNFT[]> {
  const chainConfig = chainName ? getChainConfig(chainName) : getDefaultChain();
  const alchemy = getAlchemyClient(chainConfig);
  const allNFTs: DiscoveredNFT[] = [];
  let pageKey: string | undefined;

  do {
    const response = await alchemy.nft.getNftsForOwner(walletAddress, {
      pageKey,
      pageSize: 100,
    });

    for (const nft of response.ownedNfts) {
      allNFTs.push(toDiscoveredNFT(nft, chainConfig));
    }

    pageKey = response.pageKey;
    onProgress?.(allNFTs.length, response.totalCount);
  } while (pageKey);

  return allNFTs;
}

/**
 * Clear cached Alchemy clients (useful for testing)
 */
export function clearAlchemyClients(): void {
  alchemyClients.clear();
}
