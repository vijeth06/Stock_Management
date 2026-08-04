# Identity & Wallet Management Guide

This document describes Fabric MSP X.509 identity allocation, wallet format, certificate authority, and attribution across team members.

---

## 1. Identity Architecture

Hyperledger Fabric requires X.509 PKI digital certificates to authenticate client applications submitting transactions to peers.

```text
                  Org1 Certificate Authority (ca-org1)
                                 │
           ┌─────────────────────┴─────────────────────┐
           ▼                                           ▼
   User Identity: devUserA                     User Identity: devUserB
   - Certificate (X.509)                       - Certificate (X.509)
   - Private Key (secp256r1)                   - Private Key (secp256r1)
   - MSP ID: Org1MSP                           - MSP ID: Org1MSP
           │                                           │
   Stored in Developer A                       Stored in Developer B
   Local Wallet (devUserA.id)                  Local Wallet (devUserB.id)
```

---

## 2. Wallet Identity Format (`.id` File)

The SDK uses `FileSystemWallet` to store identity objects as JSON files in `network/wallet/`:

```json
{
  "credentials": {
    "certificate": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----\n",
    "privateKey": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
  },
  "mspId": "Org1MSP",
  "type": "X.509",
  "version": 1
}
```

---

## 3. Creating Unique Identity per Developer

Run `./scripts/enroll-team-member.sh <developer_id>`:

```bash
# Developer A
./scripts/enroll-team-member.sh devA

# Developer B
./scripts/enroll-team-member.sh devB
```

Then specify `FABRIC_IDENTITY=devA` in Developer A's `gateway/.env`, and `FABRIC_IDENTITY=devB` in Developer B's `gateway/.env`.

This ensures transaction attribution on the shared ledger records the specific identity making the change.
