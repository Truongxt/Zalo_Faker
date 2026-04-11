const conversationService = require("../services/conversationService");
const userRepository = require("../repository/userRepository");

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
        const { userId, isPinned, isMuted, muteUntil, nickname, labelIds } = req.body;

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

module.exports = {
    createConversation,
    getConversation,
    getConversations,
    updateConversation,
    deleteConversation,
    updateParticipantSetting
};
