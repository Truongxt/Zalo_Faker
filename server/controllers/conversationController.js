const conversationService = require("../services/conversationService")
const userRepository = require("../repository/userRepository")

const populateParticipants = async (conversations) => {
    const isArray = Array.isArray(conversations);
    const convList = isArray ? conversations : [conversations];
    
    // Collect all unique user IDs from all conversations
    const userIds = new Set();
    convList.forEach(c => {
        if (c.participants) {
            c.participants.forEach(p => userIds.add(String(p.userId)));
        }
    });

    // Fetch user details for all unique IDs
    const userMap = {};
    await Promise.all(Array.from(userIds).map(async (uid) => {
        const user = await userRepository.getById(uid);
        if (user) {
            userMap[uid] = {
                fullName: user.fullName || user.userName || 'Người dùng',
                avatarUrl: user.avatarUrl || user.avartarUrl || null,
                status: user.presenceStatus || 'offline',
                // Keep identifiers consistent
                userId: String(uid)
            };
        }
    }));

    // Attach details back to participants
    convList.forEach(c => {
        if (c.participants) {
            c.participants = c.participants.map(p => ({
                ...p,
                ...(userMap[String(p.userId)] || {})
            }));
        }
    });

    return isArray ? convList : convList[0];
};

const createConversation = async (req, res) => {
    try {
        const senderId = req.user.userId;
        const { participantIds, type, name, avatar, background, groupSettings } = req.body;
        
        let participants = [];
        if (participantIds) {
            // Ensure unique IDs, including the sender
            const allUserIds = [...new Set([String(senderId), ...(participantIds || []).map(String)])];
            
            participants = allUserIds.map(uid => ({
                userId: uid,
                role: uid === String(senderId) && type === 'group' ? 'admin' : 'member',
                joinedAt: new Date().toISOString()
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
}

const getConversation = async (req, res) => {
    try {
        const conversation = await conversationService.getConversation(req.params.id);
        if (!conversation) return res.status(404).json({ message: "Conversation not found" });
        const populated = await populateParticipants(conversation);
        res.json({ ...populated, id: populated._id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const getConversations = async (req, res) => {
    try {
        const userId = req.user.userId;
        const conversations = await conversationService.getConversations(userId);
        const populated = await populateParticipants(conversations);
        const mapped = populated.map(conv => ({ ...conv, id: conv._id }));
        res.json(mapped);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const updateConversation = async (req, res) => {
    try {
        const conversation = await conversationService.updateConversation(req.params.id, req.body)
        res.json(conversation)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const deleteConversation = async (req, res) => {
    try {
        const conversation = await conversationService.deleteConversation(req.params.id)
        res.json(conversation)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const updateParticipantSetting = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, isPinned, isMuted, nickname, labelIds } = req.body;

        const conversation = await conversationService.getConversation(id);
        if (!conversation) return res.status(404).json({ message: "Conversation not found" });

        const participants = [...(conversation.participants || [])];
        const participantIndex = participants.findIndex(p => p.userId === userId);
        
        if (participantIndex === -1) {
            return res.status(403).json({ message: "User is not in this conversation" });
        }

        // Cập nhật các trường
        if (isPinned !== undefined) participants[participantIndex].isPinned = isPinned;
        if (isMuted !== undefined) participants[participantIndex].isMuted = isMuted;
        if (nickname !== undefined) participants[participantIndex].nickname = nickname;
        if (labelIds !== undefined) participants[participantIndex].labelIds = labelIds;

        const updated = await conversationService.updateConversation(id, { participants });
        res.json(updated);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// const getConversationsByUserId = async (req, res) => {
//     try {
//         const conversations = await conversationService.getConversationsByUserId(req.params.userId)
//         res.json(conversations)
//     } catch (error) {
//         res.status(500).json({ message: error.message })
//     }
// }

module.exports = {
    createConversation,
    getConversation,
    getConversations,
    updateConversation,
    deleteConversation,
    updateParticipantSetting
}