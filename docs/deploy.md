# Ethereum Deployment Runbook

## 1. Prepare the environment
- Install Node.js 18+
- Install MongoDB
- Install Hardhat dependencies in `blockchain/`
- Install API dependencies in `gateway/`

## 2. Start the local chain
```powershell
cd blockchain
npx hardhat node
```

## 3. Deploy the smart contract
```powershell
npx hardhat run scripts/deploy.js --network localhost
```

Copy the deployed contract address into `.env` as `CONTRACT_ADDRESS`.

## 4. Start the backend API
```powershell
cd gateway
npm start
```

## 5. Open the client
Open `http://localhost:3000`.

## 6. Verify the system
- Register a product
- Transfer ownership
- Record a shipment hash
- Record a sensor hash
- Review immutable history and transaction metadata
