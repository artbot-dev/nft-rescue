import { copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GALLERY_FILES = ['index.html', 'app.js', 'styles.css'];

function getGallerySourceDir(): string {
  const filename = fileURLToPath(import.meta.url);
  const dir = dirname(filename);
  return join(dir, '..', 'gallery');
}

export async function copyGalleryAssets(outputDir: string): Promise<string[]> {
  const galleryDir = getGallerySourceDir();
  const copied: string[] = [];

  for (const file of GALLERY_FILES) {
    const source = join(galleryDir, file);
    const target = join(outputDir, file);
    await copyFile(source, target);
    copied.push(target);
  }

  return copied;
}
