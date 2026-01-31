import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { server } from './mocks/server.js';

// Mock environment variables
process.env.ALCHEMY_API_KEY = 'test-api-key';

// Setup MSW server
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
});
