const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

async function commitChaincode() {
    const mspPath = '/workspace/network/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp';
    const walletPath = '/workspace/network/wallet';
    const ccpPath = '/workspace/network/connections/connection-org1.json';
    
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    
    // Create admin identity in wallet if not exists
    const adminIdentityPath = path.join(mspPath, 'signcerts', 'cert.pem');
    const adminPrivateKeyPath = path.join(mspPath, 'keystore', 'key.txt');
    
    // Try to get appUser first
    let appUserExists = await wallet.get('appUser');
    
    const gateway = new Gateway();
    
    try {
        console.log('Connecting to gateway...');
        await gateway.connect(JSON.parse(fs.readFileSync(ccpPath)), {
            wallet,
            identity: 'appUser',
            discovery: { enabled: false, asLocalhost: true }
        });
        console.log('Connected!');
        
        const network = await gateway.getNetwork('assets');
        const contract = network.getContract('asset-management');
        
        console.log('Trying to query channel...');
        
        // Try to check if chaincode is already committed
        try {
            const result = await contract.evaluateTransaction('GetAllAssets');
            console.log('Chaincode is working! Assets:', result.toString());
        } catch(e) {
            console.log('Chaincode query failed:', e.message);
        }
        
    } catch(err) {
        console.log('Connection error:', err.message);
    } finally {
        gateway.disconnect();
    }
}

commitChaincode().catch(console.error);