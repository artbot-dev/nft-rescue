import { describe, it, expect } from 'vitest';
import { AlchemyProvider, TzKTProvider, clearAlchemyClients } from '../../src/providers/index.js';

describe('providers index exports', () => {
  it('should export provider constructors and helpers', () => {
    expect(typeof AlchemyProvider).toBe('function');
    expect(typeof TzKTProvider).toBe('function');
    expect(typeof clearAlchemyClients).toBe('function');
  });
});
