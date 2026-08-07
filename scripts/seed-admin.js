const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

async function seedAdmin() {
    const ccpPath = '/app/network/connections/connection-org1.json';
    const walletPath = '/app/network/wallet';
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    
    const gateway = new Gateway();
    try {
        await gateway.connect(ccp, {
            wallet,
            identity: 'admin',
            discovery: { enabled: false, asLocalhost: false }
        });
        console.log('Connected to Fabric');
        
        const network = await gateway.getNetwork('assets');
        const contract = network.getContract('asset-management');
        
        const timestamp = new Date().toISOString();
        const passwordHash = '$2a$10$dummyhashplaceholder';
        
        const result = await contract.submitTransaction(
            'CreateUser',
            'usr-demo-admin',
            'Demo Administrator',
            'admin@kongu.edu',
            passwordHash,
            'Administrator',
            'ALL',
            'All Departments',
            'Active',
            'true'
        );
        
        console.log('Admin user created:', result.toString());
    } catch(err) {
        console.log('Error:', err.message);
    } finally {
        gateway.disconnect();
    }
    process.exit(0);
}

seedAdmin();