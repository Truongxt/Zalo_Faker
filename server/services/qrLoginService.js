const crypto = require("crypto");
const { safeGet, safeSet, safeDel } = require("../utils/redisClient");
const userService = require("./userService");

const QR_LOGIN_TTL_SECONDS = 120;
const QR_LOGIN_CONSUMED_TTL_SECONDS = 30;
const KEY_PREFIX = "auth:qr-login:";

const buildSessionKey = (sessionId) => `${KEY_PREFIX}${String(sessionId || "")}`;

const randomToken = (size = 24) => crypto.randomBytes(size).toString("hex");

const parseStoredSession = (raw) => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch (_err) {
    return null;
  }
};

const getRemainingTtlSeconds = (expiresAtIso) => {
  const expiresAt = new Date(expiresAtIso).getTime();
  if (!Number.isFinite(expiresAt)) return 0;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
};

const qrLoginService = {
  createSession: async () => {
    const sessionId = randomToken(12);
    const confirmCode = randomToken(18);
    const pollToken = randomToken(18);
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + QR_LOGIN_TTL_SECONDS * 1000).toISOString();

    const payload = {
      sessionId,
      confirmCode,
      pollToken,
      createdAt,
      expiresAt,
      status: "pending",
      consumed: false,
    };

    await safeSet(
      buildSessionKey(sessionId),
      JSON.stringify(payload),
      { EX: QR_LOGIN_TTL_SECONDS },
    );

    return {
      sessionId,
      pollToken,
      qrCodeValue: `taklo://qr-login?sid=${encodeURIComponent(sessionId)}&code=${encodeURIComponent(confirmCode)}`,
      expiresAt,
      expiresIn: QR_LOGIN_TTL_SECONDS,
    };
  },

  getSessionStatus: async ({ sessionId, pollToken }) => {
    const normalizedSessionId = String(sessionId || "").trim();
    const normalizedPollToken = String(pollToken || "").trim();

    if (!normalizedSessionId || !normalizedPollToken) {
      throw new Error("sessionId and pollToken are required");
    }

    const stored = parseStoredSession(await safeGet(buildSessionKey(normalizedSessionId)));
    if (!stored) {
      return { status: "expired" };
    }

    if (stored.pollToken !== normalizedPollToken) {
      throw new Error("Invalid session");
    }

    if (getRemainingTtlSeconds(stored.expiresAt) <= 0) {
      await safeDel(buildSessionKey(normalizedSessionId));
      return { status: "expired" };
    }

    if (stored.status === "pending") {
      return {
        status: "pending",
        expiresAt: stored.expiresAt,
      };
    }

    if (stored.status === "confirmed" && !stored.consumed) {
      const next = {
        ...stored,
        consumed: true,
        consumedAt: new Date().toISOString(),
      };
      await safeSet(
        buildSessionKey(normalizedSessionId),
        JSON.stringify(next),
        { EX: Math.max(1, Math.min(QR_LOGIN_CONSUMED_TTL_SECONDS, getRemainingTtlSeconds(stored.expiresAt))) },
      );

      return {
        status: "confirmed",
        expiresAt: stored.expiresAt,
        auth: stored.auth,
      };
    }

    return {
      status: stored.status === "confirmed" ? "consumed" : stored.status,
      expiresAt: stored.expiresAt,
    };
  },

  confirmSession: async ({ sessionId, confirmCode, userId, deviceInfo, ipAddress }) => {
    const normalizedSessionId = String(sessionId || "").trim();
    const normalizedConfirmCode = String(confirmCode || "").trim();
    const normalizedUserId = String(userId || "").trim();

    if (!normalizedSessionId || !normalizedConfirmCode) {
      throw new Error("sessionId and confirmCode are required");
    }
    if (!normalizedUserId) {
      throw new Error("userId is required");
    }

    const key = buildSessionKey(normalizedSessionId);
    const stored = parseStoredSession(await safeGet(key));
    if (!stored) {
      throw new Error("QR session expired");
    }

    if (stored.status !== "pending") {
      throw new Error("QR session is no longer available");
    }

    if (getRemainingTtlSeconds(stored.expiresAt) <= 0) {
      await safeDel(key);
      throw new Error("QR session expired");
    }

    if (stored.confirmCode !== normalizedConfirmCode) {
      throw new Error("Invalid QR code");
    }

    const loginResult = await userService.loginByUserId(normalizedUserId, {
      platform: "web",
      deviceInfo: deviceInfo || "QR Login",
      ipAddress: ipAddress || "Unknown",
    });

    const nextPayload = {
      ...stored,
      status: "confirmed",
      confirmedAt: new Date().toISOString(),
      confirmedByUserId: normalizedUserId,
      auth: loginResult,
      consumed: false,
    };

    await safeSet(
      key,
      JSON.stringify(nextPayload),
      { EX: Math.max(1, getRemainingTtlSeconds(stored.expiresAt)) },
    );

    return {
      message: "QR login confirmed",
      user: loginResult.user,
    };
  },
};

module.exports = qrLoginService;
