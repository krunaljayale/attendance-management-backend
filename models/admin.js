const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const adminSchema = new Schema(
  {
    name: { type: String, required: true },
    employeeId: { type: String, unique: true, sparse: true },

    phoneNumber: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    avatar: { type: String },

    role: {
      type: String,
      enum: ["SUPER_ADMIN", "TEACHER"],
      default: "TEACHER",
    }, 

    department: { type: String },

    subjects: [{ type: String }],
    assignedClasses: [{ type: String }],

    city: { type: String },

    fcmToken: [String],
    lastLogin: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const Admin = mongoose.model("Admin", adminSchema);
module.exports = Admin;
