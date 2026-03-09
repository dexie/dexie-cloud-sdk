# Dexie Cloud SDK Example

A Node.js script demonstrating the Dexie Cloud SDK for server-side data access.

## Features

- OTP authentication
- CRUD operations on tables
- Blob upload/download (auto and lazy modes)
- TSON type preservation (Date, Map, Set)

## Setup

```bash
npm install
# Set environment variables:
export DEXIE_CLOUD_SERVICE_URL=https://dexie.cloud
export DEXIE_CLOUD_DB_URL=https://xxxxxxxx.dexie.cloud
export DEXIE_CLOUD_EMAIL=user@example.com
node index.mjs
```
