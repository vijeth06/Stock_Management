const { Schema, model } = require("mongoose");

const auditReportSchema = new Schema(
  {
    reportId: { type: String, required: true, unique: true, trim: true },
    auditDate: { type: Date, required: true },
    year: { type: Number, required: true },
    totalAssets: { type: Number, default: 0 },
    totalPurchaseValue: { type: Number, default: 0 },
    categorySummary: {
      type: Map,
      of: {
        count: { type: Number },
        totalValue: { type: Number }
      }
    },
    departmentSummary: {
      type: Map,
      of: {
        count: { type: Number },
        totalValue: { type: Number }
      }
    },
    activeAssets: { type: Number, default: 0 },
    maintenanceAssets: { type: Number, default: 0 },
    condemnedAssets: { type: Number, default: 0 },
    disposedAssets: { type: Number, default: 0 },
    retiredAssets: { type: Number, default: 0 },
    auditOfficer: { type: String, trim: true },
    auditPeriod: { type: String, trim: true },
    blockchainVerified: { type: Boolean, default: false },
    blockchainTxHash: { type: String, trim: true },
    documentPath: { type: String, trim: true },
    status: {
      type: String,
      enum: ["Draft", "Completed", "Archived"],
      default: "Draft"
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

auditReportSchema.index({ year: 1 });
auditReportSchema.index({ auditDate: 1 });
auditReportSchema.index({ status: 1 });

module.exports = model("AuditReport", auditReportSchema);