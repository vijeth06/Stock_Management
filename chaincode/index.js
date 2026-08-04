const { Shim } = require('fabric-shim');
const AssetManagementContract = require('./lib/asset-management');

module.exports.AssetManagementContract = AssetManagementContract;
module.exports.contracts = [AssetManagementContract];

Shim.start(new AssetManagementContract());
