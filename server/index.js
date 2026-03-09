require("dotenv").config();

const express = require("express");
const cors = require("cors");

const userRoutes = require("./routes/userRoutes");
const groupRoutes = require("./routes/groupRoutes");

const app = express();

// ===== Middleware =====
app.use(cors());
app.use(express.json());

// ===== Routes =====
app.use("/api/users", userRoutes);
app.use("/api/groups", groupRoutes);

// ===== Health check =====
app.get("/", (req, res) => {
  res.send("API is running...");
});

// ===== Start server =====
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});