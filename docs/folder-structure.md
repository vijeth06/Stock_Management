# Folder Structure

```text
project/
├── blockchain/
│   ├── contracts/
│   ├── scripts/
│   ├── test/
│   └── hardhat.config.js
├── gateway/
│   ├── app.js
│   └── package.json
├── client/
├── shared/
├── docs/
├── backend/
├── data/
├── templates/
├── static/
└── README.md
```

## Notes
- `blockchain/` contains Solidity contracts and Hardhat tests.
- `gateway/` provides the Express + Ethers.js API.
- `client/` serves the interactive dashboard UI.
- `shared/` stores ABI and cross-layer constants.
- `docs/` captures architecture, deployment, and migration guidance.
