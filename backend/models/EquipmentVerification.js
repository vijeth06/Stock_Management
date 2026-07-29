const { Schema, model } = require("mongoose");

const verificationItemSchema = new Schema(
  {
    pageNumber: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    bookStockPreviousYear: { type: Number, default: 0 },
    purchasedDuringYear: { type: Number, default: 0 },
    bookStockCurrentYear: { type: Number, default: 0 },
    actualPhysicalStock: { type: Number, default: 0 },
    difference: { type: Number, default: 0 },
    previousBookValue: { type: Number, default: 0 },
    purchaseValue: { type: Number, default: 0 },
    currentBookValue: { type: Number, default: 0 },
    workingCondition: {
      type: String,
      enum: ["Good Condition", "Working", "Under Maintenance", "Not Working", "Repair Required"],
      default: "Working"
    },
    remarks: { type: String, trim: true },
    assetId: { type: String, trim: true }
  },
  { _id: false }
);

const equipmentVerificationSchema = new Schema(
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
    items: { type: [verificationItemSchema], default: [] },
    remarks: { type: String, trim: true },
    blockchainTxHash: { type: String, trim: true },
    documentReference: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

equipmentVerificationSchema.index({ department: 1, auditYear: 1 });
equipmentVerificationSchema.index({ verificationDate: -1 });

module.exports = model("EquipmentVerification", equipmentVerificationSchema);
