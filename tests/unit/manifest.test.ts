import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  getManifestPath,
  writeManifestWithHistory,
  MANIFEST_HISTORY_LIMIT,
} from '../../src/manifest.js';

describe('manifest helpers', () => {
  let testDir: string;
  const chainName = 'zora';
  const walletAddress = '0xabc123';

  beforeEach(async () => {
    testDir = join(tmpdir(), `nft-rescue-manifest-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('builds per wallet+chain manifest paths', () => {
    const manifestPath = getManifestPath(testDir, chainName, walletAddress);
    expect(manifestPath).toBe(
      join(testDir, 'manifests', `manifest.${chainName}.${walletAddress}.json`)
    );
  });

  it('creates a history snapshot before overwriting', async () => {
    const manifestA = {
      walletAddress,
      chainName,
      chainId: 7777777,
      backupDate: '2026-02-01T00:00:00.000Z',
      summary: { totalNFTs: 1, fullyDecentralized: 0, atRisk: 1, backedUp: 1, failed: 0 },
      nfts: [],
    };

    const manifestB = {
      ...manifestA,
      backupDate: '2026-02-02T00:00:00.000Z',
    };

    await writeManifestWithHistory(testDir, chainName, walletAddress, manifestA);
    await writeManifestWithHistory(testDir, chainName, walletAddress, manifestB);

    const historyDir = join(testDir, 'manifests', 'history');
    const historyFiles = await readdir(historyDir);
    expect(historyFiles).toHaveLength(1);
    expect(historyFiles[0]).toMatch(/^manifest\.zora\.0xabc123\./);

    const historyContent = JSON.parse(
      await readFile(join(historyDir, historyFiles[0]), 'utf-8')
    );
    expect(historyContent.backupDate).toBe(manifestA.backupDate);
  });

  it('writes a manifest index for gallery lookup', async () => {
    const manifest = {
      walletAddress,
      chainName,
      chainId: 7777777,
      backupDate: '2026-02-01T00:00:00.000Z',
      summary: { totalNFTs: 1, fullyDecentralized: 0, atRisk: 1, backedUp: 1, failed: 0 },
      nfts: [],
    };

    await writeManifestWithHistory(testDir, chainName, walletAddress, manifest);

    const indexPath = join(testDir, 'manifests', 'index.json');
    const index = JSON.parse(await readFile(indexPath, 'utf-8'));
    expect(index.manifests).toHaveLength(1);
    expect(index.manifests[0].path).toBe(
      `manifests/manifest.${chainName}.${walletAddress}.json`
    );

    const galleryDataPath = join(testDir, 'gallery-data.js');
    const galleryData = await readFile(galleryDataPath, 'utf-8');
    const json = galleryData.replace(/^window\.__NFT_RESCUE_GALLERY__ = /, '').trim();
    const payload = JSON.parse(json.replace(/;$/, ''));
    expect(payload.index.manifests).toHaveLength(1);
  });

  it('prunes old history snapshots beyond the limit', async () => {
    const baseManifest = {
      walletAddress,
      chainName,
      chainId: 7777777,
      summary: { totalNFTs: 1, fullyDecentralized: 0, atRisk: 1, backedUp: 1, failed: 0 },
      nfts: [],
    };

    for (let i = 0; i < MANIFEST_HISTORY_LIMIT + 2; i++) {
      await writeManifestWithHistory(testDir, chainName, walletAddress, {
        ...baseManifest,
        backupDate: `2026-02-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
      });
    }

    const historyDir = join(testDir, 'manifests', 'history');
    const historyFiles = await readdir(historyDir);
    expect(historyFiles.length).toBe(MANIFEST_HISTORY_LIMIT);
  });

  it('writes delta files with added/updated/removed ids', async () => {
    const chainId = 7777777;
    const idFor = (contractAddress: string, tokenId: string) =>
      `${chainId}:${contractAddress}:${tokenId}`;

    const entryA = {
      contractAddress: '0x1111',
      tokenId: '1',
      name: 'Alpha',
      metadataFile: 'nfts/0x1111/1/metadata.json',
      storageStatus: 'mixed' as const,
    };

    const entryB = {
      contractAddress: '0x2222',
      tokenId: '2',
      name: 'Beta',
      metadataFile: 'nfts/0x2222/2/metadata.json',
      storageStatus: 'mixed' as const,
    };

    const entryBUpdated = {
      ...entryB,
      name: 'Beta Updated',
    };

    const entryC = {
      contractAddress: '0x3333',
      tokenId: '3',
      name: 'Gamma',
      metadataFile: 'nfts/0x3333/3/metadata.json',
      storageStatus: 'at-risk' as const,
    };

    await writeManifestWithHistory(testDir, chainName, walletAddress, {
      walletAddress,
      chainName,
      chainId,
      backupDate: '2026-02-01T00:00:00.000Z',
      summary: { totalNFTs: 2, fullyDecentralized: 0, atRisk: 2, backedUp: 2, failed: 0 },
      nfts: [entryA, entryB],
    });

    const runsDir = join(testDir, 'manifests', 'runs');
    const firstRunFiles = await readdir(runsDir);
    expect(firstRunFiles).toHaveLength(1);

    const firstDelta = JSON.parse(
      await readFile(join(runsDir, firstRunFiles[0]), 'utf-8')
    );
    expect(firstDelta.added.sort()).toEqual(
      [idFor(entryA.contractAddress, entryA.tokenId), idFor(entryB.contractAddress, entryB.tokenId)].sort()
    );
    expect(firstDelta.updated).toHaveLength(0);
    expect(firstDelta.removed).toHaveLength(0);

    await writeManifestWithHistory(testDir, chainName, walletAddress, {
      walletAddress,
      chainName,
      chainId,
      backupDate: '2026-02-02T00:00:00.000Z',
      summary: { totalNFTs: 2, fullyDecentralized: 0, atRisk: 2, backedUp: 2, failed: 0 },
      nfts: [entryBUpdated, entryC],
    });

    const secondRunFiles = (await readdir(runsDir)).sort();
    expect(secondRunFiles).toHaveLength(2);

    const latestDelta = JSON.parse(
      await readFile(join(runsDir, secondRunFiles[secondRunFiles.length - 1]), 'utf-8')
    );
    expect(latestDelta.added).toEqual([idFor(entryC.contractAddress, entryC.tokenId)]);
    expect(latestDelta.updated).toEqual([idFor(entryBUpdated.contractAddress, entryBUpdated.tokenId)]);
    expect(latestDelta.removed).toEqual([idFor(entryA.contractAddress, entryA.tokenId)]);
  });
});
