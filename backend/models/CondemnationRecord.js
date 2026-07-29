const { Schema, model } = require("mongoose");

const condemnationRecordSchema = new Schema(
  {
    recordId: { type: String, required: true, unique: true, trim: true },
    assetId: { type: String, required: true, trim: true },
    reason: { type: String, required: true, trim: true },
    requestedBy: { type: String, trim: true },
    status: {
      type: String,
      required: true,
      default: "Pending",
      enum: ["Pending", "Approved", "Rejected", "Cancelled"]
    },
    requestedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date },
    approvedBy: { type: String, trim: true },
    rejectedAt: { type: Date },
    rejectedBy: { type: String, trim: true },
    rejectionReason: { type: String, trim: true },
    disposalMethod: { type: String, trim: true },
    disposalDate: { type: Date },
    blockchainTxHash: { type: String, trim: true },
    notes: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

condemnationRecordSchema.index({ assetId: 1 });
condemnationRecordSchema.index({ status: 1 });
condemnationRecordSchema.index({ requestedAt: 1 });

module.exports = model("CondemnationRecord", condemnationRecordSchema);