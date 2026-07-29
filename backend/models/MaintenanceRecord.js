const { Schema, model } = require("mongoose");

const maintenanceRecordSchema = new Schema(
  {
    assetId: { type: String, required: true, trim: true },
    recordId: { type: String, required: true, trim: true, unique: true },
    technician: { type: String, required: true, trim: true },
    technicianId: { type: String, trim: true },
    maintenanceDate: { type: Date, required: true },
    description: { type: String, required: true },
    cost: { type: Number, required: true },
    status: {
      type: String,
      required: true,
      enum: ["Pending", "In Progress", "Completed", "Cancelled"]
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium"
    },
    scheduledDate: { type: Date },
    completedDate: { type: Date },
    notes: { type: String, trim: true },
    blockchainTxHash: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

maintenanceRecordSchema.index({ assetId: 1 });
maintenanceRecordSchema.index({ maintenanceDate: 1 });
maintenanceRecordSchema.index({ status: 1 });

module.exports = model("MaintenanceRecord", maintenanceRecordSchema);