const mongoose = require("mongoose");
const { Schema } = mongoose;

const AttendanceRecordSchema = new Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    name: { type: String, required: true },
    rollNo: { type: String, required: true },
    status: {
      type: String,
      enum: ["present", "absent", "leave"],
      required: true,
    },
  },
  { _id: false },
);

const AttendanceSchema = new Schema(
  {
    _id: { type: String, required: true }, // Custom ID: "YYYY-MM-DD"
    date: { type: Date, required: true, index: true },
    attendant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    records: [AttendanceRecordSchema],
    summary: {
      totalStudents: { type: Number, default: 0 },
      presentCount: { type: Number, default: 0 },
      absentCount: { type: Number, default: 0 },
      leaveCount: { type: Number, default: 0 },
      attendancePercentage: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

// Check if model exists to prevent overwrite in development
const Attendance =
  mongoose.models.Attendance || mongoose.model("Attendance", AttendanceSchema);

// Export using CommonJS syntax
module.exports = { Attendance };
