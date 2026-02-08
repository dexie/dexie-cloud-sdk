/**
 * Integration tests against real Dexie Cloud Server
 * Tests the full flow from SDK → Server → Database
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DexieCloudClient } from '../../src/rest-client.js';
import { DexieCloudClient as LegacyClient } from '../../src/client.js';

const DEXIE_CLOUD_URL = process.env.DEXIE_CLOUD_URL || 'http://localhost:3000';
const MAILHOG_URL = process.env.MAILHOG_URL || 'http://localhost:8025';

// Helper to get OTP from MailHog
async function getOTPFromMailHog(email: string): Promise<string> {
  const response = await fetch(`${MAILHOG_URL}/api/v2/messages`);
  const mailhogData = await response.json();
  
  // Find email to our address
  const emails = mailhogData.items || [];
  const otpEmail = emails.find((email: any) => 
    email.To?.some((to: any) => to.Mailbox === email.split('@')[0])
  );
  
  if (!otpEmail) {
    throw new Error(`No OTP email found for ${email}`);
  }
  
  // Extract OTP code from email content
  const content = otpEmail.Content?.Body || '';
  const otpMatch = content.match(/(?:code|OTP).*?(\d{6})/i);
  
  if (!otpMatch) {
    throw new Error(`No OTP code found in email content: ${content}`);
  }
  
  return otpMatch[1];
}

// Helper to clear MailHog
async function clearMailHog() {
  try {
    await fetch(`${MAILHOG_URL}/api/v1/messages`, { method: 'DELETE' });
  } catch {
    // Ignore errors
  }
}

describe('Dexie Cloud SDK Integration Tests', () => {
  let testDatabaseUrl: string;
  let clientId: string;
  let clientSecret: string;
  let testEmail: string;

  beforeAll(async () => {
    testEmail = `test-${Date.now()}@example.com`;
    
    // Clear any existing emails
    await clearMailHog();
    
    // Create test database using legacy client
    const legacyClient = new LegacyClient(DEXIE_CLOUD_URL);
    
    // Wait for server to be ready
    await legacyClient.waitForReady(30000);
    
    // Create database with OTP flow
    const database = await legacyClient.createDatabase(testEmail, async () => {
      // Give server time to send email
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await getOTPFromMailHog(testEmail);
    });
    
    testDatabaseUrl = database.url;
    
    // Extract database ID for creating client credentials
    const dbIdMatch = testDatabaseUrl.match(/\/db\/([^\/]+)/);
    if (!dbIdMatch) {
      throw new Error(`Cannot extract database ID from URL: ${testDatabaseUrl}`);
    }
    
    // For testing, use placeholder credentials
    // In real scenario, these would be obtained from database settings
    clientId = 'test-client-id';
    clientSecret = 'test-client-secret';
    
    console.log('Test database created:', testDatabaseUrl);
  });

  describe('REST API Client', () => {
    let restClient: DexieCloudClient;

    beforeAll(() => {
      restClient = new DexieCloudClient({
        databaseUrl: testDatabaseUrl,
        clientId,
        clientSecret,
        debug: true,
      });
    });

    it('should authenticate with client credentials', async () => {
      // This will test the token flow implicitly
      const isValid = await restClient.validateToken();
      expect(isValid).toBe(true);
    });

    it('should access auth providers endpoint', async () => {
      const providers = await restClient.getAuthProviders();
      
      expect(providers).toHaveProperty('providers');
      expect(providers).toHaveProperty('otpEnabled');
      expect(Array.isArray(providers.providers)).toBe(true);
    });

    it('should perform CRUD operations on /my endpoint', async () => {
      // Create test data
      const testTodo = {
        id: `test-todo-${Date.now()}`,
        title: 'Integration Test Todo',
        completed: false,
        createdAt: new Date().toISOString(),
      };

      // CREATE: Save data
      await restClient.data.my.save('todoItems', testTodo);

      // READ: List data
      const todos = await restClient.data.my.list('todoItems');
      expect(Array.isArray(todos)).toBe(true);
      
      const createdTodo = todos.find(t => t.id === testTodo.id);
      expect(createdTodo).toBeDefined();
      expect(createdTodo?.title).toBe(testTodo.title);

      // READ: Get single item
      const singleTodo = await restClient.data.my.get('todoItems', testTodo.id);
      expect(singleTodo).toBeDefined();
      expect(singleTodo?.title).toBe(testTodo.title);

      // UPDATE: Modify data
      const updatedTodo = { ...testTodo, completed: true };
      await restClient.data.my.save('todoItems', updatedTodo);
      
      const modifiedTodo = await restClient.data.my.get('todoItems', testTodo.id);
      expect(modifiedTodo?.completed).toBe(true);

      // DELETE: Remove data
      await restClient.data.my.delete('todoItems', testTodo.id);
      
      const deletedTodo = await restClient.data.my.get('todoItems', testTodo.id);
      expect(deletedTodo).toBeNull();
    });

    it.skip('should manage users (requires GLOBAL_WRITE scope)', async () => {
      // This test would require admin client credentials
      // Skip for now since we don't have real client setup
      
      const users = await restClient.users.list();
      expect(Array.isArray(users.users)).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      try {
        await restClient.data.my.get('nonExistentTable', 'fake-id');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as any).message).toContain('nonExistentTable');
      }
    });

    it('should cache tokens between requests', async () => {
      const start = Date.now();
      
      // First request - should get new token
      await restClient.data.my.list('todoItems');
      const firstRequestTime = Date.now() - start;
      
      const secondStart = Date.now();
      
      // Second request - should use cached token
      await restClient.data.my.list('todoItems');
      const secondRequestTime = Date.now() - secondStart;
      
      // Second request should be faster (no token request)
      expect(secondRequestTime).toBeLessThan(firstRequestTime);
    });
  });

  describe('Legacy Client (Backward Compatibility)', () => {
    it('should still work for health checks', async () => {
      const legacyClient = new LegacyClient(DEXIE_CLOUD_URL);
      
      const isHealthy = await legacyClient.health.health();
      expect(isHealthy).toBe(true);
      
      const isReady = await legacyClient.health.ready();
      expect(isReady).toBe(true);
    });
  });

  afterAll(async () => {
    // Cleanup would go here if we had delete database API
    console.log('Integration tests completed');
  });
});