#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import cliProgress from 'cli-progress';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import { resolveAddress, isEnsName, reverseResolve } from './ens.js';
import { discoverNFTs } from './nft-discovery.js';
import { fetchMetadata, extractMediaUrls } from './metadata.js';
import { downloadAsset, formatBytes } from './downloader.js';
import { analyzeNFTStorage, getStorageStatus } from './storage-classifier.js';
import { uploadToArweave, verifyArweaveWallet } from './arweave-uploader.js';
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
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Prompt user for confirmation
 */
async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
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
  const spinner = ora('Starting analysis...').start();

  try {
    // Step 1: Resolve address
    spinner.text = 'Resolving wallet address...';
    const walletAddress = await resolveAddress(input);
    const ensName = isEnsName(input) ? input : await reverseResolve(walletAddress);

    spinner.succeed(
      `Resolved address: ${chalk.cyan(walletAddress)}${ensName ? ` (${chalk.green(ensName)})` : ''}`
    );

    // Step 2: Discover NFTs
    spinner.start('Discovering NFTs...');
    const nfts = await discoverNFTs(walletAddress, (current, total) => {
      spinner.text = `Discovering NFTs... ${current}${total ? `/${total}` : ''}`;
    });

    if (nfts.length === 0) {
      spinner.warn('No NFTs found in this wallet.');
      return;
    }

    spinner.succeed(`Found ${chalk.cyan(nfts.length)} NFTs`);

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
    console.log('\n' + chalk.bold('Storage Analysis Results:'));
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
      console.log(
        `\n${chalk.yellow('Tip:')} Run ${chalk.cyan(`nft-rescue backup ${input}`)} to backup at-risk assets.`
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
 * Get content type from file extension
 */
function getContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const typeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    html: 'text/html',
    pdf: 'application/pdf',
    json: 'application/json',
  };
  return typeMap[ext || ''] || 'application/octet-stream';
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
  metadataRescuedFile?: string;
  imageFile?: string;
  animationFile?: string;
  storageReportFile?: string;
  storageReport?: NFTStorageReport;
  arweaveUrls?: {
    image?: string;
    animation?: string;
    metadata?: string;
  };
  error?: string;
}> {
  const nftDir = join(outputDir, 'nfts', nft.contractAddress, nft.tokenId);

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
      metadataRescuedFile?: string;
      imageFile?: string;
      animationFile?: string;
      storageReportFile?: string;
      storageReport?: NFTStorageReport;
      arweaveUrls?: {
        image?: string;
        animation?: string;
        metadata?: string;
      };
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

    // Upload to Arweave if requested
    if (options.arweave && options.arweaveKeyPath) {
      result.arweaveUrls = {};

      if (result.imageFile) {
        try {
          const contentType = getContentType(result.imageFile);
          const upload = await uploadToArweave(result.imageFile, contentType, options.arweaveKeyPath, [
            { name: 'NFT-Contract', value: nft.contractAddress },
            { name: 'NFT-TokenId', value: nft.tokenId },
            { name: 'Asset-Type', value: 'image' },
          ]);
          result.arweaveUrls.image = upload.url;
        } catch {
          // Upload failed - continue
        }
      }

      if (result.animationFile) {
        try {
          const contentType = getContentType(result.animationFile);
          const upload = await uploadToArweave(result.animationFile, contentType, options.arweaveKeyPath, [
            { name: 'NFT-Contract', value: nft.contractAddress },
            { name: 'NFT-TokenId', value: nft.tokenId },
            { name: 'Asset-Type', value: 'animation' },
          ]);
          result.arweaveUrls.animation = upload.url;
        } catch {
          // Upload failed - continue
        }
      }

      // Create rescued metadata with Arweave URLs
      if (result.arweaveUrls.image || result.arweaveUrls.animation) {
        const rescuedMetadata = { ...metadata };
        if (result.arweaveUrls.image) {
          rescuedMetadata.image = result.arweaveUrls.image;
        }
        if (result.arweaveUrls.animation) {
          rescuedMetadata.animation_url = result.arweaveUrls.animation;
        }

        const rescuedMetadataPath = join(nftDir, 'metadata-rescued.json');
        await writeFile(rescuedMetadataPath, JSON.stringify(rescuedMetadata, null, 2));
        result.metadataRescuedFile = rescuedMetadataPath;
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
  const spinner = ora('Starting backup...').start();

  try {
    // Verify Arweave wallet if needed
    if (options.arweave) {
      if (!options.arweaveKeyPath) {
        spinner.fail(chalk.red('--arweave-key is required when using --arweave'));
        process.exit(1);
      }
      await verifyArweaveWallet(options.arweaveKeyPath);
    }

    // Step 1: Resolve address
    spinner.text = 'Resolving wallet address...';
    const walletAddress = await resolveAddress(input);
    const ensName = isEnsName(input) ? input : await reverseResolve(walletAddress);

    spinner.succeed(
      `Resolved address: ${chalk.cyan(walletAddress)}${ensName ? ` (${chalk.green(ensName)})` : ''}`
    );

    // Step 2: Discover NFTs
    spinner.start('Discovering NFTs...');
    const nfts = await discoverNFTs(walletAddress, (current, total) => {
      spinner.text = `Discovering NFTs... ${current}${total ? `/${total}` : ''}`;
    });

    if (nfts.length === 0) {
      spinner.warn('No NFTs found in this wallet.');
      return;
    }

    spinner.succeed(`Found ${chalk.cyan(nfts.length)} NFTs`);

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

    // Arweave warning
    if (options.arweave) {
      console.log('\n' + chalk.yellow('Warning: Uploading to Arweave creates a personal backup of your NFT assets.'));
      console.log(chalk.yellow('    The NFT tokens themselves still reference their original URLs on-chain.'));
      console.log(chalk.yellow('    If those servers go offline, others viewing your NFTs won\'t see the artwork'));
      console.log(chalk.yellow('    unless they also have a backup. This preserves YOUR copy, not the token\'s link.'));

      const proceed = await confirm('\n    Proceed with upload?');
      if (!proceed) {
        console.log(chalk.dim('Backup cancelled.'));
        return;
      }
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
      uploadedToArweave: 0,
    };

    const manifest: BackupManifest = {
      walletAddress,
      ensName: ensName || undefined,
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
        metadataRescuedFile: result.metadataRescuedFile,
        imageFile: result.imageFile,
        animationFile: result.animationFile,
        storageReportFile: result.storageReportFile,
        storageStatus: getStorageStatus(result.storageReport || report),
        arweaveUrls: result.arweaveUrls,
        error: result.error,
      });

      if (result.error) {
        summary.failed++;
      } else {
        summary.backedUp++;
        if (result.arweaveUrls && (result.arweaveUrls.image || result.arweaveUrls.animation)) {
          summary.uploadedToArweave++;
        }
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
    if (options.arweave) {
      console.log(`  ${chalk.blue('Uploaded to Arweave:')} ${summary.uploadedToArweave} NFTs`);
    }
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

// CLI setup
program
  .name('nft-rescue')
  .description('Backup NFT assets stored on centralized/at-risk infrastructure')
  .version('1.0.0');

// Analyze command
program
  .command('analyze')
  .description('Analyze wallet and show storage breakdown')
  .argument('<wallet>', 'Wallet address or ENS name (e.g., artbot.eth)')
  .option('-v, --verbose', 'Show detailed output', false)
  .action(async (wallet: string, opts) => {
    const options: AnalyzeOptions = {
      verbose: opts.verbose,
    };
    await analyze(wallet, options);
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
  .option('--arweave', 'Upload backed-up assets to Arweave', false)
  .option('--arweave-key <path>', 'Path to Arweave wallet JSON (required for --arweave)')
  .action(async (wallet: string, opts) => {
    const options: BackupOptions = {
      outputDir: opts.output,
      dryRun: opts.dryRun,
      verbose: opts.verbose,
      all: opts.all,
      arweave: opts.arweave,
      arweaveKeyPath: opts.arweaveKey,
    };
    await backup(wallet, options);
  });

// Default command (backwards compatibility)
program
  .argument('[wallet]', 'Wallet address or ENS name')
  .option('-o, --output <dir>', 'Output directory', './nft-rescue-backup')
  .option('-a, --all', 'Backup all NFTs, not just at-risk', false)
  .option('-d, --dry-run', 'Show what would be backed up', false)
  .option('-v, --verbose', 'Detailed output', false)
  .option('--arweave', 'Upload backed-up assets to Arweave', false)
  .option('--arweave-key <path>', 'Path to Arweave wallet JSON')
  .action(async (wallet: string | undefined, opts) => {
    if (!wallet) {
      program.help();
      return;
    }

    // If just a wallet is provided without a command, run backup
    const options: BackupOptions = {
      outputDir: opts.output,
      dryRun: opts.dryRun,
      verbose: opts.verbose,
      all: opts.all,
      arweave: opts.arweave,
      arweaveKeyPath: opts.arweaveKey,
    };
    await backup(wallet, options);
  });

program.parse();
