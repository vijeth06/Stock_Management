const { Schema, model } = require("mongoose");

const consumableCondemnationItemSchema = new Schema(
  {
    pageNumber: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 0 },
    bookStock: { type: Number, default: 0 },
    actualStock: { type: Number, default: 0 },
    difference: { type: Number, default: 0 },
    purchaseDate: { type: Date },
    bookValue: { type: Number, default: 0 },
    condemnationReason: { type: String, trim: true },
    lossDetails: { type: String, trim: true },
    remarks: { type: String, trim: true },
    itemId: { type: String, trim: true }
  },
  { _id: false }
);

const consumableCondemnationSchema = new Schema(
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
    items: { type: [consumableCondemnationItemSchema], default: [] },
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

consumableCondemnationSchema.index({ department: 1, auditYear: 1 });
consumableCondemnationSchema.index({ verificationDate: -1 });

module.exports = model("ConsumableCondemnation", consumableCondemnationSchema);
