const { Schema, model } = require("mongoose");

const departmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    manager: {
      type: Schema.Types.Mixed
    },
    assetCount: { type: Number, default: 0 },
    totalAssetValue: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);


module.exports = model("Department", departmentSchema);