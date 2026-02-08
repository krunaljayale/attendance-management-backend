const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    rollId: {
      type: Number,
      required: true,
      unique: true,
    },
    image: {
      type: String,
    },
    personalInfo: {
      aadharCard: {
        type: String,
        unique: true,
        sparse: true,
      },
      dob: {
        type: Date,
        required: true,
      },
      gender: {
        type: String,
        enum: ["Male", "Female", "Other"],
      },
      bloodGroup: {
        type: String,
      },
      casteCategory: {
        type: String,
      },
    },
    guardianDetails: {
      fatherName: {
        type: String,
      },
      motherName: {
        type: String,
      },
      primaryPhone: {
        type: String,
        required: true,
      },
      secondaryPhone: {
        type: String,
      },
      address: {
        street: String,
        city: String,
        state: String,
        pincode: String,
      },
    },
    course: {
      type: String,
      required: true,
    },
    courseStartDate: {
      type: Date,
    },
    courseEndDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["Active", "Completed", "Dropped", "Suspended"],
      default: "Active",
    },
    attendance: {
      type: String,
      default: "0%",
    },
    grade: {
      type: String,
    },
    marks: {
      type: Number,
    },
    certificateId: {
      type: String,
    },
    documents: {
      aadharFront: String,
      aadharBack: String,
      previousMarksheet: String,
    },
    registrarId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  },
);

studentSchema.index({
  name: "text",
  email: "text",
});

module.exports = mongoose.model("Student", studentSchema);
