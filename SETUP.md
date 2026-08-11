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
Use your terminal to run `npm install` inside the `gateway/` directory.

## Start the Fabric Network
Use Docker Compose to start the Fabric network and gateway services:
```yaml
docker-compose -f docker-compose.yml up -d
```

## Start the API
Run `npm start` in the `gateway/` directory.

## Open the UI
Open the browser client served by the API at `http://localhost:3000`.

## Common Issues
- If `/health` is degraded, verify the Fabric network and peer containers are running.
- If write requests fail, confirm the chaincode was installed and committed successfully.
- If assets do not appear in `/api/assets`, ensure the gateway can reach the Fabric network.

## Development Notes
- Keep asset, maintenance, bill, and condemnation state on the Fabric ledger.
- Use the Fabric-backed controllers and services for all write operations.
