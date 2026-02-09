const Admin = require("../models/admin");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { Attendance } = require("../models/attendance");
const Student = require("../models/student");
const Holiday = require("../models/holiday");
const puppeteer = require("puppeteer");
const fs = require("fs-extra");
const hbs = require("hbs");
const path = require("path");

// Helper to compile the HTML template
const compile = async (templateName, data) => {
  const filePath = path.join(process.cwd(), "templates", `${templateName}.hbs`);
  const html = await fs.readFile(filePath, "utf-8");
  return hbs.compile(html)(data);
};

module.exports.rootRoute = async (req, res) => {
  res.send("Hello Admin");
};

module.exports.loginRoute = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(401).json({ message: "Invalid email" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password." });
    }

    if (!admin.isActive) {
      return res.status(403).json({ message: "Account is disabled." });
    }

    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET || "your_fallback_secret",
      { expiresIn: "7d" },
    );

    res.status(200).json({
      message: `Welcome back, ${admin.name}`,
      token,
      user: {
        id: admin._id,
        name: admin.name,
        role: admin.role,
        email: admin.email,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.getProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await Admin.findById(id);
    res.status(200).json(admin);
  } catch (error) {
    console.error("Get Profile Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.editProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await Admin.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    res.status(200).json(admin);
  } catch (error) {
    console.error("Edit Profile Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.changePassword = async (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body;

    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const admin = await Admin.findById(userId);
    if (!admin) {
      return res.status(404).json({ message: "User not found." });
    }

    const isMatch = await bcrypt.compare(oldPassword, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Old password is incorrect." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    admin.password = hashedPassword;
    await admin.save();

    res.status(200).json({ message: "Password changed successfully." });
  } catch (error) {
    console.error("Change Password Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.addNewTeacher = async (req, res) => {
  try {
    const {
      name,
      email,
      phoneNumber,
      password,
      role,
      department,
      city,
      employeeId,
      assignedClasses,
    } = req.body;

    if (!name || !email || !phoneNumber || !password) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided." });
    }

    const existingAdmin = await Admin.findOne({
      $or: [{ email }, { phoneNumber }],
    });

    if (existingAdmin) {
      return res.status(409).json({
        message: "Admin with this Email or Phone number already exists.",
      });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    let formattedClasses = assignedClasses;
    if (typeof assignedClasses === "string") {
      formattedClasses = assignedClasses.split(",").map((c) => c.trim());
    }

    const newAdmin = await Admin.create({
      name,
      email,
      phoneNumber,
      password: hashedPassword,
      role: role || "TEACHER",
      department,
      city,
      employeeId,
      assignedClasses: formattedClasses,
      isActive: true,
    });

    const adminResponse = newAdmin.toObject();
    delete adminResponse.password;

    res.status(201).json({
      message: "New team member added successfully!",
      data: adminResponse,
    });
  } catch (error) {
    console.error("Add New Teacher Error:", error);

    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "Duplicate entry found (Email or Phone)." });
    }

    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.find({ role: "TEACHER" });
    res.status(200).json(admins);
  } catch (error) {
    console.error("Get All Admins Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.toggleActiveStatus = async (req, res) => {
  try {
    const { id } = req.params; // The ID of the account to toggle
    const { adminId } = req.body; // The ID of the person clicking the button

    // 1. Validate Requester
    if (!adminId) {
      return res.status(400).json({ message: "Requester ID is missing." });
    }

    const requester = await Admin.findById(adminId);
    if (!requester) {
      return res.status(404).json({ message: "Requester not found." });
    }

    // 2. Authorization Check (Must be SUPER_ADMIN)
    if (requester.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        message: "Access Denied. Only Super Admins can manage status.",
      });
    }

    // 3. Prevent Self-Disabling
    if (id === adminId) {
      return res
        .status(400)
        .json({ message: "You cannot disable your own account." });
    }

    // 4. Perform Toggle
    const targetAdmin = await Admin.findById(id);
    if (!targetAdmin) {
      return res.status(404).json({ message: "Target user not found." });
    }

    targetAdmin.isActive = !targetAdmin.isActive;
    await targetAdmin.save();

    res.status(200).json({
      message: `User ${targetAdmin.isActive ? "activated" : "deactivated"} successfully.`,
      data: targetAdmin,
    });
  } catch (error) {
    console.error("Toggle Active Status Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params; // Target ID
    // Check both body and query for adminId (DELETE requests sometimes strip body)
    const adminId = req.body.adminId || req.query.adminId;

    // 1. Validate Requester
    if (!adminId) {
      return res.status(400).json({ message: "Requester ID is missing." });
    }

    const requester = await Admin.findById(adminId);
    if (!requester) {
      return res.status(404).json({ message: "Requester not found." });
    }

    // 2. Authorization Check
    if (requester.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        message: "Access Denied. Only Super Admins can delete users.",
      });
    }

    // 3. Prevent Self-Deletion
    if (id === adminId) {
      return res
        .status(400)
        .json({ message: "You cannot delete your own account." });
    }

    // 4. Perform Delete
    const deletedAdmin = await Admin.findByIdAndDelete(id);

    if (!deletedAdmin) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("Delete Admin Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.getHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.find();
    res.status(200).json(holidays);
  } catch (error) {
    console.error("Get Holidays Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.addHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.create(req.body);
    res.status(200).json(holiday);
  } catch (error) {
    console.error("Add Holiday Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const holiday = await Holiday.findById(id);

    if (!holiday) {
      return res.status(404).json({ message: "Holiday not found." });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (new Date(holiday.date) < today) {
      return res
        .status(400)
        .json({ message: "Cannot delete a holiday that has already passed." });
    }

    await Holiday.findByIdAndDelete(id);
    res.status(200).json(holiday);
  } catch (error) {
    console.error("Delete Holiday Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.getStats = async (req, res) => {
  try {
    const todayStr = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    const attendanceDoc = await Attendance.findById(todayStr);

    let statsData = {
      total: 0,
      present: 0,
      absent: 0,
      leave: 0,
    };

    if (attendanceDoc) {
      statsData.total = attendanceDoc.summary.totalStudents;
      statsData.present = attendanceDoc.summary.presentCount;
      statsData.absent = attendanceDoc.summary.absentCount;
      statsData.leave = attendanceDoc.summary.leaveCount;
    } else {
      try {
        const Student = mongoose.models.Student || mongoose.model("Student");
        if (Student) {
          statsData.total = await Student.countDocuments();
        }
      } catch (err) {
        console.error(err);
      }
    }

    const stats = [
      { title: "Total Students", value: statsData.total },
      { title: "Total Present", value: statsData.present },
      { title: "Total Absent", value: statsData.absent },
      { title: "Total Leave", value: statsData.leave },
    ];

    res.status(200).json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.getAttendanceStats = async (req, res) => {
  try {
    const { viewMode } = req.params;

    if (viewMode === "monthly") {
      const currentYear = new Date().getFullYear();

      const aggregation = await Attendance.aggregate([
        {
          $match: {
            date: {
              $gte: new Date(`${currentYear}-01-01`),
              $lte: new Date(`${currentYear}-12-31`),
            },
          },
        },
        {
          $group: {
            _id: { $month: "$date" },
            average: { $avg: "$summary.attendancePercentage" },
          },
        },
      ]);

      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const stats = monthNames.map((label, index) => {
        const found = aggregation.find((item) => item._id === index + 1);
        return {
          label,
          value: found ? Math.round(found.average) : 0,
        };
      });

      return res.status(200).json(stats);
    } else if (viewMode === "yearly") {
      const aggregation = await Attendance.aggregate([
        {
          $group: {
            _id: { $year: "$date" },
            average: { $avg: "$summary.attendancePercentage" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const stats = aggregation.map((item) => ({
        label: item._id.toString(),
        value: Math.round(item.average),
      }));

      return res.status(200).json(stats);
    }

    return res.status(400).json({ message: "Invalid view mode" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.getGenderStats = async (req, res) => {
  try {
    const stats = await Student.aggregate([
      {
        $group: {
          _id: "$personalInfo.gender",
          value: { $sum: 1 },
        },
      },
      {
        $project: {
          label: "$_id",
          value: 1,
          _id: 0,
        },
      },
    ]);

    res.status(200).json(stats);
  } catch (error) {
    console.error("Get Stats Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.getTopAttendants = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    const totalSchoolDays = await Attendance.countDocuments({
      date: { $gte: startOfMonth, $lte: endOfMonth },
    });

    if (totalSchoolDays === 0) {
      return res.status(200).json([]);
    }

    const topStudents = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      { $unwind: "$records" },
      {
        $match: {
          "records.status": "present",
        },
      },
      {
        $group: {
          _id: "$records.studentId",
          name: { $first: "$records.name" },
          days: { $sum: 1 },
        },
      },
      { $sort: { days: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "students",
          localField: "_id",
          foreignField: "_id",
          as: "studentInfo",
        },
      },
      {
        $project: {
          id: "$_id",
          name: 1,
          days: 1,
          avatar: { $arrayElemAt: ["$studentInfo.image", 0] },
        },
      },
    ]);

    const formattedResult = topStudents.map((student) => ({
      id: student.id,
      name: student.name,
      avatar: student.avatar || "",
      days: student.days,
      percentage: Math.round((student.days / totalSchoolDays) * 100),
    }));

    res.status(200).json(formattedResult);
  } catch (error) {
    console.error("Get Top Attendants Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.getWeeklyAttendance = async (req, res) => {
  try {
    const { viewMode } = req.params;

    const curr = new Date();
    const first = curr.getDate() - curr.getDay() + 1;
    const last = first + 6;

    const startOfWeek = new Date(curr.setDate(first));
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(curr.setDate(last));
    endOfWeek.setHours(23, 59, 59, 999);

    const attendanceRecords = await Attendance.find({
      date: { $gte: startOfWeek, $lte: endOfWeek },
    }).select("date summary");

    const daysMap = {
      1: "Mon",
      2: "Tue",
      3: "Wed",
      4: "Thu",
      5: "Fri",
      6: "Sat",
    };

    const weeklyStats = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
      (day) => ({
        day,
        value: 0,
      }),
    );

    attendanceRecords.forEach((record) => {
      const dayIndex = new Date(record.date).getDay();
      const dayName = daysMap[dayIndex];

      if (dayName) {
        const statsItem = weeklyStats.find((item) => item.day === dayName);
        if (statsItem) {
          const total = record.summary.totalStudents || 1;

          if (viewMode === "present") {
            statsItem.value = record.summary.attendancePercentage;
          } else {
            const absentPct = (record.summary.absentCount / total) * 100;
            statsItem.value = parseFloat(absentPct.toFixed(2));
          }
        }
      }
    });

    res.status(200).json(weeklyStats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.getAllStudents = async (req, res) => {
  try {
    const students = await Student.find({});
    res.status(200).json(students);
  } catch (error) {
    console.error("Get All Students Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.getStudentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await Student.findById(id);
    res.status(200).json(student);
  } catch (error) {
    console.error("Get Student Details Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.editStudentDetails = async (req, res) => {
  try {
    const formData = req.body;
    const student = await Student.findByIdAndUpdate(formData._id, formData, {
      new: true,
      runValidators: true,
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.status(200).json(student);
  } catch (error) {
    console.error("Edit Student Details Error:", error);

    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.rollId) {
        return res.status(409).json({
          message: `Student with Roll Number ${req.body.rollId} already exists.`,
        });
      }
      if (error.keyPattern && error.keyPattern.email) {
        return res.status(409).json({
          message: `Student with Email ${req.body.email} already exists.`,
        });
      }
      return res.status(409).json({ message: "Duplicate entry found." });
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ message: messages[0] });
    }

    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.registerNewStudent = async (req, res) => {
  try {
    const formData = req.body;

    const student = await Student.create(formData);

    res.status(201).json(student);
  } catch (error) {
    console.error("Register New Student Error:", error);

    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.rollId) {
        return res.status(409).json({
          message: `Student with Roll Number ${req.body.rollId} already exists.`,
        });
      }

      if (error.keyPattern && error.keyPattern.email) {
        return res.status(409).json({
          message: `Student with Email ${req.body.email} already exists.`,
        });
      }

      return res.status(409).json({ message: "Duplicate entry found." });
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ message: messages[0] });
    }

    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await Student.findByIdAndDelete(id);
    res.status(200).json(student);
  } catch (error) {
    console.error("Delete Student Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.markAttendance = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { date, attendantId, records } = req.body;

    if (!records || records.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "No attendance records provided" });
    }

    const customId = date;

    const existingAttendance =
      await Attendance.findById(customId).session(session);

    if (existingAttendance) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        success: false,
        message: "Attendance for this date has already been marked.",
      });
    }

    const totalStudents = records.length;
    const presentCount = records.filter((r) => r.status === "present").length;
    const absentCount = records.filter((r) => r.status === "absent").length;
    const leaveCount = records.filter((r) => r.status === "leave").length;

    const attendancePercentage =
      totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(2) : 0;

    const newAttendance = new Attendance({
      _id: customId,
      date: new Date(date),
      attendant: attendantId,
      records: records,
      summary: {
        totalStudents,
        presentCount,
        absentCount,
        leaveCount,
        attendancePercentage,
      },
    });

    const savedAttendance = await newAttendance.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Attendance marked successfully",
      data: savedAttendance,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

module.exports.getAttendance = async (req, res) => {
  try {
    const { date } = req.params;
    const attendance = await Attendance.findById(date).populate(
      "attendant",
      "name email",
    );

    if (!attendance) {
      return res.status(200).json(null);
    }

    res.status(200).json(attendance);
  } catch (error) {
    console.error("Get Attendance Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.generateCertificate = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Fetch Student
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // 2. STRICT VALIDATION: Check for Important Fields
    const missingFields = [];

    if (!student.name) missingFields.push("Name");
    if (!student.personalInfo?.aadharCard) missingFields.push("Aadhar Card");
    if (!student.course) missingFields.push("Course Name");
    if (!student.courseStartDate) missingFields.push("Course Start Date");
    if (!student.courseEndDate) missingFields.push("Course End Date");

    // Check if marks are explicitly null or undefined (since 0 is a valid mark)
    if (student.marks === undefined || student.marks === null)
      missingFields.push("Marks");
    if (!student.grade) missingFields.push("Grade");
    if (!student.attendance) missingFields.push("Attendance");

    // If any fields are missing, stop and alert the frontend
    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Cannot generate certificate. Missing fields: ${missingFields.join(", ")}`,
      });
    }

    // 3. Generate Certificate ID & Update Student Status
    // Format: CERT-YEAR-ROLLID (e.g., CERT-2024-101)
    const certificateId = `CERT-${new Date().getFullYear()}-${student.rollId}`;

    student.certificateId = certificateId;
    student.status = "Completed"; // ✅ Auto-update status to Completed

    await student.save(); // Save changes to DB

    // 4. Prepare Data for Template
    const data = {
      name: student.name,
      course: student.course,
      grade: student.grade,
      certificateId: certificateId,
      startDate: new Date(student.courseStartDate).toLocaleDateString("en-IN"),
      endDate: new Date(student.courseEndDate).toLocaleDateString("en-IN"),
      date: new Date().toLocaleDateString("en-IN"),
    };

    // 5. Generate PDF
    const content = await compile("certificate", data);

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(content);

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
    });

    await browser.close();

    // 6. Send Response
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=Certificate-${student.name}.pdf`,
      "Content-Length": pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error("Generate Certificate Error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};
