if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const connectDB = require("./config/dbConfig");
const app = express();
const cors = require("cors");
const PORT = process.env.PORT;
const DBURL = process.env.DBURL;
app.use(express.json());
app.use(cors());

const admin = require("./routes/admin");

app.use("/admin", admin);

app.get("/", (req, res) => {
  try {
    res.status(200).json({ message: "Hello World" });
  } catch (error) {
    console.log("Server Error at root route");
    res.status(500).json({ message: "Server Error" });
  }
});

const start = async () => {
  await connectDB(DBURL);
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

start();
