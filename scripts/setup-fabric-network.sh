#!/bin/bash
# Fabric Network Setup Script for Departmental Asset Management

echo "Setting up Hyperledger Fabric network..."

# Generate crypto materials
echo "Generating crypto materials..."
docker run --rm -v "$(pwd):/workspace" -w /workspace hyperledger/fabric-tools:2.5 bash -c "mkdir -p network/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/msp && mkdir -p network/crypto-config/peerOrganizations/org1.example.com/msp && cryptogen generate --config=network/crypto-config.yaml --output=network/crypto-config"

# Create genesis block
echo "Creating genesis block..."
docker run --rm -v "$(pwd):/workspace" -w /workspace hyperledger/fabric-tools:2.5 bash -c "FABRIC_CFG_PATH=/workspace/network configtxgen -profile TwoOrgsOrdererGenesis -channelID system-channel -outputBlock network/channel-artifacts/genesis.block"

# Create channel transaction
echo "Creating channel transaction..."
docker run --rm -v "$(pwd):/workspace" -w /workspace hyperledger/fabric-tools:2.5 bash -c "FABRIC_CFG_PATH=/workspace/network configtxgen -profile TwoOrgsChannel -channelID assets -outputCreateChannelTx network/channel-artifacts/assets.tx"

# Create anchor peer update
echo "Creating anchor peer update..."
docker run --rm -v "$(pwd):/workspace" -w /workspace hyperledger/fabric-tools:2.5 bash -c "FABRIC_CFG_PATH=/workspace/network configtxgen -profile TwoOrgsChannel -outputAnchorPeersUpdate network/channel-artifacts/Org1MSPanchors.tx -channelID assets -asOrg Org1MSP"

echo "Fabric network setup complete!"