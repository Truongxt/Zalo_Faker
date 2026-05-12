const conversationService = require("../services/conversationService");
const messageService = require("../services/messageService");
const userRepository = require("../repository/userRepository");
const { summarizeTodayConversation } = require("../services/aiService");

const getRequesterId = (req) => req.user?.userId;

const getUsername = async (userId) => {
    if (!userId) return "User";
    try {
        const user = await userRepository.getById(userId);
        return user?.fullName || user?.userName || userId;
    } catch (e) {
        return userId;
    }
};

const createSystemMessage = async (req, conversationId, actionText, extraMetadata = {}) => {
    try {
        const actorName = await getUsername(getRequesterId(req));
        const text = `${actorName} ${actionText}`;

        const payload = {
            conversationId,
            senderId: 'system',
            type: 'system',
            content: text,
            metadata: { isAnnouncement: true, ...extraMetadata }
        };
        const message = await messageService.createMessage(payload);
        const normalizedMessage = { ...message, id: message._id };

        await conversationService.updateConversation(conversationId, {
            lastMessage: {
                content: `[Thông báo] ${text}`,
                type: "text",
                senderId: 'system',
                timestamp: message.createdAt,
            },
        });

        const io = req.app.get("io");
        if (io) {
            io.to(`conv:${conversationId}`).emit("chat:message", normalizedMessage);
            io.to(conversationId).emit("chat:message", normalizedMessage);
        }
    } catch (e) {
        console.error("Emit private system message error:", e);
    }
};

const normalizeParticipantMuteState = (participant = {}) => {
    const normalized = { ...participant };

    if (!normalized.isMuted) {
        return {
            participant: { ...normalized, isMuted: false, muteUntil: null },
            changed: normalized.isMuted !== false || normalized.muteUntil != null
        };
    }

    if (!normalized.muteUntil) {
        return {
            participant: { ...normalized, isMuted: true, muteUntil: null },
            changed: normalized.muteUntil !== null && normalized.muteUntil !== undefined
        };
    }

    const muteUntilTs = Date.parse(normalized.muteUntil);
    if (!Number.isFinite(muteUntilTs)) {
        return { participant: normalized, changed: false };
    }

    if (muteUntilTs <= Date.now()) {
        return {
            participant: { ...normalized, isMuted: false, muteUntil: null },
            changed: true
        };
    }

    const isoMuteUntil = new Date(muteUntilTs).toISOString();
    return {
        participant: { ...normalized, isMuted: true, muteUntil: isoMuteUntil },
        changed: normalized.muteUntil !== isoMuteUntil
    };
};

const normalizeConversationMuteState = (conversation) => {
    if (!conversation?.participants) {
        return { conversation, changed: false };
    }

    let changed = false;
    const participants = conversation.participants.map((participant) => {
        const normalized = normalizeParticipantMuteState(participant);
        if (normalized.changed) changed = true;
        return normalized.participant;
    });

    return {
        conversation: changed ? { ...conversation, participants } : conversation,
        changed
    };
};

const persistNormalizedConversation = async (conversation) => {
    const normalized = normalizeConversationMuteState(conversation);
    if (!normalized.changed || !conversation?._id) {
        return normalized.conversation;
    }

    await conversationService.updateConversation(conversation._id, {
        participants: normalized.conversation.participants
    });

    return normalized.conversation;
};

const populateParticipants = async (conversations) => {
    const isArray = Array.isArray(conversations);
    const convList = isArray ? conversations : [conversations];

    const userIds = new Set();
    convList.forEach((conversation) => {
        if (conversation.participants) {
            conversation.participants.forEach((participant) => userIds.add(String(participant.userId)));
        }
    });

    const userMap = {};
    await Promise.all(
        Array.from(userIds).map(async (uid) => {
            const user = await userRepository.getById(uid);
            if (user) {
                userMap[uid] = {
                    fullName: user.fullName || user.userName || "Người dùng",
                    avatarUrl: user.avatarUrl || user.avartarUrl || null,
                    status: user.presenceStatus || "offline",
                    userId: String(uid)
                };
            }
        })
    );

    convList.forEach((conversation) => {
        if (conversation.participants) {
            conversation.participants = conversation.participants.map((participant) => ({
                ...participant,
                ...(userMap[String(participant.userId)] || {})
            }));
        }
    });

    return isArray ? convList : convList[0];
};

const normalizeConversationPinnedSettings = (settings = {}, conversationType = "private") => {
    const isObjectSettings = settings && typeof settings === "object" && !Array.isArray(settings)
        ? settings
        : {};

    return {
        invite: {
            code:
                typeof isObjectSettings?.invite?.code === "string"
                    ? isObjectSettings.invite.code
                    : "",
            approvalRequired:
                typeof isObjectSettings?.invite?.approvalRequired === "boolean"
                    ? isObjectSettings.invite.approvalRequired
                    : true,
        },
        joinRequests: Array.isArray(isObjectSettings?.joinRequests)
            ? isObjectSettings.joinRequests
            : [],
        permissions: {
            sendMedia:
                typeof isObjectSettings?.permissions?.sendMedia === "string"
                    ? isObjectSettings.permissions.sendMedia
                    : "all",
            pinMessage:
                typeof isObjectSettings?.permissions?.pinMessage === "string"
                    ? isObjectSettings.permissions.pinMessage
                    : conversationType === "group"
                        ? "admin_deputy"
                        : "all",
            sendAnnouncement:
                typeof isObjectSettings?.permissions?.sendAnnouncement === "string"
                    ? isObjectSettings.permissions.sendAnnouncement
                    : conversationType === "group"
                        ? "admin_deputy"
                        : "all",
        },
        pinnedMessage: isObjectSettings?.pinnedMessage || null,
    };
};

const buildPinnedMessagePayload = (message, userId) => ({
    messageId: message._id,
    senderId: message.senderId,
    type: message.type,
    content: message.content,
    metadata: message.metadata || null,
    pinnedAt: new Date().toISOString(),
    pinnedBy: userId,
});

const createConversation = async (req, res) => {
    try {
        const senderId = req.user.userId;
        const { participantIds, type } = req.body;

        let participants = [];
        if (participantIds) {
            const allUserIds = [...new Set([String(senderId), ...(participantIds || []).map(String)])];

            participants = allUserIds.map((uid) => ({
                userId: uid,
                role: uid === String(senderId) && type === "group" ? "admin" : "member",
                joinedAt: new Date().toISOString(),
                isMuted: false,
                muteUntil: null
            }));
        }

        const conversationData = {
            ...req.body,
            participants,
            createdBy: senderId
        };

        const conversation = await conversationService.createConversation(conversationData);
        const populated = await populateParticipants(conversation);
        res.json({ ...populated, id: populated._id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getConversation = async (req, res) => {
    try {
        const conversation = await conversationService.getConversation(req.params.id);
        if (!conversation) return res.status(404).json({ message: "Conversation not found" });

        const normalizedConversation = await persistNormalizedConversation(conversation);
        const populated = await populateParticipants(normalizedConversation);
        res.json({ ...populated, id: populated._id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getConversations = async (req, res) => {
    try {
        const userId = req.user.userId;
        const conversations = await conversationService.getConversations(userId);
        const normalizedConversations = await Promise.all(
            conversations.map((conversation) => persistNormalizedConversation(conversation))
        );
        const populated = await populateParticipants(normalizedConversations);
        const mapped = populated.map((conversation) => ({ ...conversation, id: conversation._id }));
        res.json(mapped);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const summarizeConversationInDay = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const conversationId = req.params?.id;
        const { date, tzOffsetMinutes } = req.query || {};

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const data = await summarizeTodayConversation({
            conversationId,
            userId,
            date,
            tzOffsetMinutes,
        });

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to summarize conversation",
        });
    }
};

const updateConversation = async (req, res) => {
    try {
        const conversation = await conversationService.updateConversation(req.params.id, req.body);
        res.json(conversation);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteConversation = async (req, res) => {
    try {
        const conversation = await conversationService.deleteConversation(req.params.id);
        res.json(conversation);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateParticipantSetting = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, isPinned, isMuted, muteUntil, nickname, labelIds, isHidden } = req.body;

        const conversation = await conversationService.getConversation(id);
        if (!conversation) return res.status(404).json({ message: "Conversation not found" });

        const participants = [...(conversation.participants || [])];
        const participantIndex = participants.findIndex((participant) => participant.userId === userId);

        if (participantIndex === -1) {
            return res.status(403).json({ message: "User is not in this conversation" });
        }

        if (isPinned !== undefined) participants[participantIndex].isPinned = isPinned;
        if (nickname !== undefined) participants[participantIndex].nickname = nickname;
        if (labelIds !== undefined) participants[participantIndex].labelIds = labelIds;
        if (isHidden !== undefined) participants[participantIndex].isHidden = isHidden;

        if (isMuted !== undefined || muteUntil !== undefined) {
            const nextIsMuted = Boolean(isMuted);

            if (!nextIsMuted) {
                participants[participantIndex].isMuted = false;
                participants[participantIndex].muteUntil = null;
            } else if (muteUntil === null || muteUntil === undefined || muteUntil === "") {
                participants[participantIndex].isMuted = true;
                participants[participantIndex].muteUntil = null;
            } else {
                const parsedMuteUntil = Date.parse(muteUntil);
                if (!Number.isFinite(parsedMuteUntil)) {
                    return res.status(400).json({ message: "muteUntil is invalid" });
                }

                if (parsedMuteUntil <= Date.now()) {
                    participants[participantIndex].isMuted = false;
                    participants[participantIndex].muteUntil = null;
                } else {
                    participants[participantIndex].isMuted = true;
                    participants[participantIndex].muteUntil = new Date(parsedMuteUntil).toISOString();
                }
            }
        }

        const updated = await conversationService.updateConversation(id, { participants });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const pinMessage = async (req, res) => {
    try {
        const conversationId = String(req.params.id || "");
        const requesterId = String(req.user?.userId || "");
        const messageId = String(req.body?.messageId || "");

        if (!messageId) {
            return res.status(400).json({ message: "messageId is required" });
        }

        const conversation = await conversationService.getConversation(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        if (conversation.type !== "private") {
            return res.status(400).json({
                message: "Use group pin API for group conversations",
            });
        }

        const isParticipant = Array.isArray(conversation.participants)
            && conversation.participants.some(
                (participant) => String(participant.userId) === requesterId,
            );

        if (!isParticipant) {
            return res.status(403).json({ message: "User is not in this conversation" });
        }

        const message = await messageService.getMessage(messageId);
        if (!message || String(message.conversationId) !== conversationId) {
            return res.status(404).json({ message: "Message not found in this conversation" });
        }

        if (message.isDeleted) {
            return res.status(400).json({ message: "Cannot pin a deleted message" });
        }

        const nextSettings = normalizeConversationPinnedSettings(
            conversation.groupSettings,
            "private",
        );
        const pinnedMessage = buildPinnedMessagePayload(message, requesterId);
        nextSettings.pinnedMessage = pinnedMessage;

        const updatedConversation = await conversationService.updateConversation(conversationId, {
            groupSettings: nextSettings,
        });

        const io = req.app.get("io");
        if (io) {
            io.to(`conv:${conversationId}`).emit("chat:pinned_message", {
                conversationId,
                pinnedMessage,
                updatedBy: requesterId
            });
        }

        // CREATE SYSTEM MESSAGE
        let displayType = "tin nhắn";
        if (message.type === "image") displayType = "ảnh";
        else if (message.type === "video") displayType = "video";
        else if (message.type === "file") displayType = "file";
        else if (message.type === "sticker") displayType = "sticker";

        void createSystemMessage(req, conversationId, `đã ghim một ${displayType}`, {
            action: 'pin',
            pinnedMessageId: messageId
        });

        return res.json({
            message: "Message pinned successfully",
            pinnedMessage,
            conversation: updatedConversation,
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const unpinMessage = async (req, res) => {
    try {
        const conversationId = String(req.params.id || "");
        const requesterId = String(req.user?.userId || "");

        const conversation = await conversationService.getConversation(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        if (conversation.type !== "private") {
            return res.status(400).json({
                message: "Use group unpin API for group conversations",
            });
        }

        const isParticipant = Array.isArray(conversation.participants)
            && conversation.participants.some(
                (participant) => String(participant.userId) === requesterId,
            );

        if (!isParticipant) {
            return res.status(403).json({ message: "User is not in this conversation" });
        }

        const nextSettings = normalizeConversationPinnedSettings(
            conversation.groupSettings,
            "private",
        );
        nextSettings.pinnedMessage = null;

        const updatedConversation = await conversationService.updateConversation(conversationId, {
            groupSettings: nextSettings,
        });

        const io = req.app.get("io");
        if (io) {
            io.to(`conv:${conversationId}`).emit("chat:pinned_message", {
                conversationId,
                pinnedMessage: null,
                updatedBy: requesterId
            });
        }

        // CREATE SYSTEM MESSAGE
        let displayPreview = "tin nhắn";
        try {
            const previousPin = conversation?.groupSettings?.pinnedMessage;
            if (previousPin) {
                if (previousPin.type === "text") {
                    const txt = String(previousPin.content?.text || previousPin.content || "").trim();
                    displayPreview = txt ? `"${txt.substring(0, 20)}${txt.length > 20 ? "..." : ""}"` : "tin nhắn";
                } else if (previousPin.type === "image") displayPreview = "hình ảnh";
                else if (previousPin.type === "video") displayPreview = "video";
                else if (previousPin.type === "file") displayPreview = "tài liệu";
                else if (previousPin.type === "sticker") displayPreview = "sticker";
            }
        } catch (e) {
            console.error("Error fetching previous pin info:", e);
        }

        void createSystemMessage(req, conversationId, `đã bỏ ghim ${displayPreview}`, {
            action: 'unpin'
        });

        return res.json({
            message: "Pinned message cleared",
            conversation: updatedConversation,
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createConversation,
    getConversation,
    getConversations,
    summarizeConversationInDay,
    updateConversation,
    deleteConversation,
    updateParticipantSetting,
    pinMessage,
    unpinMessage,
};
