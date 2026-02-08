/**
 * HTTP client adapter for different environments
 */
import type { DexieCloudConfig } from './rest-types.js';

export interface HttpAdapter {
  fetch(url: string, options?: RequestInit): Promise<Response>;
}

/**
 * Default fetch-based adapter for browsers and modern environments
 */
export class FetchAdapter implements HttpAdapter {
  constructor(
    private config: DexieCloudConfig,
    private fetchImpl: typeof globalThis.fetch = globalThis.fetch
  ) {
    if (!this.fetchImpl) {
      throw new Error('Fetch is not available. Please provide a fetch implementation.');
    }
  }

  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const { timeout = 30000, debug } = this.config;
    
    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const fetchOptions: RequestInit = {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'dexie-cloud-sdk',
        ...options.headers,
      },
    };

    if (debug) {
      console.log(`[DexieCloud] ${options.method || 'GET'} ${url}`, fetchOptions);
    }

    try {
      const response = await this.fetchImpl(url, fetchOptions);
      
      if (debug) {
        console.log(`[DexieCloud] Response ${response.status}`, response);
      }
      
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Node.js adapter using built-in http/https modules
 */
export class NodeAdapter implements HttpAdapter {
  constructor(private config: DexieCloudConfig) {}

  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Use dynamic import to avoid bundling issues
    const { default: fetch } = await import('node-fetch');
    const adapter = new FetchAdapter(this.config, fetch as any);
    return adapter.fetch(url, options);
  }
}

/**
 * Auto-detect the best adapter for current environment
 */
export function createAdapter(config: DexieCloudConfig): HttpAdapter {
  // Check if custom fetch provided
  if (config.fetch) {
    return new FetchAdapter(config, config.fetch);
  }

  // Browser/Deno environment
  if (typeof globalThis.fetch === 'function') {
    return new FetchAdapter(config);
  }

  // Node.js environment  
  if (typeof process !== 'undefined' && process.versions?.node) {
    return new NodeAdapter(config);
  }

  throw new Error('No suitable HTTP adapter found. Please provide a fetch implementation in config.');
}