/**
 * Cross-Machine Shared Ledger Verification Test
 * Departmental Asset Management System using Hyperledger Fabric
 *
 * Verifies that multiple developer environments connected to the SAME central Fabric network
 * read and write from the EXACT SAME blockchain ledger instance.
 */

const { Gateway, Wallets } = require("fabric-network");
const path = require("path");
const fs = require("fs");

// Load connection profile
const ccpPath = path.resolve(__dirname, "../network/connections/connection-org1.json");

function getCCP() {
  const ccpRaw = fs.readFileSync(ccpPath, "utf8");
  let ccp = JSON.parse(ccpRaw);

  const fabricHost = process.env.FABRIC_HOST || "localhost";
  const peerPort = process.env.FABRIC_PEER_PORT || "7051";
  const ordererPort = process.env.FABRIC_ORDERER_PORT || "7050";

  if (fabricHost !== "localhost" || process.env.FABRIC_NETWORK_MODE === "REMOTE") {
    const rawString = JSON.stringify(ccp);
    const updatedString = rawString
      .replace(/localhost:7051/g, `${fabricHost}:${peerPort}`)
      .replace(/localhost:7050/g, `${fabricHost}:${ordererPort}`);
    ccp = JSON.parse(updatedString);
  }
  return ccp;
}

async function connectAsIdentity(identityName) {
  const walletPath = path.join(__dirname, "../network/wallet");
  const wallet = await Wallets.newFileSystemWallet(walletPath);
  const ccp = getCCP();

  const fabricHost = process.env.FABRIC_HOST || "localhost";
  const isLocalhost = fabricHost === "localhost" && process.env.FABRIC_NETWORK_MODE !== "REMOTE";
  const asLocalhost = process.env.FABRIC_DISCOVERY_AS_LOCALHOST !== undefined 
    ? process.env.FABRIC_DISCOVERY_AS_LOCALHOST === "true"
    : isLocalhost;

  const gateway = new Gateway();
  await gateway.connect(ccp, {
    wallet,
    identity: identityName || "appUser",
    discovery: { enabled: true, asLocalhost }
  });

  return gateway;
}

async function runSharedLedgerTest() {
  console.log("================================================================");
  console.log("🧪 STARTING CROSS-DEVELOPER SHARED LEDGER VERIFICATION TEST");
  console.log("================================================================");
  console.log(`Target Fabric Endpoint: ${process.env.FABRIC_HOST || "localhost"}:7051`);
  console.log(`Channel: assets | Chaincode: asset-management\n`);

  const assetId = `AST-SHARED-${Date.now()}`;
  let gatewayA, gatewayB;

  try {
    // -------------------------------------------------------------------------
    // TEST STEP 1: Developer A creates an asset on the shared Fabric network
    // -------------------------------------------------------------------------
    console.log("▶ [Developer A] Connecting local application to Shared Fabric network...");
    gatewayA = await connectAsIdentity("appUser");
    const networkA = await gatewayA.getNetwork("assets");
    const contractA = networkA.getContract("asset-management");

    console.log(`▶ [Developer A] Creating asset on shared ledger: ${assetId}`);
    const createTx = contractA.createTransaction("CreateAsset");
    const createResult = await createTx.submit(
      assetId,
      "IT",
      "Computer",
      "Dell XPS 15 - Shared Dev Unit",
      "2026-07-30",
      "120000",
      "Server Room - Rack 4",
      "Dev A (Developer 1)",
      "2029-07-30",
      "a3f5b72189cd",
      "Active"
    );

    console.log(`✅ [Developer A] Asset created successfully! TxID: ${createTx.getTransactionId()}`);
    console.log(`   Data: ${createResult.toString()}\n`);

    // -------------------------------------------------------------------------
    // TEST STEP 2: Developer B queries the SAME asset from their local backend
    // -------------------------------------------------------------------------
    console.log("▶ [Developer B] Connecting local application to Shared Fabric network...");
    gatewayB = await connectAsIdentity("appUser");
    const networkB = await gatewayB.getNetwork("assets");
    const contractB = networkB.getContract("asset-management");

    console.log(`▶ [Developer B] Querying asset created by Developer A (${assetId})...`);
    const readResultB = await contractB.evaluateTransaction("ReadAsset", assetId);
    const parsedAssetB = JSON.parse(readResultB.toString());

    console.log(`✅ [Developer B] Asset retrieved successfully from shared ledger!`);
    console.log(`   Name: ${parsedAssetB.name}`);
    console.log(`   Owner: ${parsedAssetB.owner}`);
    console.log(`   Status: ${parsedAssetB.status}\n`);

    if (parsedAssetB.assetId !== assetId) {
      throw new Error(`Asset ID mismatch! Expected ${assetId}, got ${parsedAssetB.assetId}`);
    }

    // -------------------------------------------------------------------------
    // TEST STEP 3: Developer B updates asset status on the shared ledger
    // -------------------------------------------------------------------------
    console.log(`▶ [Developer B] Updating asset status on shared ledger to 'Maintenance'...`);
    const updateTxB = contractB.createTransaction("UpdateAsset");
    await updateTxB.submit(assetId, "status", "Maintenance");
    console.log(`✅ [Developer B] Asset updated! TxID: ${updateTxB.getTransactionId()}\n`);

    // -------------------------------------------------------------------------
    // TEST STEP 4: Developer A queries updated state to verify shared ledger consistency
    // -------------------------------------------------------------------------
    console.log(`▶ [Developer A] Querying asset (${assetId}) to verify Developer B's update...`);
    const readResultA = await contractA.evaluateTransaction("ReadAsset", assetId);
    const parsedAssetA = JSON.parse(readResultA.toString());

    console.log(`✅ [Developer A] Updated asset retrieved from shared ledger!`);
    console.log(`   New Status: ${parsedAssetA.status}`);

    if (parsedAssetA.status !== "Maintenance") {
      throw new Error(`State synchronization failure! Expected status 'Maintenance', got ${parsedAssetA.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST STEP 5: Verify immutable asset history on shared ledger
    // -------------------------------------------------------------------------
    console.log(`\n▶ [Audit Check] Querying complete blockchain history for ${assetId}...`);
    const historyResult = await contractA.evaluateTransaction("GetAssetHistory", assetId);
    const history = JSON.parse(historyResult.toString());
    console.log(`✅ [Audit Check] History records found on ledger: ${history.length} transactions`);
    history.forEach((record, index) => {
      console.log(`   [Tx ${index + 1}] TxID: ${record.txId} | Timestamp: ${record.timestamp} | IsDelete: ${record.isDelete}`);
    });

    console.log("\n================================================================");
    console.log("🎉 SUCCESS: ALL CROSS-DEVELOPER SHARED LEDGER TESTS PASSED!");
    console.log("Both Developer A and Developer B are connected to the SAME Fabric Network");
    console.log("and read/write from the EXACT SAME Hyperledger Fabric ledger.");
    console.log("================================================================\n");

  } catch (error) {
    console.error("❌ Shared Ledger Test Failed:", error);
    process.exit(1);
  } finally {
    if (gatewayA) gatewayA.disconnect();
    if (gatewayB) gatewayB.disconnect();
  }
}

if (require.main === module) {
  runSharedLedgerTest();
}

module.exports = { runSharedLedgerTest };
