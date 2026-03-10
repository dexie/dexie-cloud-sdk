# Dexie Cloud SDK — Blob CRUD Example

Server-side data operations with blob support using client credentials.

## What It Shows

- Authenticating with client credentials (`clientId`/`clientSecret`)
- CRUD operations via REST API
- Uploading and downloading blobs
- Auto blob handling mode

## Run

```bash
npm install

# Credentials from your dexie-cloud.key file:
export DEXIE_CLOUD_DB_URL=https://xxxxxxxx.dexie.cloud
export DEXIE_CLOUD_CLIENT_ID=your-client-id
export DEXIE_CLOUD_CLIENT_SECRET=your-client-secret

npm start
```
