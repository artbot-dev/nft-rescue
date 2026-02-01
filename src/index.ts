#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import cliProgress from 'cli-progress';
import { mkdir, writeFile, access, constants } from 'node:fs/promises';
import { join, dirname } from 'node:path';

import { resolveAddress, isEnsName, isTezDomain, reverseResolve } from './ens.js';
import { discoverNFTs } from './nft-discovery.js';
import { fetchMetadata, extractMediaUrls } from './metadata.js';
import { downloadAsset } from './downloader.js';
import { analyzeNFTStorage, getStorageStatus } from './storage-classifier.js';
import { getChainConfig, getSupportedChainNames, getDefaultChain, isTezosChain } from './chains.js';
import type {
  BackupManifest,
  BackupOptions,
  AnalyzeOptions,
  DiscoveredNFT,
  NFTMetadata,
  NFTStorageReport,
  BackupSummary,
} from './types.js';
import { RATE_LIMIT_DELAY } from './config.js';

/**
 * Validate that the Alchemy API key is configured (only for EVM chains)
 * @param chainName Chain to validate for
 */
function validateApiKey(chainName?: string): void {
  const chain = chainName ? getChainConfig(chainName) : getDefaultChain();

  // Tezos uses TzKT API which is free and doesn't require an API key
  if (isTezosChain(chain)) {
    return;
  }

  // EVM chains require Alchemy API key
  if (!process.env.ALCHEMY_API_KEY) {
    console.error(chalk.red('Error: ALCHEMY_API_KEY environment variable is required.'));
    console.error(chalk.dim('Get a free API key at: https://dashboard.alchemy.com/signup'));
    process.exit(1);
  }
}

/**
 * Sanitize a path segment to prevent directory traversal attacks
 */
function sanitizePathSegment(segment: string): string {
  if (segment.includes('/') || segment.includes('\\') || segment.includes('..')) {
    throw new Error(`Invalid path segment (potential directory traversal): ${segment}`);
  }
  return segment;
}

/**
 * Validate that the output directory is writable
 */
async function validateOutputDir(outputDir: string): Promise<void> {
  const parentDir = dirname(outputDir);
  try {
    await access(parentDir, constants.W_OK);
  } catch {
    throw new Error(`Cannot write to directory: ${parentDir}`);
  }
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a progress bar
 */
function createProgressBar(format: string) {
  return new cliProgress.SingleBar(
    {
      format,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic
  );
}

/**
 * Analyze command - show storage breakdown for all NFTs
 */
async function analyze(input: string, options: AnalyzeOptions): Promise<void> {
  // Validate API key before starting (chain-aware)
  validateApiKey(options.chain);

  const chainConfig = getChainConfig(options.chain);
  const spinner = ora(`Starting analysis on ${chalk.cyan(chainConfig.displayName)}...`).start();

  try {
    // Step 1: Resolve address
    spinner.text = 'Resolving wallet address...';
    const { address: walletAddress, warning: resolveWarning } = await resolveAddress(input, options.chain);
    const ensName = isEnsName(input) ? input : await reverseResolve(walletAddress, options.chain);
    const tezDomainName = isTezDomain(input) ? input : null;

    const displayName = ensName || tezDomainName;
    spinner.succeed(
      `Resolved address: ${chalk.cyan(walletAddress)}${displayName ? ` (${chalk.green(displayName)})` : ''}`
    );

    if (resolveWarning) {
      console.log(chalk.yellow(`  ⚠ ${resolveWarning}`));
    }

    // Step 2: Discover NFTs
    spinner.start(`Discovering NFTs on ${chainConfig.displayName}...`);
    const nfts = await discoverNFTs(walletAddress, (current, total) => {
      spinner.text = `Discovering NFTs on ${chainConfig.displayName}... ${current}${total ? `/${total}` : ''}`;
    }, options.chain);

    if (nfts.length === 0) {
      spinner.warn(`No NFTs found in this wallet on ${chainConfig.displayName}.`);
      return;
    }

    spinner.succeed(`Found ${chalk.cyan(nfts.length)} NFTs on ${chainConfig.displayName}`);

    // Step 3: Analyze storage for each NFT
    console.log('\n' + chalk.bold('Analyzing storage...'));

    const progressBar = createProgressBar(
      'Analyzing NFTs    [{bar}] {percentage}% | {value}/{total} NFTs'
    );
    progressBar.start(nfts.length, 0);

    let fullyDecentralized = 0;
    let atRisk = 0;
    let mixed = 0;
    const atRiskNfts: Array<{ nft: DiscoveredNFT; report: NFTStorageReport }> = [];

    for (let i = 0; i < nfts.length; i++) {
      const nft = nfts[i];
      let metadata: NFTMetadata | undefined;

      try {
        if (nft.tokenUri) {
          metadata = await fetchMetadata(nft.tokenUri);
        }
      } catch {
        // Original URI failed - use cached metadata
        metadata = nft.cachedMetadata;
      }

      // Fall back to cached if still no metadata
      if (!metadata) {
        metadata = nft.cachedMetadata;
      }

      const report = analyzeNFTStorage(nft, metadata);
      const status = getStorageStatus(report);

      if (status === 'decentralized') {
        fullyDecentralized++;
      } else if (status === 'at-risk') {
        atRisk++;
        atRiskNfts.push({ nft, report });
      } else {
        mixed++;
        atRiskNfts.push({ nft, report });
      }

      progressBar.update(i + 1);
      await sleep(RATE_LIMIT_DELAY);
    }

    progressBar.stop();

    // Display results
    console.log('\n' + chalk.bold(`Storage Analysis Results (${chainConfig.displayName}):`));
    console.log(chalk.dim('-'.repeat(50)));
    console.log(`  ${chalk.green('Safe (Decentralized):')} ${fullyDecentralized} NFTs`);
    console.log(`  ${chalk.yellow('Mixed (Some at-risk):')} ${mixed} NFTs`);
    console.log(`  ${chalk.red('At-Risk (Centralized):')} ${atRisk} NFTs`);
    console.log(chalk.dim('-'.repeat(50)));
    console.log(`  ${chalk.bold('Total:')} ${nfts.length} NFTs`);

    if (options.verbose && atRiskNfts.length > 0) {
      console.log('\n' + chalk.bold('At-Risk NFTs:'));
      for (const { nft, report } of atRiskNfts.slice(0, 20)) {
        const name = nft.name || `Token #${nft.tokenId}`;
        const collection = nft.contractName || nft.contractAddress.slice(0, 10) + '...';
        console.log(`\n  ${chalk.dim('*')} ${name} ${chalk.dim(`(${collection})`)}`);

        if (report.tokenUri.isAtRisk) {
          console.log(`    ${chalk.red('Token URI:')} ${report.tokenUri.host || 'unknown'}`);
        }
        if (report.image?.isAtRisk) {
          console.log(`    ${chalk.red('Image:')} ${report.image.host || 'unknown'}`);
        }
        if (report.animation?.isAtRisk) {
          console.log(`    ${chalk.red('Animation:')} ${report.animation.host || 'unknown'}`);
        }
      }

      if (atRiskNfts.length > 20) {
        console.log(chalk.dim(`\n  ... and ${atRiskNfts.length - 20} more`));
      }
    }

    if (atRisk + mixed > 0) {
      const chainFlag = options.chain !== 'ethereum' ? ` --chain ${options.chain}` : '';
      console.log(
        `\n${chalk.yellow('Tip:')} Run ${chalk.cyan(`nft-rescue backup ${input}${chainFlag}`)} to backup at-risk assets.`
      );
    }
  } catch (error) {
    spinner.fail(
      chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`)
    );
    process.exit(1);
  }
}

/**
 * Backup a single NFT
 */
async function backupNFT(
  nft: DiscoveredNFT,
  outputDir: string,
  options: BackupOptions
): Promise<{
  metadataFile?: string;
  imageFile?: string;
  animationFile?: string;
  storageReportFile?: string;
  storageReport?: NFTStorageReport;
  error?: string;
}> {
  // Sanitize path segments to prevent directory traversal
  const safeContract = sanitizePathSegment(nft.contractAddress);
  const safeTokenId = sanitizePathSegment(nft.tokenId);
  const nftDir = join(outputDir, 'nfts', safeContract, safeTokenId);

  try {
    await mkdir(nftDir, { recursive: true });

    // Fetch metadata - try original URI first, fall back to cached
    let metadata: NFTMetadata | undefined;
    let usedCachedMetadata = false;

    if (nft.tokenUri) {
      try {
        metadata = await fetchMetadata(nft.tokenUri);
      } catch {
        // Original URI failed, try cached metadata
      }
    }

    // Fall back to cached metadata from Alchemy
    if (!metadata && nft.cachedMetadata) {
      metadata = nft.cachedMetadata;
      usedCachedMetadata = true;
    }

    if (!metadata) {
      return { error: 'No metadata available (original URI failed and no cache)' };
    }

    // Analyze storage
    const storageReport = analyzeNFTStorage(nft, metadata);

    // Save metadata (note if it came from cache)
    const metadataPath = join(nftDir, 'metadata.json');
    const metadataToSave = usedCachedMetadata
      ? { ...metadata, _source: 'alchemy-cache', _originalUri: nft.tokenUri }
      : metadata;
    await writeFile(metadataPath, JSON.stringify(metadataToSave, null, 2));

    // Save storage report
    const storageReportPath = join(nftDir, 'storage-report.json');
    await writeFile(storageReportPath, JSON.stringify(storageReport, null, 2));

    const result: {
      metadataFile?: string;
      imageFile?: string;
      animationFile?: string;
      storageReportFile?: string;
      storageReport?: NFTStorageReport;
    } = {
      metadataFile: metadataPath,
      storageReportFile: storageReportPath,
      storageReport,
    };

    // Download at-risk assets (or all if --all flag)
    const mediaUrls = extractMediaUrls(metadata);

    // Build list of image URLs to try (original + cached fallbacks)
    const imageUrlsToTry: string[] = [];
    if (mediaUrls.image) imageUrlsToTry.push(mediaUrls.image);
    if (nft.cachedImageUrl && !imageUrlsToTry.includes(nft.cachedImageUrl)) {
      imageUrlsToTry.push(nft.cachedImageUrl);
    }

    // Download image if at-risk or --all
    if (imageUrlsToTry.length > 0 && (storageReport.image?.isAtRisk || options.all)) {
      for (const imageUrl of imageUrlsToTry) {
        try {
          const { path } = await downloadAsset(imageUrl, join(nftDir, 'image.tmp'));
          result.imageFile = path;
          break; // Success - stop trying other URLs
        } catch {
          // Try next URL
        }
      }
    }

    // Build list of animation URLs to try
    const animationUrlsToTry: string[] = [];
    if (mediaUrls.animation) animationUrlsToTry.push(mediaUrls.animation);
    if (nft.cachedAnimationUrl && !animationUrlsToTry.includes(nft.cachedAnimationUrl)) {
      animationUrlsToTry.push(nft.cachedAnimationUrl);
    }

    // Download animation if at-risk or --all
    if (animationUrlsToTry.length > 0 && (storageReport.animation?.isAtRisk || options.all)) {
      for (const animationUrl of animationUrlsToTry) {
        try {
          const { path } = await downloadAsset(animationUrl, join(nftDir, 'animation.tmp'));
          result.animationFile = path;
          break; // Success - stop trying other URLs
        } catch {
          // Try next URL
        }
      }
    }

    return result;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Backup command - backup at-risk NFTs
 */
async function backup(input: string, options: BackupOptions): Promise<void> {
  // Validate API key before starting (chain-aware)
  validateApiKey(options.chain);

  // Validate output directory is writable
  try {
    await validateOutputDir(options.outputDir);
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }

  const chainConfig = getChainConfig(options.chain);
  const spinner = ora(`Starting backup on ${chalk.cyan(chainConfig.displayName)}...`).start();

  try {
    // Step 1: Resolve address
    spinner.text = 'Resolving wallet address...';
    const { address: walletAddress, warning: resolveWarning } = await resolveAddress(input, options.chain);
    const ensName = isEnsName(input) ? input : await reverseResolve(walletAddress, options.chain);
    const tezDomainName = isTezDomain(input) ? input : null;

    const displayName = ensName || tezDomainName;
    spinner.succeed(
      `Resolved address: ${chalk.cyan(walletAddress)}${displayName ? ` (${chalk.green(displayName)})` : ''}`
    );

    if (resolveWarning) {
      console.log(chalk.yellow(`  ⚠ ${resolveWarning}`));
    }

    // Step 2: Discover NFTs
    spinner.start(`Discovering NFTs on ${chainConfig.displayName}...`);
    const nfts = await discoverNFTs(walletAddress, (current, total) => {
      spinner.text = `Discovering NFTs on ${chainConfig.displayName}... ${current}${total ? `/${total}` : ''}`;
    }, options.chain);

    if (nfts.length === 0) {
      spinner.warn(`No NFTs found in this wallet on ${chainConfig.displayName}.`);
      return;
    }

    spinner.succeed(`Found ${chalk.cyan(nfts.length)} NFTs on ${chainConfig.displayName}`);

    // Step 3: Quick analysis to filter at-risk NFTs
    spinner.start('Analyzing storage...');

    const nftsToBackup: Array<{
      nft: DiscoveredNFT;
      metadata?: NFTMetadata;
      report: NFTStorageReport;
    }> = [];

    let analyzed = 0;
    for (const nft of nfts) {
      let metadata: NFTMetadata | undefined;
      try {
        if (nft.tokenUri) {
          metadata = await fetchMetadata(nft.tokenUri);
        }
      } catch {
        // Original URI failed - use cached metadata
        metadata = nft.cachedMetadata;
      }

      // Fall back to cached if still no metadata
      if (!metadata) {
        metadata = nft.cachedMetadata;
      }

      const report = analyzeNFTStorage(nft, metadata);

      // Include if at-risk or if --all flag is set
      if (!report.isFullyDecentralized || options.all) {
        nftsToBackup.push({ nft, metadata, report });
      }

      analyzed++;
      spinner.text = `Analyzing storage... ${analyzed}/${nfts.length}`;
      await sleep(RATE_LIMIT_DELAY);
    }

    const fullyDecentralized = nfts.length - nftsToBackup.length;
    spinner.succeed(
      `Analysis complete: ${chalk.green(fullyDecentralized)} safe, ${chalk.yellow(nftsToBackup.length)} need backup`
    );

    if (nftsToBackup.length === 0) {
      console.log(chalk.green('\nAll NFTs are stored on decentralized infrastructure. Nothing to backup!'));
      return;
    }

    // Display NFTs to backup
    console.log('\n' + chalk.bold('NFTs to backup:'));
    for (const { nft, report } of nftsToBackup.slice(0, 10)) {
      const name = nft.name || `Token #${nft.tokenId}`;
      const collection = nft.contractName || nft.contractAddress.slice(0, 10) + '...';
      const status = getStorageStatus(report);
      const statusColor = status === 'at-risk' ? chalk.red : chalk.yellow;
      console.log(`  ${chalk.dim('*')} ${name} ${chalk.dim(`(${collection})`)} ${statusColor(`[${status}]`)}`);
    }
    if (nftsToBackup.length > 10) {
      console.log(chalk.dim(`  ... and ${nftsToBackup.length - 10} more`));
    }

    // Dry run mode
    if (options.dryRun) {
      console.log(chalk.yellow('\nDry run mode - no files will be downloaded.'));
      return;
    }

    // Create output directory
    await mkdir(options.outputDir, { recursive: true });

    // Step 4: Backup each NFT
    console.log('\n' + chalk.bold('Downloading assets...'));

    const progressBar = createProgressBar(
      'Downloading       [{bar}] {percentage}% | {value}/{total} NFTs'
    );
    progressBar.start(nftsToBackup.length, 0);

    const summary: BackupSummary = {
      totalNFTs: nfts.length,
      fullyDecentralized,
      atRisk: nftsToBackup.length,
      backedUp: 0,
      failed: 0,
    };

    const manifest: BackupManifest = {
      walletAddress,
      ensName: ensName || undefined,
      chainName: chainConfig.name,
      chainId: chainConfig.chainId,
      backupDate: new Date().toISOString(),
      summary,
      nfts: [],
    };

    for (let i = 0; i < nftsToBackup.length; i++) {
      const { nft, report } = nftsToBackup[i];

      const result = await backupNFT(nft, options.outputDir, options);

      manifest.nfts.push({
        contractAddress: nft.contractAddress,
        tokenId: nft.tokenId,
        name: nft.name,
        metadataFile: result.metadataFile,
        imageFile: result.imageFile,
        animationFile: result.animationFile,
        storageReportFile: result.storageReportFile,
        storageStatus: getStorageStatus(result.storageReport || report),
        error: result.error,
      });

      if (result.error) {
        summary.failed++;
      } else {
        summary.backedUp++;
      }

      progressBar.update(i + 1);
      await sleep(RATE_LIMIT_DELAY);
    }

    progressBar.stop();

    // Save manifest
    const manifestPath = join(options.outputDir, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    // Display results
    console.log('\n' + chalk.bold('Backup Complete:'));
    console.log(chalk.dim('-'.repeat(50)));
    console.log(`  ${chalk.green('Backed up:')} ${summary.backedUp} NFTs`);
    console.log(`  ${chalk.red('Failed:')} ${summary.failed} NFTs`);
    console.log(chalk.dim('-'.repeat(50)));
    console.log(`\nBackup saved to: ${chalk.cyan(options.outputDir)}`);
    console.log(`Manifest: ${chalk.cyan(manifestPath)}`);
  } catch (error) {
    spinner.fail(
      chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`)
    );
    process.exit(1);
  }
}

// Chain option description
const chainOptionDesc = `Blockchain to query. Supported: ${getSupportedChainNames().join(', ')}`;

/**
 * Validate chain option and exit if invalid
 */
function validateChain(chainName: string): void {
  try {
    getChainConfig(chainName);
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

// CLI setup
program
  .name('nft-rescue')
  .description('Backup NFT assets stored on centralized/at-risk infrastructure')
  .version('1.1.0');

// Analyze command
program
  .command('analyze')
  .description('Analyze wallet and show storage breakdown')
  .argument('<wallet>', 'Wallet address or ENS name (e.g., artbot.eth)')
  .option('-v, --verbose', 'Show detailed output', false)
  .option('-c, --chain <chain>', chainOptionDesc, 'ethereum')
  .action(async (wallet: string, opts) => {
    const trimmedWallet = wallet.trim();
    if (!trimmedWallet) {
      console.error(chalk.red('Error: Wallet address or ENS name is required.'));
      process.exit(1);
    }
    validateChain(opts.chain);
    const options: AnalyzeOptions = {
      verbose: opts.verbose,
      chain: opts.chain,
    };
    await analyze(trimmedWallet, options);
  });

// Backup command
program
  .command('backup')
  .description('Backup at-risk NFTs')
  .argument('<wallet>', 'Wallet address or ENS name (e.g., artbot.eth)')
  .option('-o, --output <dir>', 'Output directory', './nft-rescue-backup')
  .option('-a, --all', 'Backup all NFTs, not just at-risk', false)
  .option('-d, --dry-run', 'Show what would be backed up', false)
  .option('-v, --verbose', 'Detailed output', false)
  .option('-c, --chain <chain>', chainOptionDesc, 'ethereum')
  .action(async (wallet: string, opts) => {
    const trimmedWallet = wallet.trim();
    if (!trimmedWallet) {
      console.error(chalk.red('Error: Wallet address or ENS name is required.'));
      process.exit(1);
    }
    validateChain(opts.chain);
    const options: BackupOptions = {
      outputDir: opts.output,
      dryRun: opts.dryRun,
      verbose: opts.verbose,
      all: opts.all,
      chain: opts.chain,
    };
    await backup(trimmedWallet, options);
  });

// Show help by default if no command is given
program.action(() => {
  program.help();
});

program.parse();
