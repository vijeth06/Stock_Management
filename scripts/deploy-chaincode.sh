# label
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_MSPCONFIGPATH=/network/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=peer0.org1.example.com:7051
export FABRIC_CFG_PATH=/etc/hyperledger/fabric

cd /chaincode

echo "=== Creating chaincode package ==="
peer lifecycle chaincode package chaincode.tar.gz \
  --path /chaincode \
  --lang node \
  --label asset-management_7
echo ""

echo "=== Installing chaincode ==="
peer lifecycle chaincode install chaincode.tar.gz
echo ""

echo "=== Querying installed ==="
peer lifecycle chaincode queryinstalled
echo ""

INSTALL_OUTPUT=$(peer lifecycle chaincode queryinstalled 2>&1)
PACKAGE_ID=$(echo "$INSTALL_OUTPUT" | grep "Package ID:" | tail -1 | awk '{print $3}' | sed 's/,//')
echo "Package ID: $PACKAGE_ID"

echo "=== Querying committed ==="
COMMITTED=$(peer lifecycle chaincode querycommitted -C assets -n asset-management 2>&1)
echo "$COMMITTED"
echo ""

# Extract sequence number
CURRENT_SEQ=$(echo "$COMMITTED" | grep "Sequence:" | awk '{print $2}')
echo "Current sequence: $CURRENT_SEQ"
NEW_SEQ=$((CURRENT_SEQ + 1))
echo "Using sequence: $NEW_SEQ"

CHAINCODE_VERSION=7.0

echo "=== Approving chaincode sequence $NEW_SEQ ==="
peer lifecycle chaincode approveformyorg -o orderer.example.com:7050 \
  -C assets -n asset-management -v $CHAINCODE_VERSION \
  --package-id "$PACKAGE_ID" \
  --sequence $NEW_SEQ --init-required \
  --ordererTLSHostnameOverride orderer.example.com \
  --waitForEvent
echo ""

echo "=== Committing chaincode ==="
peer lifecycle chaincode commit -o orderer.example.com:7050 \
  -C assets -n asset-management -v $CHAINCODE_VERSION \
  --sequence $NEW_SEQ --init-required \
  --ordererTLSHostnameOverride orderer.example.com \
  --peerAddresses peer0.org1.example.com:7051 \
  --tlsRootCertFiles /network/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
echo ""

sleep 5

echo "=== Init chaincode (InitLedger) ==="
echo '{"Args":["InitLedger"]}' > /tmp/init-args.json
peer chaincode invoke -o orderer.example.com:7050 \
  -C assets -n asset-management --isInit \
  --ctor "$(cat /tmp/init-args.json)" \
  --waitForEvent \
  --peerAddresses peer0.org1.example.com:7051 \
  --tlsRootCertFiles /network/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
echo ""

sleep 3

echo "=== Querying committed ==="
peer lifecycle chaincode querycommitted -C assets -n asset-management
echo ""

sleep 3

echo "=== Testing GetAllDepartments ==="
peer chaincode query -C assets -n asset-management -c '{"Args":["GetAllDepartments"]}'
echo ""

echo "=== Done ==="
