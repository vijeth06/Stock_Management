# Hyperledger Fabric Network & Protocol Specifications

Detailed reference for network ports, MSP structure, chaincode, channel parameters, and containers.

---

## 1. Network Topology & Identities

- **Organizations**:
  - `Org1` (`Org1MSP`) — Department & Asset Management Org
  - `OrdererOrg` (`OrdererMSP`) — Consensus & Ordering Service Org
- **Peers**:
  - `peer0.org1.example.com` (gRPC Port: 7051)
- **Orderer**:
  - `orderer.example.com` (gRPC Port: 7050, Consensus: etcdraft)
- **Certificate Authority**:
  - `ca_org1` (HTTP/REST Port: 7054)
- **State Database**:
  - `am-couchdb` (Port: 5984, restricted to internal/VPN access)

---

## 2. Channel Configuration

- **Channel Name**: `assets`
- **Profiles**:
  - `TwoOrgsOrdererGenesis` (Orderer genesis block generation)
  - `TwoOrgsChannel` (Application channel transaction creation)
- **Policies**:
  - Application Readers: `ANY Readers`
  - Application Writers: `ANY Writers`
  - Application Admins: `MAJORITY Admins`

---

## 3. Chaincode Details

- **Chaincode Name**: `asset-management`
- **Language**: JavaScript / Node.js
- **Location**: `chaincode/lib/asset-management.js`
- **Supported Transactions**:
  - `InitLedger(ctx)`
  - `CreateAsset(ctx, assetId, department, category, name, purchaseDate, purchaseValue, location, owner, warrantyExpiry, billHash)`
  - `ReadAsset(ctx, assetId)`
  - `UpdateAsset(ctx, assetId, field, newValue)`
  - `DeleteAsset(ctx, assetId)`
  - `AddMaintenanceRecord(ctx, assetId, technician, date, description, cost, status)`
  - `RequestCondemnation(ctx, assetId, reason, requestedBy)`
  - `ApproveCondemnation(ctx, assetId, approvedBy)`
  - `GenerateYearlyReport(ctx, year)`
  - `VerifyBill(ctx, billId, expectedHash)`
  - `GetAssetHistory(ctx, assetId)`
