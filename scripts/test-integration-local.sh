#!/bin/bash

# Local integration test runner
# Assumes you have dexie-cloud repo cloned as sibling directory

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Starting Dexie Cloud SDK Integration Tests${NC}"

# Check if dexie-cloud repo exists
if [ ! -d "../dexie-cloud" ]; then
    echo -e "${RED}❌ dexie-cloud repo not found at ../dexie-cloud${NC}"
    echo "Please clone dexie-cloud as a sibling directory to run integration tests"
    exit 1
fi

# Build SDK first
echo -e "${YELLOW}📦 Building SDK...${NC}"
npm run build

# Start services using E2E setup from dexie-cloud
cd ../dexie-cloud/e2e

echo -e "${YELLOW}🐳 Starting test services...${NC}"
docker-compose -f docker-compose.test.yml up -d

# Wait for services
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
timeout 120s bash -c 'until curl -f http://localhost:3000/ready; do sleep 2; done'

# Go back to SDK and run tests
cd ../../dexie-cloud-sdk

echo -e "${YELLOW}🧪 Running integration tests...${NC}"
DEXIE_CLOUD_URL=http://localhost:3000 MAILHOG_URL=http://localhost:8025 npm run test:integration

echo -e "${GREEN}✅ Integration tests completed!${NC}"

# Cleanup
echo -e "${YELLOW}🧹 Cleaning up...${NC}"
cd ../dexie-cloud/e2e
docker-compose -f docker-compose.test.yml down

echo -e "${GREEN}🎉 All done!${NC}"