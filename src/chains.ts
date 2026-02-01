import { Network } from 'alchemy-sdk';

/**
 * Chain type discriminator
 */
export type ChainType = 'evm' | 'tezos';

/**
 * Configuration for a supported blockchain network
 */
export interface ChainConfig {
  name: string;
  displayName: string;
  chainType: ChainType;
  alchemyNetwork?: Network; // Optional - not used for non-EVM chains
  chainId: number;
  supportsEns: boolean;
  supportsTezDomains?: boolean;
}

/**
 * Supported chains configuration
 */
export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    name: 'ethereum',
    displayName: 'Ethereum',
    chainType: 'evm',
    alchemyNetwork: Network.ETH_MAINNET,
    chainId: 1,
    supportsEns: true,
    supportsTezDomains: false,
  },
  base: {
    name: 'base',
    displayName: 'Base',
    chainType: 'evm',
    alchemyNetwork: Network.BASE_MAINNET,
    chainId: 8453,
    supportsEns: false,
    supportsTezDomains: false,
  },
  zora: {
    name: 'zora',
    displayName: 'Zora',
    chainType: 'evm',
    alchemyNetwork: Network.ZORA_MAINNET,
    chainId: 7777777,
    supportsEns: false,
    supportsTezDomains: false,
  },
  optimism: {
    name: 'optimism',
    displayName: 'Optimism',
    chainType: 'evm',
    alchemyNetwork: Network.OPT_MAINNET,
    chainId: 10,
    supportsEns: false,
    supportsTezDomains: false,
  },
  arbitrum: {
    name: 'arbitrum',
    displayName: 'Arbitrum',
    chainType: 'evm',
    alchemyNetwork: Network.ARB_MAINNET,
    chainId: 42161,
    supportsEns: false,
    supportsTezDomains: false,
  },
  polygon: {
    name: 'polygon',
    displayName: 'Polygon',
    chainType: 'evm',
    alchemyNetwork: Network.MATIC_MAINNET,
    chainId: 137,
    supportsEns: false,
    supportsTezDomains: false,
  },
  tezos: {
    name: 'tezos',
    displayName: 'Tezos',
    chainType: 'tezos',
    // No alchemyNetwork - Tezos uses TzKT API
    chainId: -1, // Placeholder - Tezos doesn't use EVM chain IDs
    supportsEns: false,
    supportsTezDomains: true,
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

/**
 * Check if a chain is an EVM chain (uses Alchemy)
 */
export function isEvmChain(chainConfig: ChainConfig): boolean {
  return chainConfig.chainType === 'evm';
}

/**
 * Check if a chain is Tezos
 */
export function isTezosChain(chainConfig: ChainConfig): boolean {
  return chainConfig.chainType === 'tezos';
}
