import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server.js';
import { TzKTProvider } from '../../src/providers/tzkt-provider.js';
import { SUPPORTED_CHAINS } from '../../src/chains.js';
import {
  createMockTzKTTokenBalance,
  createMockTzKTVideoNFT,
  createMockTzKTTokenNoMetadata,
} from '../mocks/tzkt.js';

describe('TzKTProvider', () => {
  const tezosConfig = SUPPORTED_CHAINS.tezos;

  beforeEach(() => {
    server.resetHandlers();
  });

  describe('constructor', () => {
    it('should create provider with Tezos chain config', () => {
      const provider = new TzKTProvider(tezosConfig);
      expect(provider.chainConfig).toBe(tezosConfig);
    });

    it('should throw error for non-Tezos chain', () => {
      expect(() => new TzKTProvider(SUPPORTED_CHAINS.ethereum)).toThrow(
        'TzKTProvider requires a Tezos chain configuration'
      );
    });
  });

  describe('discoverNFTs', () => {
    it('should return empty array for wallet with no NFTs', async () => {
      server.use(
        http.get('https://api.tzkt.io/v1/tokens/balances', () => {
          return HttpResponse.json([]);
        })
      );

      const provider = new TzKTProvider(tezosConfig);
      const nfts = await provider.discoverNFTs('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb');

      expect(nfts).toEqual([]);
    });

    it('should return discovered NFTs with TZIP-21 metadata', async () => {
      const mockBalances = [
        createMockTzKTTokenBalance({ tokenId: '1', name: 'NFT #1' }),
        createMockTzKTTokenBalance({ tokenId: '2', name: 'NFT #2' }),
      ];

      server.use(
        http.get('https://api.tzkt.io/v1/tokens/balances', () => {
          return HttpResponse.json(mockBalances);
        })
      );

      const provider = new TzKTProvider(tezosConfig);
      const nfts = await provider.discoverNFTs('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb');

      expect(nfts).toHaveLength(2);
      expect(nfts[0].tokenId).toBe('1');
      expect(nfts[0].name).toBe('NFT #1');
      expect(nfts[1].tokenId).toBe('2');
      expect(nfts[1].name).toBe('NFT #2');
    });

    it('should correctly map TZIP-21 metadata to NFTMetadata format', async () => {
      const mockBalance = createMockTzKTTokenBalance({
        tokenId: '42',
        name: 'Test NFT',
        description: 'A test description',
        displayUri: 'ipfs://QmDisplayUri',
        artifactUri: 'ipfs://QmArtifactUri',
        contractAddress: 'KT1TestContract',
        contractAlias: 'Test Collection',
      });

      server.use(
        http.get('https://api.tzkt.io/v1/tokens/balances', () => {
          return HttpResponse.json([mockBalance]);
        })
      );

      const provider = new TzKTProvider(tezosConfig);
      const nfts = await provider.discoverNFTs('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb');

      expect(nfts[0].contractAddress).toBe('KT1TestContract');
      expect(nfts[0].tokenId).toBe('42');
      expect(nfts[0].name).toBe('Test NFT');
      expect(nfts[0].description).toBe('A test description');
      expect(nfts[0].contractName).toBe('Test Collection');
      expect(nfts[0].cachedImageUrl).toBe('ipfs://QmDisplayUri');
      expect(nfts[0].chainName).toBe('tezos');
      expect(nfts[0].chainId).toBe(-1);
    });

    it('should handle video NFTs with artifactUri', async () => {
      const mockBalance = createMockTzKTVideoNFT({ tokenId: '1', name: 'Video NFT' });

      server.use(
        http.get('https://api.tzkt.io/v1/tokens/balances', () => {
          return HttpResponse.json([mockBalance]);
        })
      );

      const provider = new TzKTProvider(tezosConfig);
      const nfts = await provider.discoverNFTs('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb');

      expect(nfts[0].name).toBe('Video NFT');
      expect(nfts[0].cachedImageUrl).toBe('ipfs://QmPreviewImage');
      expect(nfts[0].cachedAnimationUrl).toBe('ipfs://QmVideoArtifact');
    });

    it('should handle NFTs without metadata', async () => {
      const mockBalance = createMockTzKTTokenNoMetadata({
        tokenId: '1',
        contractAddress: 'KT1NoMeta',
      });

      server.use(
        http.get('https://api.tzkt.io/v1/tokens/balances', () => {
          return HttpResponse.json([mockBalance]);
        })
      );

      const provider = new TzKTProvider(tezosConfig);
      const nfts = await provider.discoverNFTs('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb');

      expect(nfts[0].contractAddress).toBe('KT1NoMeta');
      expect(nfts[0].tokenId).toBe('1');
      expect(nfts[0].name).toBeUndefined();
      expect(nfts[0].cachedMetadata).toBeUndefined();
    });

    it('should handle pagination correctly', async () => {
      // Create 100 items for first page (triggers pagination)
      const page1 = Array.from({ length: 100 }, (_, i) =>
        createMockTzKTTokenBalance({ tokenId: String(i + 1), name: `NFT #${i + 1}` })
      );

      // Second page with fewer items
      const page2 = [
        createMockTzKTTokenBalance({ tokenId: '101', name: 'NFT #101' }),
        createMockTzKTTokenBalance({ tokenId: '102', name: 'NFT #102' }),
      ];

      let callCount = 0;
      server.use(
        http.get('https://api.tzkt.io/v1/tokens/balances', ({ request }) => {
          callCount++;
          const url = new URL(request.url);
          const offset = parseInt(url.searchParams.get('offset') || '0', 10);

          if (offset === 0) {
            return HttpResponse.json(page1);
          } else {
            return HttpResponse.json(page2);
          }
        })
      );

      const provider = new TzKTProvider(tezosConfig);
      const nfts = await provider.discoverNFTs('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb');

      expect(nfts).toHaveLength(102);
      expect(callCount).toBe(2);
    });

    it('should call progress callback', async () => {
      const mockBalances = [
        createMockTzKTTokenBalance({ tokenId: '1' }),
        createMockTzKTTokenBalance({ tokenId: '2' }),
      ];

      server.use(
        http.get('https://api.tzkt.io/v1/tokens/balances', () => {
          return HttpResponse.json(mockBalances);
        })
      );

      const onProgress = vi.fn();
      const provider = new TzKTProvider(tezosConfig);
      await provider.discoverNFTs('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb', onProgress);

      expect(onProgress).toHaveBeenCalledWith(2);
    });

    it('should throw error on API failure', async () => {
      server.use(
        http.get('https://api.tzkt.io/v1/tokens/balances', () => {
          return new HttpResponse(null, {
            status: 500,
            statusText: 'Internal Server Error',
          });
        })
      );

      const provider = new TzKTProvider(tezosConfig);

      await expect(
        provider.discoverNFTs('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb')
      ).rejects.toThrow('TzKT API error: HTTP 500');
    });

    it('should correctly map attributes from TZIP-21 format', async () => {
      const mockBalance = createMockTzKTTokenBalance({ tokenId: '1' });

      server.use(
        http.get('https://api.tzkt.io/v1/tokens/balances', () => {
          return HttpResponse.json([mockBalance]);
        })
      );

      const provider = new TzKTProvider(tezosConfig);
      const nfts = await provider.discoverNFTs('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb');

      const attributes = nfts[0].cachedMetadata?.attributes;
      expect(attributes).toBeDefined();
      expect(attributes).toHaveLength(2);
      // First attribute uses name/value format
      expect(attributes?.[0]).toEqual({ trait_type: 'Color', value: 'Blue' });
      // Second attribute uses trait_type/value format
      expect(attributes?.[1]).toEqual({ trait_type: 'Rarity', value: 'Rare' });
    });

    it('should handle attributes provided as an object map', async () => {
      const mockBalance = createMockTzKTTokenBalance({
        tokenId: '2',
        attributes: {
          Color: 'Green',
          Rarity: { value: 'Epic' },
        },
      });

      server.use(
        http.get('https://api.tzkt.io/v1/tokens/balances', () => {
          return HttpResponse.json([mockBalance]);
        })
      );

      const provider = new TzKTProvider(tezosConfig);
      const nfts = await provider.discoverNFTs('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb');

      const attributes = nfts[0].cachedMetadata?.attributes;
      expect(attributes).toEqual([
        { trait_type: 'Color', value: 'Green' },
        { trait_type: 'Rarity', value: 'Epic' },
      ]);
    });

    it('should use correct TzKT API URL with FA2 filter', async () => {
      let capturedUrl: string | null = null;

      server.use(
        http.get('https://api.tzkt.io/v1/tokens/balances', ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json([]);
        })
      );

      const provider = new TzKTProvider(tezosConfig);
      await provider.discoverNFTs('tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb');

      expect(capturedUrl).toContain('token.standard=fa2');
      expect(capturedUrl).toContain('balance.gt=0');
      expect(capturedUrl).toContain('limit=100');
    });
  });
});
