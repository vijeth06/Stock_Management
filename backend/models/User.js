const { Schema, model } = require("mongoose");

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ["Administrator", "DepartmentUser", "AuditOfficer"]
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: function() {
        return this.role === "DepartmentUser";
      }
    },
    isActive: { type: Boolean, default: true },
    isApproved: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["PendingApproval", "Approved", "Rejected"],
      default: "PendingApproval"
    },
    lastLoginAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date }
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ department: 1 });

module.exports = model("User", userSchema);