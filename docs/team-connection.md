# Team Member Setup & Connection Guide

This document explains how team members connect their local applications to the central shared Hyperledger Fabric network.

---

## Developer Workflow Overview

```text
Team Member Laptop
  │
  ├── 1. Connect to Tailscale / WireGuard VPN
  ├── 2. Clone Repository & Install Dependencies
  ├── 3. Configure local .env to point FABRIC_HOST to Cloud Server IP
  ├── 4. Enroll Client Identity in local wallet
  ├── 5. Start Local Gateway / Express Backend (npm start)
  └── 6. Interact via Local Frontend Browser UI (http://localhost:3000)
```

---

## Step-by-Step Setup for Developers

### Step 1: Connect to Private VPN
1. Install [Tailscale](https://tailscale.com/download) on your local machine.
2. Join your team's Tailscale network.
3. Obtain the central server's Tailscale IP address (e.g. `100.110.120.130`).

### Step 2: Configure Environment Variables
Copy `.env.example` to `gateway/.env` or `.env` in project root:

```env
# Point to central Cloud Server IP over VPN
FABRIC_NETWORK_MODE=REMOTE
FABRIC_HOST=100.110.120.130
FABRIC_PEER_PORT=7051
FABRIC_ORDERER_PORT=7050
FABRIC_CHANNEL_NAME=assets
FABRIC_CHAINCODE_NAME=asset-management
FABRIC_MSP_ID=Org1MSP
FABRIC_IDENTITY=devUserA
FABRIC_DISCOVERY_AS_LOCALHOST=false

# Local Backend Settings
PORT=3000
MONGO_URI=mongodb://localhost:27017/assetmanagement
JWT_SECRET=dev-secret-key-123
```

### Step 3: Enroll / Copy Identity to Local Wallet
Ensure your `network/wallet/` contains your user identity (e.g. `devUserA.id` or `appUser.id`).
You can use the helper script:
```bash
./scripts/enroll-team-member.sh devUserA
```

### Step 4: Start Local Backend & Frontend
```bash
cd gateway
npm install
npm start
```

### Step 5: Test Connectivity & Shared Ledger
Open browser at `http://localhost:3000` or run the verification test:
```bash
node tests/test-shared-ledger.js
```
