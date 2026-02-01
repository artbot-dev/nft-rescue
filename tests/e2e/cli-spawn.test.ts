import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

function runCliSpawn(args: string[]) {
  const cliPath = join(import.meta.dirname, '../..', 'dist', 'index.js');
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    env: process.env,
    encoding: 'utf8',
  });
  const errorCode = result.error && 'code' in result.error ? result.error.code : undefined;
  if (errorCode === 'EPERM' || errorCode === 'EACCES') {
    return { output: '', status: result.status ?? 0, skipped: true as const };
  }
  if (result.error) {
    throw result.error;
  }
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  return { output, status: result.status ?? 0, skipped: false as const };
}

describe('CLI spawn smoke tests', () => {
  it('prints help', () => {
    const { output, status, skipped } = runCliSpawn(['--help']);
    if (skipped) {
      return;
    }
    expect(status).toBe(0);
    expect(output).toContain('nft-rescue');
    expect(output).toContain('backup');
    expect(output).toContain('analyze');
  });

  it('prints version', () => {
    const { output, status, skipped } = runCliSpawn(['--version']);
    if (skipped) {
      return;
    }
    expect(status).toBe(0);
    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });
});
