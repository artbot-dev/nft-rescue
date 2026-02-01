import { Network } from 'alchemy-sdk';

/**
 * Configuration for a supported blockchain network
 */
export interface ChainConfig {
  name: string;
  displayName: string;
  alchemyNetwork: Network;
  chainId: number;
  supportsEns: boolean;
}

/**
 * Supported chains configuration
 */
export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    name: 'ethereum',
    displayName: 'Ethereum',
    alchemyNetwork: Network.ETH_MAINNET,
    chainId: 1,
    supportsEns: true,
  },
  base: {
    name: 'base',
    displayName: 'Base',
    alchemyNetwork: Network.BASE_MAINNET,
    chainId: 8453,
    supportsEns: false,
  },
  zora: {
    name: 'zora',
    displayName: 'Zora',
    alchemyNetwork: Network.ZORA_MAINNET,
    chainId: 7777777,
    supportsEns: false,
  },
  optimism: {
    name: 'optimism',
    displayName: 'Optimism',
    alchemyNetwork: Network.OPT_MAINNET,
    chainId: 10,
    supportsEns: false,
  },
  arbitrum: {
    name: 'arbitrum',
    displayName: 'Arbitrum',
    alchemyNetwork: Network.ARB_MAINNET,
    chainId: 42161,
    supportsEns: false,
  },
  polygon: {
    name: 'polygon',
    displayName: 'Polygon',
    alchemyNetwork: Network.MATIC_MAINNET,
    chainId: 137,
    supportsEns: false,
  },
};

/**
 * Get chain configuration by name
 * @throws Error if chain is not supported
 */
export function getChainConfig(chainName: string): ChainConfig {
  const normalizedName = chainName.toLowerCase();
  const config = SUPPORTED_CHAINS[normalizedName];

  if (!config) {
    const supported = getSupportedChainNames().join(', ');
    throw new Error(
      `Unsupported chain: ${chainName}. Supported chains: ${supported}`
    );
  }

  return config;
}

/**
 * Get list of supported chain names
 */
export function getSupportedChainNames(): string[] {
  return Object.keys(SUPPORTED_CHAINS);
}

/**
 * Check if a chain is supported
 */
export function isChainSupported(chainName: string): boolean {
  return chainName.toLowerCase() in SUPPORTED_CHAINS;
}

/**
 * Get the default chain configuration (Ethereum)
 */
export function getDefaultChain(): ChainConfig {
  return SUPPORTED_CHAINS.ethereum;
}
