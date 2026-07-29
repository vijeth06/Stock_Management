const { Schema, model } = require("mongoose");

const auditLogSchema = new Schema(
  {
    logId: { type: String, required: true, unique: true, trim: true },
    action: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ["ASSET", "MAINTENANCE", "CONDEMNATION", "BILL", "USER", "DEPARTMENT", "REPORT", "AUTH"]
    },
    userId: { type: String, trim: true },
    userEmail: { type: String, trim: true },
    userRole: { type: String, trim: true },
    assetId: { type: String, trim: true },
    department: { type: String, trim: true },
    details: { type: String, trim: true },
    ipAddress: { type: String, trim: true },
    userAgent: { type: String, trim: true },
    blockchainTxHash: { type: String, trim: true },
    timestamp: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

auditLogSchema.index({ timestamp: 1 });
auditLogSchema.index({ category: 1 });
auditLogSchema.index({ assetId: 1 });

module.exports = model("AuditLog", auditLogSchema);