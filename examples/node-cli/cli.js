#!/usr/bin/env node

/**
 * Node.js CLI Example for Dexie Cloud SDK
 * 
 * Usage:
 *   node cli.js --email user@example.com --service http://localhost:3000
 */

const { DexieCloudClient } = require('dexie-cloud-sdk');
const readline = require('readline');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    email: null,
    service: 'https://dexie.cloud',
    timeout: 60000,
    debug: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--email':
        config.email = args[++i];
        break;
      case '--service':
        config.service = args[++i];
        break;
      case '--timeout':
        config.timeout = parseInt(args[++i]);
        break;
      case '--debug':
        config.debug = true;
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: node cli.js [options]

Options:
  --email <email>      Email address for OTP authentication
  --service <url>      Dexie Cloud service URL (default: https://dexie.cloud)
  --timeout <ms>       Timeout in milliseconds (default: 60000)
  --debug              Enable debug logging
  --help, -h           Show this help message

Example:
  node cli.js --email user@example.com --service http://localhost:3000 --debug
        `);
        process.exit(0);
    }
  }

  return config;
}

// Create readline interface
function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

// Prompt for user input
function prompt(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

// Get OTP from user input
async function getOTPFromUser() {
  const rl = createReadline();
  try {
    console.log('📧 Check your email for the OTP code...');
    const otp = await prompt(rl, 'Enter OTP (6 digits): ');
    return otp.trim();
  } finally {
    rl.close();
  }
}

// Main function
async function main() {
  const config = parseArgs();

  // Get email if not provided
  if (!config.email) {
    const rl = createReadline();
    try {
      config.email = await prompt(rl, 'Enter your email address: ');
    } finally {
      rl.close();
    }
  }

  if (!config.email) {
    console.error('❌ Email is required');
    process.exit(1);
  }

  try {
    console.log('🚀 Dexie Cloud Database Creator');
    console.log(`📧 Email: ${config.email}`);
    console.log(`🌐 Service: ${config.service}`);
    console.log('');

    // Initialize client
    const client = new DexieCloudClient({
      serviceUrl: config.service,
      timeout: config.timeout,
      debug: config.debug,
    });

    console.log('🔍 Checking service health...');
    await client.waitForReady(10000);
    console.log('✅ Service is ready');

    console.log('🔐 Creating database with OTP authentication...');
    
    // Create database with OTP flow
    const database = await client.createDatabase(
      config.email,
      getOTPFromUser,
      {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }
    );

    console.log('');
    console.log('🎉 Database created successfully!');
    console.log('');
    console.log('📄 Database Information:');
    console.log(`   URL:          ${database.url}`);
    console.log(`   Client ID:    ${database.clientId}`);
    console.log(`   Access Token: ${database.accessToken}`);
    console.log('');
    
    // Save to file for convenience
    const fs = require('fs');
    const dbInfo = {
      url: database.url,
      clientId: database.clientId,
      clientSecret: database.clientSecret,
      accessToken: database.accessToken,
      createdAt: new Date().toISOString(),
      email: config.email,
    };
    
    const filename = `database-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(dbInfo, null, 2));
    console.log(`💾 Database info saved to: ${filename}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (config.debug) {
      console.error(error);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, parseArgs };