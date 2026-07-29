# Migration Status

The repository has begun migrating from Hyperledger Fabric to Ethereum.

## Completed
- Reframed the project README for an Ethereum IoT supply-chain system.
- Added a migration plan.
- Added a Solidity-based supply-chain contract scaffold.
- Replaced the Fabric gateway with an Ethereum/Ethers.js API slice.
- Updated the browser client to use the Ethereum API.
- Replaced the main setup and architecture docs with Ethereum guidance.

## In Progress
- Full backend modularization under `backend/`
- Hardhat deployment script
- MongoDB models and controllers
- JWT auth and RBAC
- MQTT ingestion and alerts

## Remaining Manual Steps
- Install npm dependencies in `gateway/` and `blockchain/`
- Run Hardhat locally
- Deploy the contract and set `CONTRACT_ADDRESS`
- Provide a valid `PRIVATE_KEY` for the API signer
