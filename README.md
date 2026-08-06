# Departmental Asset Management System using Hyperledger Fabric

A permissioned blockchain-based application for digitizing departmental asset management and yearly audits. This project is built on **Hyperledger Fabric** (v2.x), not Ethereum, providing a truly permissioned network for enterprise-grade asset tracking.

## What This Project Does

- **Asset Registration**: Record purchased assets with blockchain-backed verification
- **Bill Management**: Upload bills, generate SHA-256 hashes, and verify authenticity
- **Asset Lifecycle Tracking**: Track assets from purchase to disposal with full history
- **Maintenance Management**: Record maintenance activities, repairs, and technician details
- **Condemnation Process**: Request, approve, and track asset condemnation
- **Blockchain Audit Trail**: Immutable record of all asset transactions
- **Yearly Audit Reports**: Generate comprehensive reports for compliance

## User Roles

1. **Administrator** - Full system access, user management, department management
2. **Department User** - Manage assets in assigned department, record maintenance, request condemnation
3. **Audit Officer** - View all assets, run verifications, generate audit reports

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js, Express.js, JWT, bcryptjs
- **Blockchain**: Hyperledger Fabric v2.5, Go chaincode (Node.js SDK)
- **Ledger**: Hyperledger Fabric
- **Reporting**: PDFKit (PDF), ExcelJS (Excel)

## New Business Modules

### Department Management
- Create and manage departments
- Department asset summaries
- Department user assignment

### Asset Management
- **Create Asset**: Register purchased assets with bill verification
- **Update Asset**: Modify asset details, location, status
- **Search Assets**: Filter by ID, department, category, status
- **Asset History**: View complete blockchain history

### Maintenance Module
- **Add Maintenance**: Record maintenance activities, costs, technician details
- **Maintenance Timeline**: View maintenance history per asset
- **Maintenance Records**: Track all maintenance activities

### Bill Management
- **Upload Bill**: Scan/upload bills with SHA-256 hash generation
- **Store Bill**: Store bill metadata and document reference
- **Generate Hash**: Create cryptographic hash for verification
- **Verify Bill**: Compare hashes to verify authenticity

### Condemnation Module
- **Request Condemnation**: Initiate asset condemnation process
- **Inspection Details**: Record inspection findings
- **Approval Record**: Track approval workflow
- **Condemnation History**: View all condemnation records

### Audit Module
- **Generate Yearly Reports**: Total assets, purchase value, category summary
- **Active Assets**: Count of active assets by department
- **Maintenance Assets**: Assets requiring or completed maintenance
- **Condemned Assets**: Count of condemned and disposed assets
- **Export Reports**: PDF and Excel format

## Repository Layout

```text
fabric-supply-chain/
├── blockchain/          (removed - replaced with Fabric)
├── chaincode/           Fabric chaincode (Go/Node.js)
│   └── lib/asset-management.js
├── gateway/             Express API gateway
│   ├── app.js
│   ├── services/
│   │   ├── fabricService.js
│   │   └── authService.js
├── client/              Frontend application
│   ├── index.html
│   ├── app.js
│   └── style.css
├── backend/             MongoDB models, controllers, services
│   ├── controllers/
│   │   ├── departmentController.js
│   │   ├── assetController.js
│   │   ├── maintenanceController.js
│   │   ├── billController.js
│   │   ├── condemnationController.js
│   │   └── reportController.js
│   └── services/
│       └── fabricService.js
├── network/             Hyperledger Fabric network configuration
│   ├── crypto-config/
│   ├── channel-artifacts/
│   ├── connections/
│   └── configtx.yaml
├── docker-compose.yml   Docker Compose for Fabric network
├── MIGRATION_ANALYSIS.md Detailed migration analysis
├── MIGRATION_LOG.md     Migration log
└── README.md
```

## Local Runbook

### Quick Start

```bash
# 1. Generate crypto materials
cd network
cryptogen generate --config=crypto-config.yaml --output=crypto-config

# 2. Create channel artifacts
configtxgen -profile TwoOrgsOrdererGenesis -channelID system-channel -outputBlock channel-artifacts/genesis.block
configtxgen -profile TwoOrgsChannel -channelID assets -outputCreateChannelTx channel-artifacts/assets.tx

# 3. Start Fabric network
docker-compose -f docker-compose.yml up -d

# 4. Install chaincode on peer
docker exec -it am-peer0 bash
cd /opt/gopath/src/github.com/hyperledger/fabric/peer
peer lifecycle chaincode install /opt/gopath/src/github.com/asset-management/chaincode.tar.gz

# 5. Approve and commit chaincode
peer lifecycle chaincode approveformyorg ...
peer lifecycle chaincode commit ...

# 6. Start gateway
cd gateway
npm install
npm start

# 7. Open browser
http://localhost:3000
```

### Demo Credentials
- **Email**: admin@assetmgmt.local
- **Password**: Admin@12345!
- **Role**: Administrator

## API Overview

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login

### Departments
- `GET /departments` - List all departments
- `GET /departments/:id` - Get department details
- `GET /departments/:id/summary` - Get department asset summary
- `POST /departments` - Create department
- `PUT /departments/:id` - Update department
- `DELETE /departments/:id` - Deactivate department

### Assets
- `GET /assets` - List/search assets
- `GET /assets/:assetId` - Get asset details
- `GET /assets/:assetId/history` - Get asset blockchain history
- `POST /assets` - Create new asset
- `PUT /assets/:assetId` - Update asset
- `DELETE /assets/:assetId` - Delete asset

### Maintenance
- `GET /maintenance` - List maintenance records
- `GET /maintenance/:assetId` - Get maintenance history for asset
- `POST /maintenance` - Create maintenance record
- `GET /maintenance/:recordId` - Get maintenance record
- `PUT /maintenance/:recordId` - Update maintenance record

### Bills
- `GET /bills` - List bills
- `GET /bills/:billId` - Get bill details
- `POST /bills` - Upload bill
- `POST /bills/:billId/verify` - Verify bill authenticity
- `PUT /bills/:billId/payment` - Update payment status

### Condemnation
- `GET /condemnation` - List condemnation records
- `GET /condemnation/:recordId` - Get condemnation record
- `POST /condemnation` - Request condemnation
- `PUT /condemnation/:recordId/approve` - Approve condemnation
- `PUT /condemnation/:recordId/reject` - Reject condemnation

### Reports
- `GET /reports` - List reports
- `GET /reports/:reportId` - Get report details
- `GET /reports/:reportId/export` - Export report (PDF/Excel)
- `POST /reports` - Generate yearly report
- `GET /summary/:year` - Get annual summary

## Smart Contract Functions (Chaincode)

- `createAsset()` - Create new asset on blockchain
- `getAsset()` - Retrieve asset from ledger
- `updateAssetStatus()` - Update asset status
- `addMaintenanceRecord()` - Add maintenance to asset
- `requestCondemnation()` - Request asset condemnation
- `approveCondemnation()` - Approve condemnation
- `getAssetHistory()` - Get asset transaction history
- `generateYearlyReport()` - Generate annual report
- `verifyBill()` - Verify bill authenticity

## UI Design

The frontend provides:
- **Dashboard**: KPI cards, charts (pie/bar), recent assets
- **Assets Page**: Search, list, and view asset cards
- **Login Page**: User authentication with demo credentials
- **Responsive Design**: Clean, professional interface

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────▶│  Gateway     │────▶│   Fabric    │
│   (HTML/JS)│     │  (Express)   │     │   Network   │
└─────────────┘     └──────────────┘     └─────────────┘
                           │                      │
                           ▼                      ▼
                   ┌──────────────┐     ┌─────────────┐
                   │   Fabric     │     │   CouchDB   │
                   │ (Ledger)     │     │ (State DB)  │
                   └──────────────┘     └─────────────┘
```

## Data Model

### Department
- `_id`, name, code, description, manager, isActive, timestamps

### Asset
- `assetId`, department, category, name, description, purchaseDate, purchaseValue
- `status`, location, owner, warrantyExpiry, billHash, blockchainTxHash
- `maintenanceRecords`, `condemnationRecord`, timestamps

### MaintenanceRecord
- `recordId`, assetId, technician, maintenanceDate, description, cost, status

### Bill
- `billId`, assetId, vendor, invoiceNumber, amount, documentHash, verified

### CondemnationRecord
- `recordId`, assetId, reason, requestedBy, status, approvedBy, disposalMethod

### AuditReport
- `reportId`, year, totalAssets, totalPurchaseValue, categorySummary, departmentSummary
- activeAssets, maintenanceAssets, condemnedAssets, disposedAssets

## Troubleshooting

- If gateway fails to connect to Fabric, ensure network is running: `docker-compose -f docker-compose.yml up`
- If crypto materials missing, regenerate: `cryptogen generate --config=network/crypto-config.yaml`
- If the gateway cannot reach Fabric, verify the network and chaincode are running

## Project Status

✅ **Completed**
- Hyperledger Fabric network setup
- Chaincode development for asset management
- Complete MongoDB data model redesign
- Backend API development with RBAC
- Frontend UI redesign
- Docker configuration
- Migration documentation

## Documentation

- [Migration Analysis](MIGRATION_ANALYSIS.md)
- [Migration Log](MIGRATION_LOG.md)
- [Architecture](docs/architecture.md)
- [Setup](docs/setup.md)
- [Deployment](docs/deploy.md)