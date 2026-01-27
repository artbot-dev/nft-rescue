import { Alchemy, Network, OwnedNft } from 'alchemy-sdk';
import type { DiscoveredNFT } from './types.js';

let alchemyClient: Alchemy | null = null;

/**
 * Initialize the Alchemy SDK client
 */
function getAlchemyClient(): Alchemy {
  if (!alchemyClient) {
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      throw new Error(
        'ALCHEMY_API_KEY environment variable is required.\n' +
        'Get a free API key at: https://dashboard.alchemy.com/signup'
      );
    }

    alchemyClient = new Alchemy({
      apiKey,
      network: Network.ETH_MAINNET,
    });
  }
  return alchemyClient;
}

/**
 * Convert Alchemy NFT to our DiscoveredNFT format
 */
function toDiscoveredNFT(nft: OwnedNft): DiscoveredNFT {
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
  };
}

/**
 * Discover all NFTs owned by a wallet address
 * @param walletAddress Ethereum address to check
 * @param onProgress Optional callback for progress updates (current count, total if known)
 */
export async function discoverNFTs(
  walletAddress: string,
  onProgress?: (current: number, total?: number) => void
): Promise<DiscoveredNFT[]> {
  const alchemy = getAlchemyClient();
  const allNFTs: DiscoveredNFT[] = [];
  let pageKey: string | undefined;

  do {
    const response = await alchemy.nft.getNftsForOwner(walletAddress, {
      pageKey,
      pageSize: 100,
    });

    for (const nft of response.ownedNfts) {
      allNFTs.push(toDiscoveredNFT(nft));
    }

    pageKey = response.pageKey;
    onProgress?.(allNFTs.length, response.totalCount);
  } while (pageKey);

  return allNFTs;
}
