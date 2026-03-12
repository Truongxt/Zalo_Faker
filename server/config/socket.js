const { Server } = require("socket.io");

module.exports = (socketConfig) => {

  const io = new Server(socketConfig, {
    cors: { origin: "*" }
  });

  return io;
};