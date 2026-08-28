import { Gateway, Wallets } from 'fabric-network';
import fs from 'fs';
import path from 'path';

const ccpPath = '/app/network/connections/connection-org1.json';
const walletPath = '/app/network/wallet';

const wallet = await Wallets.newFileSystemWallet(walletPath);
const gateway = new Gateway();
await gateway.connect(JSON.parse(fs.readFileSync(ccpPath)), { wallet, identity: 'admin', discovery: { enabled: true, asLocalhost: false } });
const network = await gateway.getNetwork('assets');
const contract = network.getContract('asset-management');

const allRes = await contract.evaluateTransaction('GetAllAssets');
const assets = JSON.parse(allRes.toString());
console.log('Total assets:', assets.length);

for (const asset of assets) {
  try { await contract.submitTransaction('DeleteAsset', asset.assetId); console.log('Deleted:', asset.assetId); }
  catch(e) { console.log('Failed:', asset.assetId, e.message); }
}

const consRes = await contract.evaluateTransaction('GetAllConsumables');
const consumables = JSON.parse(consRes.toString());
console.log('Total consumables:', consumables.length);

for (const cons of consumables) {
  try { await contract.submitTransaction('DeleteConsumable', cons.consumableId); console.log('Deleted:', cons.consumableId); }
  catch(e) { console.log('Failed:', cons.consumableId, e.message); }
}

const afterAssets = JSON.parse((await contract.evaluateTransaction('GetAllAssets')).toString());
const afterCons = JSON.parse((await contract.evaluateTransaction('GetAllConsumables')).toString());
console.log('After cleanup - Assets:', afterAssets.length, 'Consumables:', afterCons.length);

gateway.disconnect();
process.exit(0);
