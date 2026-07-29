const { Schema, model } = require("mongoose");

const billSchema = new Schema(
  {
    billId: { type: String, required: true, unique: true, trim: true },
    assetId: { type: String, trim: true },
    vendor: { type: String, trim: true },
    invoiceNumber: { type: String, trim: true },
    invoiceDate: { type: Date },
    amount: { type: Number },
    taxAmount: { type: Number },
    totalAmount: { type: Number },
    currency: { type: String, default: "INR" },
    paymentDueDate: { type: Date },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Overdue", "Cancelled"],
      default: "Pending"
    },
    documentPath: { type: String, trim: true },
    documentHash: { type: String, trim: true },
    blockchainTxHash: { type: String, trim: true },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    verifiedBy: { type: String, trim: true },
    verificationHash: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

billSchema.index({ assetId: 1 });
billSchema.index({ paymentStatus: 1 });
billSchema.index({ documentHash: 1 });

module.exports = model("Bill", billSchema);