# Production Deployment Guide

## Prerequisites

### System Requirements
- **OS**: Linux (Ubuntu 20.04+), macOS 12+, Windows Server 2019+
- **CPU**: 4+ cores
- **RAM**: 8GB minimum (16GB recommended)
- **Disk**: 50GB+ free space
- **Node.js**: v20.x
- **Docker**: v24.x
- **Docker Compose**: v2.24.x

### Ports Required
| Port | Service |
|------|---------|
| 3000 | Gateway API |
| 8545 | Hardhat JSON-RPC |
| 8546 | Hardhat WebSocket |
| 1883 | MQTT Broker |
| 27017 | MongoDB |
| 9001 | MQTT WebSocket |

---

## Deployment Methods

### Option 1: Docker Compose (Recommended)

#### 1. Clone Repository
```bash
git clone https://github.com/vijeth06/Supplychain_management_Blockchain.git
cd fabric-supply-chain
```

#### 2. Create Environment File
```bash
cp .env.example .env
```

#### 3. Edit .env
```bash
# Required
JWT_SECRET=your-secure-random-secret-here
MONGO_URI=mongodb://admin:password@mongodb:27017/supplychain?authSource=admin

# Optional (for email notifications)
EMAIL_HOST=smtp.yourdomain.com
EMAIL_PORT=587
EMAIL_USER=alerts@yourdomain.com
EMAIL_PASS=your-email-password
```

#### 4. Deploy
```bash
docker-compose up -d
```

#### 5. Deploy Smart Contract
```bash
docker-compose exec hardhat-deploy bash -c "npx hardhat run scripts/deploy.js --network localhost"
```

#### 6. Update Contract Address
```bash
# Copy the deployed address and update gateway/.env
echo "CONTRACT_ADDRESS=0x..." >> gateway/.env
```

#### 7. Restart Gateway
```bash
docker-compose restart gateway
```

---

### Option 2: Manual Deployment

#### 1. Install Dependencies
```bash
# Install system packages
sudo apt-get update
sudo apt-get install -y curl git build-essential

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node -v  # v20.x
npm -v   # Latest version
```

#### 2. Clone and Install
```bash
git clone https://github.com/vijeth06/Supplychain_management_Blockchain.git
cd fabric-supply-chain

# Install gateway dependencies
cd gateway
npm install --production
cd ..

# Install blockchain dependencies
cd blockchain
npm install --production
cd ..
```

#### 3. Configure Environment
```bash
cp .env.example .env
nano .env  # Edit with your values
```

#### 4. Start MongoDB
```bash
# Option A: Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Option B: Use Docker for MongoDB only
docker run -d --name mongodb -p 27017:27017 -v mongodb_data:/data/db mongo:7
```

#### 5. Start Hardhat Node
```bash
cd blockchain
npx hardhat node &
```

#### 6. Deploy Contract
```bash
npx hardhat run scripts/deploy.js --network localhost
```

#### 7. Start Gateway
```bash
cd ../gateway
npm start
```

---

## Reverse Proxy Setup (Nginx)

### Install Nginx
```bash
sudo apt-get install -y nginx
```

### Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/supplychain
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # HTTP -> HTTPS redirect
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws/ {
        proxy_pass http://localhost:8546;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

### Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/supplychain /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## SSL Certificate (Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Production Configuration

### Environment Variables
```bash
# Required
PORT=3000
RPC_URL=http://localhost:8545
CONTRACT_ADDRESS=0xDeployedContractAddress
PRIVATE_KEY=0xAccountPrivateKey
MONGO_URI=mongodb://admin:password@localhost:27017/supplychain?authSource=admin
JWT_SECRET=$(openssl rand -hex 32)

# Optional
MQTT_URL=mqtt://localhost:1883
EMAIL_HOST=smtp.yourdomain.com
EMAIL_PORT=587
EMAIL_USER=alerts@yourdomain.com
EMAIL_PASS=your-password
```

### Security Hardening
1. **Change default private key** - Use a dedicated account with limited funds
2. **Enable MongoDB authentication** - Set MONGO_INITDB_ROOT_USERNAME and PASSWORD
3. **Use HTTPS** - Always deploy behind reverse proxy with SSL
4. **Rate limiting** - Implement nginx rate limiting
5. **Firewall** - Only expose necessary ports

---

## Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

### Log Files
```bash
# Gateway logs
docker logs sc-gateway

# MongoDB logs
docker logs sc-mongodb

# Hardhat logs
docker logs sc-hardhat

# MQTT logs
docker logs sc-mosquitto
```

### Monitoring Tools
- **Prometheus + Grafana**: For metrics
- **PM2**: For process management
- **Logrotate**: For log rotation

### PM2 Setup
```bash
npm install -g pm2

# Start gateway
pm2 start gateway/app.js --name "supplychain-gateway"

# Save process list
pm2 save

# Setup startup
pm2 startup
```

---

## Backup Strategy

### MongoDB Backup
```bash
# Create backup
docker exec sc-mongodb mongodump --archive=/dump/backup.archive --gzip

# Restore backup
docker exec sc-mongodb mongorestore --archive=/dump/backup.archive --gzip
```

### Smart Contract
- Contract code is in `blockchain/contracts/`
- ABI is in `blockchain/artifacts/`
- Deployment script in `blockchain/scripts/deploy.js`

---

## Scaling

### Horizontal Scaling
```yaml
# docker-compose.yml additions
  gateway-replica:
    image: node:20
    deploy:
      replicas: 3
    # ... rest of config
```

### Vertical Scaling
- Increase container resources in Docker
- Add MongoDB replica set
- Use load balancer for multiple gateway instances

---

## Troubleshooting

### Common Issues

**Gateway won't start**
```bash
# Check logs
docker logs sc-gateway

# Check if ports are in use
netstat -tlnp | grep :3000
```

**MongoDB connection failed**
```bash
# Check if MongoDB is running
docker ps | grep mongodb

# Test connection
docker exec sc-mongodb mongosh --eval "db.adminCommand('ping')"
```

**Contract not deployed**
```bash
# Check Hardhat node
curl http://localhost:8545

# Redeploy
docker-compose exec hardhat-deploy npx hardhat run scripts/deploy.js --network localhost
```

**MQTT connection issues**
```bash
# Check if Mosquitto is running
docker ps | grep mosquitto

# Test connection
mosquitto_pub -h localhost -t "test" -m "hello"
```

---

## Maintenance

### Updates
```bash
# Pull latest changes
git pull origin main

# Rebuild containers
docker-compose build

# Restart services
docker-compose up -d
```

### Database Maintenance
```bash
# Compact database
docker exec sc-mongodb mongosh --eval "db.runCommand({compact: 'products'})"

# Re-index
docker exec sc-mongodb mongosh --eval "db.products.reIndex()"
```

### Log Rotation
```bash
# Add to crontab
crontab -e

# Daily log rotation
0 0 * * * /usr/bin/find /var/log -name "*.log" -mtime +7 -exec rotate {} \;
```

---

## Support

For issues and questions:
- GitHub Issues: https://github.com/Kilo-Org/kilocode/issues
- Documentation: See docs/ directory
- Email: support@chaintrack.io