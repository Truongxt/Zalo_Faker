require("dotenv").config();
const swaggerUi = require("swagger-ui-express");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { connectRedis } = require("./utils/redisClient");
const socketConfig = require("./config/socket");
const { setSocketIO } = require("./utils/socketEmitter");


const userRoutes = require("./routes/userRoutes");

const groupRoutes = require("./routes/groupRoutes");
const momentRoutes = require("./routes/momentRoutes");
const notificationRoutes = require("./routes/notificationRoutes");


const friendRoutes = require("./routes/friendRoutes");
const aiRoutes = require("./routes/aiRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const labelRoutes = require("./routes/labelRoutes");
const app = express();

// ===== Middleware =====
app.use(cors());
app.use(express.json());


// ===== Routes =====
const conversationRoutes = require("./routes/conversationRoutes");
const messageRoutes = require("./routes/messageRoutes");
const swaggerSpec = require("./config/swagger");

app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);

app.use("/api/friends", friendRoutes);
app.use("/api/groups", groupRoutes); 
app.use("/api/moments", momentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/labels", labelRoutes);
// ===== Health check =====
app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ===== Create HTTP server =====
const server = http.createServer(app);

// ===== Socket.IO =====
const io = socketConfig(server);
app.set("io", io);



// ===== Start server =====
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
(async () => {
  await connectRedis();
})();
server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
