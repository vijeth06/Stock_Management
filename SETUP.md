# Fabric Asset Management Setup & Troubleshooting Guide

## Prerequisites
- Node.js 18+
- Docker Desktop
- npm
- Hyperledger Fabric tooling (optional for manual setup)

## What This Project Uses
- `chaincode/` for Fabric chaincode
- `gateway/` for the Express API server
- `client/` for the browser UI
- `network/` for Fabric crypto and channel configuration

## Install Dependencies
```powershell
cd gateway
npm install
```

## Start the Fabric Network
```powershell
docker-compose -f docker-compose.yml up -d
```

## Start the API
```powershell
cd gateway
npm start
```

## Open the UI
Open the browser client served by the API at `http://localhost:3000`.

## Common Issues
- If `/health` is degraded, verify the Fabric network and peer containers are running.
- If write requests fail, confirm the chaincode was installed and committed successfully.
- If assets do not appear in `/api/assets`, ensure the gateway can reach the Fabric network.

## Development Notes
- Keep asset, maintenance, bill, and condemnation state on the Fabric ledger.
- Use the Fabric-backed controllers and services for all write operations.
