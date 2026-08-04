#!/bin/bash
# ==============================================================================
# Identity Enrollment Script for Team Members
# Generates or registers unique client wallet identities for attribution
# ==============================================================================

set -e

MEMBER_NAME=${1:-"devUser"}
MSP_ID="Org1MSP"

echo "👤 Enrolling identity for team member: $MEMBER_NAME..."

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WALLET_DIR="$PROJECT_ROOT/network/wallet"

mkdir -p "$WALLET_DIR"

CERT_PATH="$PROJECT_ROOT/network/crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/signcerts/User1@org1.example.com-cert.pem"
KEY_DIR="$PROJECT_ROOT/network/crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/keystore"

if [ ! -f "$CERT_PATH" ]; then
    echo "⚠️ Cert file missing at $CERT_PATH, attempting fallback to Admin cert..."
    CERT_PATH="$PROJECT_ROOT/network/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/Admin@org1.example.com-cert.pem"
    KEY_DIR="$PROJECT_ROOT/network/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore"
fi

KEY_PATH=$(ls "$KEY_DIR"/*_sk 2>/dev/null | head -n 1 || ls "$KEY_DIR"/*.pem 2>/dev/null | head -n 1)

if [ -f "$CERT_PATH" ] && [ -f "$KEY_PATH" ]; then
    CERT_CONTENT=$(awk '{printf "%s\\n", $0}' "$CERT_PATH")
    KEY_CONTENT=$(awk '{printf "%s\\n", $0}' "$KEY_PATH")

    cat <<EOF > "$WALLET_DIR/${MEMBER_NAME}.id"
{
  "credentials": {
    "certificate": "${CERT_CONTENT}",
    "privateKey": "${KEY_CONTENT}"
  },
  "mspId": "${MSP_ID}",
  "type": "X.509",
  "version": 1
}
EOF
    echo "✅ Identity file created at network/wallet/${MEMBER_NAME}.id"
else
    echo "❌ Error: Key or Certificate files not found."
    exit 1
fi
