#!/bin/bash
# ==============================================================================
# Centralized Hyperledger Fabric Startup & Network Deployment Script
# Departmental Asset Management System
# ==============================================================================

set -e

echo "🚀 Starting Central Shared Hyperledger Fabric Network..."

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Ensure network directories exist
mkdir -p network/crypto-config network/channel-artifacts network/wallet

# Step 1: Generate crypto materials if missing
if [ ! -d "network/crypto-config/peerOrganizations" ]; then
    echo "🔑 Generating cryptographic materials..."
    docker run --rm -v "$PROJECT_ROOT:/workspace" -w /workspace hyperledger/fabric-tools:2.5 bash -c \
      "cryptogen generate --config=network/crypto-config.yaml --output=network/crypto-config"
else
    echo "✅ Crypto materials already present."
fi

# Step 2: Generate genesis block and channel artifacts if missing
if [ ! -f "network/channel-artifacts/genesis.block" ]; then
    echo "📦 Creating orderer genesis block..."
    docker run --rm -v "$PROJECT_ROOT:/workspace" -w /workspace hyperledger/fabric-tools:2.5 bash -c \
      "FABRIC_CFG_PATH=/workspace/network configtxgen -profile TwoOrgsOrdererGenesis -channelID system-channel -outputBlock network/channel-artifacts/genesis.block"
fi

if [ ! -f "network/channel-artifacts/assets.tx" ]; then
    echo "📄 Creating assets channel transaction..."
    docker run --rm -v "$PROJECT_ROOT:/workspace" -w /workspace hyperledger/fabric-tools:2.5 bash -c \
      "FABRIC_CFG_PATH=/workspace/network configtxgen -profile TwoOrgsChannel -channelID assets -outputCreateChannelTx network/channel-artifacts/assets.tx"
fi

if [ ! -f "network/channel-artifacts/Org1MSPanchors.tx" ]; then
    echo "⚓ Creating anchor peer update..."
    docker run --rm -v "$PROJECT_ROOT:/workspace" -w /workspace hyperledger/fabric-tools:2.5 bash -c \
      "FABRIC_CFG_PATH=/workspace/network configtxgen -profile TwoOrgsChannel -outputAnchorPeersUpdate network/channel-artifacts/Org1MSPanchors.tx -channelID assets -asOrg Org1MSP"
fi

# Step 3: Start Fabric Docker containers
echo "🐳 Starting Fabric Docker containers on central server..."
docker compose -f docker-compose-central-fabric.yml up -d

echo "⏳ Waiting for containers to initialize..."
sleep 5

# Step 4: Create and Join Channel if channel block not present
echo "🔗 Setting up 'assets' channel on peer..."
docker run --rm \
  --network fabric-network \
  -v "$PROJECT_ROOT/network:/etc/hyperledger/fabric" \
  -e CORE_PEER_LOCALMSPID=Org1MSP \
  -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp \
  -e CORE_PEER_ADDRESS=peer0.org1.example.com:7051 \
  hyperledger/fabric-tools:2.5 bash -c "
    peer channel create -o orderer.example.com:7050 -c assets -f /etc/hyperledger/fabric/channel-artifacts/assets.tx --outputBlock /etc/hyperledger/fabric/channel-artifacts/assets.block || true
    peer channel join -b /etc/hyperledger/fabric/channel-artifacts/assets.block || true
  "

echo "✅ Central Shared Fabric Network is ONLINE and ready for team connections!"
