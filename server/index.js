require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");

const socketConfig = require("./config/socket");


const userRoutes = require("./routes/userRoutes");


const friendRoutes = require("./routes/friendRoutes");
const app = express();

// ===== Middleware =====
app.use(cors());
app.use(express.json());


// ===== Routes =====
const conversationRoutes = require("./routes/conversationRoutes");
const messageRoutes = require("./routes/messageRoutes");

app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);

app.use("/api/friends", friendRoutes);
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