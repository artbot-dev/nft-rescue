import { readFile } from 'node:fs/promises';
import type { ArweaveUploadResult } from './types.js';

// Dynamic import for Irys SDK (ESM module)
let IrysClass: any = null;

async function getIrys(keyPath: string) {
  if (!IrysClass) {
    const module = await import('@irys/sdk');
    IrysClass = module.default;
  }

  const key = JSON.parse(await readFile(keyPath, 'utf-8'));

  const irys = new IrysClass({
    network: 'mainnet',
    token: 'arweave',
    key,
  });

  return irys;
}

/**
 * Get the balance of the Irys/Arweave wallet
 */
export async function getBalance(keyPath: string): Promise<string> {
  const irys = await getIrys(keyPath);
  const balance = await irys.getLoadedBalance();
  return irys.utils.fromAtomic(balance).toString();
}

/**
 * Get the price to upload data of a given size
 */
export async function getPrice(keyPath: string, bytes: number): Promise<string> {
  const irys = await getIrys(keyPath);
  const price = await irys.getPrice(bytes);
  return irys.utils.fromAtomic(price).toString();
}

/**
 * Upload a file to Arweave via Irys
 */
export async function uploadToArweave(
  filePath: string,
  contentType: string,
  keyPath: string,
  tags?: Array<{ name: string; value: string }>
): Promise<ArweaveUploadResult> {
  const irys = await getIrys(keyPath);

  const defaultTags = [
    { name: 'Content-Type', value: contentType },
    { name: 'App-Name', value: 'nft-rescue' },
    { name: 'App-Version', value: '1.0.0' },
  ];

  const allTags = [...defaultTags, ...(tags || [])];

  const receipt = await irys.uploadFile(filePath, { tags: allTags });

  return {
    transactionId: receipt.id,
    url: `https://arweave.net/${receipt.id}`,
  };
}

/**
 * Upload raw data to Arweave via Irys
 */
export async function uploadDataToArweave(
  data: Buffer | string,
  contentType: string,
  keyPath: string,
  tags?: Array<{ name: string; value: string }>
): Promise<ArweaveUploadResult> {
  const irys = await getIrys(keyPath);

  const defaultTags = [
    { name: 'Content-Type', value: contentType },
    { name: 'App-Name', value: 'nft-rescue' },
    { name: 'App-Version', value: '1.0.0' },
  ];

  const allTags = [...defaultTags, ...(tags || [])];

  const receipt = await irys.upload(data, { tags: allTags });

  return {
    transactionId: receipt.id,
    url: `https://arweave.net/${receipt.id}`,
  };
}

/**
 * Verify an Arweave wallet file exists and is valid
 */
export async function verifyArweaveWallet(keyPath: string): Promise<void> {
  try {
    const content = await readFile(keyPath, 'utf-8');
    const key = JSON.parse(content);

    if (!key.n || !key.e || !key.d) {
      throw new Error('Invalid Arweave wallet format - missing required key components');
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Arweave wallet file not found: ${keyPath}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in Arweave wallet file: ${keyPath}`);
    }
    throw error;
  }
}
