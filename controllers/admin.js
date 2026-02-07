const Admin = require("../models/admin");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Student = require("../models/student");

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

module.exports.getStats = async (req, res) => {
  try {
    const stats = [
      { title: "Total Students", value: 100 },
      { title: "Total Present", value: 80 },
      { title: "Total Absent", value: 15 },
      { title: "Total Leave", value: 5 },
    ];
    res.status(200).json(stats);
  } catch (error) {
    console.error("Get Stats Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.getAttendanceStats = async (req, res) => {
  try {
    const { viewMode } = req.params;
    if (viewMode === "monthly") {
      const stats = [
        { label: "Jan", value: 87 },
        { label: "Feb", value: 78 },
        { label: "Mar", value: 65 },
        { label: "Apr", value: 55 },
        { label: "May", value: 50 },
        { label: "Jun", value: 45 },
        { label: "Jul", value: 40 },
        { label: "Aug", value: 35 },
        { label: "Sep", value: 30 },
        { label: "Oct", value: 25 },
        { label: "Nov", value: 20 },
        { label: "Dec", value: 15 },
      ];
      return res.status(200).json(stats);
    } else if (viewMode === "yearly") {
      const stats = [
        { label: "2020", value: 1 },
        { label: "2021", value: 78 },
        { label: "2022", value: 65 },
        { label: "2023", value: 55 },
        { label: "2024", value: 50 },
        { label: "2025", value: 45 },
      ];
      return res.status(200).json(stats);
    }
  } catch (error) {
    console.error("Get Stats Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.getGenderStats = async (req, res) => {
  try {
    const stats = [
      { label: "Male", value: 62 },
      { label: "Female", value: 38 },
    ];
    res.status(200).json(stats);
  } catch (error) {
    console.error("Get Stats Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.getTopAttendants = async (req, res) => {
  try {
    const attendants = [
      {
        id: "1",
        name: "Jacob Zachary",
        avatar:
          "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60",
        percentage: 98,
        days: 28,
      },
      {
        id: "2",
        name: "Hannah Sarah",
        avatar:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=60",
        percentage: 95,
        days: 27,
      },
      {
        id: "3",
        name: "Megan Alyssa",
        avatar:
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&auto=format&fit=crop&q=60",
        percentage: 92,
        days: 26,
      },
      {
        id: "4",
        name: "Lauren Rachel",
        avatar:
          "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&auto=format&fit=crop&q=60",
        percentage: 89,
        days: 25,
      },
      {
        id: "5",
        name: "Abby Victoria",
        avatar:
          "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&auto=format&fit=crop&q=60",
        percentage: 85,
        days: 24,
      },
    ];

    res.status(200).json(attendants);
  } catch (error) {
    console.error("Get Top Attendants Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports.getWeeklyAttendance = async (req, res) => {
  try {
    const { viewMode } = req.params;

    let weeklyStats = [];

    if (viewMode === "present") {
      weeklyStats = [
        { day: "Mon", value: 85 },
        { day: "Tue", value: 78 },
        { day: "Wed", value: 92 },
        { day: "Thu", value: 88 },
        { day: "Fri", value: 75 },
        { day: "Sat", value: 82 },
      ];
    } else {
      weeklyStats = [
        { day: "Mon", value: 15 },
        { day: "Tue", value: 22 },
        { day: "Wed", value: 8 },
        { day: "Thu", value: 12 },
        { day: "Fri", value: 25 },
        { day: "Sat", value: 18 },
      ];
    }

    res.status(200).json(weeklyStats);
  } catch (error) {
    console.error("Get Weekly Stats Error:", error);
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
