import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, rm, access, readFile } from 'node:fs/promises';
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

    // Timeout after 10 seconds
    setTimeout(() => {
      proc.kill();
      resolve({ stdout, stderr, exitCode: -1 });
    }, 10000);
  });
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
