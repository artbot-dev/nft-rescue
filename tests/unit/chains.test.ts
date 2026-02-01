import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_CHAINS,
  getChainConfig,
  getSupportedChainNames,
  isChainSupported,
  getDefaultChain,
  isEvmChain,
  isTezosChain,
  type ChainConfig,
} from '../../src/chains.js';
import { Network } from 'alchemy-sdk';

describe('chains', () => {
  describe('SUPPORTED_CHAINS', () => {
    it('should include Ethereum mainnet', () => {
      expect(SUPPORTED_CHAINS['ethereum']).toBeDefined();
      expect(SUPPORTED_CHAINS['ethereum'].alchemyNetwork).toBe(Network.ETH_MAINNET);
      expect(SUPPORTED_CHAINS['ethereum'].displayName).toBe('Ethereum');
    });

    it('should include Base mainnet', () => {
      expect(SUPPORTED_CHAINS['base']).toBeDefined();
      expect(SUPPORTED_CHAINS['base'].alchemyNetwork).toBe(Network.BASE_MAINNET);
      expect(SUPPORTED_CHAINS['base'].displayName).toBe('Base');
    });

    it('should include Zora mainnet', () => {
      expect(SUPPORTED_CHAINS['zora']).toBeDefined();
      expect(SUPPORTED_CHAINS['zora'].alchemyNetwork).toBe(Network.ZORA_MAINNET);
      expect(SUPPORTED_CHAINS['zora'].displayName).toBe('Zora');
    });

    it('should include Optimism mainnet', () => {
      expect(SUPPORTED_CHAINS['optimism']).toBeDefined();
      expect(SUPPORTED_CHAINS['optimism'].alchemyNetwork).toBe(Network.OPT_MAINNET);
    });

    it('should include Arbitrum mainnet', () => {
      expect(SUPPORTED_CHAINS['arbitrum']).toBeDefined();
      expect(SUPPORTED_CHAINS['arbitrum'].alchemyNetwork).toBe(Network.ARB_MAINNET);
    });

    it('should include Polygon mainnet', () => {
      expect(SUPPORTED_CHAINS['polygon']).toBeDefined();
      expect(SUPPORTED_CHAINS['polygon'].alchemyNetwork).toBe(Network.MATIC_MAINNET);
    });

    it('should have correct chain IDs', () => {
      expect(SUPPORTED_CHAINS['ethereum'].chainId).toBe(1);
      expect(SUPPORTED_CHAINS['base'].chainId).toBe(8453);
      expect(SUPPORTED_CHAINS['zora'].chainId).toBe(7777777);
      expect(SUPPORTED_CHAINS['optimism'].chainId).toBe(10);
      expect(SUPPORTED_CHAINS['arbitrum'].chainId).toBe(42161);
      expect(SUPPORTED_CHAINS['polygon'].chainId).toBe(137);
    });

    it('should mark ENS support correctly', () => {
      expect(SUPPORTED_CHAINS['ethereum'].supportsEns).toBe(true);
      expect(SUPPORTED_CHAINS['base'].supportsEns).toBe(false);
      expect(SUPPORTED_CHAINS['zora'].supportsEns).toBe(false);
      expect(SUPPORTED_CHAINS['optimism'].supportsEns).toBe(false);
      expect(SUPPORTED_CHAINS['arbitrum'].supportsEns).toBe(false);
      expect(SUPPORTED_CHAINS['polygon'].supportsEns).toBe(false);
    });

    it('should have all required fields for each chain', () => {
      for (const [name, config] of Object.entries(SUPPORTED_CHAINS)) {
        expect(config.name).toBe(name);
        expect(config.displayName).toBeTruthy();
        expect(config.chainType).toBeTruthy();
        // alchemyNetwork is only required for EVM chains
        if (isEvmChain(config)) {
          expect(config.alchemyNetwork).toBeTruthy();
        }
        expect(typeof config.chainId).toBe('number');
        expect(typeof config.supportsEns).toBe('boolean');
      }
    });

    it('should include Tezos', () => {
      expect(SUPPORTED_CHAINS['tezos']).toBeDefined();
      expect(SUPPORTED_CHAINS['tezos'].displayName).toBe('Tezos');
      expect(SUPPORTED_CHAINS['tezos'].chainType).toBe('tezos');
      expect(SUPPORTED_CHAINS['tezos'].alchemyNetwork).toBeUndefined();
      expect(SUPPORTED_CHAINS['tezos'].supportsTezDomains).toBe(true);
    });
  });

  describe('getChainConfig', () => {
    it('should return config for valid chain name', () => {
      const config = getChainConfig('ethereum');
      expect(config).toBeDefined();
      expect(config.name).toBe('ethereum');
    });

    it('should be case-insensitive', () => {
      expect(getChainConfig('Ethereum')).toEqual(getChainConfig('ethereum'));
      expect(getChainConfig('BASE')).toEqual(getChainConfig('base'));
      expect(getChainConfig('Zora')).toEqual(getChainConfig('zora'));
    });

    it('should throw error for unsupported chain', () => {
      expect(() => getChainConfig('unsupported-chain')).toThrow(
        'Unsupported chain: unsupported-chain'
      );
    });

    it('should throw error with list of supported chains', () => {
      try {
        getChainConfig('invalid');
      } catch (error) {
        expect((error as Error).message).toContain('Supported chains:');
        expect((error as Error).message).toContain('ethereum');
        expect((error as Error).message).toContain('base');
        expect((error as Error).message).toContain('zora');
      }
    });
  });

  describe('getSupportedChainNames', () => {
    it('should return array of chain names', () => {
      const names = getSupportedChainNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names).toContain('ethereum');
      expect(names).toContain('base');
      expect(names).toContain('zora');
    });

    it('should return at least 6 chains', () => {
      const names = getSupportedChainNames();
      expect(names.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('isChainSupported', () => {
    it('should return true for supported chains', () => {
      expect(isChainSupported('ethereum')).toBe(true);
      expect(isChainSupported('base')).toBe(true);
      expect(isChainSupported('zora')).toBe(true);
    });

    it('should return false for unsupported chains', () => {
      expect(isChainSupported('unsupported')).toBe(false);
      expect(isChainSupported('')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isChainSupported('ETHEREUM')).toBe(true);
      expect(isChainSupported('Base')).toBe(true);
    });
  });

  describe('getDefaultChain', () => {
    it('should return ethereum as default', () => {
      const defaultChain = getDefaultChain();
      expect(defaultChain.name).toBe('ethereum');
    });
  });

  describe('isEvmChain', () => {
    it('should return true for EVM chains', () => {
      expect(isEvmChain(SUPPORTED_CHAINS.ethereum)).toBe(true);
      expect(isEvmChain(SUPPORTED_CHAINS.base)).toBe(true);
      expect(isEvmChain(SUPPORTED_CHAINS.polygon)).toBe(true);
    });

    it('should return false for non-EVM chains', () => {
      expect(isEvmChain(SUPPORTED_CHAINS.tezos)).toBe(false);
    });
  });

  describe('isTezosChain', () => {
    it('should return true for Tezos', () => {
      expect(isTezosChain(SUPPORTED_CHAINS.tezos)).toBe(true);
    });

    it('should return false for EVM chains', () => {
      expect(isTezosChain(SUPPORTED_CHAINS.ethereum)).toBe(false);
      expect(isTezosChain(SUPPORTED_CHAINS.base)).toBe(false);
    });
  });
});
