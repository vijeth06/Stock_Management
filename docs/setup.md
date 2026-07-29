# Ethereum Setup

## Install
```powershell
cd gateway
npm install
cd ..\blockchain
npm install
```

## Run
1. Start a local Ethereum node:
```powershell
cd blockchain
npx hardhat node
```
2. Deploy the contract:
```powershell
npx hardhat run scripts/deploy.js --network localhost
```
3. Set `CONTRACT_ADDRESS` and `PRIVATE_KEY` in `.env`.
4. Start the API:
```powershell
cd ..\gateway
npm start
```

## Environment Variables
- `PORT` - API port
- `RPC_URL` - Ethereum JSON-RPC endpoint
- `CONTRACT_ADDRESS` - Deployed registry contract address
- `PRIVATE_KEY` - Signer key used by the API for write transactions
- `ROLE_OWNER_ADDRESSES_JSON` - Optional alias map for role names to Ethereum addresses
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret

## Validation
- `GET /health` should return Ethereum connectivity details.
- `GET /assets` should list registered products.
- `GET /assets/:assetId/history` should return immutable event history.
