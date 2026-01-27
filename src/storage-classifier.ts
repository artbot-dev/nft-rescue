import { IPFS_GATEWAY_HOSTS, ARWEAVE_GATEWAY_HOSTS } from './config.js';
import type { StorageType, StorageAnalysis, NFTStorageReport, DiscoveredNFT, NFTMetadata } from './types.js';

// IPFS CID patterns
const IPFS_CID_V0_PATTERN = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
const IPFS_CID_V1_PATTERN = /^bafy[a-z2-7]{55,}$/;

/**
 * Check if a string looks like an IPFS CID
 */
function isIpfsCid(str: string): boolean {
  return IPFS_CID_V0_PATTERN.test(str) || IPFS_CID_V1_PATTERN.test(str);
}

/**
 * Extract hostname from URL, handling edge cases
 */
function getHost(url: string): string | undefined {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Check if a hostname matches any pattern in the list
 * Supports both exact matches and suffix matches (e.g., "*.cloudinary.com")
 */
function hostMatchesPatterns(host: string, patterns: string[]): boolean {
  const lowerHost = host.toLowerCase();
  return patterns.some(pattern => {
    const lowerPattern = pattern.toLowerCase();
    return lowerHost === lowerPattern || lowerHost.endsWith('.' + lowerPattern);
  });
}

/**
 * Classify a URL to determine its storage type and risk level
 */
export function classifyUrl(url: string): StorageAnalysis {
  if (!url) {
    return {
      type: 'centralized',
      isAtRisk: true,
      originalUrl: url,
    };
  }

  const trimmedUrl = url.trim();

  // Check for data URIs (always safe - content is embedded)
  if (trimmedUrl.startsWith('data:')) {
    return {
      type: 'data-uri',
      isAtRisk: false,
      originalUrl: url,
    };
  }

  // Check for ipfs:// protocol
  if (trimmedUrl.startsWith('ipfs://')) {
    return {
      type: 'ipfs',
      isAtRisk: false,
      originalUrl: url,
    };
  }

  // Check for ar:// protocol (Arweave)
  if (trimmedUrl.startsWith('ar://')) {
    return {
      type: 'arweave',
      isAtRisk: false,
      originalUrl: url,
    };
  }

  // Check for /ipfs/ path pattern (used in various gateways)
  if (trimmedUrl.includes('/ipfs/')) {
    const match = trimmedUrl.match(/\/ipfs\/(Qm[a-zA-Z0-9]+|bafy[a-zA-Z0-9]+)/);
    if (match) {
      return {
        type: 'ipfs',
        isAtRisk: false,
        originalUrl: url,
      };
    }
  }

  // Check for raw CID (starts with Qm or bafy)
  if (isIpfsCid(trimmedUrl)) {
    return {
      type: 'ipfs',
      isAtRisk: false,
      originalUrl: url,
    };
  }

  // Check for HTTP/HTTPS URLs
  const host = getHost(trimmedUrl);
  if (host) {
    // Check if it's an IPFS gateway
    if (hostMatchesPatterns(host, IPFS_GATEWAY_HOSTS)) {
      return {
        type: 'ipfs',
        isAtRisk: false,
        originalUrl: url,
        host,
      };
    }

    // Check if it's an Arweave gateway
    if (hostMatchesPatterns(host, ARWEAVE_GATEWAY_HOSTS)) {
      return {
        type: 'arweave',
        isAtRisk: false,
        originalUrl: url,
        host,
      };
    }

    // Everything else is centralized and at-risk
    return {
      type: 'centralized',
      isAtRisk: true,
      originalUrl: url,
      host,
    };
  }

  // Unknown format - treat as at-risk
  return {
    type: 'centralized',
    isAtRisk: true,
    originalUrl: url,
  };
}

/**
 * Analyze all storage URLs for an NFT and generate a comprehensive report
 */
export function analyzeNFTStorage(
  nft: DiscoveredNFT,
  metadata?: NFTMetadata
): NFTStorageReport {
  const atRiskUrls: string[] = [];

  // Analyze token URI
  const tokenUriAnalysis = classifyUrl(nft.tokenUri || '');
  if (tokenUriAnalysis.isAtRisk && nft.tokenUri) {
    atRiskUrls.push(nft.tokenUri);
  }

  // Analyze image URL
  let imageAnalysis: StorageAnalysis | undefined;
  if (metadata?.image) {
    imageAnalysis = classifyUrl(metadata.image);
    if (imageAnalysis.isAtRisk) {
      atRiskUrls.push(metadata.image);
    }
  }

  // Analyze animation URL
  let animationAnalysis: StorageAnalysis | undefined;
  if (metadata?.animation_url) {
    animationAnalysis = classifyUrl(metadata.animation_url);
    if (animationAnalysis.isAtRisk) {
      atRiskUrls.push(metadata.animation_url);
    }
  }

  // Determine if fully decentralized
  const analyses = [tokenUriAnalysis, imageAnalysis, animationAnalysis].filter(
    (a): a is StorageAnalysis => a !== undefined
  );
  const isFullyDecentralized = analyses.every((a) => !a.isAtRisk);

  return {
    tokenUri: tokenUriAnalysis,
    image: imageAnalysis,
    animation: animationAnalysis,
    isFullyDecentralized,
    atRiskUrls,
  };
}

/**
 * Get a human-readable summary of storage type
 */
export function getStorageTypeName(type: StorageType): string {
  switch (type) {
    case 'ipfs':
      return 'IPFS';
    case 'arweave':
      return 'Arweave';
    case 'data-uri':
      return 'Embedded (data URI)';
    case 'centralized':
      return 'Centralized';
  }
}

/**
 * Get storage status for manifest
 */
export function getStorageStatus(
  report: NFTStorageReport
): 'decentralized' | 'at-risk' | 'mixed' {
  if (report.isFullyDecentralized) {
    return 'decentralized';
  }

  const analyses = [report.tokenUri, report.image, report.animation].filter(
    (a): a is StorageAnalysis => a !== undefined
  );

  const hasDecentralized = analyses.some((a) => !a.isAtRisk);
  const hasAtRisk = analyses.some((a) => a.isAtRisk);

  if (hasDecentralized && hasAtRisk) {
    return 'mixed';
  }

  return 'at-risk';
}
