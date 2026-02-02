import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mockResolveAddress = vi.fn();
const mockReverseResolve = vi.fn();
const mockDiscoverNFTs = vi.fn();
const mockFetchMetadata = vi.fn();
const mockDownloadAsset = vi.fn();
const mockCopyGalleryAssets = vi.fn();

vi.mock('../../src/ens.js', () => ({
  resolveAddress: (...args: unknown[]) => mockResolveAddress(...args),
  reverseResolve: (...args: unknown[]) => mockReverseResolve(...args),
  isEnsName: (input: string) => input.endsWith('.eth'),
  isTezDomain: (input: string) => input.endsWith('.tez'),
}));

vi.mock('../../src/nft-discovery.js', () => ({
  discoverNFTs: (...args: unknown[]) => mockDiscoverNFTs(...args),
}));

vi.mock('../../src/metadata.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/metadata.js')>('../../src/metadata.js');
  return {
    ...actual,
    fetchMetadata: (...args: unknown[]) => mockFetchMetadata(...args),
  };
});

vi.mock('../../src/downloader.js', () => ({
  downloadAsset: (...args: unknown[]) => mockDownloadAsset(...args),
}));

vi.mock('../../src/gallery.js', () => ({
  copyGalleryAssets: (...args: unknown[]) => mockCopyGalleryAssets(...args),
}));

vi.mock('../../src/config.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/config.js')>('../../src/config.js');
  return { ...actual, RATE_LIMIT_DELAY: 0 };
});

async function runCli(
  args: string[],
  env: Record<string, string> = {},
  setup?: () => void | Promise<void>
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  vi.resetModules();
  if (setup) {
    await setup();
  }
  const { runCli } = await import('../../src/cli.js');
  return runCli(args, { env, captureOutput: true });
}

describe('CLI flows (mocked)', () => {
  let testOutputDir: string;

  beforeEach(async () => {
    testOutputDir = join(tmpdir(), `nft-rescue-cli-flow-${Date.now()}`);
    await mkdir(testOutputDir, { recursive: true });

    mockResolveAddress.mockReset();
    mockReverseResolve.mockReset();
    mockDiscoverNFTs.mockReset();
    mockFetchMetadata.mockReset();
    mockDownloadAsset.mockReset();
    mockCopyGalleryAssets.mockReset();

    mockResolveAddress.mockResolvedValue({ address: '0xabc', warning: undefined });
    mockReverseResolve.mockResolvedValue(null);
    mockDiscoverNFTs.mockResolvedValue([]);
    mockFetchMetadata.mockResolvedValue({});
    mockDownloadAsset.mockResolvedValue({ path: 'image.png', size: 1 });
    mockCopyGalleryAssets.mockResolvedValue([]);
  });

  afterEach(async () => {
    await rm(testOutputDir, { recursive: true, force: true });
  });

  it('analyzes NFTs with verbose output and mixed statuses', async () => {
    const safeNft = {
      contractAddress: '0x1111',
      tokenId: '1',
      tokenUri: 'ipfs://QmSafeMetadata',
      name: 'Safe NFT',
      contractName: 'Safe Collection',
      cachedMetadata: { image: 'ipfs://QmSafeImage' },
    };

    const riskyNft = {
      contractAddress: '0x2222',
      tokenId: '2',
      tokenUri: 'https://api.example.com/metadata/2',
      name: 'Risky NFT',
      contractName: 'Risk Collection',
      cachedMetadata: { image: 'https://cdn.example.com/2.png' },
    };

    const mixedNft = {
      contractAddress: '0x3333',
      tokenId: '3',
      tokenUri: 'ipfs://QmMixedMetadata',
      name: 'Mixed NFT',
      contractName: 'Mixed Collection',
      cachedMetadata: {
        image: 'https://cdn.example.com/3.png',
        animation_url: 'ipfs://QmAnim',
      },
    };

    mockResolveAddress.mockResolvedValue({ address: '0xabc', warning: 'Cross-chain warning' });
    mockReverseResolve.mockResolvedValue('vitalik.eth');
    mockDiscoverNFTs.mockImplementation(async (_addr: string, onProgress?: (current: number, total?: number) => void) => {
      onProgress?.(1, 3);
      return [safeNft, riskyNft, mixedNft];
    });

    mockFetchMetadata.mockImplementation(async (uri: string) => {
      if (uri.includes('QmSafeMetadata')) {
        return { image: 'ipfs://QmSafeImage' };
      }
      if (uri.includes('metadata/2')) {
        return { image: 'https://cdn.example.com/2.png' };
      }
      throw new Error('fetch failed');
    });

    const { stdout, exitCode } = await runCli(
      ['analyze', '0xabc', '--verbose', '--chain', 'base'],
      { ALCHEMY_API_KEY: 'test-key' }
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Storage Analysis Results');
    expect(stdout).toContain('Cross-chain warning');
    expect(stdout).toContain('Tip:');
  });

  it('returns early when no NFTs are found on a Tezos chain', async () => {
    mockResolveAddress.mockResolvedValue({ address: 'tz1-test', warning: undefined });
    mockReverseResolve.mockResolvedValue(null);
    mockDiscoverNFTs.mockResolvedValue([]);

    const { stderr, exitCode } = await runCli(
      ['analyze', 'alice.tez', '--chain', 'tezos'],
      {}
    );

    expect(exitCode).toBe(0);
    expect(stderr).toContain('No NFTs found');
  });

  it('backs up with --all and --dry-run enabled', async () => {
    const safeNft = {
      contractAddress: '0x4444',
      tokenId: '4',
      tokenUri: 'ipfs://QmSafeBackup',
      name: 'Safe Backup NFT',
      contractName: 'Safe Backup Collection',
      cachedMetadata: { image: 'ipfs://QmSafeImage' },
    };

    mockDiscoverNFTs.mockResolvedValue([safeNft]);
    mockFetchMetadata.mockResolvedValue({ image: 'ipfs://QmSafeImage' });

    const { stdout, exitCode } = await runCli(
      ['backup', '0xabc', '--all', '--dry-run', '--output', testOutputDir],
      { ALCHEMY_API_KEY: 'test-key' }
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Dry run mode');
  });

  it('backs up at-risk NFTs and warns if gallery copy fails', async () => {
    const riskyNft = {
      contractAddress: '0x5555',
      tokenId: '5',
      tokenUri: 'https://api.example.com/metadata/5',
      name: 'Risky Backup NFT',
      contractName: 'Risky Collection',
      cachedMetadata: {
        image: 'https://cdn.example.com/5.png',
        animation_url: 'https://cdn.example.com/5.mp4',
        attributes: [{ trait_type: 'Mood', value: 'Bold' }],
      },
      cachedImageUrl: 'https://cdn.example.com/5-fallback.png',
      cachedAnimationUrl: 'https://cdn.example.com/5-fallback.mp4',
    };

    mockResolveAddress.mockResolvedValue({ address: '0xabc', warning: 'Warning from resolver' });
    mockReverseResolve.mockResolvedValue('backup.eth');
    mockDiscoverNFTs.mockResolvedValue([riskyNft]);

    let fetchCalls = 0;
    mockFetchMetadata.mockImplementation(async () => {
      fetchCalls += 1;
      if (fetchCalls === 1) {
        return {
          image: 'https://cdn.example.com/5.png',
          animation_url: 'https://cdn.example.com/5.mp4',
          attributes: [{ trait_type: 'Mood', value: 'Bold' }],
        };
      }
      throw new Error('metadata fetch failed');
    });

    let downloadCalls = 0;
    mockDownloadAsset.mockImplementation(async (_url: string, dest: string) => {
      downloadCalls += 1;
      if (downloadCalls === 1) {
        throw new Error('download failed');
      }
      const suffix = dest.includes('animation') ? '.mp4' : '.png';
      return { path: dest.replace('.tmp', suffix), size: 1 };
    });

    mockCopyGalleryAssets.mockRejectedValueOnce(new Error('copy failed'));

    const { stdout, exitCode } = await runCli(
      ['backup', '0xabc', '--output', testOutputDir],
      { ALCHEMY_API_KEY: 'test-key' }
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Backup Complete');
    expect(stdout).toContain('Warning: Failed to copy gallery assets');
  });

  it('errors when output directory parent is missing', async () => {
    const badOutput = join(testOutputDir, 'missing', 'backup');
    const { stderr, exitCode } = await runCli(
      ['backup', '0xabc', '--output', badOutput],
      { ALCHEMY_API_KEY: 'test-key' }
    );

    expect(exitCode).toBe(1);
    expect(stderr).toContain('Cannot write to directory');
  });

  it('fails when NFT paths contain invalid segments', async () => {
    const badNft = {
      contractAddress: '../bad',
      tokenId: '6',
      tokenUri: 'ipfs://QmBad',
      name: 'Bad NFT',
      contractName: 'Bad Collection',
      cachedMetadata: { image: 'ipfs://QmBadImage' },
    };

    mockDiscoverNFTs.mockResolvedValue([badNft]);
    mockFetchMetadata.mockResolvedValue({ image: 'ipfs://QmBadImage' });

    const { stderr, exitCode } = await runCli(
      ['backup', '0xabc', '--all', '--output', testOutputDir],
      { ALCHEMY_API_KEY: 'test-key' }
    );

    expect(exitCode).toBe(1);
    expect(stderr).toContain('Invalid path segment');
  });

  it('rejects invalid chain names', async () => {
    const { stderr, exitCode } = await runCli(
      ['analyze', '0xabc', '--chain', 'invalid-chain'],
      { ALCHEMY_API_KEY: 'test-key' }
    );

    expect(exitCode).toBe(1);
    expect(stderr).toContain('Error');
  });

  it('returns early when backup finds no NFTs', async () => {
    mockDiscoverNFTs.mockResolvedValue([]);

    const { stderr, exitCode } = await runCli(
      ['backup', '0xabc', '--output', testOutputDir],
      { ALCHEMY_API_KEY: 'test-key' }
    );

    expect(exitCode).toBe(0);
    expect(stderr).toContain('No NFTs found');
  });
});
