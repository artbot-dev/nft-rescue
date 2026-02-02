import { access, copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BackupManifest } from './types.js';

export const MANIFEST_HISTORY_LIMIT = 2;

function sanitizeManifestSegment(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..')) {
    throw new Error(`Invalid manifest segment: ${value}`);
  }
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function getManifestBaseName(chainName: string, walletAddress: string): string {
  const safeChain = sanitizeManifestSegment(chainName);
  const safeWallet = sanitizeManifestSegment(walletAddress);
  return `manifest.${safeChain}.${safeWallet}`;
}

export function getManifestPath(
  outputDir: string,
  chainName: string,
  walletAddress: string
): string {
  const baseName = getManifestBaseName(chainName, walletAddress);
  return join(outputDir, 'manifests', `${baseName}.json`);
}

function formatTimestampForFilename(date: Date): string {
  return date.toISOString().replace(/:/g, '-');
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function getUniqueHistoryPath(
  historyDir: string,
  baseName: string,
  timestamp: string
): Promise<string> {
  let suffix = '';
  let attempt = 0;
  while (true) {
    const filename = `${baseName}.${timestamp}${suffix}.json`;
    const candidate = join(historyDir, filename);
    if (!(await fileExists(candidate))) {
      return candidate;
    }
    attempt += 1;
    suffix = `-${attempt}`;
  }
}

async function pruneHistorySnapshots(
  historyDir: string,
  baseName: string,
  keep: number
): Promise<void> {
  const entries = await readdir(historyDir, { withFileTypes: true });
  const snapshots = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(`${baseName}.`) && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();

  if (snapshots.length <= keep) {
    return;
  }

  const toRemove = snapshots.slice(0, snapshots.length - keep);
  await Promise.all(toRemove.map((name) => rm(join(historyDir, name))));
}

function getNftId(manifest: BackupManifest, entry: BackupManifest['nfts'][number]): string {
  return `${manifest.chainId}:${entry.contractAddress}:${entry.tokenId}`;
}

function getEntryFingerprint(entry: BackupManifest['nfts'][number]): string {
  const ordered: Record<string, unknown> = {};
  const keys = Object.keys(entry).sort();
  for (const key of keys) {
    ordered[key] = entry[key as keyof typeof entry];
  }
  return JSON.stringify(ordered);
}

function buildDelta(
  previous: BackupManifest | null,
  next: BackupManifest
): {
  runId: string;
  walletAddress: string;
  chainName: string;
  chainId: number;
  added: string[];
  updated: string[];
  removed: string[];
  summary: { added: number; updated: number; removed: number };
} {
  const previousMap = new Map<string, string>();
  if (previous) {
    for (const entry of previous.nfts) {
      previousMap.set(getNftId(previous, entry), getEntryFingerprint(entry));
    }
  }

  const nextMap = new Map<string, string>();
  for (const entry of next.nfts) {
    nextMap.set(getNftId(next, entry), getEntryFingerprint(entry));
  }

  const added: string[] = [];
  const updated: string[] = [];
  const removed: string[] = [];

  for (const [id, fingerprint] of nextMap) {
    if (!previousMap.has(id)) {
      added.push(id);
    } else if (previousMap.get(id) !== fingerprint) {
      updated.push(id);
    }
  }

  for (const id of previousMap.keys()) {
    if (!nextMap.has(id)) {
      removed.push(id);
    }
  }

  added.sort();
  updated.sort();
  removed.sort();

  return {
    runId: next.backupDate,
    walletAddress: next.walletAddress,
    chainName: next.chainName,
    chainId: next.chainId,
    added,
    updated,
    removed,
    summary: { added: added.length, updated: updated.length, removed: removed.length },
  };
}

async function getUniqueRunPath(
  runsDir: string,
  filenameBase: string
): Promise<string> {
  let suffix = '';
  let attempt = 0;
  while (true) {
    const candidate = join(runsDir, `${filenameBase}${suffix}.json`);
    if (!(await fileExists(candidate))) {
      return candidate;
    }
    attempt += 1;
    suffix = `-${attempt}`;
  }
}

export async function writeManifestWithHistory(
  outputDir: string,
  chainName: string,
  walletAddress: string,
  manifest: BackupManifest
): Promise<string> {
  const manifestDir = join(outputDir, 'manifests');
  const historyDir = join(manifestDir, 'history');
  const runsDir = join(manifestDir, 'runs');

  await mkdir(manifestDir, { recursive: true });
  await mkdir(historyDir, { recursive: true });
  await mkdir(runsDir, { recursive: true });

  const baseName = getManifestBaseName(chainName, walletAddress);
  const manifestPath = join(manifestDir, `${baseName}.json`);

  let previousManifest: BackupManifest | null = null;
  const hasExisting = await fileExists(manifestPath);
  if (hasExisting) {
    const raw = await readFile(manifestPath, 'utf-8');
    previousManifest = JSON.parse(raw) as BackupManifest;
  }

  if (hasExisting) {
    const timestamp = formatTimestampForFilename(new Date());
    const historyPath = await getUniqueHistoryPath(historyDir, baseName, timestamp);
    await copyFile(manifestPath, historyPath);
    await pruneHistorySnapshots(historyDir, baseName, MANIFEST_HISTORY_LIMIT);
  }

  const delta = buildDelta(previousManifest, manifest);
  const runTimestamp = formatTimestampForFilename(new Date());
  const safeChain = sanitizeManifestSegment(chainName);
  const safeWallet = sanitizeManifestSegment(walletAddress);
  const runBaseName = `run.${runTimestamp}.${safeChain}.${safeWallet}`;
  const runPath = await getUniqueRunPath(runsDir, runBaseName);
  await writeFile(runPath, JSON.stringify(delta, null, 2));

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return manifestPath;
}
