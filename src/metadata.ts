import { IPFS_GATEWAY_URLS, RETRY_CONFIG, REQUEST_TIMEOUT } from './config.js';
import type { NFTMetadata } from './types.js';

/**
 * Transform IPFS URI to HTTP gateway URL
 */
export function ipfsToHttp(uri: string): string {
  if (!uri) return uri;

  // Handle ipfs:// protocol
  if (uri.startsWith('ipfs://')) {
    const hash = uri.replace('ipfs://', '');
    return `${IPFS_GATEWAY_URLS[0]}${hash}`;
  }

  // Handle ipfs/Qm... format
  if (uri.startsWith('ipfs/')) {
    const hash = uri.replace('ipfs/', '');
    return `${IPFS_GATEWAY_URLS[0]}${hash}`;
  }

  // Handle raw CID (starts with Qm or bafy)
  if (uri.match(/^(Qm[a-zA-Z0-9]{44}|bafy[a-zA-Z0-9]+)/)) {
    return `${IPFS_GATEWAY_URLS[0]}${uri}`;
  }

  return uri;
}

/**
 * Fetch with timeout and retry logic
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }

      // Don't retry 4xx errors (except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if aborted by something other than timeout
      if (lastError.name === 'AbortError' && attempt === 0) {
        throw new Error(`Request timed out after ${REQUEST_TIMEOUT}ms`);
      }
    }

    // Exponential backoff
    if (attempt < RETRY_CONFIG.maxRetries - 1) {
      const delay = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
        RETRY_CONFIG.maxDelay
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Failed to fetch after retries');
}

/**
 * Try fetching from multiple IPFS gateways
 */
async function fetchFromIpfsGateways(ipfsHash: string): Promise<Response> {
  let lastError: Error | null = null;

  for (const gateway of IPFS_GATEWAY_URLS) {
    try {
      const url = `${gateway}${ipfsHash}`;
      return await fetchWithRetry(url);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error('Failed to fetch from all IPFS gateways');
}

/**
 * Fetch metadata from a token URI
 */
export async function fetchMetadata(tokenUri: string): Promise<NFTMetadata> {
  if (!tokenUri) {
    throw new Error('Token URI is empty');
  }

  let response: Response;

  // Handle IPFS URIs
  if (tokenUri.startsWith('ipfs://')) {
    const hash = tokenUri.replace('ipfs://', '');
    response = await fetchFromIpfsGateways(hash);
  } else if (tokenUri.startsWith('ipfs/')) {
    const hash = tokenUri.replace('ipfs/', '');
    response = await fetchFromIpfsGateways(hash);
  } else if (tokenUri.match(/^(Qm[a-zA-Z0-9]{44}|bafy[a-zA-Z0-9]+)/)) {
    response = await fetchFromIpfsGateways(tokenUri);
  } else {
    // Handle HTTP/HTTPS URLs
    response = await fetchWithRetry(tokenUri);
  }

  const text = await response.text();

  try {
    return JSON.parse(text) as NFTMetadata;
  } catch {
    throw new Error(`Invalid JSON in metadata: ${text.substring(0, 100)}...`);
  }
}

/**
 * Extract media URLs from metadata
 */
export function extractMediaUrls(metadata: NFTMetadata): {
  image?: string;
  animation?: string;
} {
  return {
    image: metadata.image ? ipfsToHttp(metadata.image) : undefined,
    animation: metadata.animation_url ? ipfsToHttp(metadata.animation_url) : undefined,
  };
}
