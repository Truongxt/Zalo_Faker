const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const getPresenceLabel = (
  status?: string | null,
  lastSeen?: string | null,
) => {
  if (String(status || "").toLowerCase() === "online") {
    return "Đang hoạt động";
  }

  if (!lastSeen) {
    return "Ngoại tuyến";
  }

  const lastSeenMs = new Date(lastSeen).getTime();
  const diffMs = Date.now() - lastSeenMs;

  if (!Number.isFinite(lastSeenMs) || diffMs < 0) {
    return "Ngoại tuyến";
  }

  if (diffMs < HOUR_MS) {
    return `Offline ${Math.max(1, Math.floor(diffMs / MINUTE_MS))} phút trước`;
  }

  if (diffMs < DAY_MS) {
    return `Offline ${Math.floor(diffMs / HOUR_MS)} giờ trước`;
  }

  return `Offline ${Math.floor(diffMs / DAY_MS)} ngày trước`;
};
