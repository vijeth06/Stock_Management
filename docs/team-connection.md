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
  ├── 5. Start Local Gateway / Express Backend
  └── 6. Interact via Local Frontend Browser UI (http://localhost:3000)
```

---

## Step-by-Step Setup for Developers

### Step 1: Connect to Private VPN
1. Install [Tailscale](https://tailscale.com/download) on your local machine.
2. Join your team's Tailscale network.
3. Obtain the central server's Tailscale IP address (e.g. `100.110.120.130`).

### Step 2: Configure Environment Variables
Create a `.env` file in the project root (or `gateway/.env`):

| Variable | Example Value | Description |
|----------|--------------|-------------|
| `FABRIC_NETWORK_MODE` | `REMOTE` | Connect to remote Fabric |
| `FABRIC_HOST` | `100.110.120.130` | Cloud server Tailscale IP |
| `FABRIC_PEER_PORT` | `7051` | Peer gRPC port |
| `FABRIC_ORDERER_PORT` | `7050` | Orderer port |
| `FABRIC_CHANNEL_NAME` | `assets` | Fabric channel name |
| `FABRIC_CHAINCODE_NAME` | `asset-management` | Deployed chaincode |
| `FABRIC_MSP_ID` | `Org1MSP` | Organization MSP ID |
| `FABRIC_IDENTITY` | `devUserA` | Your enrolled identity |
| `FABRIC_DISCOVERY_AS_LOCALHOST` | `false` | Disable localhost discovery |
| `PORT` | `3000` | Local API port |
| `JWT_SECRET` | *(set by team lead)* | JWT signing key |

### Step 3: Enroll / Copy Identity to Local Wallet
Ensure your `network/wallet/` contains your user identity (e.g. `devUserA.id` or `appUser.id`).

Ask your team lead to generate your identity using the enrollment script, then place the `.id` file in `network/wallet/`.

### Step 4: Start Local Backend & Frontend
1. Install gateway dependencies: `npm install` in the `gateway/` directory
2. Start the backend server
3. The frontend is served automatically by the Express gateway

### Step 5: Test Connectivity & Shared Ledger
Open browser at `http://localhost:3000` or run the verification test:
`node tests/test-shared-ledger.js`
