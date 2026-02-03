import type { DiscoveredNFT, NFTMetadata } from '../types.js';
import type { ChainConfig } from '../chains.js';
import type { NFTDiscoveryProvider, ProgressCallback } from './types.js';

/**
 * TzKT API token balance response
 */
interface TzKTTokenBalance {
  id: number;
  account: {
    address: string;
  };
  token: {
    id: number;
    contract: {
      address: string;
      alias?: string;
    };
    tokenId: string;
    standard: string;
    metadata?: TzKTTokenMetadata;
  };
  balance: string;
  transfersCount: number;
  firstLevel: number;
  firstTime: string;
  lastLevel: number;
  lastTime: string;
}

/**
 * TzKT TZIP-21 metadata format
 */
interface TzKTTokenMetadata {
  name?: string;
  description?: string;
  displayUri?: string;
  artifactUri?: string;
  thumbnailUri?: string;
  image?: string;
  symbol?: string;
  decimals?: string;
  isBooleanAmount?: boolean;
  tags?: string[];
  formats?: Array<{
    uri: string;
    mimeType?: string;
    dimensions?: { value: string; unit: string };
  }>;
  creators?: string[];
  attributes?: unknown;
  [key: string]: unknown;
}

const TZKT_API_BASE = 'https://api.tzkt.io/v1';
const PAGE_SIZE = 100;

/**
 * Map TZIP-21 metadata to our NFTMetadata format
 */
function mapTzip21ToNFTMetadata(tzip21: TzKTTokenMetadata): NFTMetadata {
  // TZIP-21 uses displayUri for preview image, artifactUri for main asset
  // Our format uses image and animation_url
  const image = tzip21.displayUri || tzip21.image || tzip21.thumbnailUri;

  // If artifactUri is different from displayUri, it might be a video/animation
  // Check if it looks like a video format
  const artifactUri = tzip21.artifactUri;
  let animationUrl: string | undefined;

  if (artifactUri && artifactUri !== image) {
    // Check if it might be a video/animation based on format hints
    const formats = tzip21.formats || [];
    const isVideo = formats.some(
      (f) =>
        f.uri === artifactUri &&
        f.mimeType?.startsWith('video/')
    );

    if (isVideo) {
      animationUrl = artifactUri;
    } else {
      // Use artifactUri as the main image if displayUri is just a thumbnail
      // but only if we don't already have an image
      if (!image) {
        // Will be set below
      }
    }
  }

  // Map attributes - TZIP-21 can use either name/value or trait_type/value
  let attributes: Array<{ trait_type?: string; value?: string }> | undefined;
  const rawAttributes = tzip21.attributes;

  if (Array.isArray(rawAttributes)) {
    attributes = rawAttributes
      .map((attr) => {
        if (!attr || typeof attr !== 'object') return null;
        const typed = attr as { name?: string; value?: string; trait_type?: string };
        const traitType = typed.trait_type || typed.name;
        const value = typed.value;
        if (!traitType || value === undefined) return null;
        return { trait_type: traitType, value };
      })
      .filter((entry): entry is { trait_type?: string; value?: string } => entry !== null);
  } else if (rawAttributes && typeof rawAttributes === 'object') {
    const mapped: Array<{ trait_type?: string; value?: string }> = [];
    for (const [key, value] of Object.entries(rawAttributes as Record<string, unknown>)) {
      if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
        const rawValue = (value as { value?: unknown }).value;
        if (rawValue === undefined || rawValue === null) continue;
        mapped.push({ trait_type: String(key), value: String(rawValue) });
        continue;
      }
      if (value === undefined || value === null) continue;
      mapped.push({ trait_type: String(key), value: String(value) });
    }
    if (mapped.length > 0) {
      attributes = mapped;
    }
  }

  return {
    name: tzip21.name,
    description: tzip21.description,
    image: image || artifactUri, // Fall back to artifactUri if no displayUri
    animation_url: animationUrl,
    attributes,
  };
}

/**
 * Convert TzKT token balance to our DiscoveredNFT format
 */
function toDiscoveredNFT(
  tokenBalance: TzKTTokenBalance,
  chainConfig: ChainConfig
): DiscoveredNFT {
  const token = tokenBalance.token;
  const metadata = token.metadata;

  // Map TZIP-21 metadata if available
  const mappedMetadata = metadata ? mapTzip21ToNFTMetadata(metadata) : undefined;

  // Build cached image URL from TZIP-21 displayUri or artifactUri
  const cachedImageUrl =
    metadata?.displayUri || metadata?.image || metadata?.artifactUri;

  // Check for animation in artifactUri
  let cachedAnimationUrl: string | undefined;
  if (metadata?.artifactUri && metadata.artifactUri !== cachedImageUrl) {
    const formats = metadata.formats || [];
    const isVideo = formats.some(
      (f) =>
        f.uri === metadata.artifactUri &&
        f.mimeType?.startsWith('video/')
    );
    if (isVideo) {
      cachedAnimationUrl = metadata.artifactUri;
    }
  }

  return {
    contractAddress: token.contract.address,
    tokenId: token.tokenId,
    tokenUri: undefined, // TzKT doesn't provide raw token URI
    name: metadata?.name,
    description: metadata?.description,
    contractName: token.contract.alias,
    cachedMetadata: mappedMetadata,
    cachedImageUrl,
    cachedAnimationUrl,
    chainId: chainConfig.chainId,
    chainName: chainConfig.name,
  };
}

/**
 * NFT discovery provider using TzKT API for Tezos
 */
export class TzKTProvider implements NFTDiscoveryProvider {
  readonly chainConfig: ChainConfig;

  constructor(chainConfig: ChainConfig) {
    if (chainConfig.chainType !== 'tezos') {
      throw new Error(
        `TzKTProvider requires a Tezos chain configuration. ` +
        `${chainConfig.name} is ${chainConfig.chainType}.`
      );
    }
    this.chainConfig = chainConfig;
  }

  async discoverNFTs(
    walletAddress: string,
    onProgress?: ProgressCallback
  ): Promise<DiscoveredNFT[]> {
    const allNFTs: DiscoveredNFT[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const url = new URL(`${TZKT_API_BASE}/tokens/balances`);
      url.searchParams.set('account', walletAddress);
      url.searchParams.set('token.standard', 'fa2');
      url.searchParams.set('balance.gt', '0');
      url.searchParams.set('limit', PAGE_SIZE.toString());
      url.searchParams.set('offset', offset.toString());

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(
          `TzKT API error: HTTP ${response.status} ${response.statusText}`
        );
      }

      const balances = (await response.json()) as TzKTTokenBalance[];

      for (const balance of balances) {
        allNFTs.push(toDiscoveredNFT(balance, this.chainConfig));
      }

      // Check if there are more results
      hasMore = balances.length === PAGE_SIZE;
      offset += PAGE_SIZE;

      // Call progress callback
      // TzKT doesn't provide total count, so we just report current count
      onProgress?.(allNFTs.length);
    }

    return allNFTs;
  }
}
