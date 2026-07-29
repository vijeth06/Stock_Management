const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

async function createWallet() {
  try {
    const walletPath = path.resolve(__dirname, '..', 'network', 'wallet');
    await fs.promises.mkdir(walletPath, { recursive: true });

    const certPath = path.resolve(__dirname, '..', 'network', 'crypto-config', 'peerOrganizations', 'org1.example.com', 'users', 'User1@org1.example.com', 'msp', 'signcerts', 'User1@org1.example.com-cert.pem');
    const keyDir = path.resolve(__dirname, '..', 'network', 'crypto-config', 'peerOrganizations', 'org1.example.com', 'users', 'User1@org1.example.com', 'msp', 'keystore');

    const keyFiles = await fs.promises.readdir(keyDir);
    const keyPath = path.join(keyDir, keyFiles[0]);

    const cert = await fs.promises.readFile(certPath, 'utf8');
    const key = await fs.promises.readFile(keyPath, 'utf8');

    const wallet = await Wallets.newFileSystemWallet(walletPath);
    const identity = {
      credentials: {
        certificate: cert,
        privateKey: key
      },
      mspId: 'Org1MSP',
      type: 'X.509'
    };

    await wallet.put('appUser', identity);
    console.log('appUser identity written to wallet at', walletPath);
  } catch (e) {
    console.error('Failed to create wallet:', e);
    process.exit(1);
  }
}

createWallet();
