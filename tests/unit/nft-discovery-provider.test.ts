import { describe, it, expect } from 'vitest';
import { getDiscoveryProvider } from '../../src/nft-discovery.js';
import { getChainConfig, type ChainConfig } from '../../src/chains.js';
import { AlchemyProvider } from '../../src/providers/alchemy-provider.js';
import { TzKTProvider } from '../../src/providers/tzkt-provider.js';

describe('getDiscoveryProvider', () => {
  it('returns AlchemyProvider for EVM chains', () => {
    const chain = getChainConfig('ethereum');
    const provider = getDiscoveryProvider(chain);
    expect(provider).toBeInstanceOf(AlchemyProvider);
  });

  it('returns TzKTProvider for Tezos', () => {
    const chain = getChainConfig('tezos');
    const provider = getDiscoveryProvider(chain);
    expect(provider).toBeInstanceOf(TzKTProvider);
  });

  it('throws for unsupported chain type', () => {
    const badChain = {
      name: 'unknown',
      displayName: 'Unknown',
      chainType: 'other',
      chainId: 0,
      supportsEns: false,
    } as unknown as ChainConfig;

    expect(() => getDiscoveryProvider(badChain)).toThrow('No NFT discovery provider');
  });
});
