/**
 * GroupCallManager — In-memory manager for active group call rooms.
 *
 * Data structures:
 *   activeRooms : Map<roomId, RoomState>
 *   userToRoom  : Map<userId, roomId>   — quick reverse lookup
 *
 * Each RoomState:
 *   { roomId, conversationId, hostUserId, callType,
 *     participants: Map<userId, ParticipantInfo>,
 *     createdAt, maxParticipants }
 */

const crypto = require("crypto");

const DEFAULT_MAX_PARTICIPANTS = 8;

/** @type {Map<string, RoomState>} */
const activeRooms = new Map();

/** @type {Map<string, string>} userId → roomId */
const userToRoom = new Map();

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

const generateRoomId = () => `room_${crypto.randomBytes(8).toString("hex")}`;

const makeParticipant = (userId, socketId) => ({
  userId: String(userId),
  socketId: String(socketId),
  joinedAt: new Date().toISOString(),
  isMuted: false,
  isVideoOff: false,
});

// ─────────────────────────────────────────────────
// Core API
// ─────────────────────────────────────────────────

/**
 * Create a new group call room.
 * The creator automatically becomes the host and first participant.
 */
function createRoom(conversationId, hostUserId, socketId, callType, maxParticipants) {
  // If there's already an active room for this conversation, return it
  const existingRoom = getRoomByConversation(conversationId);
  if (existingRoom) {
    // Auto-join host if not already in
    if (!existingRoom.participants.has(String(hostUserId))) {
      existingRoom.participants.set(String(hostUserId), makeParticipant(hostUserId, socketId));
      userToRoom.set(String(hostUserId), existingRoom.roomId);
    }
    return existingRoom;
  }

  // Check if user is already in another room
  const currentRoomId = userToRoom.get(String(hostUserId));
  if (currentRoomId) {
    leaveRoom(currentRoomId, hostUserId);
  }

  const roomId = generateRoomId();
  const room = {
    roomId,
    conversationId: String(conversationId),
    hostUserId: String(hostUserId),
    callType: callType === "video" ? "video" : "audio",
    participants: new Map(),
    createdAt: new Date().toISOString(),
    maxParticipants: Math.min(Math.max(Number(maxParticipants) || DEFAULT_MAX_PARTICIPANTS, 2), 10),
  };

  room.participants.set(String(hostUserId), makeParticipant(hostUserId, socketId));
  activeRooms.set(roomId, room);
  userToRoom.set(String(hostUserId), roomId);

  return room;
}

/**
 * Join an existing room. Returns { room, isNew } or throws.
 */
function joinRoom(roomId, userId, socketId) {
  const room = activeRooms.get(roomId);
  if (!room) {
    const err = new Error("Room not found");
    err.code = "ROOM_NOT_FOUND";
    throw err;
  }

  const uid = String(userId);

  // Already in this room? Just update socketId
  if (room.participants.has(uid)) {
    const participant = room.participants.get(uid);
    const previousSocketId = participant.socketId;
    participant.socketId = String(socketId);
    return {
      room,
      isNew: false,
      socketChanged: String(previousSocketId || "") !== String(socketId || ""),
    };
  }

  // Room full?
  if (room.participants.size >= room.maxParticipants) {
    const err = new Error("Room is full");
    err.code = "ROOM_FULL";
    throw err;
  }

  // Leave any other room first
  const currentRoomId = userToRoom.get(uid);
  if (currentRoomId && currentRoomId !== roomId) {
    leaveRoom(currentRoomId, uid);
  }

  room.participants.set(uid, makeParticipant(uid, socketId));
  userToRoom.set(uid, roomId);

  return { room, isNew: true, socketChanged: false };
}

/**
 * Remove a user from a room. Returns the remaining participants array or null if room was deleted.
 */
function leaveRoom(roomId, userId) {
  const room = activeRooms.get(roomId);
  if (!room) return null;

  const uid = String(userId);
  room.participants.delete(uid);

  if (userToRoom.get(uid) === roomId) {
    userToRoom.delete(uid);
  }

  // Room empty → cleanup
  if (room.participants.size === 0) {
    activeRooms.delete(roomId);
    return null;
  }

  // Host left → transfer to earliest joiner
  if (room.hostUserId === uid) {
    let earliestJoin = null;
    let newHost = null;

    for (const [pUid, pInfo] of room.participants) {
      if (!earliestJoin || pInfo.joinedAt < earliestJoin) {
        earliestJoin = pInfo.joinedAt;
        newHost = pUid;
      }
    }

    if (newHost) {
      room.hostUserId = newHost;
    }
  }

  return getParticipantsArray(roomId);
}

/**
 * Host kicks a user from the room.
 */
function kickUser(roomId, hostUserId, targetUserId) {
  const room = activeRooms.get(roomId);
  if (!room) {
    const err = new Error("Room not found");
    err.code = "ROOM_NOT_FOUND";
    throw err;
  }

  if (String(room.hostUserId) !== String(hostUserId)) {
    const err = new Error("Only the host can kick users");
    err.code = "NOT_HOST";
    throw err;
  }

  if (String(hostUserId) === String(targetUserId)) {
    const err = new Error("Cannot kick yourself");
    err.code = "SELF_KICK";
    throw err;
  }

  const target = room.participants.get(String(targetUserId));
  if (!target) {
    const err = new Error("User not in room");
    err.code = "USER_NOT_IN_ROOM";
    throw err;
  }

  const targetSocketId = target.socketId;
  leaveRoom(roomId, targetUserId);

  return { targetSocketId, remaining: getParticipantsArray(roomId) };
}

/**
 * Update a participant's media state (muted / video off).
 */
function updateParticipantMedia(roomId, userId, updates) {
  const room = activeRooms.get(roomId);
  if (!room) return null;

  const participant = room.participants.get(String(userId));
  if (!participant) return null;

  if (typeof updates.isMuted === "boolean") {
    participant.isMuted = updates.isMuted;
  }
  if (typeof updates.isVideoOff === "boolean") {
    participant.isVideoOff = updates.isVideoOff;
  }

  return participant;
}

// ─────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────

function getRoom(roomId) {
  return activeRooms.get(roomId) || null;
}

function getRoomByConversation(conversationId) {
  for (const room of activeRooms.values()) {
    if (room.conversationId === String(conversationId)) {
      return room;
    }
  }
  return null;
}

function getParticipantsArray(roomId) {
  const room = activeRooms.get(roomId);
  if (!room) return [];

  return Array.from(room.participants.values());
}

function isUserInRoom(userId) {
  return userToRoom.has(String(userId));
}

function getUserRoomId(userId) {
  return userToRoom.get(String(userId)) || null;
}

/**
 * Cleanup user from any room by socketId (used on disconnect).
 * Returns { roomId, userId, remaining } or null.
 */
function cleanupBySocketId(socketId) {
  for (const [roomId, room] of activeRooms) {
    for (const [uid, participant] of room.participants) {
      if (participant.socketId === socketId) {
        const remaining = leaveRoom(roomId, uid);
        return { roomId, userId: uid, remaining, conversationId: room.conversationId };
      }
    }
  }
  return null;
}

/**
 * Serialize room for client consumption.
 */
function serializeRoom(room) {
  if (!room) return null;
  return {
    roomId: room.roomId,
    conversationId: room.conversationId,
    hostUserId: room.hostUserId,
    callType: room.callType,
    participants: Array.from(room.participants.values()),
    createdAt: room.createdAt,
    maxParticipants: room.maxParticipants,
  };
}

module.exports = {
  createRoom,
  joinRoom,
  leaveRoom,
  kickUser,
  updateParticipantMedia,
  getRoom,
  getRoomByConversation,
  getParticipantsArray,
  isUserInRoom,
  getUserRoomId,
  cleanupBySocketId,
  serializeRoom,
};
