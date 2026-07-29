const { Schema, model } = require("mongoose");

const equipmentCondemnationItemSchema = new Schema(
  {
    pageNumber: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 0 },
    purchaseDate: { type: Date },
    purchaseValue: { type: Number, default: 0 },
    bookValue: { type: Number, default: 0 },
    reasonForCondemnation: { type: String, trim: true },
    lossDetails: { type: String, trim: true },
    inspectionRemarks: { type: String, trim: true },
    remarks: { type: String, trim: true },
    assetId: { type: String, trim: true }
  },
  { _id: false }
);

const equipmentCondemnationSchema = new Schema(
  {
    recordId: { type: String, required: true, unique: true, trim: true },
    department: { type: String, required: true, trim: true },
    laboratory: { type: String, required: true, trim: true },
    stockBookNumber: { type: String, trim: true },
    verificationDate: { type: Date, required: true },
    staffInCharge: { type: String, required: true, trim: true },
    auditYear: { type: Number },
    auditPeriod: { type: String, trim: true },
    status: { type: String, enum: ["Draft", "Pending", "Approved", "Rejected", "Completed"], default: "Pending" },
    items: { type: [equipmentCondemnationItemSchema], default: [] },
    approvedBy: { type: String, trim: true },
    approvedAt: { type: Date },
    rejectedBy: { type: String, trim: true },
    rejectedAt: { type: Date },
    blockchainTxHash: { type: String, trim: true },
    documentReference: { type: String, trim: true },
    remarks: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

equipmentCondemnationSchema.index({ department: 1, auditYear: 1 });
equipmentCondemnationSchema.index({ verificationDate: -1 });

module.exports = model("EquipmentCondemnation", equipmentCondemnationSchema);
