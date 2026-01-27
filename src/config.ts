// Known IPFS gateway hostnames (safe/decentralized storage)
export const IPFS_GATEWAY_HOSTS = [
  'ipfs.io',
  'cloudflare-ipfs.com',
  'gateway.pinata.cloud',
  'dweb.link',
  'w3s.link',
  'nftstorage.link',
  'ipfs.infura.io',
  'ipfs.fleek.co',
  '4everland.io',
  'cf-ipfs.com',
];

// Known Arweave gateway hostnames (safe/decentralized storage)
export const ARWEAVE_GATEWAY_HOSTS = [
  'arweave.net',
  'arweave.dev',
  'ar-io.net',
  'g8way.io',
  'arweave.live',
];

// IPFS gateway URLs for fetching content
export const IPFS_GATEWAY_URLS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
  'https://w3s.link/ipfs/',
  'https://nftstorage.link/ipfs/',
];

// Known centralized/at-risk host patterns
export const AT_RISK_HOST_PATTERNS = [
  'api.niftygateway.com',
  'niftygateway.com',
  'cloudinary.com',
  'amazonaws.com',
  's3.amazonaws.com',
  'opensea.io',
  'api.opensea.io',
  'lh3.googleusercontent.com',
  'storage.googleapis.com',
  'firebasestorage.googleapis.com',
  'imgix.net',
  'cdn.shopify.com',
];

// Default retry configuration
export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // ms
  maxDelay: 10000, // ms
};

// Request timeout
export const REQUEST_TIMEOUT = 30000; // 30 seconds

// Rate limiting delay between API calls
export const RATE_LIMIT_DELAY = 100; // ms
