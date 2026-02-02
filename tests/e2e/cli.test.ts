import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Helper to run CLI commands
async function runCli(
  args: string[],
  env: Record<string, string> = {},
  setup?: () => void | Promise<void>
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
}> {
  vi.resetModules();
  if (setup) {
    await setup();
  }
  const { runCli } = await import('../../src/cli.js');
  return runCli(args, { env, captureOutput: true });
}

describe('CLI e2e tests', () => {
  let testOutputDir: string;

  beforeEach(async () => {
    testOutputDir = join(tmpdir(), `nft-rescue-e2e-${Date.now()}`);
    await mkdir(testOutputDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('--help flag', () => {
    it('should display help information', async () => {
      const { stdout, exitCode } = await runCli(['--help']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('nft-rescue');
      expect(stdout).toContain('backup');
      expect(stdout).toContain('analyze');
    });
  });

  describe('--version flag', () => {
    it('should display version', async () => {
      const { stdout, exitCode } = await runCli(['--version']);

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('analyze command', () => {
    it('should fail without ALCHEMY_API_KEY', async () => {
      const { stderr, exitCode } = await runCli(
        ['analyze', '0x1234567890123456789012345678901234567890'],
        { ALCHEMY_API_KEY: '' }
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('ALCHEMY_API_KEY');
    });

    it('should load ALCHEMY_API_KEY from .env', async () => {
      const envDir = join(tmpdir(), `nft-rescue-env-${Date.now()}`);
      await mkdir(envDir, { recursive: true });
      await writeFile(join(envDir, '.env'), 'ALCHEMY_API_KEY=test-key\n');

      const originalCwd = process.cwd();
      const originalKey = process.env.ALCHEMY_API_KEY;
      delete process.env.ALCHEMY_API_KEY;
      process.chdir(envDir);

      try {
        const { stderr, exitCode } = await runCli(['analyze', 'invalid-address']);

        expect(exitCode).not.toBe(0);
        expect(stderr).toContain('Invalid input');
        expect(stderr).not.toContain('ALCHEMY_API_KEY');
      } finally {
        process.chdir(originalCwd);
        if (originalKey === undefined) {
          delete process.env.ALCHEMY_API_KEY;
        } else {
          process.env.ALCHEMY_API_KEY = originalKey;
        }
      }
    });

    it('should fail with invalid wallet address', async () => {
      const { stderr, exitCode } = await runCli(
        ['analyze', 'invalid-address'],
        { ALCHEMY_API_KEY: 'test-key' }
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('Invalid input');
    });
  });

  describe('backup command', () => {
    it('should fail without ALCHEMY_API_KEY', async () => {
      const { stderr, exitCode } = await runCli(
        ['backup', '0x1234567890123456789012345678901234567890'],
        { ALCHEMY_API_KEY: '' }
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('ALCHEMY_API_KEY');
    });

    it('should accept --output option', async () => {
      const { stderr, exitCode } = await runCli(
        ['backup', '0x1234567890123456789012345678901234567890', '--output', testOutputDir, '--dry-run'],
        { ALCHEMY_API_KEY: 'test-key' }
      );

      // Will fail due to API call, but should not fail on argument parsing
      expect(stderr).not.toContain('Unknown option');
    });

    it('should accept --dry-run option', async () => {
      const { stderr } = await runCli(
        ['backup', '0x1234567890123456789012345678901234567890', '--dry-run'],
        { ALCHEMY_API_KEY: 'test-key' }
      );

      expect(stderr).not.toContain('Unknown option');
    });

    it('should accept --all option', async () => {
      const { stderr } = await runCli(
        ['backup', '0x1234567890123456789012345678901234567890', '--all'],
        { ALCHEMY_API_KEY: 'test-key' }
      );

      expect(stderr).not.toContain('Unknown option');
    });

    it('should accept --verbose option', async () => {
      const { stderr } = await runCli(
        ['backup', '0x1234567890123456789012345678901234567890', '--verbose'],
        { ALCHEMY_API_KEY: 'test-key' }
      );

      expect(stderr).not.toContain('Unknown option');
    });
  });

  describe('command aliases', () => {
    it('should support short options', async () => {
      const { stderr } = await runCli(
        ['backup', '0x1234567890123456789012345678901234567890', '-o', testOutputDir, '-d', '-v', '-a'],
        { ALCHEMY_API_KEY: 'test-key' }
      );

      expect(stderr).not.toContain('Unknown option');
    });
  });

  describe('gallery refresh command', () => {
    it('should regenerate gallery assets for an existing backup', async () => {
      const manifestDir = join(testOutputDir, 'manifests');
      await mkdir(manifestDir, { recursive: true });

      const walletAddress = '0xabc123';
      const manifest = {
        walletAddress,
        chainName: 'ethereum',
        chainId: 1,
        backupDate: '2026-02-01T00:00:00.000Z',
        summary: { totalNFTs: 0, fullyDecentralized: 0, atRisk: 0, backedUp: 0, failed: 0 },
        nfts: [],
      };

      await writeFile(
        join(manifestDir, `manifest.ethereum.${walletAddress}.json`),
        JSON.stringify(manifest, null, 2)
      );

      const { stdout, exitCode } = await runCli(['gallery', 'refresh', testOutputDir]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Gallery:');
      await access(join(testOutputDir, 'index.html'));
      await access(join(testOutputDir, 'gallery-data.js'));
    });

    it('should fail when manifests directory is missing', async () => {
      const { stderr, exitCode } = await runCli(['gallery', 'refresh', testOutputDir]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain('Manifests directory not found');
    });

    it('should fail when no manifests exist', async () => {
      await mkdir(join(testOutputDir, 'manifests'), { recursive: true });
      const { stderr, exitCode } = await runCli(['gallery', 'refresh', testOutputDir]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain('No canonical manifests found');
    });
  });

  describe('default command', () => {
    it('should show help when no wallet is provided', async () => {
      const { stdout, exitCode } = await runCli([]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Usage');
    });
  });

  describe('input validation', () => {
    it('should reject empty wallet address', async () => {
      const { stderr, exitCode } = await runCli(
        ['analyze', ''],
        { ALCHEMY_API_KEY: 'test-key' }
      );

      // Empty string triggers error exit
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Wallet address or ENS name is required');
    });

    it('should handle ENS-like input', async () => {
      const { stderr } = await runCli(
        ['analyze', 'vitalik.eth'],
        { ALCHEMY_API_KEY: 'test-key' }
      );

      // Should attempt to resolve, may fail due to network, but won't error on input format
      expect(stderr).not.toContain('Invalid input');
    });
  });
});
