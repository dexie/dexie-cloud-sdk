# Dexie Cloud SDK

Official JavaScript SDK for [Dexie Cloud](https://dexie.org) - Local-first database with sync.

## 🚀 Features

- **Type-safe API** - Full TypeScript support with strong typing
- **Multi-environment** - Works in browsers, Node.js, Deno, and Cloudflare Workers  
- **Simple authentication** - Built-in OTP email flows
- **Database management** - Create and manage Dexie Cloud databases
- **Health monitoring** - Check service status and wait for readiness
- **Error handling** - Comprehensive error types with detailed messages

## 📦 Installation

```bash
npm install dexie-cloud-sdk
```

## 🔥 Quick Start

```typescript
import { DexieCloudClient } from 'dexie-cloud-sdk';

const client = new DexieCloudClient('https://dexie.cloud');

// Create a new database with OTP authentication
const database = await client.createDatabase('user@example.com', async () => {
  // Return the OTP code from email
  // In real apps, this would prompt the user or fetch from email
  return '123456';
});

console.log('Database created:', database.url);
```

## 📖 API Documentation

### Client Initialization

```typescript
// Simple URL
const client = new DexieCloudClient('https://dexie.cloud');

// Full configuration
const client = new DexieCloudClient({
  serviceUrl: 'https://dexie.cloud',
  timeout: 30000,
  debug: true,
  fetch: customFetch, // Optional custom fetch implementation
});
```

### Authentication

The SDK handles OTP (One-Time Password) authentication flows:

```typescript
// Manual flow
const otpId = await client.auth.requestOTP('user@example.com', ['CREATE_DB']);
// ... user receives email with OTP ...
const tokens = await client.auth.verifyOTP('user@example.com', otpId, '123456');

// Or use the convenience method
const tokens = await client.auth.authenticateWithOTP(
  'user@example.com',
  async () => {
    // Get OTP from user input, email service, etc.
    return await promptForOTP();
  },
  ['CREATE_DB']
);
```

### Database Operations

```typescript
// Create database (requires CREATE_DB scope)
const database = await client.databases.create(accessToken, {
  timeZone: 'Europe/Stockholm',
  hackathon: false,
});

// Convenience method with auth
const database = await client.createDatabase('user@example.com', getOTP);
```

### Health Monitoring

```typescript
// Quick checks
const isHealthy = await client.health.health();
const isReady = await client.health.ready();

// Full status
const status = await client.getStatus();
console.log(status); // { healthy: true, ready: true }

// Wait for service
await client.waitForReady(60000); // Wait up to 60 seconds
```

### Database-Specific Authentication

For accessing an existing database:

```typescript
const dbTokens = await client.auth.authenticateDatabase(
  'https://dexie.cloud/db/abc123',
  'user@example.com',
  async () => await getOTPFromEmail()
);

// Use dbTokens.accessToken for database operations
```

## 🌍 Environment Support

### Browser

```html
<script type="module">
import { DexieCloudClient } from 'https://unpkg.com/dexie-cloud-sdk/dist/index.esm.js';

const client = new DexieCloudClient('https://dexie.cloud');
// ... use client
</script>
```

### Node.js

```javascript
const { DexieCloudClient } = require('dexie-cloud-sdk');
// or
import { DexieCloudClient } from 'dexie-cloud-sdk';

const client = new DexieCloudClient('https://dexie.cloud');
```

### Deno

```typescript
import { DexieCloudClient } from 'https://unpkg.com/dexie-cloud-sdk/dist/index.esm.js';

const client = new DexieCloudClient('https://dexie.cloud');
```

### Cloudflare Workers

```typescript
import { DexieCloudClient } from 'dexie-cloud-sdk';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const client = new DexieCloudClient('https://dexie.cloud');
    // ... use client
  }
};
```

## 🛠️ Error Handling

The SDK provides specific error types:

```typescript
import { 
  DexieCloudError, 
  DexieCloudAuthError, 
  DexieCloudNetworkError 
} from 'dexie-cloud-sdk';

try {
  const db = await client.createDatabase('user@example.com', getOTP);
} catch (error) {
  if (error instanceof DexieCloudAuthError) {
    console.log('Authentication failed:', error.message);
  } else if (error instanceof DexieCloudNetworkError) {
    console.log('Network issue:', error.message);
  } else if (error instanceof DexieCloudError) {
    console.log('API error:', error.message, error.status);
  }
}
```

## 🧪 Testing Integration

Perfect for E2E testing with MailHog or similar email services:

```typescript
import { DexieCloudClient } from 'dexie-cloud-sdk';

const client = new DexieCloudClient('http://localhost:3000');

// Wait for test server
await client.waitForReady();

// Create test database
const database = await client.createDatabase('test@example.com', async () => {
  // Fetch OTP from MailHog API
  const response = await fetch('http://localhost:8025/api/v2/messages');
  const emails = await response.json();
  const otpEmail = emails.items[0];
  const otp = extractOTPFromEmail(otpEmail.Content.Body);
  return otp;
});
```

## 📝 Examples

See the `/examples` directory for complete examples:

- **Browser** - HTML + vanilla JS
- **Node.js CLI** - Command-line database creator
- **React App** - Full authentication flow
- **Cloudflare Workers** - Edge database operations

## 🤝 Contributing

1. Clone the repository
2. Install dependencies: `npm install`  
3. Build: `npm run build`
4. Test: `npm test`
5. Create a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Links

- [Dexie.js](https://dexie.org) - The underlying database library
- [Dexie Cloud](https://dexie.org/cloud) - Local-first sync service
- [Documentation](https://dexie.org/docs) - Full Dexie documentation
- [GitHub](https://github.com/dexie/dexie-cloud-sdk) - Source code