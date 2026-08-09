#!/bin/bash
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_MSPCONFIGPATH=/network/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=peer0.org1.example.com:7051
export FABRIC_CFG_PATH=/etc/hyperledger/fabric

cd /chaincode

echo "=== Creating chaincode package ==="
peer lifecycle chaincode package chaincode.tar.gz \
  --path /chaincode \
  --lang node \
  --label asset-management_5
echo ""

echo "=== Installing chaincode ==="
peer lifecycle chaincode install chaincode.tar.gz
echo ""

echo "=== Querying installed ==="
peer lifecycle chaincode queryinstalled
echo ""

PACKAGE_ID=$(peer lifecycle chaincode queryinstalled | grep "Package ID:" | sed 's/.*Package ID: //' | sed 's/,.*//')
echo "Package ID: $PACKAGE_ID"

echo "=== Approving chaincode sequence 9 ==="
peer lifecycle chaincode approveformyorg -o orderer.example.com:7050 \
  -C assets -n asset-management -v 5.0 \
  --package-id "$PACKAGE_ID" \
  --sequence 9 --init-required \
  --ordererTLSHostnameOverride orderer.example.com
echo ""

echo "=== Committing chaincode ==="
peer lifecycle chaincode commit -o orderer.example.com:7050 \
  -C assets -n asset-management -v 5.0 \
  --sequence 9 --init-required \
  --ordererTLSHostnameOverride orderer.example.com \
  --peerAddresses peer0.org1.example.com:7051 \
  --tlsRootCertFiles /network/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
echo ""

sleep 3

echo "=== Querying committed ==="
peer lifecycle chaincode querycommitted -C assets -n asset-management
echo ""

sleep 5

echo "=== Init chaincode (InitLedger) ==="
peer chaincode invoke -o orderer.example.com:7050 \
  -C assets -n asset-management --isInit \
  -c '{"Args":[]}'
echo ""

sleep 5

echo "=== Testing GetAllDepartments ==="
peer chaincode query -C assets -n asset-management -c '{"Args":["GetAllDepartments"]}'
echo ""

echo "=== Chaincode deployment complete ==="
