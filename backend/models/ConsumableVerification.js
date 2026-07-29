const { Schema, model } = require("mongoose");

const consumableVerificationItemSchema = new Schema(
  {
    pageNumber: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    previousStock: { type: Number, default: 0 },
    purchasedQuantity: { type: Number, default: 0 },
    consumedQuantity: { type: Number, default: 0 },
    remainingBookStock: { type: Number, default: 0 },
    actualPhysicalStock: { type: Number, default: 0 },
    difference: { type: Number, default: 0 },
    purchaseValue: { type: Number, default: 0 },
    currentValue: { type: Number, default: 0 },
    workingCondition: { type: String, trim: true },
    remarks: { type: String, trim: true },
    itemId: { type: String, trim: true }
  },
  { _id: false }
);

const consumableVerificationSchema = new Schema(
  {
    recordId: { type: String, required: true, unique: true, trim: true },
    department: { type: String, required: true, trim: true },
    laboratory: { type: String, required: true, trim: true },
    stockBookNumber: { type: String, trim: true },
    verificationDate: { type: Date, required: true },
    staffInCharge: { type: String, required: true, trim: true },
    auditYear: { type: Number },
    auditPeriod: { type: String, trim: true },
    status: { type: String, enum: ["Draft", "Completed", "Archived"], default: "Completed" },
    items: { type: [consumableVerificationItemSchema], default: [] },
    remarks: { type: String, trim: true },
    blockchainTxHash: { type: String, trim: true },
    documentReference: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

consumableVerificationSchema.index({ department: 1, auditYear: 1 });
consumableVerificationSchema.index({ verificationDate: -1 });

module.exports = model("ConsumableVerification", consumableVerificationSchema);
