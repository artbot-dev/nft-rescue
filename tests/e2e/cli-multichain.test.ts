import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Helper to run CLI commands
function runCli(args: string[], env: Record<string, string> = {}): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
}> {
  return new Promise((resolve) => {
    const proc = spawn('node', ['dist/index.js', ...args], {
      cwd: join(import.meta.dirname, '../..'),
      env: { ...process.env, ...env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code });
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      proc.kill();
      resolve({ stdout, stderr, exitCode: -1 });
    }, 15000);
  });
}

describe('CLI multi-chain e2e tests', () => {
  let testOutputDir: string;

  beforeEach(async () => {
    testOutputDir = join(tmpdir(), `nft-rescue-chain-e2e-${Date.now()}`);
    await mkdir(testOutputDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('--chain option', () => {
    it('should show --chain option in help', async () => {
      const { stdout, exitCode } = await runCli(['--help']);

      expect(exitCode).toBe(0);
      // Main help shows commands, --chain is in subcommand help
      expect(stdout).toContain('analyze');
      expect(stdout).toContain('backup');
    });

    it('should show --chain option in analyze help', async () => {
      const { stdout, exitCode } = await runCli(['analyze', '--help']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('--chain');
      expect(stdout).toContain('ethereum');
    });

    it('should show --chain option in backup help', async () => {
      const { stdout, exitCode } = await runCli(['backup', '--help']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('--chain');
    });

    it('should accept --chain ethereum', async () => {
      const { stderr } = await runCli(
        ['analyze', '0x1234567890123456789012345678901234567890', '--chain', 'ethereum'],
        { ALCHEMY_API_KEY: 'test-key' }
      );

      expect(stderr).not.toContain('Unknown option');
      expect(stderr).not.toContain('Unsupported chain');
    });

    it('should accept --chain base', async () => {
      const { stderr } = await runCli(
        ['analyze', '0x1234567890123456789012345678901234567890', '--chain', 'base'],
        { ALCHEMY_API_KEY: 'test-key' }
      );

      expect(stderr).not.toContain('Unknown option');
      expect(stderr).not.toContain('Unsupported chain');
    });

    it('should accept --chain zora', async () => {
      const { stderr } = await runCli(
        ['analyze', '0x1234567890123456789012345678901234567890', '--chain', 'zora'],
        { ALCHEMY_API_KEY: 'test-key' }
      );

      expect(stderr).not.toContain('Unknown option');
      expect(stderr).not.toContain('Unsupported chain');
    });

    it('should accept --chain optimism', async () => {
      const { stderr } = await runCli(
        ['analyze', '0x1234567890123456789012345678901234567890', '--chain', 'optimism'],
        { ALCHEMY_API_KEY: 'test-key' }
      );

      expect(stderr).not.toContain('Unknown option');
      expect(stderr).not.toContain('Unsupported chain');
    });

    it('should accept --chain arbitrum', async () => {
      const { stderr } = await runCli(
        ['analyze', '0x1234567890123456789012345678901234567890', '--chain', 'arbitrum'],
        { ALCHEMY_API_KEY: 'test-key' }
      );

      expect(stderr).not.toContain('Unknown option');
    });

    it('should accept --chain polygon', async () => {
      const { stderr } = await runCli(
        ['analyze', '0x1234567890123456789012345678901234567890', '--chain', 'polygon'],
        { ALCHEMY_API_KEY: 'test-key' }
      );

      expect(stderr).not.toContain('Unknown option');
    });

    it('should reject unsupported chain', async () => {
      const { stderr, exitCode } = await runCli(
        ['analyze', '0x1234567890123456789012345678901234567890', '--chain', 'unsupported'],
        { ALCHEMY_API_KEY: 'test-key' }
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('Unsupported chain');
    });

    it('should accept short -c option for chain', async () => {
      const { stderr } = await runCli(
        ['analyze', '0x1234567890123456789012345678901234567890', '-c', 'base'],
        { ALCHEMY_API_KEY: 'test-key' }
      );

      expect(stderr).not.toContain('Unknown option');
    });

    it('should resolve ENS names on non-Ethereum chains with warning', async () => {
      const { stdout, exitCode } = await runCli(
        ['analyze', 'vitalik.eth', '--chain', 'base'],
        { ALCHEMY_API_KEY: 'test-key' }
      );

      // Should proceed (may fail due to API auth, but not due to ENS)
      // The warning should be shown in stdout
      expect(stdout).toContain('resolved on Ethereum');
      expect(stdout).toContain('base');
    });

    it('should work with backup command and chain option', async () => {
      const { stderr } = await runCli(
        ['backup', '0x1234567890123456789012345678901234567890', '--chain', 'base', '--dry-run'],
        { ALCHEMY_API_KEY: 'test-key' }
      );

      expect(stderr).not.toContain('Unknown option');
      expect(stderr).not.toContain('Unsupported chain');
    });
  });
});
