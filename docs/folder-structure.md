# Folder Structure

```text
stock_management/
├── chaincode/                  Hyperledger Fabric chaincode
│   └── lib/
│       └── asset-management.js Main smart contract (49 functions)
├── backend/                    Express API gateway + business logic
│   ├── app.js                  Gateway entry point
│   ├── services/
│   │   ├── fabricService.js    Fabric SDK wrapper (50+ functions)
│   │   ├── authService.js      JWT + RBAC authentication
│   │   └── reportExportService.js PDF/Excel generation
│   ├── controllers/            API route controllers (8 files)
│   ├── middleware/
│   │   └── auth.js            JWT + role-based middleware
│   ├── routes/
│   │   └── index.js           All REST API routes
│   └── package.json
├── client/                     Browser UI (Vanilla HTML/CSS/JS)
│   ├── index.html
│   ├── app.js
│   └── style.css
├── network/                    Fabric network configuration
│   ├── crypto-config/          MSP certificates
│   ├── channel-artifacts/      Genesis block, channel config
│   ├── connections/
│   │   └── connection-org1.json  Connection profile
│   └── configtx.yaml
├── scripts/                    Deployment, testing, utils
├── tests/
│   └── api.test.js             API integration tests
├── docs/                       Project documentation
├── docker-compose.yml          Fabric + gateway services
├── package.json                Root (test runner)
└── README.md
```

## Notes
- `chaincode/` contains Node.js chaincode deployed on the Fabric network
- `backend/` provides the Express API gateway with Fabric SDK integration
- `client/` serves the interactive dashboard UI in the browser
- `network/` contains all Fabric cryptographic material and network definitions
