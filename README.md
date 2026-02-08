# Dexie Cloud SDK

Official JavaScript SDK for [Dexie Cloud](https://dexie.org) - Local-first database with sync.

## 🚀 Features

- **🔑 Client Credentials Authentication** - Automatic token management with caching  
- **📊 Type-safe REST API** - Full TypeScript support for all endpoints
- **🌍 Multi-environment** - Works in browsers, Node.js, Deno, and Cloudflare Workers  
- **📡 Complete API Coverage** - `/all`, `/my`, `/public`, `/users` endpoints
- **🔄 TSON Support** - Handles Date, Blob, and other special types via dreambase-library
- **⚡ Token Caching** - Intelligent token refresh with 5-minute buffer
- **🛡️ Error Handling** - Comprehensive error types with detailed messages

## 📦 Installation

```bash
npm install dexie-cloud-sdk
```

For TSON support (special types like Date, Blob):
```bash
npm install dreambase-library
```

## 🔥 Quick Start (REST API Client)

```typescript
import { DexieCloudClient } from 'dexie-cloud-sdk';

const client = new DexieCloudClient({
  databaseUrl: 'https://abc123.dexie.cloud',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret'
});

// Access all data (requires GLOBAL_READ scope)
const allTodos = await client.data.all.list('todoItems');

// Access user's data (requires ACCESS_DB scope)  
const myTodos = await client.data.my.list('todoItems');

// Create new data
await client.data.my.save('todoItems', {
  title: 'Learn Dexie Cloud',
  completed: false,
  createdAt: new Date()
});

// Manage users (requires GLOBAL_WRITE scope)
const users = await client.users.list({ type: 'eval' });
```

## 📖 API Documentation

### Client Initialization

```typescript
const client = new DexieCloudClient({
  databaseUrl: 'https://your-database-id.dexie.cloud',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  timeout: 30000,           // Optional: request timeout
  debug: true,              // Optional: enable debug logging
  autoRefresh: true,        // Optional: auto-refresh tokens (default: true)
  fetch: customFetch        // Optional: custom fetch implementation
});
```

### Authentication & Scopes

The SDK automatically handles client credentials authentication with the following scopes:

- **`ACCESS_DB`** - Basic database access
- **`GLOBAL_READ`** - Read all data (required for `/all` endpoint)
- **`GLOBAL_WRITE`** - Write all data (required for `/all` POST/DELETE)
- **`IMPERSONATE`** - Act on behalf of users
- **`MANAGE_DB`** - Database management operations
- **`DELETE_DB`** - Database deletion (dangerous!)

```typescript
// Get token with specific scopes
const token = await client.tokens.getAccessToken(['ACCESS_DB', 'GLOBAL_READ']);

// Act on behalf of a user (requires IMPERSONATE scope)
const userClient = await client.actAsUser('user123', 'user@example.com', 'User Name');
const userTodos = await userClient.data.my.list('todoItems');
```

### Data Endpoints

#### Global Data (`/all` endpoint)

Access all data in the database. Requires `GLOBAL_READ` scope for reading, `GLOBAL_WRITE` for modifications.

```typescript
// List all items in a table
const items = await client.data.all.list('todoItems');

// Filter by properties
const completedTodos = await client.data.all.list('todoItems', {
  filters: { completed: true }
});

// Filter by realm
const realmData = await client.data.all.list('todoItems', {
  realmId: 'rlm-abc123',
  filters: { priority: 'high' }
});

// Get single item by primary key
const todo = await client.data.all.get('todoItems', 'todo-123');

// Create/update data (upsert)
await client.data.all.save('todoItems', [
  { 
    id: 'todo-456',
    realmId: 'rlm-abc123', // Required for /all endpoint
    title: 'Global Todo',
    completed: false 
  }
]);

// Delete by primary key
await client.data.all.delete('todoItems', 'todo-456');
```

#### User Data (`/my` endpoint)

Access data accessible to the authenticated user. Requires `ACCESS_DB` scope.

```typescript
// List user's accessible data
const myTodos = await client.data.my.list('todoItems');

// Filter user's data
const urgentTodos = await client.data.my.list('todoItems', {
  filters: { priority: 'urgent', completed: false }
});

// Create user data (realmId defaults to user's private realm)
await client.data.my.save('todoItems', {
  title: 'Personal Todo',
  completed: false,
  dueDate: new Date('2026-12-31')
});
```

#### Public Data (`/public` endpoint)

Access public data (realm `rlm-public`). No authentication required for reading.

```typescript
// Read public data (no auth required)
const publicItems = await client.data.public.list('products');

// Create public data (requires GLOBAL_WRITE scope)
await client.data.public.save('products', {
  name: 'New Product',
  price: 29.99,
  category: 'electronics'
});
```

### User Management

```typescript
// List users with filtering and pagination
const users = await client.users.list({
  type: 'eval',              // Filter by user type
  active: true,              // Only active users
  search: 'john',            // Fuzzy search
  sort: 'created',           // Sort by field
  desc: true,                // Descending order
  limit: 50,                 // Max results per page
  pagingKey: 'abc123'        // For pagination
});

// Get single user
const user = await client.users.get('user@example.com');

// Create users
await client.users.create([
  {
    userId: 'new-user@example.com',
    type: 'eval',
    evalDaysLeft: 30,
    data: {
      email: 'new-user@example.com',
      displayName: 'New User'
    }
  }
]);

// Update users
await client.users.update({
  userId: 'user@example.com',
  type: 'prod',
  validUntil: '2026-12-31T23:59:59.999Z'
});

// Upgrade eval user to production
await client.users.upgradeToProd('user@example.com', new Date('2027-01-01'));

// Deactivate user (soft delete)
await client.users.deactivate('user@example.com');

// Extend evaluation period
await client.users.extendEval('user@example.com', 15); // +15 days
```

## 🌍 Environment Support

### Browser

```html
<script type="module">
import { DexieCloudClient } from 'https://unpkg.com/dexie-cloud-sdk/dist/index.esm.js';

const client = new DexieCloudClient({
  databaseUrl: 'https://abc123.dexie.cloud',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret'
});

const todos = await client.data.my.list('todoItems');
</script>
```

### Node.js

```javascript
const { DexieCloudClient } = require('dexie-cloud-sdk');

const client = new DexieCloudClient({
  databaseUrl: 'https://abc123.dexie.cloud',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret'
});
```

### Cloudflare Workers

```typescript
import { DexieCloudClient } from 'dexie-cloud-sdk';

export default {
  async fetch(request: Request): Promise<Response> {
    const client = new DexieCloudClient({
      databaseUrl: 'https://abc123.dexie.cloud',
      clientId: 'your-client-id',
      clientSecret: 'your-client-secret'
    });
    
    const data = await client.data.public.list('products');
    return Response.json(data);
  }
};
```

## 🧠 TSON Support (Special Types)

The SDK automatically handles TSON (TypeSON) serialization for special JavaScript types when `dreambase-library` is available:

```typescript
// Install TSON support
import { TypesonSimplified, builtInTypeDefs } from 'dreambase-library';

// Make TSON available globally
globalThis.TSON = TypesonSimplified(builtInTypeDefs);

// Now the SDK automatically handles Date, Blob, etc.
await client.data.my.save('files', {
  name: 'document.pdf',
  content: new Blob([pdfData], { type: 'application/pdf' }),
  uploadedAt: new Date(),
  tags: new Set(['important', 'document'])
});
```

## 🛠️ Error Handling

The SDK provides specific error types for different scenarios:

```typescript
import { 
  DexieCloudError,
  DexieCloudAuthError,
  DexieCloudNetworkError 
} from 'dexie-cloud-sdk';

try {
  const data = await client.data.all.list('todoItems');
} catch (error) {
  if (error instanceof DexieCloudAuthError) {
    console.log('Authentication failed:', error.message);
    console.log('Status code:', error.status);
  } else if (error instanceof DexieCloudNetworkError) {
    console.log('Network issue:', error.message);
  } else if (error instanceof DexieCloudError) {
    console.log('API error:', error.message, error.status);
  }
}
```

## ⚡ Legacy Support (Database Creation)

The SDK also supports legacy database creation flows for backward compatibility:

```typescript
import { LegacyDexieCloudClient } from 'dexie-cloud-sdk';

const client = new LegacyDexieCloudClient('https://dexie.cloud');

// Create database with OTP authentication
const database = await client.createDatabase('user@example.com', async () => {
  // Return OTP from email
  return await getOTPFromEmail();
});
```

## 📝 Examples

See the `/examples` directory for complete examples:

- **REST API Client** - Complete CRUD operations
- **User Management** - User lifecycle management  
- **Browser Integration** - Client-side usage
- **Node.js Server** - Server-side operations
- **Cloudflare Workers** - Edge computing

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
- [REST API Docs](https://dexie.org/docs/cloud/rest-api) - Complete API reference
- [GitHub](https://github.com/dexie/dexie-cloud-sdk) - Source code