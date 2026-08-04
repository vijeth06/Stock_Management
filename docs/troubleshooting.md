# Troubleshooting & Diagnostic Guide

Common connection issues, resolution steps, and diagnostic procedures for the central Hyperledger Fabric setup.

---

## 1. Gateway Connection Errors

### Problem: `Failed to connect to peer: connection refused` or `ECONNREFUSED`
- **Cause**: Fabric containers are not running on the cloud server, or VPN connection is inactive.
- **Resolution**:
  1. Check VPN status: `tailscale status` (verify green status to cloud server).
  2. Ping cloud server VPN IP: `ping 100.x.y.z`.
  3. Verify central Fabric containers are active on cloud server: `docker ps`.

### Problem: `Discovery Service failed to return endpoints`
- **Cause**: Client attempted localhost discovery while connecting remotely.
- **Resolution**:
  Set `FABRIC_DISCOVERY_AS_LOCALHOST=false` in `gateway/.env`.

---

## 2. Certificate & Identity Errors

### Problem: `Identity appUser not found in wallet`
- **Cause**: Wallet directory `network/wallet/` is empty or missing `.id` file.
- **Resolution**:
  Run `./scripts/enroll-team-member.sh appUser` to initialize default wallet identity.

### Problem: `access denied for channel [assets]`
- **Cause**: Certificate MSP ID mismatch or outdated crypto materials.
- **Resolution**:
  Verify `FABRIC_MSP_ID=Org1MSP` in `gateway/.env`.

---

## 3. Useful Health Check Commands

```bash
# Test gRPC port accessibility from developer laptop over VPN
nc -zv <CLOUD_VPN_IP> 7051

# View peer container logs on cloud server
docker logs -f am-peer0

# Check channel membership on peer container
docker exec am-peer0 peer channel list
```
