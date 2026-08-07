#!/bin/bash
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_MSPCONFIGPATH=/network/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=peer0.org1.example.com:7051
export FABRIC_CFG_PATH=/etc/hyperledger/fabric

echo "=== Removing old chaincode ==="
rm -f /var/hyperledger/production/lifecycle/chaincodes/asset-management*
echo "Removed"

echo "=== Installing chaincode ==="
peer lifecycle chaincode install /chaincode/chaincode.tar.gz
echo ""

echo "=== Querying installed ==="
peer lifecycle chaincode queryinstalled
echo ""

echo "=== Approving ==="
PACKAGE_ID=$(peer lifecycle chaincode queryinstalled | grep "Package ID:" | sed 's/Package ID: //' | sed 's/,.*//')
echo "Package ID: $PACKAGE_ID"
peer lifecycle chaincode approveformyorg -o orderer.example.com:7050 \
  -C assets -n asset-management -v 1.0 \
  --package-id $PACKAGE_ID \
  --sequence 2 --init-required
echo ""

echo "=== Committing ==="
peer lifecycle chaincode commit -o orderer.example.com:7050 \
  -C assets -n asset-management -v 1.0 \
  --sequence 2 --init-required
echo ""

sleep 2

echo "=== Init chaincode ==="
peer chaincode invoke -o orderer.example.com:7050 \
  -C assets -n asset-management --isInit \
  -c '{"Args":[]}'
echo ""

sleep 3

echo "=== Query chaincode ==="
peer chaincode query -C assets -n asset-management \
  -c '{"Args":["GetAllAssets"]}'
