const { Schema, model } = require("mongoose");

const assetSchema = new Schema(
  {
    assetId: { type: String, required: true, unique: true, trim: true },
    department: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    purchaseDate: { type: Date, required: true },
    purchaseValue: { type: Number, required: true },
    status: {
      type: String,
      required: true,
      default: "Active",
      enum: ["Active", "Maintenance", "Condemned", "Disposed", "Retired", "Condemnation Requested"]
    },
    location: { type: String, trim: true },
    owner: { type: String, trim: true },
    warrantyExpiry: { type: Date },
    billHash: { type: String, trim: true },
    billDocument: { type: String, trim: true },
    blockchainTxHash: { type: String, trim: true },
    maintenanceRecords: [{
      recordId: { type: String },
      technician: { type: String, trim: true },
      maintenanceDate: { type: Date },
      description: { type: String },
      cost: { type: Number },
      status: { type: String, enum: ["Pending", "In Progress", "Completed", "Cancelled"] },
      createdAt: { type: Date, default: Date.now }
    }],
    maintenanceCount: { type: Number, default: 0 },
    condemnationRecord: {
      recordId: { type: String },
      reason: { type: String },
      requestedBy: { type: String, trim: true },
      status: { type: String, enum: ["Pending", "Approved", "Rejected"] },
      requestedAt: { type: Date },
      approvedAt: { type: Date },
      approvedBy: { type: String, trim: true }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

assetSchema.index({ department: 1, status: 1 });
assetSchema.index({ category: 1 });
assetSchema.index({ status: 1 });
assetSchema.index({ "condemnationRecord.status": 1 });

module.exports = model("Asset", assetSchema);