const express = require("express");
const {
  rootRoute,
  loginRoute,
  getStats,
  getAttendanceStats,
  getGenderStats,
  getTopAttendants,
  getWeeklyAttendance,
  getAllStudents,
  getStudentDetails,
  editStudentDetails,
  registerNewStudent,
  getProfile,
  editProfile,
  addNewTeacher,
  getAllAdmins,
  toggleActiveStatus,
  deleteAdmin,
  deleteStudent,
  changePassword,
  getHolidays,
  addHoliday,
  deleteHoliday,
  markAttendance,
  getAttendance,
  generateCertificate,
} = require("../controllers/admin");
const { protect, restrictTo } = require("../utils/AuthMiddleware");
const router = express.Router();

router.get("/", rootRoute);
router.post("/login", loginRoute);
router.use(protect);
router.get("/get-profile/:id", getProfile);
router.put("/edit-profile/:id", editProfile);
router.put("/change-password",changePassword);
router.post("/add-new-teacher",restrictTo("SUPER_ADMIN"), addNewTeacher);
router.get("/get-all-admins",restrictTo("SUPER_ADMIN"), getAllAdmins);
router.put("/toggle-active-status/:id",restrictTo("SUPER_ADMIN"), toggleActiveStatus);
router.delete("/delete-admin/:id",restrictTo("SUPER_ADMIN"), deleteAdmin);
router.get("/get-holidays",getHolidays);
router.post("/add-holiday",restrictTo("SUPER_ADMIN"),addHoliday);
router.delete("/delete-holiday/:id",restrictTo("SUPER_ADMIN"),deleteHoliday);
router.get("/get-stats", getStats);
router.get("/get-attendance-stats/:viewMode", getAttendanceStats);
router.get("/get-gender-stats", getGenderStats);
router.get("/get-top-attendants", getTopAttendants);
router.get("/get-weekly-attendance/:viewMode", getWeeklyAttendance);
router.get("/get-all-students", getAllStudents);
router.get("/get-student/:id", getStudentDetails);
router.put("/edit-student-details", editStudentDetails);
router.post("/register-new-student", registerNewStudent);
router.delete("/delete-student/:id",restrictTo("SUPER_ADMIN"), deleteStudent);
router.post("/mark-attendance",markAttendance);
router.get("/get-attendance/:date",getAttendance);
router.get("/generate-certificate/:id",generateCertificate);

module.exports = router;
