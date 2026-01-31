import { describe, it, expect } from 'vitest';
import {
  IPFS_GATEWAY_HOSTS,
  ARWEAVE_GATEWAY_HOSTS,
  IPFS_GATEWAY_URLS,
  AT_RISK_HOST_PATTERNS,
  RETRY_CONFIG,
  REQUEST_TIMEOUT,
  RATE_LIMIT_DELAY,
} from '../../src/config.js';

describe('config', () => {
  describe('IPFS_GATEWAY_HOSTS', () => {
    it('should contain known IPFS gateway hostnames', () => {
      expect(IPFS_GATEWAY_HOSTS).toContain('ipfs.io');
      expect(IPFS_GATEWAY_HOSTS).toContain('cloudflare-ipfs.com');
      expect(IPFS_GATEWAY_HOSTS).toContain('gateway.pinata.cloud');
    });

    it('should have at least 5 IPFS gateways', () => {
      expect(IPFS_GATEWAY_HOSTS.length).toBeGreaterThanOrEqual(5);
    });

    it('should contain only lowercase hostnames', () => {
      for (const host of IPFS_GATEWAY_HOSTS) {
        expect(host).toBe(host.toLowerCase());
      }
    });
  });

  describe('ARWEAVE_GATEWAY_HOSTS', () => {
    it('should contain known Arweave gateway hostnames', () => {
      expect(ARWEAVE_GATEWAY_HOSTS).toContain('arweave.net');
      expect(ARWEAVE_GATEWAY_HOSTS).toContain('arweave.dev');
    });

    it('should have at least 3 Arweave gateways', () => {
      expect(ARWEAVE_GATEWAY_HOSTS.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('IPFS_GATEWAY_URLS', () => {
    it('should be valid HTTPS URLs ending with /ipfs/', () => {
      for (const url of IPFS_GATEWAY_URLS) {
        expect(url).toMatch(/^https:\/\/.+\/ipfs\/$/);
      }
    });

    it('should have at least 3 gateway URLs', () => {
      expect(IPFS_GATEWAY_URLS.length).toBeGreaterThanOrEqual(3);
    });

    it('should correspond to IPFS gateway hosts', () => {
      for (const url of IPFS_GATEWAY_URLS) {
        const urlObj = new URL(url);
        const matchesHost = IPFS_GATEWAY_HOSTS.some(
          (host) => urlObj.hostname === host || urlObj.hostname.endsWith('.' + host)
        );
        expect(matchesHost).toBe(true);
      }
    });
  });

  describe('AT_RISK_HOST_PATTERNS', () => {
    it('should contain known centralized hosting patterns', () => {
      expect(AT_RISK_HOST_PATTERNS).toContain('niftygateway.com');
      expect(AT_RISK_HOST_PATTERNS).toContain('amazonaws.com');
      expect(AT_RISK_HOST_PATTERNS).toContain('opensea.io');
    });

    it('should contain Google Cloud patterns', () => {
      expect(AT_RISK_HOST_PATTERNS).toContain('storage.googleapis.com');
      expect(AT_RISK_HOST_PATTERNS).toContain('lh3.googleusercontent.com');
    });

    it('should have at least 5 at-risk patterns', () => {
      expect(AT_RISK_HOST_PATTERNS.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('RETRY_CONFIG', () => {
    it('should have valid retry configuration', () => {
      expect(RETRY_CONFIG.maxRetries).toBeGreaterThan(0);
      expect(RETRY_CONFIG.maxRetries).toBeLessThanOrEqual(10);
    });

    it('should have valid delay configuration', () => {
      expect(RETRY_CONFIG.baseDelay).toBeGreaterThan(0);
      expect(RETRY_CONFIG.maxDelay).toBeGreaterThan(RETRY_CONFIG.baseDelay);
    });

    it('should have reasonable delay values in milliseconds', () => {
      expect(RETRY_CONFIG.baseDelay).toBeLessThanOrEqual(5000);
      expect(RETRY_CONFIG.maxDelay).toBeLessThanOrEqual(60000);
    });
  });

  describe('REQUEST_TIMEOUT', () => {
    it('should be a positive number in milliseconds', () => {
      expect(REQUEST_TIMEOUT).toBeGreaterThan(0);
    });

    it('should be at least 10 seconds', () => {
      expect(REQUEST_TIMEOUT).toBeGreaterThanOrEqual(10000);
    });

    it('should be less than 5 minutes', () => {
      expect(REQUEST_TIMEOUT).toBeLessThan(300000);
    });
  });

  describe('RATE_LIMIT_DELAY', () => {
    it('should be a positive number in milliseconds', () => {
      expect(RATE_LIMIT_DELAY).toBeGreaterThan(0);
    });

    it('should be less than 5 seconds', () => {
      expect(RATE_LIMIT_DELAY).toBeLessThan(5000);
    });
  });
});
