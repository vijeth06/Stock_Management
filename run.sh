#!/bin/bash
# Run this script from the project root

set -e

echo "🚀 Starting ChainTrack Supply Chain Management System..."

# Navigate to project root
cd "$(dirname "$0")"

# Install gateway dependencies
echo "📦 Installing gateway dependencies..."
cd gateway
npm install --silent
cd ..

# Install blockchain dependencies
echo "📦 Installing blockchain dependencies..."
cd blockchain
npm install --silent
cd ..

# Start Hardhat node in background
echo "⛓️  Starting Hardhat node..."
npx hardhat node > /tmp/hardhat.log 2>&1 &
HARDHAT_PID=$!

# Wait for Hardhat to start
echo "⏳ Waiting for Hardhat node to start..."
sleep 5

# Deploy contract
echo "📝 Deploying smart contract..."
npx hardhat run scripts/deploy.js --network localhost

# Get contract address from deployment
CONTRACT_ADDRESS=$(grep "SupplyChainRegistry deployed to:" /tmp/hardhat.log | awk '{print $NF}')
echo "📋 Contract deployed at: $CONTRACT_ADDRESS"

# Update .env with contract address
if [ -f "gateway/.env" ]; then
    sed -i.bak "s/^CONTRACT_ADDRESS=.*/CONTRACT_ADDRESS=$CONTRACT_ADDRESS/" gateway/.env
fi

# Start gateway
echo "🌐 Starting Express gateway..."
cd gateway
node app.js

# Cleanup on exit
trap "kill $HARDHAT_PID 2>/dev/null" EXIT