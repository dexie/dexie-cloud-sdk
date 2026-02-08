/**
 * Health and status monitoring
 */
import type { HealthStatus, DexieCloudConfig } from './types.js';
import { DexieCloudNetworkError } from './types.js';
import type { HttpAdapter } from './adapters.js';

export class HealthManager {
  constructor(
    private config: DexieCloudConfig,
    private http: HttpAdapter
  ) {}

  /**
   * Health check - basic server status
   */
  async health(): Promise<boolean> {
    try {
      const response = await this.http.fetch(`${this.config.serviceUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Ready check - server + database connection
   */
  async ready(): Promise<boolean> {
    try {
      const response = await this.http.fetch(`${this.config.serviceUrl}/ready`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Combined health status
   */
  async status(): Promise<HealthStatus> {
    const [healthy, ready] = await Promise.all([
      this.health(),
      this.ready(),
    ]);

    return { healthy, ready };
  }

  /**
   * Wait for server to be ready
   */
  async waitForReady(timeout = 60000, interval = 1000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await this.ready()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new DexieCloudNetworkError(`Server not ready after ${timeout}ms`);
  }

  /**
   * Wait for server to be healthy
   */
  async waitForHealth(timeout = 30000, interval = 1000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await this.health()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new DexieCloudNetworkError(`Server not healthy after ${timeout}ms`);
  }
}