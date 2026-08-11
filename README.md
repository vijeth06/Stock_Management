# Departmental Asset Management System using Hyperledger Fabric

A permissioned blockchain-based application for digitizing departmental asset management and yearly audits. Built on **Hyperledger Fabric v2.5**, providing an enterprise-grade permissioned network for immutable asset tracking.

## What This Project Does

- **Asset Registration**: Register assets on the Fabric ledger with blockchain-backed immutability
- **Bill Management**: Upload bills, generate SHA-256 hashes, and verify authenticity against the ledger
- **Asset Lifecycle Tracking**: Track assets through PURCHASED → ACTIVE → UNDER_MAINTENANCE → NOT_WORKING → CONDEMNATION_REQUESTED → CONDEMNED → DISPOSED
- **Maintenance Management**: Record maintenance activities, costs, and technician details on-chain
- **Condemnation Process**: Request, approve, and track asset condemnation with blockchain auditing
- **Blockchain Audit Trail**: Immutable record of all asset transactions and state changes
- **Verification Proformas**: Four proforma forms (Equipment Verification, Equipment Condemnation, Consumable Verification, Consumable Condemnation)
- **Report Generation**: PDF and Excel exports for audit compliance

## User Roles & RBAC

- **Administrator** — Full system access, user management, department management
- **Department User** — Manage assets in assigned department only; cannot approve condemnations
- **Audit Officer** — View all departments, run verifications, generate audit reports

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Architecture | Hyperledger Fabric v2.5 (Node.js SDK) |
| Chaincode | Node.js (fabric-contract-api v2.5) |
| Backend API | Node.js, Express.js |
| Auth | JWT + bcryptjs |
| Ledger | Fabric Ledger (CouchDB state database) |
| Reporting | PDFKit (PDF), ExcelJS (Excel) |
| Containerization | Docker Compose |

## Repository Layout

```text
stock_management/
├── chaincode/                 Fabric chaincode (v9.0)
│   └── lib/
│       └── asset-management.js   Main smart contract (1571 lines)
├── backend/                   Express API gateway
│   ├── app.js                   Gateway entry point
│   ├── services/
│   │   ├── fabricService.js       Fabric SDK wrapper
│   │   ├── authService.js         JWT + RBAC + user management
│   │   └── reportExportService.js PDF/Excel generation
│   ├── controllers/
│   │   ├── assetController.blockchain.js
│   │   ├── verificationController.js
│   │   ├── consumableController.js
│   │   ├── reportController.js
│   │   └── ... (8 total)
│   ├── middleware/
│   │   └── auth.js               Authentication middleware
│   └── routes/
│       └── index.js              All REST API route definitions
├── client/                    Frontend application (Vanilla JS)
│   ├── index.html
│   ├── app.js
│   └── style.css
├── network/                   Fabric network configuration
│   ├── crypto-config/          MSP certificates
│   ├── channel-artifacts/      Genesis block, channel config
│   ├── connections/
│   │   └── connection-org1.json  Connection profile
│   └── configtx.yaml
├── scripts/                   Deployment, testing, and utility scripts
├── docker-compose.yml         Fabric + gateway services
├── package.json               Root dependencies (tests, axios)
└── README.md                  This file
```

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js v18+ (for gateway/testing)

### Steps

## Quick Start

1. Start services: `docker-compose -f docker-compose.yml up -d`
2. Wait for health: `GET http://localhost:3000/health` → returns `{"status":"ok"}`
3. Login: `POST http://localhost:3000/auth/login` with email `admin@kongu.edu` and password `Admin@123`
4. Open app: `http://localhost:3000` in browser

### Demo Credentials
- **Email**: admin@kongu.edu
- **Password**: Admin@123
- **Role**: Administrator

## API Overview

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user (pending approval) |
| POST | `/auth/login` | User login (returns JWT) |

### Departments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/departments` | List all active departments |
| GET | `/departments/:id` | Get department details |
| GET | `/departments/:id/summary` | Department asset summary |
| POST | `/departments` | Create department (Admin only) |
| PUT | `/departments/:id` | Update department (Admin only) |
| DELETE | `/departments/:id` | Deactivate department (Admin only) |

### Assets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/assets` | List/search assets |
| GET | `/assets/:assetId` | Get asset details |
| GET | `/assets/:assetId/history` | Blockchain history |
| GET | `/assets/:assetId/lifecycle` | Lifecycle events |
| POST | `/assets` | Create new asset |
| PUT | `/assets/:assetId` | Update asset |
| DELETE | `/assets/:assetId` | Delete asset |
| POST | `/transfers` | Transfer asset |
| GET | `/transfers` | List transfers |

### Maintenance
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/maintenance` | List maintenance records |
| GET | `/maintenance/history/:assetId` | History for asset |
| POST | `/maintenance` | Create maintenance record |
| GET | `/maintenance/:recordId` | Get maintenance record |
| PUT | `/maintenance/:recordId` | Update maintenance |

### Bills
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/bills` | List bills |
| GET | `/bills/:billId` | Get bill details |
| POST | `/bills` | Upload bill (multipart) |
| POST | `/bills/:billId/verify` | Verify bill authenticity |
| PUT | `/bills/:billId/payment` | Update payment status |
| GET | `/bills/download` | Download by token |

### Verification Proformas
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/verification/equipment` | Proforma-I: Equipment verification |
| GET | `/verification/equipment` | List equipment verifications |
| GET | `/verification/equipment/:recordId` | Single record |
| POST | `/verification/equipment/condemnation` | Proforma-II: Equipment condemnation |
| GET | `/verification/equipment/condemnation` | List condemnation requests |
| PUT | `/verification/equipment/condemnation/:id/approve` | Approve (Admin/AuditOfficer) |
| POST | `/verification/consumables` | Proforma-III: Consumable verification |
| POST | `/verification/consumables/condemnation` | Proforma-IV: Consumable condemnation |
| PUT | `/verification/consumables/condemnation/:id/approve` | Approve condensation |
| GET | `/proforma/equipment/verification/:recordId/export` | Export PDF/XLSX |

### Consumables
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/consumables` | List consumables |
| GET | `/consumables/:consumableId` | Get consumable |
| POST | `/consumables` | Create consumable |
| POST | `/consumables/:consumableId/consume` | Record consumption |
| POST | `/consumables/:consumableId/purchase` | Record purchase |
| GET | `/consumables/:consumableId/history` | Usage history |
| DELETE | `/consumables/:consumableId` | Delete consumable (Admin) |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Dashboard KPIs + financial summary |
| GET | `/reports` | List reports |
| POST | `/reports` | Generate yearly report |
| GET | `/reports/:reportId/export` | Export report (PDF/Excel) |
| GET | `/summary/:year` | Annual summary |
| GET | `/audit-logs` | Audit trail logs |
| GET | `/users/pending` | Pending users (Admin) |
| GET | `/users` | Active users (Admin) |

## Chaincode Functions (v9.0)

### Asset Management
| Function | Description |
|----------|-------------|
| `CreateAsset` | Register new asset |
| `ReadAsset` | Get asset by ID |
| `UpdateAsset` | Update asset field + lifecycle validation |
| `DeleteAsset` | Remove asset from ledger |
| `TransferAsset` | Transfer ownership |
| `GetAllAssets` | List all assets |
| `GetAssetsByDepartment` | Filter by department |
| `GetAssetHistory` | Full transaction history |
| `GetAssetLifecycle` | Lifecycle events |

### User & Department
| Function | Description |
|----------|-------------|
| `CreateUser` | Register on ledger |
| `ReadUser` | Get user by email |
| `GetAllUsers` | List all users |
| `CreateDepartment` | Create department |
| `GetAllDepartments` | List departments |

### Verification & Condemnation
| Function | Description |
|----------|-------------|
| `CreateEquipmentVerification` | Proforma-I |
| `CreateConsumableVerification` | Proforma-III |
| `CreateEquipmentCondemnation` | Proforma-II |
| `CreateConsumableCondemnation` | Proforma-IV |
| `ApproveCondemnation` | Approve request |
| `GetAllEquipmentCondemnations` | Query II records |
| `GetAllConsumableCondemnations` | Query IV records |

### Consumables
| Function | Description |
|----------|-------------|
| `CreateConsumable` | Register consumable |
| `ReadConsumable` | Get by ID |
| `GetAllConsumables` | List all |
| `RecordConsumableConsumption` | Use stock |
| `RecordConsumablePurchase` | Add stock |
| `UpdateConsumableStock` | Adjust stock |
| `DeleteConsumable` | Remove consumable |

### Lifecycle Validation
```
PURCHASED → ACTIVE → UNDER_MAINTENANCE → NOT_WORKING
    ↓         ↓              ↓               ↓
  DISPOSED  CONDEMNATION_    CONDEMNATION_  CONDEMNATION_
             REQUESTED       REQUESTED      REQUESTED
               ↓               ↓             ↓
            CONDEMNED        CONDEMNED     CONDEMNED
               ↓               ↓             ↓
            DISPOSED         DISPOSED      DISPOSED
```

## Asset Lifecycle States
1. `PURCHASED` — Initial state
2. `ACTIVE` — In use
3. `UNDER_MAINTENANCE` — Being serviced
4. `NOT_WORKING` — Out of order
5. `CONDEMNATION_REQUESTED` — Condemnation initiated
6. `CONDEMNED` — Condemnation approved
7. `DISPOSED` — Terminal state (cannot transition from)

## Testing

The project includes four test suites covering API integration, edge cases, workflow, and end-to-end scenarios:

| Suite | File | Tests |
|-------|------|-------|
| API Integration | `tests/api.test.js` | 11 |
| Proforma Edge Cases | `scripts/test-proforma-edge-cases.js` | 48 |
| Workflow | `scripts/test-proforma-workflow.js` | 29 |
| E2E Comprehensive | `scripts/e2e-full-test.js` | 78 |

### Test Credentials
All tests use:
- **Email**: admin@kongu.edu
- **Password**: Admin@123

## Documentation

- [Architecture](docs/architecture.md) — System architecture overview
- [Folder Structure](docs/folder-structure.md) — Codebase organization
- [Security](docs/security.md) — RBAC, authentication, access control
- [Shared Fabric Architecture](docs/shared-fabric-architecture.md) — Multi-developer shared network setup
- [Team Connection Guide](docs/team-connection.md) — How to connect to the shared Fabric network

## Project Status

✅ **Feature Complete**
- Hyperledger Fabric v2.5 network with CouchDB
- Chaincode v9.0 deployed (49 functions)
- 4 Proforma verification/condemnation workflows
- Consumable stock management (CRUD, consume, purchase)
- Full lifecycle tracking with blockchain validation
- RBAC (Administrator, DepartmentUser, AuditOfficer)
- PDF/Excel export for all proformas
- Dashboard with financial summary
