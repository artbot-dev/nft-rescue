import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { RETRY_CONFIG, REQUEST_TIMEOUT, IPFS_GATEWAY_URLS } from './config.js';

/**
 * Get file extension from URL or content-type
 */
export function getExtensionFromUrl(url: string, contentType?: string): string {
  // Try to get extension from content-type first
  if (contentType) {
    const typeMap: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/quicktime': '.mov',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'text/html': '.html',
      'application/pdf': '.pdf',
    };

    const ext = typeMap[contentType.split(';')[0].trim().toLowerCase()];
    if (ext) return ext;
  }

  // Try to extract from URL path
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]+)(\?|$)/);
    if (match) {
      return `.${match[1].toLowerCase()}`;
    }
  } catch {
    // Invalid URL, try simple regex
    const match = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
    if (match) {
      return `.${match[1].toLowerCase()}`;
    }
  }

  // Default to .bin for unknown types
  return '.bin';
}

/**
 * Download a file from URL to local path
 */
export async function downloadAsset(
  url: string,
  destPath: string
): Promise<{ path: string; size: number }> {
  // Ensure directory exists
  await mkdir(dirname(destPath), { recursive: true });

  let lastError: Error | null = null;
  let urlsToTry = [url];

  // If it's an IPFS URL, try multiple gateways
  const ipfsMatch = url.match(/\/ipfs\/(Qm[a-zA-Z0-9]+|bafy[a-zA-Z0-9]+)/);
  if (ipfsMatch) {
    const hash = ipfsMatch[1];
    urlsToTry = IPFS_GATEWAY_URLS.map((gateway) => `${gateway}${hash}`);
  }

  for (const tryUrl of urlsToTry) {
    for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        const response = await fetch(tryUrl, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('Response body is empty');
        }

        // Get content type for extension
        const contentType = response.headers.get('content-type') || undefined;
        const ext = getExtensionFromUrl(tryUrl, contentType);

        // Update destination path with correct extension
        const finalPath = destPath.replace(/\.[^.]+$/, '') + ext;

        // Ensure directory exists for final path
        await mkdir(dirname(finalPath), { recursive: true });

        // Stream to file
        const fileStream = createWriteStream(finalPath);
        const webStream = response.body;

        // Convert web stream to node stream
        const nodeStream = Readable.fromWeb(webStream as import('stream/web').ReadableStream);

        await pipeline(nodeStream, fileStream);

        // Get file size
        const contentLength = response.headers.get('content-length');
        const size = contentLength ? parseInt(contentLength, 10) : 0;

        return { path: finalPath, size };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Exponential backoff
        if (attempt < RETRY_CONFIG.maxRetries - 1) {
          const delay = Math.min(
            RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
            RETRY_CONFIG.maxDelay
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  throw lastError || new Error(`Failed to download: ${url}`);
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
