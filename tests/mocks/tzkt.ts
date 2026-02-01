/**
 * Mock data for TzKT API responses
 */

/**
 * Create a mock TzKT token balance response
 */
export function createMockTzKTTokenBalance(overrides: {
  tokenId?: string;
  contractAddress?: string;
  contractAlias?: string;
  name?: string;
  description?: string;
  displayUri?: string;
  artifactUri?: string;
  balance?: string;
} = {}) {
  return {
    id: Math.floor(Math.random() * 1000000),
    account: {
      address: 'tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb',
    },
    token: {
      id: Math.floor(Math.random() * 1000000),
      contract: {
        address: overrides.contractAddress ?? 'KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton',
        alias: overrides.contractAlias ?? 'Test Collection',
      },
      tokenId: overrides.tokenId ?? '1',
      standard: 'fa2',
      metadata: {
        name: overrides.name ?? 'Tezos NFT #1',
        description: overrides.description ?? 'A test Tezos NFT',
        displayUri: overrides.displayUri ?? 'ipfs://QmDisplayUri123',
        artifactUri: overrides.artifactUri ?? 'ipfs://QmArtifactUri456',
        thumbnailUri: 'ipfs://QmThumbnail789',
        symbol: 'TNFT',
        decimals: '0',
        isBooleanAmount: true,
        tags: ['art', 'generative'],
        formats: [
          {
            uri: overrides.displayUri ?? 'ipfs://QmDisplayUri123',
            mimeType: 'image/png',
            dimensions: { value: '1024x1024', unit: 'px' },
          },
        ],
        creators: ['tz1Creator123'],
        attributes: [
          { name: 'Color', value: 'Blue' },
          { trait_type: 'Rarity', value: 'Rare' },
        ],
      },
    },
    balance: overrides.balance ?? '1',
    transfersCount: 3,
    firstLevel: 1000000,
    firstTime: '2023-01-01T00:00:00Z',
    lastLevel: 1500000,
    lastTime: '2024-01-01T00:00:00Z',
  };
}

/**
 * Create a mock TzKT token balance with video artifact
 */
export function createMockTzKTVideoNFT(overrides: {
  tokenId?: string;
  name?: string;
} = {}) {
  return {
    id: Math.floor(Math.random() * 1000000),
    account: {
      address: 'tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb',
    },
    token: {
      id: Math.floor(Math.random() * 1000000),
      contract: {
        address: 'KT1GBZmSxmnKJXGMdMLbugPfLyUPmuLSMwKS',
        alias: 'Video Collection',
      },
      tokenId: overrides.tokenId ?? '1',
      standard: 'fa2',
      metadata: {
        name: overrides.name ?? 'Video NFT',
        description: 'An NFT with video content',
        displayUri: 'ipfs://QmPreviewImage',
        artifactUri: 'ipfs://QmVideoArtifact',
        formats: [
          {
            uri: 'ipfs://QmPreviewImage',
            mimeType: 'image/png',
          },
          {
            uri: 'ipfs://QmVideoArtifact',
            mimeType: 'video/mp4',
          },
        ],
      },
    },
    balance: '1',
    transfersCount: 1,
    firstLevel: 1000000,
    firstTime: '2023-01-01T00:00:00Z',
    lastLevel: 1000000,
    lastTime: '2023-01-01T00:00:00Z',
  };
}

/**
 * Create a mock TzKT token balance without metadata
 */
export function createMockTzKTTokenNoMetadata(overrides: {
  tokenId?: string;
  contractAddress?: string;
} = {}) {
  return {
    id: Math.floor(Math.random() * 1000000),
    account: {
      address: 'tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb',
    },
    token: {
      id: Math.floor(Math.random() * 1000000),
      contract: {
        address: overrides.contractAddress ?? 'KT1NoMetadata',
      },
      tokenId: overrides.tokenId ?? '1',
      standard: 'fa2',
      // No metadata field
    },
    balance: '1',
    transfersCount: 1,
    firstLevel: 1000000,
    firstTime: '2023-01-01T00:00:00Z',
    lastLevel: 1000000,
    lastTime: '2023-01-01T00:00:00Z',
  };
}

/**
 * Create a mock .tez domain resolution response
 */
export function createMockTezDomainResponse(address: string) {
  return [{ address }];
}

/**
 * Create mock fetch responses for TzKT API
 */
export function createMockTzKTFetch(responses: Record<string, unknown>) {
  return (url: string) => {
    const urlStr = url.toString();

    // Check for domain resolution
    if (urlStr.includes('/domains')) {
      const domainMatch = urlStr.match(/name=([^&]+)/);
      const domain = domainMatch ? domainMatch[1] : '';
      const response = responses[`domain:${domain}`];
      return Promise.resolve({
        ok: !!response,
        status: response ? 200 : 404,
        json: () => Promise.resolve(response ?? []),
      });
    }

    // Check for token balances
    if (urlStr.includes('/tokens/balances')) {
      const accountMatch = urlStr.match(/account=([^&]+)/);
      const account = accountMatch ? accountMatch[1] : '';
      const response = responses[`balances:${account}`] ?? [];
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(response),
      });
    }

    // Default empty response
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });
  };
}
