# Integration Tests

Integration tests verify the SDK works correctly against a real Dexie Cloud Server instance.

## Running Integration Tests

### Option 1: Local Development (Recommended)

If you have access to the `dexie-cloud` repository:

```bash
# Clone dexie-cloud as sibling directory
git clone https://github.com/dexie/dexie-cloud.git ../dexie-cloud

# Run integration tests
npm run test:integration:local
```

This uses the existing E2E infrastructure from the dexie-cloud repo.

### Option 2: Manual Setup

Start your own Dexie Cloud Server and run:

```bash
DEXIE_CLOUD_URL=http://localhost:3000 MAILHOG_URL=http://localhost:8025 npm run test:integration
```

### Option 3: CI/CD

Integration tests run automatically in CI when:
- Opening PRs to main branch
- Docker services are available

## Test Coverage

The integration tests verify:

✅ **Authentication Flow**
- Client credentials token generation
- Token caching and refresh
- OTP email flow (legacy compatibility)

✅ **REST API Endpoints**
- `/my/...` - User data CRUD operations
- `/all/...` - Global data access (when permissions allow)
- `/users` - User management operations
- `/auth-providers` - Authentication provider discovery

✅ **Error Handling**
- Network timeouts
- Invalid credentials
- Missing permissions
- Server errors

✅ **Performance**
- Token caching efficiency
- Request batching
- Response parsing (TSON support)

## Test Database

Integration tests create a temporary database using:
- Unique email: `test-${timestamp}@example.com`
- OTP verification via MailHog
- Cleanup after test completion

## Environment Variables

- `DEXIE_CLOUD_URL` - Server URL (default: `http://localhost:3000`)
- `MAILHOG_URL` - MailHog API URL (default: `http://localhost:8025`)

## Debugging

Enable debug logging:

```bash
DEBUG=dexie-cloud-sdk npm run test:integration
```

View MailHog emails: http://localhost:8025