# Cloud VPS Deployment Guide — Hyperledger Fabric

This guide covers setting up and running the shared Hyperledger Fabric network on a Linux / Ubuntu VPS or dedicated cloud server.

---

## 1. Prerequisites on Cloud Server

- **OS**: Ubuntu 22.04 LTS / 24.04 LTS (or Debian/CentOS Linux)
- **CPU / RAM**: Minimum 2 vCPUs, 4GB RAM (8GB recommended)
- **Disk**: 20GB+ SSD storage
- **Docker Engine**: v24.0+
- **Docker Compose**: v2.20+
- **Private Network / VPN**: Tailscale or WireGuard

---

## 2. Server Setup Instructions

### Step 1: Install Docker & Docker Compose
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git jq build-essential

# Install Docker Engine
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Verify Docker installation
docker --version
docker compose version
```

### Step 2: Install VPN (Tailscale Recommended)
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```
Note the Tailscale IP address assigned to the cloud server (e.g., `100.x.y.z`).

---

## 3. Fabric Network Deployment

### Step 1: Clone Repository
```bash
git clone <your-repository-url>
cd Stock_Management-main
```

### Step 2: Make Scripts Executable
```bash
chmod +x scripts/*.sh
```

### Step 3: Launch Central Fabric Network
```bash
./scripts/start-central-fabric.sh
```

### Step 4: Verify Container Health
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected containers running:
- `am-peer0` (Peer 0 Org1)
- `am-orderer` (Orderer)
- `am-ca` (CA Org1)
- `am-couchdb` (CouchDB State DB)

---

## 4. Operational Commands

### Start Network
```bash
./scripts/start-central-fabric.sh
```

### Safe Shutdown (Preserves Blockchain Ledger)
```bash
./scripts/stop-central-fabric.sh
```

### View Peer Logs
```bash
docker logs -f am-peer0
```

### Destructive Reset (⚠ CAUTION)
> [!CAUTION]
> This command will permanently delete all blockchain data and CouchDB state.
```bash
docker compose -f docker-compose-central-fabric.yml down -v
rm -rf network/crypto-config network/channel-artifacts network/wallet/*.id
```
