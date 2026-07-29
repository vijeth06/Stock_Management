# Ethereum IoT Supply Chain Setup & Troubleshooting Guide

## Prerequisites
- Node.js 18+
- MongoDB
- Local Ethereum node via Hardhat
- npm
- Optional: Docker Desktop for MongoDB, MQTT, and app containers

## What This Project Uses
- `blockchain/` for Solidity contracts and Hardhat tests
- `gateway/` for the Express + Ethers.js API
- `client/` for the browser UI
- `shared/` for ABI and reusable constants

## Install Dependencies
```powershell
cd gateway
npm install
cd ..\blockchain
npm install
```

## Start the Local Blockchain
```powershell
cd blockchain
npx hardhat node
```

## Deploy the Contract
In a second terminal:
```powershell
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```

Set `CONTRACT_ADDRESS` in `.env` from the deployment output.

## Start the API
```powershell
cd gateway
npm start
```

## Open the UI
Open the browser client served by the API at `http://localhost:3000`.

## Common Issues
- If `/health` is degraded, verify `RPC_URL`, `CONTRACT_ADDRESS`, and `PRIVATE_KEY` in `.env`.
- If write requests fail, ensure the wallet key matches an unlocked local Hardhat account.
- If products do not appear in `/assets`, confirm the contract has been deployed to the same local chain the API is using.

## Development Notes
- Keep blockchain data on-chain only for product IDs, ownership, status hashes, and audit history.
- Keep IoT payloads, alerts, and reports in MongoDB.
- Use role aliases or addresses consistently when transferring ownership through the API.
