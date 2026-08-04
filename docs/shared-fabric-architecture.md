# Shared Hyperledger Fabric Network Architecture

## Executive Overview

The Departmental Asset Management and Audit System uses a centralized, single-instance **Hyperledger Fabric v2.5** blockchain network deployed on a Cloud Server / VPS. 

Instead of running separate local Fabric Docker environments on every team member's laptop (which creates isolated, inconsistent ledgers), all team members' local applications connect over a secure private network (Tailscale / WireGuard VPN) to the **SAME central Fabric network**, writing and reading from the **SAME blockchain ledger**.

---

## High-Level Target Architecture

```text
                                CENTRAL CLOUD SERVER / VPS
                        ┌────────────────────────────────────────┐
                        │ Docker Engine & Docker Compose         │
                        │                                        │
                        │ ┌────────────────────────────────────┐ │
                        │ │  Hyperledger Fabric Containers     │ │
                        │ │  - am-peer0 (Peer 0 Org1)          │ │
                        │ │  - am-orderer (Orderer Org)        │ │
                        │ │  - am-ca (Org1 CA)                 │ │
                        │ │  - am-couchdb (Ledger State DB)    │ │
                        │ │  - asset-management (Chaincode)    │ │
                        │ └────────────────────────────────────┘ │
                        │                                        │
                        │  SHARED LEDGER & PERSISTENT VOLUMES    │
                        └───────────────────┬────────────────────┘
                                            │
                                 SECURE PRIVATE VPN NETWORK
                             (Tailscale / WireGuard Subnet)
                                            │
           ┌────────────────────────────────┼────────────────────────────────┐
           │                                │                                │
 ┌───────────────────┐            ┌───────────────────┐            ┌───────────────────┐
 │ Developer A Laptop│            │ Developer B Laptop│            │ Developer C Laptop│
 │ ┌───────────────┐ │            │ ┌───────────────┐ │            │ ┌───────────────┐ │
 │ │Local Frontend │ │            │ │Local Frontend │ │            │ │Local Frontend │ │
 │ └───────┬───────┘ │            │ └───────┬───────┘ │            │ └───────┬───────┘ │
 │         ▼         │            │         ▼         │            │         ▼         │
 │ ┌───────────────┐ │            │ ┌───────────────┐ │            │ ┌───────────────┐ │
 │ │ Local Backend │ │            │ │ Local Backend │ │            │ │ Local Backend │ │
 │ │(Node.js/Exp)  │ │            │ │(Node.js/Exp)  │ │            │ │(Node.js/Exp)  │ │
 │ └───────┬───────┘ │            │ └───────┬───────┘ │            │ └───────┬───────┘ │
 └─────────┼─────────┘            └─────────┼─────────┘            └─────────┼─────────┘
           │                                │                                │
           └────────────────────────────────┴────────────────────────────────┘
                                            │
                                            ▼
                              Fabric Gateway gRPC (7051)
                                            │
                                            ▼
                                  SINGLE SHARED LEDGER
```

---

## Component Responsibilities

| Host Machine | Component | Technology / Runtime | Responsibility |
| :--- | :--- | :--- | :--- |
| **Cloud Server** | `am-peer0` | Hyperledger Fabric Peer 2.5 | Endorses transactions, commits block updates, maintains state database |
| **Cloud Server** | `am-orderer` | Hyperledger Fabric Orderer 2.5 | Packages endorsed transactions into ordered blocks via etcdraft |
| **Cloud Server** | `am-ca` | Hyperledger Fabric CA 1.5 | Issues X.509 identities and certificates for organizations |
| **Cloud Server** | `am-couchdb` | CouchDB 3.2 | Rich query state database for asset state and maintenance history |
| **Cloud Server** | `asset-management` | Node.js Chaincode | Smart contract enforcing business rules (Create, Update, Condemnation, Audit) |
| **Developer Laptop** | Local Frontend | HTML/CSS/JavaScript | User interface for asset management and audit reporting |
| **Developer Laptop** | Local Backend | Express.js API | Authentication, MongoDB metadata, and Fabric Gateway SDK connector |
| **Developer Laptop** | Local MongoDB | MongoDB 7 | Manages user accounts, session state, and local application metadata |

---

## Key Benefits of Centralization

1. **Ledger Consistency**: Every transaction committed by Developer A is immediately visible to Developer B.
2. **Audit Integrity**: Transaction history and block IDs match across all developer testing sessions.
3. **Resource Efficiency**: Developers do not need to run heavy Fabric Docker containers locally.
4. **Simple Onboarding**: New developers only clone the repository, connect to the VPN, and start their local backend.
