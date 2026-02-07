const jwt = require("jsonwebtoken");
const Admin = require("../models/admin");

// 1. Verify Token exists and is valid
module.exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // FETCH USER FROM DB TO BE SURE (don't just trust the token payload if roles change often)
      req.user = await Admin.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({ message: "User not found" });
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

// 2. Role Restriction Middleware (THE SECURITY FIX)
module.exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // req.user is set by the 'protect' middleware above
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to perform this action",
      });
    }
    next();
  };
};
