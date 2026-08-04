# Security Architecture & Exposure Guidelines

This document details port binding policies, network isolation, private key safety, and administrative security for the centralized Fabric network.

---

## 1. Network Boundary & Port Exposure

To ensure robust enterprise security, **NO administrative interface, database, or Fabric internal service is exposed to the public Internet**.

```text
               PUBLIC INTERNET (0.0.0.0/0)
                           │
                           │  [ALL PORTS BLOCKED BY FIREWALL]
                           ▼
                  ┌─────────────────┐
                  │   Cloud VPS     │
                  └────────┬────────┘
                           │
             PRIVATE VPN SUBNET (100.x.y.z/32)
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
  Peer gRPC (7051)   Orderer gRPC (7050)   Fabric CA (7054)
 [VPN Members Only]  [VPN Members Only]   [VPN Members Only]

  CouchDB (5984)  ────▶ BOUND TO 127.0.0.1 (Local Container Access Only)
  Docker Socket   ────▶ UNBOUND (Internalunix:///var/run/docker.sock)
```

---

## 2. Port Security Matrix

| Service | Container Name | Internal Port | External Public Binding | Private VPN Binding | Protection Level |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Fabric Peer0** | `am-peer0` | 7051 | ❌ BLOCKED | ✅ Allowed (7051) | Authenticated X.509 gRPC |
| **Fabric Orderer** | `am-orderer` | 7050 | ❌ BLOCKED | ✅ Allowed (7050) | Authenticated X.509 gRPC |
| **Fabric CA** | `am-ca` | 7054 | ❌ BLOCKED | ✅ Allowed (7054) | TLS + Admin Auth |
| **CouchDB State DB**| `am-couchdb` | 5984 | ❌ BLOCKED | ❌ Localhost Only (`127.0.0.1`) | Basic Auth + Net Isolation |
| **Docker Daemon** | Host | 2375/2376 | ❌ UNEXPOSED | ❌ UNEXPOSED | Unix Socket Only |

---

## 3. Key & Secret Management Rules

1. **Git Protection**:
   - `network/crypto-config/` and `network/wallet/*.id` containing private key materials (`_sk` / `.pem` files) MUST be present in `.gitignore`.
   - Production passwords, database credentials, and JWT secrets MUST never be committed.

2. **Access Control**:
   - Only authorized developer Tailscale / WireGuard public keys are permitted to join the VPN subnet.
   - Unauthorized machines cannot reach gRPC ports `7051` or `7050`.
