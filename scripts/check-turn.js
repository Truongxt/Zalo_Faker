#!/usr/bin/env node

const dgram = require("dgram");
const dns = require("dns/promises");
const net = require("net");

const host = process.argv[2] || process.env.TURN_HOST || "taklo.duckdns.org";
const port = Number(process.argv[3] || process.env.TURN_PORT || 3478);
const timeoutMs = Number(process.argv[4] || process.env.TURN_TIMEOUT_MS || 6000);

const createStunBindingRequest = () => {
  const msg = Buffer.alloc(20);
  msg.writeUInt16BE(0x0001, 0);
  msg.writeUInt16BE(0, 2);
  msg.writeUInt32BE(0x2112a442, 4);

  for (let i = 8; i < 20; i += 1) {
    msg[i] = Math.floor(Math.random() * 256);
  }

  return msg;
};

const checkTcp = (address) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host: address, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, detail: "timeout" });
    }, timeoutMs);

    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ ok: true, detail: "connected" });
    });

    socket.once("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, detail: error.message });
    });
  });

const checkUdpStun = (address) =>
  new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    const request = createStunBindingRequest();

    const timer = setTimeout(() => {
      socket.close();
      resolve({ ok: false, detail: "timeout" });
    }, timeoutMs);

    socket.once("message", (data, rinfo) => {
      clearTimeout(timer);
      const type = data.length >= 2
        ? `0x${data.readUInt16BE(0).toString(16).padStart(4, "0")}`
        : "unknown";
      socket.close();
      resolve({
        ok: true,
        detail: `response ${type}, ${data.length} bytes from ${rinfo.address}:${rinfo.port}`,
      });
    });

    socket.once("error", (error) => {
      clearTimeout(timer);
      socket.close();
      resolve({ ok: false, detail: error.message });
    });

    socket.send(request, port, address);
  });

const main = async () => {
  const { address } = await dns.lookup(host);
  console.log(`TURN host: ${host}:${port} -> ${address}`);

  const [tcp, udp] = await Promise.all([
    checkTcp(address),
    checkUdpStun(address),
  ]);

  console.log(`TCP ${port}: ${tcp.ok ? "OK" : "FAILED"} (${tcp.detail})`);
  console.log(`UDP ${port}: ${udp.ok ? "OK" : "FAILED"} (${udp.detail})`);

  if (!tcp.ok || !udp.ok) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
