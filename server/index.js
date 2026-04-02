require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");

const socketConfig = require("./config/socket");


const userRoutes = require("./routes/userRoutes");
const friendRoutes = require("./routes/friendRoutes");
const aiRoutes = require("./routes/aiRoutes");
const app = express();
const groupRoutes = require("./routes/groupRoutes");
// ===== Middleware =====
app.use(cors());
app.use(express.json());


// ===== Routes =====
const conversationRoutes = require("./routes/conversationRoutes");
const messageRoutes = require("./routes/messageRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const labelRoutes = require("./routes/labelRoutes");

app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/groups", groupRoutes); 
app.use("/api/ai", aiRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/labels", labelRoutes);
// ===== Health check =====
app.get("/", (req, res) => {
  res.send("API is running...");
});

// ===== Create HTTP server =====
const server = http.createServer(app);

// ===== Socket.IO =====
const io = socketConfig(server);



// ===== Start server =====
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});