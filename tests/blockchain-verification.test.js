const assert = require('assert');
const fabricService = require('../backend/services/fabricService');

async function main() {
  const requiredMethods = [
    'createEquipmentVerificationOnFabric',
    'getAllEquipmentVerificationsFromFabric',
    'createEquipmentCondemnationOnFabric',
    'getAllEquipmentCondemnationsFromFabric',
    'createConsumableVerificationOnFabric',
    'getAllConsumableVerificationsFromFabric',
    'createConsumableCondemnationOnFabric',
    'getAllConsumableCondemnationsFromFabric'
  ];

  for (const methodName of requiredMethods) {
    assert.strictEqual(typeof fabricService[methodName], 'function', `${methodName} should be exposed`);
  }

  const verificationPayload = {
    recordId: 'EQV-TEST-1',
    department: 'IT',
    auditYear: 2026,
    items: [{ itemId: 'ITEM-1', actualPhysicalStock: 2 }],
    status: 'Completed'
  };

  const verificationRes = await fabricService.createEquipmentVerificationOnFabric(verificationPayload);
  assert.strictEqual(verificationRes.success, true, 'equipment verification should be stored on the ledger');

  const equipmentRecordsRes = await fabricService.getAllEquipmentVerificationsFromFabric();
  assert.strictEqual(equipmentRecordsRes.success, true, 'equipment verification list should be retrievable');
  assert.ok(Array.isArray(equipmentRecordsRes.records), 'equipment verification records should be returned as an array');

  console.log('Verification ledger wrappers are available and storing records correctly.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
