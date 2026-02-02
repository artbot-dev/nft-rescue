import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadEnv } from '../../src/env.js';

describe('env loader', () => {
  let testDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    testDir = join(tmpdir(), `nft-rescue-env-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await rm(testDir, { recursive: true, force: true });
  });

  it('loads valid entries and ignores comments/invalid lines', async () => {
    const envPath = join(testDir, '.env');
    await writeFile(
      envPath,
      [
        '# Comment line',
        'export FOO=bar',
        'BAZ="qux"',
        "SINGLE='quoted'",
        'INVALID LINE',
        '',
      ].join('\n')
    );

    await loadEnv(envPath);

    expect(process.env.FOO).toBe('bar');
    expect(process.env.BAZ).toBe('qux');
    expect(process.env.SINGLE).toBe('quoted');
    expect(process.env.INVALID).toBeUndefined();
  });

  it('does not override existing variables', async () => {
    const envPath = join(testDir, '.env');
    await writeFile(envPath, 'FOO=new\n');
    process.env.FOO = 'existing';

    await loadEnv(envPath);

    expect(process.env.FOO).toBe('existing');
  });

  it('silently ignores missing env files', async () => {
    const missingPath = join(testDir, 'missing.env');

    await loadEnv(missingPath);

    expect(process.env.MISSING_TEST).toBeUndefined();
  });
});
