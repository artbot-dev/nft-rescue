import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { copyGalleryAssets } from '../../src/gallery.js';

describe('gallery assets', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `nft-rescue-gallery-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('copies gallery files into the backup root', async () => {
    const copied = await copyGalleryAssets(testDir);

    expect(copied).toHaveLength(3);
    await access(join(testDir, 'index.html'));
    await access(join(testDir, 'app.js'));
    await access(join(testDir, 'styles.css'));

    const html = await readFile(join(testDir, 'index.html'), 'utf-8');
    expect(html).toContain('Offline Gallery');
  });
});
